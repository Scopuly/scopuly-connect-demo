import * as providerApi from "@scopuly/signer-extension-api";
import type { ScopulyProvider } from "@scopuly/signer-extension-api";
import {
  NETWORKS,
  PROJECT_ID,
  WALLETCONNECT_CONFIGURED,
  type NetworkId,
} from "./config";
import { DemoError } from "./errors";
import { assertAddress, assertNetwork } from "./stellar";

export type ConnectionMode = "swk" | "provider" | "walletconnect";
export interface WalletSnapshot {
  address: string;
  networkPassphrase: string;
}
export interface WalletAdapter {
  connect(): Promise<WalletSnapshot>;
  current(): Promise<WalletSnapshot>;
  sign(
    xdr: string,
    address: string,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
  disconnect(): Promise<void>;
  subscribe(callback: (snapshot: WalletSnapshot | null) => void): () => void;
}
export type WalletFactory = (
  mode: ConnectionMode,
  network: NetworkId,
) => Promise<WalletAdapter>;

export function providerStatus(): "extension" | "mobile" | "missing" {
  const provider = window.scopuly;
  return provider?.isScopuly &&
    (provider.platform === "extension" || provider.platform === "mobile")
    ? provider.platform
    : "missing";
}

function unwrap<T>(
  result: T & { error?: { code?: number; message?: string } },
): T {
  if (result.error) throw result.error;
  return result;
}

function requireProvider(): ScopulyProvider {
  if (providerStatus() === "missing") {
    throw new DemoError(
      "Scopuly was not detected. Install and pair the extension, then reload this page, or open it in the Scopuly in-app browser.",
    );
  }
  return providerApi.getProvider();
}

let kitPromise:
  | Promise<typeof import("@creit.tech/stellar-wallets-kit/sdk")>
  | undefined;
const getKit = () =>
  (kitPromise ??= import("@creit.tech/stellar-wallets-kit/sdk"));
type WC =
  import("@creit.tech/stellar-wallets-kit/modules/wallet-connect").WalletConnectModule;
let wc: WC | undefined;
let activeOwner: symbol | undefined;

export const createWallet: WalletFactory = async (mode, network) => {
  const expected = NETWORKS[network];
  const owner = Symbol("wallet-session");
  if (mode !== "walletconnect") {
    const provider = requireProvider();
    const kit = mode === "swk" ? (await getKit()).StellarWalletsKit : undefined;
    if (kit) {
      (
        await import("@creit.tech/stellar-wallets-kit/state")
      ).resetWalletState();
      const { ScopulyModule, SCOPULY_ID } = await import(
        "@creit.tech/stellar-wallets-kit/modules/scopuly"
      );
      const { Networks } = await import(
        "@creit.tech/stellar-wallets-kit/types"
      );
      kit.init({
        modules: [new ScopulyModule()],
        network: network === "testnet" ? Networks.TESTNET : Networks.PUBLIC,
      });
      kit.setWallet(SCOPULY_ID);
    }
    activeOwner = owner;
    const current = async (): Promise<WalletSnapshot> => {
      if (window.scopuly !== provider || activeOwner !== owner)
        throw new DemoError(
          "The wallet provider changed. Reconnect before continuing.",
        );
      const { address } = unwrap(await provider.getAddress());
      const { networkPassphrase } = unwrap(await provider.getNetwork());
      assertAddress(address);
      assertNetwork(network, networkPassphrase);
      return { address, networkPassphrase };
    };
    return {
      async connect() {
        if (kit) await kit.fetchAddress();
        else unwrap(await providerApi.requestAccess());
        return current();
      },
      current,
      async sign(xdr, address) {
        const options = { address, networkPassphrase: expected.passphrase };
        return kit
          ? kit.signTransaction(xdr, options)
          : unwrap(await providerApi.signTransaction(xdr, options));
      },
      async disconnect() {
        // A late response from a timed-out connection must not revoke a newer one.
        if (activeOwner !== owner) return;
        activeOwner = undefined;
        try {
          await provider.disconnect();
        } finally {
          // SWK 2.7's disconnect is fire-and-forget. Await the provider before clearing kit state.
          if (kit)
            (
              await import("@creit.tech/stellar-wallets-kit/state")
            ).resetWalletState();
        }
      },
      subscribe(callback) {
        return provider.onChange((event) =>
          callback(
            event.address && event.isConnected !== false
              ? {
                  address: event.address,
                  networkPassphrase: event.networkPassphrase,
                }
              : null,
          ),
        );
      },
    };
  }

  if (!WALLETCONNECT_CONFIGURED) {
    throw new DemoError(
      "WalletConnect needs your Reown project ID. Set VITE_WALLETCONNECT_PROJECT_ID in .env.local and restart the demo. The other connection methods need no project ID.",
    );
  }
  const [
    { StellarWalletsKit: kit },
    { WalletConnectModule, WalletConnectTargetChain, WALLET_CONNECT_ID },
    { Networks },
  ] = await Promise.all([
    getKit(),
    import("@creit.tech/stellar-wallets-kit/modules/wallet-connect"),
    import("@creit.tech/stellar-wallets-kit/types"),
  ]);
  const chain =
    network === "testnet"
      ? WalletConnectTargetChain.TESTNET
      : WalletConnectTargetChain.PUBLIC;
  const { mainnet } = await import("@reown/appkit/networks");
  wc ??= new WalletConnectModule({
    projectId: PROJECT_ID,
    allowedChains: [chain],
    metadata: {
      name: "Scopuly Connect Lab",
      description: "An inspectable Stellar wallet integration demo.",
      url: window.location.origin,
      icons: [
        new URL(`${import.meta.env.BASE_URL}scopuly.svg`, window.location.href)
          .href,
      ],
    },
    // Match SWK's manual modal configuration; Stellar chains are negotiated above.
    appKitOptions: {
      projectId: PROJECT_ID,
      networks: [mainnet],
      features: { analytics: false },
    },
  });
  const module = wc;
  module.wcParams.allowedChains = [chain];
  const deadline = Date.now() + 20_000;
  while (!(await module.isAvailable())) {
    if (Date.now() > deadline)
      throw new DemoError(
        "WalletConnect did not initialize. Check your Reown project ID, allowed origins, and network connection.",
      );
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  (await import("@creit.tech/stellar-wallets-kit/state")).resetWalletState();
  kit.init({
    modules: [module],
    network: network === "testnet" ? Networks.TESTNET : Networks.PUBLIC,
  });
  kit.setWallet(WALLET_CONNECT_ID);
  activeOwner = owner;
  let connectedAddress = "";
  let topic = "";
  const ownedTopics = new Set<string>();
  const current = async (): Promise<WalletSnapshot> => {
    const session = (await module.getSessions()).find(
      (item) => item.topic === topic,
    );
    // WalletConnectModule has no getNetwork(). Validate the approved CAIP-10 account instead.
    if (
      activeOwner !== owner ||
      !session ||
      session.expiry <= Date.now() / 1000 ||
      !session.namespaces.stellar?.accounts.includes(
        `${expected.chain}:${connectedAddress}`,
      )
    ) {
      throw new DemoError(
        "The WalletConnect session is missing, expired, or uses another network. Reconnect to continue.",
      );
    }
    return {
      address: connectedAddress,
      networkPassphrase: expected.passphrase,
    };
  };
  return {
    async connect() {
      const previousTopics = new Set(
        (await module.getSessions()).map((session) => session.topic),
      );
      const { address } = await kit.fetchAddress();
      assertAddress(address);
      connectedAddress = address;
      const sessions = await module.getSessions();
      for (const session of sessions) {
        if (!previousTopics.has(session.topic)) ownedTopics.add(session.topic);
      }
      const session = [...sessions]
        .sort(
          (a, b) =>
            Number(previousTopics.has(a.topic)) -
            Number(previousTopics.has(b.topic)),
        )
        .find((item) =>
          item.namespaces.stellar?.accounts.includes(
            `${expected.chain}:${address}`,
          ),
        );
      topic = session?.topic ?? "";
      if (topic) ownedTopics.add(topic);
      return current();
    },
    current,
    sign: (xdr, address) =>
      kit.signTransaction(xdr, {
        address,
        networkPassphrase: expected.passphrase,
      }),
    async disconnect() {
      // Clear the active module first: upstream closeSession calls SWK disconnect recursively.
      if (activeOwner === owner) {
        activeOwner = undefined;
        module.modal.close();
        (
          await import("@creit.tech/stellar-wallets-kit/state")
        ).resetWalletState();
      }
      const sessions = (await module.getSessions()).filter((session) =>
        ownedTopics.has(session.topic),
      );
      await Promise.all(
        sessions.map((session) =>
          module.signClient.disconnect({
            topic: session.topic,
            reason: {
              code: 6000,
              message: "Disconnected from Scopuly Connect Lab",
            },
          }),
        ),
      );
    },
    subscribe(callback) {
      const invalidate = (event: { topic?: string }) => {
        if (event.topic === topic) callback(null);
      };
      const events = [
        "session_delete",
        "session_expire",
        "session_update",
        "session_event",
      ] as const;
      for (const event of events) module.signClient.on(event, invalidate);
      return () => {
        for (const event of events) module.signClient.off(event, invalidate);
      };
    },
  };
};
