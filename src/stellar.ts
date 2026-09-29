import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk/base";
import { NETWORKS, type NetworkId } from "./config";
import { DemoError } from "./errors";

export interface PreparedTransaction {
  network: NetworkId;
  address: string;
  sequence: string;
  unsignedXdr: string;
  hash: string;
  expiresAt: number;
}

export const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export function assertAddress(address: string): void {
  if (!StrKey.isValidEd25519PublicKey(address))
    throw new DemoError(
      "The wallet returned an invalid Stellar account address.",
    );
}

export function assertNetwork(
  network: NetworkId,
  networkPassphrase: string,
): void {
  if (networkPassphrase !== NETWORKS[network].passphrase) {
    throw new DemoError(
      `Switch the signing account to Stellar ${NETWORKS[network].label} in Scopuly, then reconnect. The wallet and demo must use the same network.`,
      "WRONG_NETWORK",
    );
  }
}

export function prepareTransaction(
  network: NetworkId,
  address: string,
  sequence: string,
  now = Date.now(),
): PreparedTransaction {
  assertAddress(address);
  if (!/^\d+$/.test(sequence))
    throw new DemoError("Horizon returned an invalid account sequence.");
  const expiresAt = Math.floor(now / 1000) + 300;
  const tx = new TransactionBuilder(new Account(address, sequence), {
    fee: "100",
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .addOperation(
      Operation.payment({
        destination: address,
        asset: Asset.native(),
        amount: "1",
      }),
    )
    .addMemo(Memo.text("Scopuly connect demo"))
    .setTimebounds(0, expiresAt)
    .build();
  return {
    network,
    address,
    sequence,
    unsignedXdr: tx.toXDR(),
    hash: hex(tx.hash()),
    expiresAt,
  };
}

export function assertNotExpired(
  prepared: PreparedTransaction,
  now = Date.now(),
): void {
  if (Math.floor(now / 1000) >= prepared.expiresAt)
    throw new DemoError(
      "This transaction has expired. Prepare a new transaction and sign it again.",
      "EXPIRED",
    );
}

export function verifySignedTransaction(
  prepared: PreparedTransaction,
  signedXdr: string,
  signerAddress?: string,
): string {
  assertNotExpired(prepared);
  if (signerAddress && signerAddress !== prepared.address)
    throw new DemoError(
      "The wallet returned a different signing account. Nothing was submitted.",
    );
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(
      signedXdr,
      NETWORKS[prepared.network].passphrase,
    );
  } catch {
    throw new DemoError(
      "The wallet returned invalid transaction XDR. Nothing was submitted.",
    );
  }
  if (!(tx instanceof Transaction) || hex(tx.hash()) !== prepared.hash) {
    throw new DemoError(
      "The signed transaction does not match the transaction you reviewed. Nothing was submitted.",
    );
  }
  const key = Keypair.fromPublicKey(prepared.address);
  const valid = tx.signatures.some((signature) => {
    try {
      return key.verify(tx.hash(), signature.signature);
    } catch {
      return false;
    }
  });
  if (!valid)
    throw new DemoError(
      `The returned signature could not be verified for your account on ${NETWORKS[prepared.network].label}. Nothing was submitted.`,
    );
  return signedXdr;
}
