import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { createController } from "./controller";
import { NETWORKS, type NetworkId } from "./config";
import { HorizonError, type HorizonClient } from "./horizon";
import type { WalletAdapter, WalletSnapshot } from "./wallet";

const key = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
const account = {
  address: key.publicKey(),
  balance: "10000.0000000",
  sequence: "42",
};
let network: NetworkId;
let changed: (snapshot: WalletSnapshot | null) => void;
let wallet: WalletAdapter;
let api: HorizonClient;

beforeEach(() => {
  network = "testnet";
  const snapshot = () => ({
    address: key.publicKey(),
    networkPassphrase: NETWORKS[network].passphrase,
  });
  wallet = {
    connect: vi.fn(async () => snapshot()),
    current: vi.fn(async () => snapshot()),
    sign: vi.fn(async (xdr) => {
      const tx = TransactionBuilder.fromXDR(
        xdr,
        NETWORKS[network].passphrase,
      ) as Transaction;
      tx.sign(key);
      return { signedTxXdr: tx.toXDR(), signerAddress: key.publicKey() };
    }),
    disconnect: vi.fn(async () => {}),
    subscribe(callback) {
      changed = callback;
      return () => {};
    },
  };
  api = {
    account: vi.fn(async () => account),
    fund: vi.fn(async () => {}),
    submit: vi.fn(async (_network, _xdr, hash) => ({
      hash,
      ledger: 500,
      successful: true,
    })),
    transaction: vi.fn(async () => null),
  };
});

describe("demo flow", () => {
  it("requires a separate submit action and prevents duplicate submissions", async () => {
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    expect(demo.getSnapshot().signedXdr).toBeTruthy();
    expect(api.submit).not.toHaveBeenCalled();
    await demo.submit();
    await demo.submit();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(demo.getSnapshot().submission).toMatchObject({
      network: "testnet",
      status: "success",
      ledger: 500,
    });
  });
  it("guards Mainnet spending and never invokes Friendbot there", async () => {
    const demo = createController(async () => wallet, api);
    await demo.selectNetwork("mainnet");
    network = "mainnet";
    await demo.connect();
    await demo.fund();
    expect(api.fund).not.toHaveBeenCalled();
    await demo.prepare();
    expect(demo.getSnapshot().prepared).toBeNull();
    demo.acknowledgeMainnet(true);
    await demo.prepare();
    expect(demo.getSnapshot().notice?.message).toContain(
      "0.01 XLM back to the same account",
    );
    expect(
      demo
        .getSnapshot()
        .traces.find((entry) => entry.method === "TransactionBuilder.build()")
        ?.request,
    ).toMatchObject({
      source: key.publicKey(),
      destination: key.publicKey(),
      amount: "0.01",
      feeStroops: "1000",
    });
    await demo.sign();
    await demo.submit();
    expect(api.submit).toHaveBeenCalledWith(
      "mainnet",
      expect.any(String),
      expect.any(String),
    );
  });
  it("clears connection and signed XDR on a network switch", async () => {
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    await demo.selectNetwork("mainnet");
    expect(wallet.disconnect).toHaveBeenCalled();
    expect(demo.getSnapshot()).toMatchObject({
      network: "mainnet",
      session: null,
      signedXdr: null,
      prepared: null,
      mainnetAcknowledged: false,
    });
    await demo.submit();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("refuses to connect when the wallet network differs", async () => {
    network = "mainnet";
    const demo = createController(async () => wallet, api);
    await demo.connect();
    expect(demo.getSnapshot().session).toBeNull();
    expect(demo.getSnapshot().notice?.message).toContain("same network");
  });
  it("invalidates reviewed data on an account change", async () => {
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    changed(null);
    await demo.sign();
    expect(wallet.sign).not.toHaveBeenCalled();
    expect(demo.getSnapshot().prepared).toBeNull();
  });
  it("discards a late signature after a provider change", async () => {
    let finish!: (result: { signedTxXdr: string }) => void;
    wallet.sign = vi.fn(
      () =>
        new Promise<{ signedTxXdr: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    const action = demo.sign();
    await vi.waitFor(() => expect(wallet.sign).toHaveBeenCalled());
    changed(null);
    finish({ signedTxXdr: "must-be-discarded" });
    await action;
    expect(demo.getSnapshot().signedXdr).toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("handles rejection without signing or submitting", async () => {
    wallet.sign = vi.fn(async () => {
      throw { code: -4 };
    });
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    expect(demo.getSnapshot().notice?.message).toContain("declined");
    expect(demo.getSnapshot().signedXdr).toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("does not resubmit, reconnect, or switch networks after an ambiguous response", async () => {
    api.submit = vi.fn(async () => {
      throw new HorizonError("Timeout", 0);
    });
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    await demo.submit();
    expect(demo.getSnapshot().submission?.status).toBe("unknown");
    await demo.submit();
    await demo.prepare();
    await demo.selectNetwork("mainnet");
    await demo.connect();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(demo.getSnapshot().network).toBe("testnet");
    expect(demo.getSnapshot().submission?.status).toBe("unknown");
    api.transaction = vi.fn(async (_network, hash) => ({
      hash,
      ledger: 501,
      successful: true,
    }));
    await demo.checkStatus();
    expect(demo.getSnapshot().submission).toMatchObject({
      status: "success",
      ledger: 501,
    });
  });
  it("treats transaction-not-found as unknown, not failure", async () => {
    api.submit = vi.fn(async () => {
      throw new HorizonError("Timeout", 504);
    });
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    await demo.submit();
    await demo.checkStatus();
    expect(demo.getSnapshot().submission?.status).toBe("unknown");
    expect(demo.getSnapshot().notice?.message).toContain("does not prove");
  });
  it("invalidates a transaction when the account sequence changes", async () => {
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    api.account = vi.fn(async () => ({ ...account, sequence: "43" }));
    await demo.submit();
    expect(api.submit).not.toHaveBeenCalled();
    expect(demo.getSnapshot().signedXdr).toBeNull();
  });
  it("does not request Friendbot for an already funded account", async () => {
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.fund();
    expect(api.fund).not.toHaveBeenCalled();
    expect(demo.getSnapshot().account).toEqual(account);
  });
  it("distinguishes a definite Horizon rejection from an unknown submission", async () => {
    api.submit = vi.fn(async () => {
      throw new HorizonError("Insufficient fee", 400, "tx_insufficient_fee");
    });
    const demo = createController(async () => wallet, api);
    await demo.connect();
    await demo.prepare();
    await demo.sign();
    await demo.submit();
    expect(demo.getSnapshot().submission?.status).toBe("failed");
  });
});
