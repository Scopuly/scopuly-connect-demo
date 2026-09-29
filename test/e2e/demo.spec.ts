import { expect, test, type Page } from "@playwright/test";
import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

const testnet = "Test SDF Network ; September 2015";
const mainnet = "Public Global Stellar Network ; September 2015";
// Mock-only disposable account. This fixture is not imported by the application.
const key = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));

test("sticky header covers the viewport without horizontal overflow", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() =>
        window.scrollTo({ top: 600, behavior: "instant" }),
      );
      const geometry = await page.locator(".site-header").evaluate((header) => {
        const rect = header.getBoundingClientRect();
        const inner = header
          .querySelector(".header-inner")!
          .getBoundingClientRect();
        const content = document
          .querySelector(".page-content")!
          .getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          aligned:
            Math.abs(inner.left - content.left) < 1 &&
            Math.abs(inner.right - content.right) < 1,
        };
      });
      expect(geometry.left).toBe(0);
      expect(geometry.top).toBe(0);
      expect(geometry.right).toBe(geometry.viewport);
      expect(geometry.scrollWidth).toBe(geometry.viewport);
      expect(geometry.aligned).toBe(true);
    }
  }
});

async function installFixture(
  page: Page,
  options: { reject?: boolean; timeout?: boolean } = {},
) {
  let funded = false;
  let submittedHash = "";
  const submissions: string[] = [];
  await page.route("https://**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "friendbot.stellar.org") {
      funded = true;
      return route.fulfill({ json: { successful: true } });
    }
    if (
      ["horizon-testnet.stellar.org", "horizon.stellar.org"].includes(
        url.hostname,
      )
    ) {
      if (url.pathname.startsWith("/accounts/"))
        return route.fulfill({
          status: funded || url.hostname === "horizon.stellar.org" ? 200 : 404,
          json: {
            account_id: key.publicKey(),
            sequence: "42",
            balances: [{ asset_type: "native", balance: "10000.0000000" }],
          },
        });
      if (request.method() === "POST") {
        submissions.push(url.hostname);
        const xdr = new URLSearchParams(request.postData()!).get("tx")!;
        submittedHash = Buffer.from(
          TransactionBuilder.fromXDR(
            xdr,
            url.hostname === "horizon.stellar.org" ? mainnet : testnet,
          ).hash(),
        ).toString("hex");
        if (options.timeout) return route.abort("timedout");
        return route.fulfill({
          json: { hash: submittedHash, successful: true, ledger: 500 },
        });
      }
      if (url.pathname.startsWith("/transactions/"))
        return route.fulfill({
          json: { hash: submittedHash, successful: true, ledger: 500 },
        });
    }
    // No live network calls, wallet sessions, or payments are allowed in browser tests.
    return route.abort();
  });
  await page.exposeFunction("mockSign", (xdr: string, passphrase: string) => {
    const tx = TransactionBuilder.fromXDR(xdr, passphrase) as Transaction;
    tx.sign(key);
    return tx.toXDR();
  });
  await page.addInitScript(
    ({ address, testnet, reject }) => {
      let network = testnet;
      let connected = false;
      const listeners = new Set<
        (event: {
          address: string;
          network: string;
          networkPassphrase: string;
          isConnected: boolean;
          changed: [];
        }) => void
      >();
      const environment = window as typeof window & {
        mockSign(xdr: string, passphrase: string): Promise<string>;
        mockNetwork(network: string): void;
      };
      environment.mockNetwork = (next) => {
        network = next;
        for (const listener of listeners)
          listener({
            address,
            network: next,
            networkPassphrase: next,
            isConnected: connected,
            changed: [],
          });
      };
      window.scopuly = {
        isScopuly: true,
        platform: "extension",
        __scopulyProviderVersion: "test-fixture",
        isConnected: async () => ({ isConnected: connected }),
        requestAccess: async () => {
          connected = true;
          return { address };
        },
        getAddress: async () => ({ address: connected ? address : "" }),
        getPublicKey: async () => address,
        getNetwork: async () => ({ network, networkPassphrase: network }),
        signTransaction: async (xdr, options) => {
          if (reject) throw { code: -4, message: "Rejected" };
          return {
            signedTxXdr: await environment.mockSign(
              xdr,
              options!.networkPassphrase!,
            ),
            signerAddress: address,
          };
        },
        disconnect: async () => {
          connected = false;
        },
        onChange: (callback) => {
          listeners.add(callback);
          return () => {
            listeners.delete(callback);
          };
        },
        removeListener: (callback) => {
          listeners.delete(callback);
        },
        signAndSubmitTransaction: async () => {
          throw new Error("Not used");
        },
        signAuthEntry: async () => {
          throw new Error("Not used");
        },
        signMessage: async () => {
          throw new Error("Not used");
        },
        reportX402Receipt: async () => {
          throw new Error("Not used");
        },
      };
    },
    { address: key.publicKey(), testnet, reject: options.reject },
  );
  return submissions;
}

