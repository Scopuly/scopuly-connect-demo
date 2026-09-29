import { MAX_FEE_STROOPS, NETWORKS, type NetworkId } from "./config";
import { DemoError, explainError } from "./errors";
import {
  horizon,
  HorizonError,
  type AccountInfo,
  type HorizonClient,
  type Receipt,
} from "./horizon";
import {
  assertAddress,
  assertNetwork,
  assertNotExpired,
  prepareTransaction,
  verifySignedTransaction,
  type PreparedTransaction,
} from "./stellar";
import type {
  ConnectionMode,
  WalletAdapter,
  WalletFactory,
  WalletSnapshot,
} from "./wallet";

export type Phase =
  | "idle"
  | "connecting"
  | "loading"
  | "funding"
  | "preparing"
  | "signing"
  | "submitting"
  | "checking"
  | "disconnecting";
export interface Trace {
  id: number;
  time: string;
  method: string;
  status: "pending" | "success" | "error";
  request: unknown;
  response?: unknown;
}
export interface Submission {
  network: NetworkId;
  hash: string;
  status: "unknown" | "success" | "failed";
  ledger?: number;
}
export interface DemoState {
  network: NetworkId;
  mode: ConnectionMode;
  phase: Phase;
  session: WalletSnapshot | null;
  account: AccountInfo | null;
  prepared: PreparedTransaction | null;
  signedXdr: string | null;
  submission: Submission | null;
  mainnetAcknowledged: boolean;
  notice: { tone: "info" | "error" | "success"; message: string } | null;
  traces: Trace[];
}

