import { describe, expect, it } from "vitest";
import { Keypair, TransactionBuilder, Transaction } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { NETWORKS } from "./config";
import {
  assertNetwork,
  assertNotExpired,
  prepareTransaction,
  verifySignedTransaction,
} from "./stellar";

// Deterministic, disposable test key. Never used by the production application.
const key = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8));

describe("transaction boundaries", () => {
  it.each(["testnet", "mainnet"] as const)(
    "builds a bounded native self-payment on %s",
    (network) => {
      const prepared = prepareTransaction(network, key.publicKey(), "42");
      const tx = TransactionBuilder.fromXDR(
        prepared.unsignedXdr,
        NETWORKS[network].passphrase,
      ) as Transaction;
      expect(tx.source).toBe(key.publicKey());
      expect(tx.sequence).toBe("43");
      expect(tx.fee).toBe("100");
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0]).toMatchObject({
        type: "payment",
        destination: key.publicKey(),
        amount: "1.0000000",
      });
      expect(tx.timeBounds?.maxTime).toBe(String(prepared.expiresAt));
      tx.sign(key);
      expect(
        verifySignedTransaction(prepared, tx.toXDR(), key.publicKey()),
      ).toBe(tx.toXDR());
    },
  );
  it("rejects a wrong network before signing", () => {
    expect(() => assertNetwork("testnet", NETWORKS.mainnet.passphrase)).toThrow(
      "same network",
    );
    expect(() => assertNetwork("mainnet", NETWORKS.testnet.passphrase)).toThrow(
      "same network",
    );
  });
  it("rejects an invalid account or sequence", () => {
    expect(() => prepareTransaction("testnet", "not-an-address", "0")).toThrow(
      "invalid",
    );
    expect(() => prepareTransaction("testnet", key.publicKey(), "-1")).toThrow(
      "sequence",
    );
  });
  it("rejects expired, empty, tampered and wrong-signer responses", () => {
    const original = prepareTransaction("testnet", key.publicKey(), "4");
    const tx = TransactionBuilder.fromXDR(
      original.unsignedXdr,
      NETWORKS.testnet.passphrase,
    ) as Transaction;
    expect(() => assertNotExpired(original, original.expiresAt * 1000)).toThrow(
      "expired",
    );
    expect(() => verifySignedTransaction(original, "invalid")).toThrow(
      "invalid",
    );
    expect(() =>
      verifySignedTransaction(original, original.unsignedXdr),
    ).toThrow("signature");
    tx.sign(other);
    expect(() => verifySignedTransaction(original, tx.toXDR())).toThrow(
      "signature",
    );
    expect(() =>
      verifySignedTransaction(original, tx.toXDR(), other.publicKey()),
    ).toThrow("different");
    const different = prepareTransaction("testnet", key.publicKey(), "5");
    expect(() =>
      verifySignedTransaction(original, different.unsignedXdr),
    ).toThrow("does not match");
  });
  it("rejects a valid signature made for another network", () => {
    const original = prepareTransaction("testnet", key.publicKey(), "4");
    const tx = TransactionBuilder.fromXDR(
      original.unsignedXdr,
      NETWORKS.mainnet.passphrase,
    ) as Transaction;
    tx.sign(key);
    expect(() => verifySignedTransaction(original, tx.toXDR())).toThrow(
      "signature",
    );
  });
});
