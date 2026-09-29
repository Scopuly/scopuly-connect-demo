# Scopuly Connect Lab

A small React + TypeScript application that makes a Stellar wallet integration inspectable, from account access to ledger confirmation.

**Testnet is the default. Mainnet is optional and uses real XLM for fees.** The demo sends **1 XLM to the connected account itself**, with a maximum fee of **100 stroops (0.00001 XLM)**. It never chooses an external recipient, buys assets, or submits automatically.

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

### Appearance

The topbar contains the Testnet/Mainnet selector and a light/dark theme toggle. The initial theme follows the device preference; an explicit choice is remembered locally under `scopuly-connect-lab:theme`. Changing the theme does not disconnect the wallet or reset the transaction. The hero diagram is an illustration of the connection flow, not live session data.

Baloo 2 is bundled locally. The supplied Scopuly logos switch with the theme; no external font service is used.

## Walk through the entire flow

1. **Connect** — request the public address and validate the wallet's selected network.
2. **Fund** — refresh the balance. On Testnet, **Get test XLM** asks Stellar Friendbot to create and fund an account that does not yet exist. Existing accounts are not automatically topped up. Mainnet funding is external and manual.
3. **Prepare** — fetch the current sequence from the selected network's Horizon and build a one-operation payment to the same account. Review the destination, amount, maximum fee, memo, expiration, and unsigned XDR.
4. **Sign** — request approval in Scopuly. Verify that the returned transaction body is unchanged and that its Ed25519 signature is valid for the requested account and network. No submission happens here.
5. **Submit** — explicitly submit the signed envelope to the matching Horizon. Inspect the transaction hash, ledger result, and network-specific explorer link. Refresh the balance afterward to see the fee.

The developer inspector exposes abbreviated integration code, real request parameters, returned data, and an in-memory activity log. TypeScript and JSON use syntax highlighting and line numbers, with palettes for both themes. The Copy button copies only the original text, without line numbers or markup. It never displays simulated successes in the production app. Automated tests use isolated mocks.

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
- The amount and destination cannot be edited: this is a **1 XLM self-payment**, not a general transfer form. The amount remains in the same account; a successfully submitted transaction incurs a network fee. Failed transactions included in a ledger can also incur a fee.
- Transactions expire after five minutes. Account sequence changes require a fresh transaction and signature.
- The demo does not raise fees automatically. If the network requires more than 100 stroops, the request can fail; inspect the returned result.
- An ambiguous submission result is treated as **unknown**, not failed. Check the original hash instead of submitting again. A temporary Horizon `404` is not proof of failure.
- Use a normal single-signature account. Multisignature coordination, custom signer thresholds, fee bumps, and production payment recovery are outside this example's scope.

This is integration example code, not an audited production payments system.

### Dependency audit

The locked dependency audit on September 29, 2026 reported 19 findings (13 low, 6 moderate, no high or critical findings), primarily through SWK's unused Hot Wallet / NEAR / Solana dependency tree. The demo imports only the Scopuly and WalletConnect modules, not Hot Wallet or `defaultModules()`. This does not make the dependency audit clean: recheck `npm audit` and track upstream updates. Do not apply the suggested downgrade to SWK 1.x; it would remove the integration API used here.

## Project structure

```text
src/
  App.tsx             Step-by-step UI and live inspector
  BrandLogo.tsx       Original Scopuly artwork for each theme
  HeroFlow.tsx        Clearly labeled connection-flow illustration
  SyntaxCode.tsx       Theme-aware TypeScript and JSON syntax highlighting
  SiteFooter.tsx       Scopuly apps, developer resources, and open-source links
  theme.ts            Device preference and persistent theme selection
  config.ts           Fixed Testnet/Mainnet endpoints and public configuration
  controller.ts       Flow, invalidation, and duplicate-submission guards
  wallet.ts           SWK, direct provider, and WalletConnect adapters
  stellar.ts          Transaction construction and signature verification
  horizon.ts          Account, Friendbot, submission, and status requests
  snippets.ts         Abbreviated examples displayed in the inspector
  *.test.ts           Unit and flow tests
test/e2e/             Isolated browser tests with disposable mock signing keys
public/scopuly.svg    Scopuly brand mark
public/brand/         Original light/dark Scopuly logos
public/fonts/         Baloo 2 font files and SIL Open Font License
```

## Checks

```sh
npm run check         # ESLint, TypeScript, unit tests, production build
npx playwright install chromium
npm run test:e2e      # Browser tests with mocked providers and Horizon
```

Browser tests exercise the actual SWK Scopuly module and direct provider adapter, but they **do not prove connectivity to a real signing device or a live WalletConnect session**. Both Mainnet and Testnet HTTP endpoints are intercepted. No real transactions are sent by tests.

Before publishing, manually verify:

- Extension pairing and account permission, including rejection.
- Testnet funding, signing, explicit submission, and explorer confirmation.
- The same flow from Scopuly's in-app browser over HTTPS.
- WalletConnect with your configured Reown project, on each network you intend to support.
- Account/network changes, disconnect, expired transactions, and cancellation.
- Mainnet warnings and routing. Only submit a real Mainnet transaction if you explicitly intend to pay the fee.

## Build and upload

See [UPLOAD.md](UPLOAD.md) for the FileZilla workflow, directory layout, upload order, WalletConnect configuration, and post-deployment checks.

```sh
npm run build
npm run preview
```

Upload the **contents of `dist/`** to the desired HTTPS directory, such as `extension.scopuly.com/connect-demo/`. Assets use relative URLs, so a subdirectory works without a router or server rewrite rules. Do not overwrite an existing demo without checking its contents first.

Live demo: **https://extension.scopuly.com/connect-demo/**. Source: **https://github.com/Scopuly/scopuly-connect-demo**. Running a local build does not deploy it.

Do not upload `node_modules`, `.env.local`, tests, or the source folder as the hosted application. There is no backend to deploy and no npm package to publish.

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

Horizon sees public account queries and submitted transactions. Friendbot sees Testnet funding requests. WalletConnect uses Reown services when configured and selected. Fonts and logos are served from the same origin as the demo. Theme preference is saved locally; no wallet addresses or transaction data are stored by the theme feature.

## References

- [Scopuly setup and downloads](https://extension.scopuly.com/)
- [Scopuly Provider API](https://extension.scopuly.com/docs/provider-api/)
- [Signer API source](https://github.com/Scopuly/signer-extension-api)
- [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
- [Stellar Horizon API](https://developers.stellar.org/docs/data/apis/horizon)

## License

The example code is MIT licensed. Scopuly branding remains the property of its respective owner; this example does not grant separate trademark rights.

Baloo 2 by Ek Type is distributed under the SIL Open Font License 1.1; see `public/fonts/OFL.txt`.