async function walletDeadline<T>(
  promise: Promise<T>,
  onLateResult?: () => void,
): Promise<T> {
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(
        new DemoError(
          "The wallet did not respond within two minutes. Close any pending wallet request, disconnect, then reconnect. Nothing was submitted by this demo.",
          "WALLET_TIMEOUT",
        ),
      );
    }, 120_000);
  });
  promise.then(
    () => {
      if (timedOut) onLateResult?.();
    },
    () => {
      if (timedOut) onLateResult?.();
    },
  );
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function createController(
  walletFactory: WalletFactory,
  api: HorizonClient = horizon,
) {
  let state: DemoState = {
    network: "testnet",
    mode: "swk",
    phase: "idle",
    session: null,
    account: null,
    prepared: null,
    signedXdr: null,
    submission: null,
    mainnetAcknowledged: false,
    notice: null,
    traces: [],
  };
  let adapter: WalletAdapter | null = null;
  let unsubscribeWallet: (() => void) | undefined;
  let revision = 0;
  let traceId = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<DemoState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const isBusy = () => state.phase !== "idle";
  const ensureMainnetAcknowledged = () => {
    if (state.network === "mainnet" && !state.mainnetAcknowledged)
      throw new DemoError(
        "Confirm that you understand the real XLM network fee before using Mainnet.",
      );
  };
  const ensureCurrent = async (
    expectedRevision: number,
  ): Promise<WalletSnapshot> => {
    if (!adapter || !state.session)
      throw new DemoError("Connect your wallet before continuing.");
    const snapshot = await walletDeadline(adapter.current());
    if (
      revision !== expectedRevision ||
      !state.session ||
      snapshot.address !== state.session.address
    ) {
      throw new DemoError(
        "The wallet account changed. Reconnect and prepare a new transaction.",
      );
    }
    assertAddress(snapshot.address);
    assertNetwork(state.network, snapshot.networkPassphrase);
    return snapshot;
  };
  const trace = async <T>(
    method: string,
    request: unknown,
    action: () => Promise<T>,
  ): Promise<T> => {
    const id = ++traceId;
    update({
      traces: [
        ...state.traces.slice(-39),
        {
          id,
          time: new Date().toISOString(),
          method,
          request,
          status: "pending",
        },
      ],
    });
    try {
      const response = await action();
      update({
        traces: state.traces.map((item) =>
          item.id === id
            ? { ...item, status: "success", response: response ?? { ok: true } }
            : item,
        ),
      });
      return response;
    } catch (error) {
      update({
        traces: state.traces.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "error",
                response: { message: explainError(error) },
              }
            : item,
        ),
      });
      throw error;
    }
  };
  const run = async (
    phase: Phase,
    action: (currentRevision: number) => Promise<void>,
  ) => {
    if (isBusy()) return;
    update({ phase, notice: null });
    try {
      await action(revision);
    } catch (error) {
      if (error instanceof DemoError && error.code === "WALLET_TIMEOUT") {
        revision++;
        update({
          session: null,
          account: null,
          prepared: null,
          signedXdr: null,
        });
      }
      update({ notice: { tone: "error", message: explainError(error) } });
    } finally {
      update({ phase: "idle" });
    }
  };
  const clearConnection = async () => {
    revision++;
    unsubscribeWallet?.();
    unsubscribeWallet = undefined;
    const previous = adapter;
    adapter = null;
    update({ session: null, account: null, prepared: null, signedXdr: null });
    if (previous) await walletDeadline(previous.disconnect());
  };
  const recordReceipt = (network: NetworkId, result: Receipt) => {
    update({
      submission: {
        network,
        hash: result.hash,
        status: result.successful ? "success" : "failed",
        ledger: result.ledger,
      },
      notice: {
        tone: result.successful ? "success" : "error",
        message: result.successful
          ? `Confirmed on ${NETWORKS[network].label} in ledger ${result.ledger.toLocaleString("en-US")}. Your self-payment is complete.`
          : "The transaction was included but failed. A network fee may have been charged. Inspect the result in the explorer.",
      },
    });
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acknowledgeMainnet(value: boolean) {
      if (!isBusy()) update({ mainnetAcknowledged: value });
    },
    selectMode(mode: ConnectionMode) {
      return run("disconnecting", async () => {
        if (state.submission?.status === "unknown")
          throw new DemoError(
            "Check the pending transaction status before changing the connection.",
          );
        await clearConnection();
        update({ mode, submission: null, notice: null });
      });
    },
    selectNetwork(network: NetworkId) {
      return run("disconnecting", async () => {
        if (state.submission?.status === "unknown")
          throw new DemoError(
            "Check the pending transaction status before changing networks.",
          );
        await clearConnection();
        update({
          network,
          mainnetAcknowledged: false,
          submission: null,
          notice: {
            tone: "info",
            message: `${NETWORKS[network].label} selected. Select the same network in Scopuly, then connect.`,
          },
        });
      });
    },
    connect() {
      return run("connecting", async () => {
        if (state.submission?.status === "unknown")
          throw new DemoError(
            "Check the pending transaction status before reconnecting.",
          );
        if (adapter) await clearConnection();
        const target = await walletFactory(state.mode, state.network);
        adapter = target;
        try {
          const snapshot = await trace(
            state.mode === "provider"
              ? "scopuly.requestAccess() + getNetwork()"
              : "StellarWalletsKit.fetchAddress()",
            { mode: state.mode, network: NETWORKS[state.network].label },
            () =>
              walletDeadline(target.connect(), () => {
                void target.disconnect().catch(() => {});
              }),
          );
          assertAddress(snapshot.address);
          assertNetwork(state.network, snapshot.networkPassphrase);
          update({
            session: snapshot,
            submission: null,
            notice: {
              tone: "success",
              message:
                "Connected. Your public address is shared; your private keys stay in Scopuly.",
            },
          });
          unsubscribeWallet = target.subscribe((snapshot) => {
            if (
              state.session &&
              (!snapshot ||
                snapshot.address !== state.session.address ||
                snapshot.networkPassphrase !== state.session.networkPassphrase)
            ) {
              revision++;
              update({
                session: null,
                account: null,
                prepared: null,
                signedXdr: null,
                mainnetAcknowledged: false,
                notice: {
                  tone: "error",
                  message:
                    "The wallet account, network, or session changed. Reconnect before preparing another transaction.",
                },
              });
            }
          });
        } catch (error) {
          await clearConnection().catch(() => {});
          throw error;
        }
      });
    },
    disconnect() {
      return run("disconnecting", async () => {
        await clearConnection();
        update({
          notice: {
            tone: "info",
            message:
              "Disconnected. You may also revoke this site in your wallet settings.",
          },
        });
      });
    },
    refreshAccount() {
      return run("loading", async (token) => {
        const { address } = await ensureCurrent(token);
        const account = await trace(
          "GET /accounts/{address}",
          { network: state.network, address },
          () => api.account(state.network, address),
        );
        if (revision !== token) return;
        update({
          account,
          notice: {
            tone: "info",
            message: account
              ? "Account loaded. You can prepare a self-payment."
              : state.network === "testnet"
                ? "No Testnet account yet. Use Friendbot to create and fund it with free test XLM."
                : "This account is not funded on Mainnet. Fund it separately before continuing. This demo never buys or transfers funds to activate it.",
          },
        });
      });
    },
    fund() {
      return run("funding", async (token) => {
        if (state.network !== "testnet")
          throw new DemoError("Friendbot is available on Testnet only.");
        const { address } = await ensureCurrent(token);
        const existing = await api.account("testnet", address);
        if (!existing)
          await trace(
            "GET friendbot.stellar.org",
            { address, network: "testnet" },
            () => api.fund("testnet", address),
          );
        const account = existing ?? (await api.account("testnet", address));
        if (revision !== token) return;
        update({
          account,
          notice: {
            tone: "success",
            message: existing
              ? "Your Testnet account is already funded. No Friendbot request was sent."
              : account
                ? "Test XLM received. These funds have no monetary value."
                : "Friendbot accepted the request. Refresh the account in a few seconds.",
          },
        });
      });
    },
    prepare() {
      return run("preparing", async (token) => {
        ensureMainnetAcknowledged();
        if (state.submission?.status === "unknown")
          throw new DemoError(
            "Check the previous transaction status before preparing another transaction.",
          );
        update({ prepared: null, signedXdr: null, submission: null });
        const { address } = await ensureCurrent(token);
        const network = state.network;
        const account = await trace(
          "GET /accounts/{address}",
          { network, address },
          () => api.account(network, address),
        );
        if (revision !== token) return;
        update({ account });
        if (!account)
          throw new DemoError(
            `This account is not funded on ${NETWORKS[network].label}. Complete the funding step first.`,
          );
        const prepared = await trace(
          "TransactionBuilder.build()",
          {
            network,
            source: address,
            destination: address,
            asset: "XLM",
            amount: NETWORKS[network].demoAmount,
            feeStroops: MAX_FEE_STROOPS,
            memo: "Scopuly connect demo",
            timeoutSeconds: 300,
          },
          async () => prepareTransaction(network, address, account.sequence),
        );
        update({
          prepared,
          notice: {
            tone: "info",
            message: `Review the transaction below. It sends ${NETWORKS[network].demoAmount} XLM back to the same account; only the network fee reduces your balance.`,
          },
        });
      });
    },
    sign() {
      return run("signing", async (token) => {
        ensureMainnetAcknowledged();
        const prepared = state.prepared;
        if (!prepared || !adapter)
          throw new DemoError("Prepare a transaction first.");
        if (state.submission)
          throw new DemoError(
            "Prepare a new transaction before requesting another signature.",
          );
        await ensureCurrent(token);
        assertNotExpired(prepared);
        update({ signedXdr: null });
        const result = await trace(
          state.mode === "provider"
            ? "scopuly.signTransaction()"
            : "StellarWalletsKit.signTransaction()",
          {
            xdr: prepared.unsignedXdr,
            address: prepared.address,
            networkPassphrase: NETWORKS[prepared.network].passphrase,
          },
          () =>
            walletDeadline(
              adapter!.sign(prepared.unsignedXdr, prepared.address),
            ),
        );
        await ensureCurrent(token);
        const signedXdr = verifySignedTransaction(
          prepared,
          result.signedTxXdr,
          result.signerAddress,
        );
        update({
          signedXdr,
          notice: {
            tone: "success",
            message:
              "Signature verified locally. The transaction has not been sent. Submit when you are ready.",
          },
        });
      });
    },
    submit() {
      return run("submitting", async (token) => {
        ensureMainnetAcknowledged();
        const { prepared, signedXdr } = state;
        if (!prepared || !signedXdr)
          throw new DemoError("Sign a transaction first.");
        if (state.submission)
          throw new DemoError(
            "This transaction was already submitted. Check its status instead of submitting again.",
          );
        await ensureCurrent(token);
        verifySignedTransaction(prepared, signedXdr);
        const account = await api.account(prepared.network, prepared.address);
        if (!account || account.sequence !== prepared.sequence) {
          update({ prepared: null, signedXdr: null });
          throw new DemoError(
            "The account sequence changed. Prepare a new transaction and sign it again.",
          );
        }
        await ensureCurrent(token);
        assertNotExpired(prepared);
        update({
          submission: {
            network: prepared.network,
            hash: prepared.hash,
            status: "unknown",
          },
        });
        try {
          const result = await trace(
            "POST /transactions",
            { network: prepared.network, tx: signedXdr, hash: prepared.hash },
            () => api.submit(prepared.network, signedXdr, prepared.hash),
          );
          recordReceipt(prepared.network, result);
        } catch (error) {
          if (
            error instanceof HorizonError &&
            error.status === 400 &&
            error.resultCode
          ) {
            update({
              submission: {
                network: prepared.network,
                hash: prepared.hash,
                status: "failed",
              },
            });
            throw error;
          }
          update({
            notice: {
              tone: "error",
              message:
                "Submission status is unknown. The transaction may already be in the ledger. Use Check status or the explorer; do not submit another transaction yet.",
            },
          });
        }
      });
    },
    checkStatus() {
      return run("checking", async () => {
        const pending = state.submission;
        if (!pending)
          throw new DemoError("There is no submitted transaction to check.");
        const result = await trace(
          "GET /transactions/{hash}",
          { network: pending.network, hash: pending.hash },
          () => api.transaction(pending.network, pending.hash),
        );
        if (result) recordReceipt(pending.network, result);
        else
          update({
            notice: {
              tone: "info",
              message:
                "The transaction is not indexed yet. Wait a few seconds, then check again. A missing result does not prove that submission failed.",
            },
          });
      });
    },
    clearTraces() {
      if (!isBusy()) update({ traces: [] });
    },
  };
}

export type DemoController = ReturnType<typeof createController>;
