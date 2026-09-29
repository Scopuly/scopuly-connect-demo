# Scopuly Connect Lab

A small React + TypeScript application that makes a Stellar wallet integration inspectable, from account access to ledger confirmation.

**Testnet is the default. Mainnet is optional and uses real XLM for fees.** The demo sends **0.01 XLM on Mainnet or 1 test XLM on Testnet back to your own connected account**. The destination is always your own address, not another recipient. The payment amount stays in your account; only the network fee is deducted, up to **1000 stroops (0.0001 XLM)**. Nothing is submitted automatically.

## Quick start

Requirements: Node.js 22.12+ (Node.js 24 recommended), npm, and an up-to-date Scopuly signing app.

```sh
git clone https://github.com/Scopuly/scopuly-connect-demo.git
cd scopuly-connect-demo
npm ci
npm run dev
```

Open **http://127.0.0.1:5186**. The package is standalone: no application code or dependencies from a parent repository are required.

### Wallet setup

1. Install the [Scopuly browser extension](https://extension.scopuly.com/) for your browser.
2. Open Scopuly on the paired iOS, Android, or macOS signing device. Follow the extension's pairing instructions.
3. Select **Testnet** in Scopuly and in this demo. Reload the demo after installing the extension.
4. Choose **Wallets Kit** or **Provider API**, then click **Connect Scopuly** and approve account access.

Alternatively, open the deployed HTTPS demo inside Scopuly's in-app browser. The desktop loopback address is not reachable from a separate phone. Use an HTTPS deployment when testing on another device.

No seed phrase or secret key should ever be entered in this application.

## Walk through the entire flow

1. **Connect** — request the public address and validate the wallet's selected network.
2. **Fund** — refresh the balance. On Testnet, **Get test XLM** asks Stellar Friendbot to create and fund an account that does not yet exist. Existing accounts are not automatically topped up. Mainnet funding is external and manual.
3. **Prepare** — fetch the current sequence from the selected network's Horizon and build a one-operation payment to the same account. Review the destination, amount, maximum fee, memo, expiration, and unsigned XDR.
4. **Sign** — request approval in Scopuly. Verify that the returned transaction body is unchanged and that its Ed25519 signature is valid for the requested account and network. No submission happens here.
5. **Submit** — explicitly submit the signed envelope to the matching Horizon. Inspect the transaction hash, ledger result, and network-specific explorer link. Refresh the balance afterward to see the fee.

The developer inspector shows integration code, request parameters, responses, and an activity log so you can follow each step.

## Three connection methods

| Method        | Integration                              | Setup                                            |
| ------------- | ---------------------------------------- | ------------------------------------------------ |
| Wallets Kit   | Published `ScopulyModule` from SWK 2.7.0 | Injected Scopuly provider; no Reown project ID   |
| Provider API  | `@scopuly/signer-extension-api` 0.3.3    | The same extension or in-app provider            |
| WalletConnect | SWK `WalletConnectModule`                | Your own Reown project ID; no extension required |

The demo uses an explicit Scopuly module rather than downloading every default wallet module into the initial bundle. In a multi-wallet application, `defaultModules()` also includes Scopuly.

### WalletConnect configuration

Copy `.env.example` to `.env.local` and set your public client project ID:

```dotenv
VITE_WALLETCONNECT_PROJECT_ID=your_32_character_reown_project_id
```

Create the project at [Reown Dashboard](https://dashboard.reown.com/) and configure your allowed development and production origins. Restart Vite after changing the file. Rebuild before deploying changes to environment variables.

Choose **WalletConnect**, click **Connect with WalletConnect**, select Scopuly in the dialog, and approve the session. Only the selected Stellar chain is requested. Never use an unrelated project's ID, an API secret, or a wallet private key here. All `VITE_` values are public in a browser build.

WalletConnect's SWK module does not implement `getNetwork()`. This demo validates the approved session's CAIP-10 account and expiry instead. Direct provider calls are never mixed into a WalletConnect signing session.

### Wallets Kit: minimal pattern

```ts
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { ScopulyModule } from "@creit.tech/stellar-wallets-kit/modules/scopuly";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";

StellarWalletsKit.init({
  modules: [new ScopulyModule()],
  network: Networks.TESTNET,
});
StellarWalletsKit.setWallet("scopuly");

// Call from an explicit user action.
const { address } = await StellarWalletsKit.fetchAddress();
const { networkPassphrase } = await StellarWalletsKit.getNetwork();
if (networkPassphrase !== Networks.TESTNET)
  throw new Error("Select Testnet in the wallet");

// Build unsignedXdr for this address and network, then review it.
const { signedTxXdr } = await StellarWalletsKit.signTransaction(unsignedXdr, {
  address,
  networkPassphrase: Networks.TESTNET,
});

// Verify the response. Submit only after a separate confirmation.
```

This snippet is abbreviated. The working adapter, network checks, signature verification, submission, and event handling are in `src/wallet.ts`, `src/stellar.ts`, `src/horizon.ts`, and `src/controller.ts`.

## Mainnet safeguards

- Mainnet is never selected automatically on a fresh visit.
- Changing the network or connection method disconnects the current session and discards prepared/signed XDR.
- The wallet network must match the chosen environment before preparing, signing, and submitting.
- An explicit checkbox acknowledges real network fees. Signing and submission are separate buttons.
- This is a **0.01 XLM payment back to your own account**, not a transfer to someone else. The amount and destination are fixed. The payment amount stays in your account; the network fee reduces your balance. Failed transactions included in a ledger can also incur a fee.
- Transactions expire after five minutes. Account sequence changes require a fresh transaction and signature.
- The maximum fee is **1000 stroops (0.0001 XLM)**. The demo does not increase it automatically. If the network requires a higher fee, inspect the returned error before trying again.
- An ambiguous submission result is treated as **unknown**, not failed. Check the original hash instead of submitting again. A temporary Horizon `404` is not proof of failure.
- Use a normal single-signature account. Multisignature coordination, custom signer thresholds, fee bumps, and production payment recovery are outside this example's scope.

This is integration example code, not an audited production payments system.

### Dependency audit

The locked dependency audit on September 29, 2026 reported 19 findings (13 low, 6 moderate, no high or critical findings), primarily through SWK's unused Hot Wallet / NEAR / Solana dependency tree. The demo imports only the Scopuly and WalletConnect modules, not Hot Wallet or `defaultModules()`. This does not make the dependency audit clean: recheck `npm audit` and track upstream updates. Do not apply the suggested downgrade to SWK 1.x; it would remove the integration API used here.

## Project structure

```text
src/
  App.tsx             Step-by-step UI and live inspector
  SiteFooter.tsx       Scopuly apps, developer resources, and open-source links
  config.ts           Fixed Testnet/Mainnet endpoints and public configuration
  controller.ts       Flow, invalidation, and duplicate-submission guards
  wallet.ts           SWK, direct provider, and WalletConnect adapters
  stellar.ts          Transaction construction and signature verification
  horizon.ts          Account, Friendbot, submission, and status requests
  snippets.ts         Abbreviated examples displayed in the inspector
  *.test.ts           Unit and flow tests
test/e2e/             Isolated browser tests with disposable mock signing keys
```

## Checks

```sh
npm run check         # ESLint, TypeScript, unit tests, production build
npx playwright install chromium
npm run test:e2e      # Browser tests with mocked providers and Horizon
```

The browser suite covers the SWK Scopuly module, direct provider flow, network safeguards, and transaction submission using mocked wallet and Horizon responses. Tests do not send real transactions.

For end-to-end testing with your wallet:

- Extension pairing and account permission, including rejection.
- Testnet funding, signing, explicit submission, and explorer confirmation.
- The same flow from Scopuly's in-app browser over HTTPS.
- WalletConnect with your configured Reown project, on each network you intend to support.
- Account/network changes, disconnect, expired transactions, and cancellation.
- Mainnet warnings and routing. Only submit a real Mainnet transaction if you explicitly intend to pay the fee.

## Build

```sh
npm run build
npm run preview
```

The production build is generated in `dist/` and can be hosted on any static HTTPS host. No backend is required.

[Live demo](https://extension.scopuly.com/connect-demo/) · [Source code](https://github.com/Scopuly/scopuly-connect-demo)

## Troubleshooting

| Symptom                         | What to check                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Waiting for Scopuly             | Enable and pair the extension, then reload; or use the in-app browser.                                         |
| Wallet network mismatch         | Select the matching signing network in Scopuly and reconnect.                                                  |
| No account found                | Fund the account on the selected network. Friendbot is Testnet-only.                                           |
| Signing times out               | Close the pending request in Scopuly, disconnect, and reconnect. No automatic retry occurs.                    |
| WalletConnect stays unavailable | Check your project ID, allowed origin, relay connectivity, and app version.                                    |
| `tx_bad_seq` or expired         | Prepare and sign a fresh transaction.                                                                          |
| `tx_bad_auth`                   | Check the account's signer/threshold configuration. This example supports a standard single-signature account. |
| `tx_insufficient_fee`           | The fixed fee cap was not accepted. The demo will not silently increase it.                                    |
| Unknown submission              | Check the original transaction hash. Do not assume a timeout means failure.                                    |

## Privacy and third-party services

There is no application analytics or backend. The activity log stays in memory until reload and may contain public addresses and signed transaction envelopes. Copy only the data you intend to share. SWK/WalletConnect may use browser storage for their connection state; revoke sessions in Scopuly when finished.

Horizon sees public account queries and submitted transactions. Friendbot sees Testnet funding requests. WalletConnect uses Reown services when configured and selected.

## References

- [Scopuly setup and downloads](https://extension.scopuly.com/)
- [Scopuly Provider API](https://extension.scopuly.com/docs/provider-api/)
- [Signer API source](https://github.com/Scopuly/signer-extension-api)
- [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
- [Stellar Horizon API](https://developers.stellar.org/docs/data/apis/horizon)

## License

The example code is MIT licensed. Scopuly branding remains the property of its respective owner; this example does not grant separate trademark rights.
