import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk/base";

const fixture = vi.hoisted(() => ({
  address: "GBUQWP3HZZXWQFBKCBAHWXFILZQEYCD3KWJWFXO7YJF62IEEK27UMQYA",
  sessions: [] as {
    topic: string;
    expiry: number;
    namespaces: { stellar: { accounts: string[] } };
  }[],
  params: undefined as undefined | { allowedChains: string[] },
  disconnect: vi.fn(async () => {}),
  selected: "",
  wrongChain: false,
}));

vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  PROJECT_ID: "a".repeat(32),
  WALLETCONNECT_CONFIGURED: true,
}));
vi.mock("@creit.tech/stellar-wallets-kit/state", () => ({
  resetWalletState: vi.fn(),
}));
vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  Networks: {
    TESTNET: "Test SDF Network ; September 2015",
    PUBLIC: "Public Global Stellar Network ; September 2015",
  },
}));
vi.mock("@reown/appkit/networks", () => ({ mainnet: { id: 1 } }));
vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    setWallet: (id: string) => {
      fixture.selected = id;
    },
    async fetchAddress() {
      fixture.sessions.push({
        topic: "new-session",
        expiry: Date.now() / 1000 + 600,
        namespaces: {
          stellar: {
            accounts: [
              `${fixture.wrongChain ? "stellar:pubnet" : fixture.params!.allowedChains[0]}:${fixture.address}`,
            ],
          },
        },
      });
      return { address: fixture.address };
    },
    signTransaction: vi.fn(),
  },
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/wallet-connect", () => ({
  WALLET_CONNECT_ID: "wallet_connect",
  WalletConnectTargetChain: {
    TESTNET: "stellar:testnet",
    PUBLIC: "stellar:pubnet",
  },
  WalletConnectModule: class {
    constructor(public wcParams: { allowedChains: string[] }) {
      fixture.params = wcParams;
    }
    modal = { close: vi.fn() };
    signClient = { disconnect: fixture.disconnect, on: vi.fn(), off: vi.fn() };
    async isAvailable() {
      return true;
    }
    async getSessions() {
      return fixture.sessions;
    }
  },
}));

beforeEach(() => {
  fixture.address = Keypair.fromRawEd25519Seed(
    new Uint8Array(32).fill(7),
  ).publicKey();
  vi.resetModules();
  fixture.sessions = [];
  fixture.wrongChain = false;
  fixture.disconnect.mockClear();
  vi.stubGlobal("window", {
    location: {
      origin: "http://localhost:5186",
      href: "http://localhost:5186/",
    },
  });
});

describe("WalletConnect adapter session boundaries (mocked transport)", () => {
  it.each(["testnet", "mainnet"] as const)(
    "requests only the selected %s chain",
    async (network) => {
      const { createWallet } = await import("./wallet");
      const adapter = await createWallet("walletconnect", network);
      expect(fixture.params!.allowedChains).toEqual([
        network === "testnet" ? "stellar:testnet" : "stellar:pubnet",
      ]);
      expect(fixture.selected).toBe("wallet_connect");
      await expect(adapter.connect()).resolves.toHaveProperty(
        "address",
        fixture.address,
      );
    },
  );
  it("rejects a session approved for another network", async () => {
    fixture.wrongChain = true;
    const { createWallet } = await import("./wallet");
    const adapter = await createWallet("walletconnect", "testnet");
    await expect(adapter.connect()).rejects.toThrow("another network");
  });
  it("disconnects only its own session and preserves unrelated sessions", async () => {
    fixture.sessions.push({
      topic: "unrelated",
      expiry: Date.now() / 1000 + 600,
      namespaces: {
        stellar: { accounts: [`stellar:testnet:${fixture.address}`] },
      },
    });
    const { createWallet } = await import("./wallet");
    const adapter = await createWallet("walletconnect", "testnet");
    await adapter.connect();
    await adapter.disconnect();
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    expect(fixture.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "new-session" }),
    );
  });
});
