import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { horizon } from "./horizon";

const address = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey();
const hash = "a".repeat(64);
afterEach(() => vi.unstubAllGlobals());

describe("Horizon network routing", () => {
  it.each(["testnet", "mainnet"] as const)(
    "submits only to the selected %s endpoint",
    async (network) => {
      const fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ hash, successful: true, ledger: 12 })),
      );
      vi.stubGlobal("fetch", fetch);
      await horizon.submit(network, "signed+xdr=", hash);
      expect(fetch.mock.calls[0]).toEqual([
        network === "testnet"
          ? "https://horizon-testnet.stellar.org/transactions"
          : "https://horizon.stellar.org/transactions",
        expect.objectContaining({ method: "POST", body: "tx=signed%2Bxdr%3D" }),
      ]);
    },
  );
  it("never calls Friendbot for Mainnet", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(horizon.fund("mainnet", address)).rejects.toThrow(
      "Testnet only",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("handles a missing account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    await expect(horizon.account("testnet", address)).resolves.toBeNull();
  });
  it("rejects a receipt for a different transaction hash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              hash: "b".repeat(64),
              successful: true,
              ledger: 12,
            }),
          ),
      ),
    );
    await expect(horizon.submit("testnet", "xdr", hash)).rejects.toThrow(
      "unexpected transaction",
    );
  });
});
