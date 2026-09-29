# Upload Connect Lab with FileZilla

Public URL: **https://extension.scopuly.com/connect-demo/**

This is a standalone static application. Deploy it into its own directory, not over the extension landing page and not into the mobile app's `www/` output.

## 1. Prepare the build

From this package directory:

```sh
npm ci
npm run check
npm run test:e2e
```

`npm run check` produces the production files in `dist/`. The local Vite server is not needed after deployment.

If you want the WalletConnect option enabled, first create a Reown project for this dApp, allow the production origin `https://extension.scopuly.com`, and set `VITE_WALLETCONNECT_PROJECT_ID` in `.env.local`. Then rebuild. Never upload `.env.local`; Vite embeds the public project ID into the JavaScript bundle. Do not enter private keys or API secrets in a `VITE_` variable. Without a project ID, WalletConnect remains disabled with developer setup instructions; Wallets Kit and Provider API do not need it.

## 2. Choose the destination

Use your existing hosting connection in FileZilla. Prefer SFTP if your hosting supports it, otherwise use the encrypted protocol supplied by the host.

On the remote side, open the **document root for `extension.scopuly.com`**: the directory containing the extension landing page's `index.html`, `playground/`, and `docs/`. Its actual filesystem name depends on the hosting configuration; do not assume it is the account's top-level `public_html` directory.

Create a child directory named `connect-demo`. If it already exists, inspect it and download a backup before replacing any files. Leave the landing page's root files and other directories unchanged.

## 3. Upload the contents, not the enclosing folder

Open this package's `dist/` on the local side. Transfer its contents into the remote `connect-demo/` directory:

```text
extension.scopuly.com document root/
├── index.html                 Existing extension landing page: leave unchanged
├── playground/                Existing playground: leave unchanged
├── docs/                      Existing documentation: leave unchanged
└── connect-demo/
    ├── index.html             Upload this last
    ├── assets/                All generated JavaScript and CSS files
    ├── brand/                 Light/dark Scopuly logos
    ├── fonts/                 Baloo 2 files and font license
    ├── og-connect-lab-v1.png  Social preview image
    └── scopuly.svg            WalletConnect metadata icon
```

Upload every generated file and directory, including `assets/`, `brand/`, `fonts/`, `og-connect-lab-v1.png`, and `scopuly.svg`, before uploading `index.html` last. The favicon is in `brand/`. Check FileZilla's failed transfers queue. On updates, retain older hashed assets until the deployment is verified so already-open pages can finish loading them.

Do **not** create `connect-demo/dist/`. Do not upload `src/`, `node_modules/`, `.env.local`, `test-results/`, package files, or the whole parent Scopuly application. The build uses relative asset paths and needs no SPA rewrite rules. The host must serve `index.html` as the directory index.

## 4. Verify the public page

1. Open **https://extension.scopuly.com/connect-demo/** with the trailing slash.
2. Check that the title is **Scopuly Connect Lab**, not the extension landing page.
3. Confirm both themes, the logos, font, footer links, and highlighted code load. Check the browser's Network/Console panels for missing files or errors.
4. Confirm **Testnet** is selected on a fresh visit. Changing the theme must not change the network.
5. Test account access and the Testnet workflow with the matching network in Scopuly. Signing must not submit automatically.
6. If WalletConnect is configured, test its session separately. A project ID alone is not proof that a live session works.

If you see a blank page or missing assets, check for an accidental `dist/` directory nesting, incomplete uploads, or a missing trailing slash. If the host serves the landing page instead, check that `connect-demo/` is under the correct domain root and not intercepted by a catch-all rewrite. Do not replace the root `.htaccess` to troubleshoot this demo.

The deployment itself sends no payments. Do not test Mainnet submission unless you explicitly intend to pay a real network fee.