async function connectAndPrepare(page: Page) {
  await page
    .getByRole("button", { name: "Connect Scopuly", exact: false })
    .click();
  await expect(
    page.getByText("CONNECTED ACCOUNT", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get test XLM", exact: true }).click();
  await expect(
    page.getByText("Test XLM received.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prepare transaction", exact: false })
    .click();
  await expect(page.getByText("Maximum fee", { exact: true })).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "1 XLM (stays in your account)" }),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "0.0001 XLM" }),
  ).toBeVisible();
}

test("initial desktop and mobile layouts, missing provider, and WC setup", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "From connect to confirmed." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Scopuly", exact: false }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/desktop-initial.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "WalletConnect No extension" })
    .click();
  await expect(page.getByText("One small setup step")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Connect with WalletConnect",
      exact: false,
    }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Wallets Kit Recommended" }).click();
  await page.screenshot({
    path: "test-results/mobile-initial.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const mode of [
  "Wallets Kit Recommended",
  "Provider API Direct integration",
]) {
  test(`${mode}: full mocked Testnet lifecycle and inspector`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const submissions = await installFixture(page);
    await page.goto("/");
    await page.getByRole("button", { name: mode }).click();
    await connectAndPrepare(page);
    await page
      .getByRole("button", { name: "Sign with Scopuly", exact: false })
      .click();
    await expect(
      page.getByText("Signature verified locally.", { exact: false }),
    ).toBeVisible();
    expect(submissions).toHaveLength(0);
    await page
      .getByRole("button", { name: "Submit to Testnet", exact: false })
      .click();
    await expect(
      page.getByText("Confirmed on Stellar", { exact: true }),
    ).toBeVisible();
    expect(submissions).toEqual(["horizon-testnet.stellar.org"]);
    await page.getByRole("tab", { name: "Response", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText(
      '"successful": true',
    );
    expect(errors).toEqual([]);
  });
}

test("Mainnet has an explicit fee confirmation and the correct endpoint", async ({
  page,
}) => {
  const submissions = await installFixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Mainnet", exact: true }).click();
  await page.evaluate(
    (passphrase) =>
      (
        window as typeof window & { mockNetwork(network: string): void }
      ).mockNetwork(passphrase),
    mainnet,
  );
  await page
    .getByRole("button", { name: "Connect Scopuly", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Get test XLM", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Prepare transaction", exact: false }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Prepare transaction", exact: false })
    .click();
  await expect(
    page.getByText("Destination (your own account)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "0.01 XLM (stays in your account)" }),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "0.0001 XLM" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sign with Scopuly", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Submit to Mainnet", exact: false })
    .click();
  await expect(
    page.getByText("Confirmed on Stellar", { exact: true }),
  ).toBeVisible();
  expect(submissions).toEqual(["horizon.stellar.org"]);
});

test("rejection does not submit a transaction", async ({ page }) => {
  const submissions = await installFixture(page, { reject: true });
  await page.goto("/");
  await connectAndPrepare(page);
  await page
    .getByRole("button", { name: "Sign with Scopuly", exact: false })
    .click();
  await expect(page.getByRole("alert")).toContainText("Request declined");
  expect(submissions).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Submit to Testnet", exact: false }),
  ).toHaveCount(0);
});

test("unknown submission is recovered by hash without a retry", async ({
  page,
}) => {
  const submissions = await installFixture(page, { timeout: true });
  await page.goto("/");
  await connectAndPrepare(page);
  await page
    .getByRole("button", { name: "Sign with Scopuly", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Submit to Testnet", exact: false })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Submission status is unknown",
  );
  await expect(
    page.getByRole("button", { name: "Mainnet", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Check transaction status", exact: true })
    .click();
  await expect(
    page.getByText("Confirmed on Stellar", { exact: true }),
  ).toBeVisible();
  expect(submissions).toHaveLength(1);
});

test("switching network clears the signed transaction", async ({ page }) => {
  const submissions = await installFixture(page);
  await page.goto("/");
  await connectAndPrepare(page);
  await page
    .getByRole("button", { name: "Sign with Scopuly", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Submit to Testnet", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mainnet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit to Testnet", exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect Scopuly", exact: false }),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
});

test("themes follow the device, persist an explicit choice, and load local fonts", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("header .logo-dark")).toBeVisible();
  await expect(page.locator("header .logo-light")).toBeHidden();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("header .logo-light")).toBeVisible();
  await expect(page.locator("header .logo-dark")).toBeHidden();
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      family: getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('16px "Baloo 2"'),
      files: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes(".woff2"))
        .map((entry) => new URL(entry.name).origin),
    };
  });
  expect(fonts.family).toContain("Baloo 2");
  expect(fonts.loaded).toBe(true);
  expect(fonts.files.length).toBeGreaterThan(0);
  expect(
    fonts.files.every((origin) => origin === new URL(page.url()).origin),
  ).toBe(true);
  expect(
    await page
      .locator(".step-heading p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page
    .locator("summary")
    .filter({ hasText: "Why does the extension" })
    .click();
  await expect(
    page.getByText("Your keys stay on that device.", { exact: false }),
  ).toBeVisible();
});

test("both themes fit mobile, tablet, and desktop without horizontal overflow", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/");
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
    for (const width of [320, 390, 656, 768, 960, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${theme} at ${width}px`,
      ).toBeLessThanOrEqual(width);
      await expect(
        page.getByRole("button", { name: "Testnet", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `Switch to ${theme === "light" ? "dark" : "light"} theme`,
        }),
      ).toBeVisible();
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: `test-results/${width === 390 ? "mobile" : "desktop"}-${theme}.png`,
          fullPage: true,
        });
        await page.screenshot({
          path: `test-results/${width === 390 ? "mobile" : "desktop"}-${theme}-hero.png`,
        });
      }
    }
  }
});

test("theme switching preserves the signed transaction and does not submit", async ({
  page,
}) => {
  const submissions = await installFixture(page);
  await page.goto("/");
  await connectAndPrepare(page);
  await page
    .getByRole("button", { name: "Sign with Scopuly", exact: false })
    .click();
  const submit = page.getByRole("button", {
    name: "Submit to Testnet",
    exact: false,
  });
  await expect(submit).toBeEnabled();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(submit).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-dark-signed.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(submit).toBeEnabled();
  expect(submissions).toEqual([]);
});

test("theme toggle works when browser storage is unavailable", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("syntax highlighting switches palettes and copies the original source", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { copiedSource: string }).copiedSource =
            text;
        },
      },
    });
  });
  await page.goto("/");
  const code = page.getByLabel("TypeScript integration example");
  await expect(code.locator(".token.keyword").first()).toHaveText("import");
  await expect(code.locator(".token.string").first()).toContainText(
    "stellar-wallets-kit/sdk",
  );
  await expect(code.locator(".token.comment").first()).toContainText(
    "Signing does not submit",
  );
  const original = (
    await code.locator(".syntax-line-content").allTextContents()
  )
    .map((line) => (line === "\n" ? "" : line))
    .join("\n");
  const lightKeyword = await code
    .locator(".token.keyword")
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  const copied = await page.evaluate(
    () => (window as typeof window & { copiedSource: string }).copiedSource,
  );
  expect(copied).toBe(original);
  expect(copied).toMatch(/^import \{ StellarWalletsKit as kit \}/);
  expect(copied).toContain("\n\nkit.init({");
  await page
    .locator(".inspector")
    .screenshot({ path: "test-results/syntax-light.png" });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  expect(
    await code
      .locator(".token.keyword")
      .first()
      .evaluate((el) => getComputedStyle(el).color),
  ).not.toBe(lightKeyword);
  await page
    .locator(".inspector")
    .screenshot({ path: "test-results/syntax-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".inspector")
    .screenshot({ path: "test-results/syntax-mobile.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("the inspector highlights actual request and response JSON", async ({
  page,
}) => {
  const submissions = await installFixture(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect Scopuly", exact: false })
    .click();
  await expect(
    page.getByRole("button", { name: "Disconnect", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Request", exact: true }).click();
  await expect(
    page.getByLabel("Request JSON").locator(".token.property").first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Response", exact: true }).click();
  await expect(
    page.getByLabel("Response JSON").locator(".token.property").first(),
  ).toBeVisible();
  expect(submissions).toEqual([]);
});

test("the ecosystem footer links to current products and fits both themes", async ({
  page,
}) => {
  await page.route("https://**/*", (route) => route.abort());
  await page.goto("/");
  const footer = page.getByRole("contentinfo", { name: "Scopuly ecosystem" });
  await expect(
    footer.getByRole("link", { name: "AI Payments", exact: false }),
  ).toHaveAttribute("href", "https://app.scopuly.com/ai-payments/");
  await expect(
    footer.getByRole("link", { name: "Web app", exact: false }),
  ).toHaveAttribute("href", "https://app.scopuly.com/");
  await expect(
    footer.getByRole("link", { name: "Provider playground", exact: false }),
  ).toHaveAttribute("href", "https://extension.scopuly.com/playground/");
  await expect(
    footer.getByRole("link", {
      name: "x402 payments demo Mainnet",
      exact: false,
    }),
  ).toHaveAttribute("href", "https://app.scopuly.com/x402-demo/");
  await expect(
    footer.getByRole("link", {
      name: "x402 Stellar Guard Preview",
      exact: false,
    }),
  ).toHaveAttribute("href", "https://github.com/Scopuly/x402-stellar-guard");
  await expect(
    footer.getByRole("link", { name: /Deep Link SDK|Stellar Payment Button/ }),
  ).toHaveCount(0);
  expect(
    await footer
      .locator('a[href^="https://"]')
      .evaluateAll((links) =>
        links.every(
          (link) =>
            link.getAttribute("target") === "_blank" &&
            link.getAttribute("rel")?.includes("noreferrer"),
        ),
      ),
  ).toBe(true);
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 390 || width === 1440)
        await footer.screenshot({
          path: `test-results/footer-${theme}-${width}.png`,
        });
    }
  }
});
