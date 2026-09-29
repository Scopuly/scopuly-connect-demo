import { FRIENDBOT, NETWORKS, type NetworkId } from "./config";
import { DemoError } from "./errors";
import { assertAddress } from "./stellar";

export interface AccountInfo {
  address: string;
  sequence: string;
  balance: string;
}
export interface Receipt {
  hash: string;
  ledger: number;
  successful: boolean;
}

export class HorizonError extends DemoError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly resultCode?: string,
  ) {
    super(message, "HORIZON_ERROR");
  }
}

async function request(
  url: string,
  options: RequestInit = {},
  timeout = 20_000,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new HorizonError(
      "The network request timed out or could not reach Stellar. Check your connection.",
      0,
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new HorizonError(
      "Stellar returned an unreadable response. Check the transaction status before trying again.",
      response.status,
    );
  }
  if (!response.ok) {
    const extras = body.extras as
      | { result_codes?: { transaction?: string; operations?: string[] } }
      | undefined;
    const code = extras?.result_codes?.transaction;
    const reason = [code, ...(extras?.result_codes?.operations ?? [])]
      .filter(Boolean)
      .join(", ");
    throw new HorizonError(
      `Stellar could not complete the request${reason ? ` (${reason})` : ` (HTTP ${response.status})`}.`,
      response.status,
      code,
    );
  }
  return body;
}

function receipt(body: Record<string, unknown>, hash: string): Receipt {
  if (
    body.hash !== hash ||
    typeof body.ledger !== "number" ||
    typeof body.successful !== "boolean"
  ) {
    throw new HorizonError(
      "Stellar returned an unexpected transaction response. Check the transaction hash in the explorer.",
      0,
    );
  }
  return { hash, ledger: body.ledger, successful: body.successful };
}

export const horizon = {
  async account(
    network: NetworkId,
    address: string,
  ): Promise<AccountInfo | null> {
    assertAddress(address);
    try {
      const body = await request(
        `${NETWORKS[network].horizon}/accounts/${address}`,
      );
      const balances = body.balances as {
        asset_type: string;
        balance: string;
      }[];
      const balance = balances?.find(
        (item) => item.asset_type === "native",
      )?.balance;
      if (
        body.account_id !== address ||
        typeof body.sequence !== "string" ||
        typeof balance !== "string"
      ) {
        throw new HorizonError(
          "Stellar returned unexpected account information.",
          0,
        );
      }
      return { address, sequence: body.sequence, balance };
    } catch (error) {
      if (error instanceof HorizonError && error.status === 404) return null;
      throw error;
    }
  },
  async fund(network: NetworkId, address: string): Promise<void> {
    if (network !== "testnet")
      throw new DemoError(
        "Friendbot is available on Testnet only. Mainnet funding is never automatic.",
      );
    assertAddress(address);
    await request(
      `${FRIENDBOT}/?addr=${encodeURIComponent(address)}`,
      {},
      60_000,
    );
  },
  async submit(
    network: NetworkId,
    signedXdr: string,
    hash: string,
  ): Promise<Receipt> {
    const body = await request(
      `${NETWORKS[network].horizon}/transactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ tx: signedXdr }).toString(),
      },
      60_000,
    );
    return receipt(body, hash);
  },
  async transaction(network: NetworkId, hash: string): Promise<Receipt | null> {
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new DemoError("Invalid transaction hash.");
    try {
      return receipt(
        await request(`${NETWORKS[network].horizon}/transactions/${hash}`),
        hash,
      );
    } catch (error) {
      if (error instanceof HorizonError && error.status === 404) return null;
      throw error;
    }
  },
};

export type HorizonClient = typeof horizon;
