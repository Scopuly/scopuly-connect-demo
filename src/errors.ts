export class DemoError extends Error {
  constructor(
    message: string,
    public readonly code = "DEMO_ERROR",
  ) {
    super(message);
    this.name = "DemoError";
  }
}

export function explainError(error: unknown): string {
  if (error instanceof DemoError) return error.message;
  const candidate =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const nested =
    typeof candidate.error === "object" && candidate.error !== null
      ? (candidate.error as Record<string, unknown>)
      : candidate;
  if (nested.code === -4 || nested.code === 4001 || nested.code === 5000) {
    return "Request declined in the wallet. Nothing was submitted. You can try again when ready.";
  }
  if (nested.code === -2)
    return "The wallet could not reach its signing device. Open Scopuly, check its connection, and try again.";
  if (nested.code === -3)
    return "The wallet could not complete this request. Check the selected account, Testnet network, and extension pairing.";
  return "The request could not be completed. Check your connection and wallet, then try again. No automatic retry was made.";
}
