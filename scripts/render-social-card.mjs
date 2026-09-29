import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "@playwright/test";

// Render the social card from HTML using the project's original brand assets.
const root = new URL("../", import.meta.url);
const asset = async (path) =>
  (await readFile(new URL(path, root))).toString("base64");
const font = await asset("public/fonts/Baloo2-Bold.woff2");
const logo = await asset("public/brand/scopuly-dark.png");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
    @font-face{font-family:Baloo;src:url(data:font/woff2;base64,${font})}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;color:#f4f3ff;font-family:Baloo,sans-serif;background:radial-gradient(ellipse at 95% 10%,#302554 0,transparent 52%),radial-gradient(ellipse at 0 110%,#172847 0,transparent 55%),#080a14}
    .card{padding:54px 64px;height:100%;position:relative}
    header{display:flex;align-items:center;gap:28px}svg{width:228px;height:51px}.label{font-size:24px;color:#bcc3de;border-left:1px solid #505576;padding-left:28px}
    h1{font-size:86px;line-height:1.02;letter-spacing:-2px;margin:42px 0 20px}h1 span{color:#a9baff}
    p{font-size:25px;color:#c4cbe2;margin:0;line-height:1.4}
    .steps{display:flex;gap:14px;align-items:center;margin-top:32px;font-size:21px}.step{padding:8px 22px;border:1px solid #454b75;border-radius:30px;background:#191e34}.arrow{color:#8b96c2}
    footer{position:absolute;left:64px;right:64px;bottom:35px;border-top:1px solid #343b56;padding-top:18px;display:flex;justify-content:space-between;font-size:19px;color:#afb9d9}.net{color:#8de0cb}
  </style><div class="card"><header><svg viewBox="276 391 1360 300" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${logo}" width="1920" height="1080"/></svg><div class="label">CONNECT LAB</div></header>
  <h1>From connect<br>to <span>confirmed.</span></h1><p>A hands-on Scopuly integration demo.<br>Every request. Every approval. Every step.</p>
  <div class="steps"><span class="step">Connect</span><span class="arrow">→</span><span class="step">Review & sign</span><span class="arrow">→</span><span class="step">Submit & verify</span></div>
  <footer><span>extension.scopuly.com/connect-demo</span><span class="net">STELLAR · TESTNET + MAINNET</span></footer></div></html>`);
  // This callback runs inside the browser, not in Node.js.
  // eslint-disable-next-line no-undef
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL("public/og-connect-lab-v1.png", root)),
  });
} finally {
  await browser.close();
}
