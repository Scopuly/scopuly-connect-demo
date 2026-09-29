import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DOCS,
  EXTENSION,
  MAX_FEE_XLM,
  NETWORKS,
  WALLETCONNECT_CONFIGURED,
  type NetworkId,
} from "./config";
import type { DemoController, Trace } from "./controller";
import { integrationSnippet } from "./snippets";
import { providerStatus, type ConnectionMode } from "./wallet";
import BrandLogo from "./BrandLogo";
import HeroFlow from "./HeroFlow";
import { useTheme, type Theme } from "./theme";
import SyntaxCode from "./SyntaxCode";
import SiteFooter from "./SiteFooter";

const methods: { id: ConnectionMode; title: string; subtitle: string }[] = [
  { id: "swk", title: "Wallets Kit", subtitle: "Recommended" },
  { id: "provider", title: "Provider API", subtitle: "Direct integration" },
  { id: "walletconnect", title: "WalletConnect", subtitle: "No extension" },
];
const steps = ["Connect", "Fund", "Prepare", "Sign", "Submit"];
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-8)}`;
const pretty = (value: unknown) => JSON.stringify(value, null, 2);

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <Arrow />
    </a>
  );
}
function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 2200);
    return () => clearTimeout(timer);
  }, [feedback]);
  return (
    <button
      type="button"
      className="copy-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setFeedback("Copied");
        } catch {
          setFeedback("Select text to copy");
        }
      }}
      aria-label={label}
    >
      {feedback || label}
    </button>
  );
}

function Step({
  number,
  title,
  caption,
  active,
  done,
  children,
}: {
  number: number;
  title: string;
  caption: string;
  active: boolean;
  done: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      className={`step ${active ? "step-active" : ""} ${done ? "step-done" : ""}`}
      aria-labelledby={`step-${number}`}
    >
      <div className="step-heading">
        <span
          className="step-number"
          aria-label={done ? `Step ${number} completed` : `Step ${number}`}
        >
          {done ? "✓" : `0${number}`}
        </span>
        <div>
          <h2 id={`step-${number}`}>{title}</h2>
          <p>{caption}</p>
        </div>
        {done && <span className="done-label">Done</span>}
      </div>
      {children && <div className="step-body">{children}</div>}
    </section>
  );
}

function Inspector({
  traces,
  code,
  clear,
  theme,
}: {
  traces: Trace[];
  code: string;
  clear: () => void;
  theme: Theme;
}) {
  const [tab, setTab] = useState<"Code" | "Request" | "Response" | "Activity">(
    "Code",
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected =
    traces.find((item) => item.id === selectedId) ?? traces.at(-1);
  const content =
    tab === "Code"
      ? code
      : tab === "Request"
        ? selected
          ? pretty(selected.request)
          : "// Connect your wallet to inspect a request."
        : selected?.response !== undefined
          ? pretty(selected.response)
          : selected?.status === "pending"
            ? "// Waiting for the wallet or network…"
            : "// Responses will appear here. Nothing is simulated.";
  return (
    <aside className="inspector" aria-label="Developer inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">DEVELOPER VIEW</span>
          <h2>Under the hood</h2>
        </div>
        <span className="live-indicator">
          <i /> Live
        </span>
      </div>
      <p className="inspector-description">
        Real calls. Readable inputs. Every response.
      </p>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Inspector views"
      >
        {(["Code", "Request", "Response", "Activity"] as const).map((name) => (
          <button
            key={name}
            role="tab"
            id={`tab-${name}`}
            aria-controls="inspector-content"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
            {name === "Activity" && <span>{traces.length}</span>}
          </button>
        ))}
      </div>
      <div
        id="inspector-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "Activity" ? (
          <div className="activity-list">
            {traces.length === 0 && (
              <div className="empty-log">
                <span>⌘</span>
                <h3>Your integration, step by step.</h3>
                <p>
                  Connect a wallet to start the activity log. This panel records
                  actual calls, never sample results.
                </p>
              </div>
            )}
            {[...traces].reverse().map((item) => (
              <button
                className="activity-item"
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setTab("Response");
                }}
              >
                <span className={`log-dot ${item.status}`} />
                <span>
                  <strong>{item.method}</strong>
                  <small>
                    {new Date(item.time).toLocaleTimeString("en-US")} ·{" "}
                    {item.status}
                  </small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="code-caption">
              <span>
                {tab === "Code"
                  ? "integration.ts · abbreviated"
                  : (selected?.method ?? "No requests yet")}
              </span>
              <CopyButton text={content} />
            </div>
            <SyntaxCode
              code={content}
              language={tab === "Code" ? "typescript" : "json"}
              theme={theme}
              label={
                tab === "Code"
                  ? "TypeScript integration example"
                  : `${tab} JSON`
              }
            />
          </>
        )}
      </div>
      <div className="inspector-footer">
        <span>
          <i /> {traces.length} calls this session
        </span>
        <button
          onClick={() => {
            clear();
            setSelectedId(null);
          }}
        >
          Clear log
        </button>
      </div>
      <div className="inspector-note">
        Logs stay in this page and disappear on reload. They may contain public
        addresses and signed XDR. No private keys or seed phrases are requested.
      </div>
    </aside>
  );
}

export default function App({ controller }: { controller: DemoController }) {
  const { theme, toggleTheme } = useTheme();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [provider, setProvider] = useState(providerStatus);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const refresh = () => setProvider(providerStatus());
    window.addEventListener("scopuly#initialized", refresh);
    window.addEventListener("focus", refresh);
    const interval = setInterval(() => {
      refresh();
      setNow(Date.now());
    }, 1000);
    return () => {
      window.removeEventListener("scopuly#initialized", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, []);

  const {
    session,
    account,
    prepared,
    signedXdr,
    submission,
    network,
    mode,
    phase,
  } = state;
  const busy = phase !== "idle";
  const mainnet = network === "mainnet";
  const networkInfo = NETWORKS[network];
  const pending = submission?.status === "unknown";
  const expired = !!prepared && now / 1000 >= prepared.expiresAt;
  const canSpend = !mainnet || state.mainnetAcknowledged;
  const canConnect =
    mode === "walletconnect"
      ? WALLETCONNECT_CONFIGURED
      : provider !== "missing";
  const completed = [
    !!session,
    !!account,
    !!prepared,
    !!signedXdr,
    submission?.status === "success",
  ];
  const activeStep = completed.findIndex((done) => !done);
  const code = integrationSnippet(mode, network);

  return (
    <div className={`app ${mainnet ? "mainnet" : ""}`}>
      <a className="skip-link" href="#demo">
        Skip to demo
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href={EXTENSION}
            target="_blank"
            rel="noreferrer"
          >
            <BrandLogo />
            <span className="brand-divider" />
            <span className="brand-product">Connect Lab</span>
          </a>
          <nav aria-label="Resources">
            <ExternalLink href={DOCS}>Developer docs</ExternalLink>
            <ExternalLink href="https://github.com/Scopuly/scopuly-browser-extension">
              Extension source
            </ExternalLink>
          </nav>
          <div className="header-controls">
            <div
              className="network-switch"
              role="group"
              aria-label="Stellar network"
            >
              {(["testnet", "mainnet"] as NetworkId[]).map((id) => (
                <button
                  key={id}
                  aria-pressed={network === id}
                  className={network === id ? "selected" : ""}
                  disabled={busy || pending}
                  onClick={() => {
                    if (id !== network) void controller.selectNetwork(id);
                  }}
                >
                  <span className={`network-dot ${id}`} />
                  {NETWORKS[id].label}
                </button>
              ))}
            </div>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              {theme === "light" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 15.1A8.3 8.3 0 0 1 8.9 4a8.5 8.5 0 1 0 11.1 11.1Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span /> BUILT ON STELLAR{" "}
                <span className="kicker-divider">/</span> MADE FOR DEVELOPERS
              </div>
              <h1>
                From connect
                <br />
                to <span>confirmed.</span>
              </h1>
              <p>
                A working wallet integration, one transparent step at a time.
                <br className="desktop-break" /> Connect Scopuly. Sign a
                transaction. See exactly what happens.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#demo">
                  Try the integration <span aria-hidden="true">↓</span>
                </a>
                <a
                  className="button secondary"
                  href={DOCS}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the docs <Arrow />
                </a>
              </div>
              <div className="hero-meta">
                <span>
                  <i aria-hidden="true">✓</i> Your keys stay in Scopuly
                </span>
                <span>
                  <i aria-hidden="true">✓</i> Every step is inspectable
                </span>
              </div>
            </div>
            <HeroFlow />
          </section>

          <div className={`environment-banner ${mainnet ? "warning" : ""}`}>
            <span className="banner-icon" aria-hidden="true">
              {mainnet ? "!" : "✓"}
            </span>
            <div>
              <strong>
                {mainnet
                  ? "You are on Mainnet"
                  : "Testnet by default. You stay in control."}
              </strong>
              <span>
                {mainnet
                  ? `This demo sends ${NETWORKS.mainnet.demoAmount} real XLM back to your own account. A real network fee is deducted. Nothing is submitted automatically.`
                  : "Free test funds, explicit wallet approvals, and a separate submit step. No secret keys. No automatic payments."}
              </span>
            </div>
            <span className="network-tag">{networkInfo.label}</span>
          </div>

          <div className="progress-strip" aria-label="Demo progress">
            {steps.map((step, i) => (
              <div
                key={step}
                className={
                  completed[i] ? "complete" : i === activeStep ? "current" : ""
                }
              >
                <span>{completed[i] ? "✓" : `0${i + 1}`}</span>
                {step}
                {i < steps.length - 1 && <b aria-hidden="true">→</b>}
              </div>
            ))}
          </div>

          <div className="workspace" id="demo">
            <div className="workflow">
              {state.notice && (
                <div
                  role={state.notice.tone === "error" ? "alert" : "status"}
                  className={`notice ${state.notice.tone}`}
                >
                  {state.notice.message}
                </div>
              )}
              <Step
                number={1}
                title="Connect your wallet"
                caption="Choose how your app talks to Scopuly."
                active={!session}
                done={!!session}
              >
                <div
                  className="method-switch"
                  role="group"
                  aria-label="Connection method"
                >
                  {methods.map((method) => (
                    <button
                      key={method.id}
                      aria-pressed={mode === method.id}
                      className={mode === method.id ? "selected" : ""}
                      disabled={busy || pending}
                      onClick={() => {
                        if (method.id !== mode)
                          void controller.selectMode(method.id);
                      }}
                    >
                      <strong>{method.title}</strong>
                      <small>{method.subtitle}</small>
                    </button>
                  ))}
                </div>
                {!session ? (
                  <>
                    {mode === "walletconnect" ? (
                      <div className="setup-note">
                        <strong>
                          {WALLETCONNECT_CONFIGURED
                            ? "Connect without a browser extension"
                            : "One small setup step"}
                        </strong>
                        <p>
                          {WALLETCONNECT_CONFIGURED
                            ? "Choose Scopuly in the WalletConnect dialog and approve the session in the app. The session will request only the selected Stellar network."
                            : "Add your Reown project ID as VITE_WALLETCONNECT_PROJECT_ID in .env.local, then restart. Wallets Kit and Provider API work without this."}
                        </p>
                        {!WALLETCONNECT_CONFIGURED && (
                          <ExternalLink href="https://dashboard.reown.com/">
                            Get a project ID
                          </ExternalLink>
                        )}
                      </div>
                    ) : (
                      <div className="setup-note">
                        <div className="provider-status">
                          <span
                            className={`status-dot ${provider === "missing" ? "" : "connected"}`}
                          />
                          <strong>
                            {provider === "extension"
                              ? "Scopuly extension detected"
                              : provider === "mobile"
                                ? "Scopuly in-app browser detected"
                                : "Waiting for Scopuly"}
                          </strong>
                        </div>
                        <p>
                          {provider === "missing"
                            ? "Install the extension, pair it with Scopuly on your signing device, and reload this page. Or open this page in Scopuly’s in-app browser."
                            : `Open your paired Scopuly app and select ${networkInfo.label}. Approve account access when prompted.`}
                        </p>
                        {provider === "missing" && (
                          <ExternalLink href={EXTENSION}>
                            Install & pair Scopuly
                          </ExternalLink>
                        )}
                      </div>
                    )}
                    <button
                      className="button primary full-width"
                      disabled={busy || !canConnect || pending}
                      onClick={() => void controller.connect()}
                    >
                      {phase === "connecting"
                        ? "Waiting for wallet approval…"
                        : mode === "walletconnect"
                          ? "Connect with WalletConnect"
                          : "Connect Scopuly"}
                      <span aria-hidden="true">→</span>
                    </button>
                    <p className="microcopy">
                      Shares your public address. Never your private keys.
                    </p>
                  </>
                ) : (
                  <div className="connected-account">
                    <div>
                      <span className="eyebrow">
                        CONNECTED ACCOUNT · {networkInfo.label.toUpperCase()}
                      </span>
                      <strong title={session.address}>
                        {short(session.address)}
                      </strong>
                      <details>
                        <summary>Show full address</summary>
                        <code>{session.address}</code>
                      </details>
                    </div>
                    <div className="account-actions">
                      <CopyButton text={session.address} label="Copy address" />
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void controller.disconnect()}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </Step>

              <Step
                number={2}
                title="Check your balance"
                caption={
                  mainnet
                    ? "Use an existing funded Mainnet account."
                    : "Start with free XLM from Stellar Friendbot."
                }
                active={!!session && !account}
                done={!!account}
              >
                {session && (
                  <>
                    <div className="balance-row">
                      <div>
                        <span className="eyebrow">
                          {networkInfo.label.toUpperCase()} BALANCE
                        </span>
                        <strong>
                          {account
                            ? Number(account.balance).toLocaleString("en-US", {
                                maximumFractionDigits: 7,
                              })
                            : "—"}{" "}
                          <span>XLM</span>
                        </strong>
                      </div>
                      <span className="pill">
                        {mainnet ? "Real funds" : "Test funds"}
                      </span>
                    </div>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void controller.refreshAccount()}
                      >
                        {phase === "loading" ? "Loading…" : "Refresh balance"}
                      </button>
                      {!mainnet && (
                        <button
                          className="button secondary"
                          disabled={busy || !!account}
                          onClick={() => void controller.fund()}
                        >
                          {phase === "funding"
                            ? "Requesting test XLM…"
                            : "Get test XLM"}
                        </button>
                      )}
                    </div>
                    <p className="microcopy">
                      {mainnet
                        ? "Friendbot is not available on Mainnet. Funding is always your choice."
                        : "Friendbot creates and funds a new Testnet account. No purchase or real funds required."}
                    </p>
                  </>
                )}
              </Step>

              <Step
                number={3}
                title="Prepare a self-payment"
                caption={`${NETWORKS[state.network].demoAmount} XLM to your own address. Only the network fee leaves your balance.`}
                active={!!account && !prepared}
                done={!!prepared}
              >
                {session && (
                  <>
                    {mainnet && (
                      <label className="risk-confirmation">
                        <input
                          type="checkbox"
                          checked={state.mainnetAcknowledged}
                          disabled={busy}
                          onChange={(event) =>
                            controller.acknowledgeMainnet(event.target.checked)
                          }
                        />
                        <span>
                          I understand this is Mainnet and submitting a
                          transaction spends a real XLM network fee.
                        </span>
                      </label>
                    )}
                    <button
                      className="button secondary"
                      disabled={busy || !canSpend || pending}
                      onClick={() => void controller.prepare()}
                    >
                      {phase === "preparing"
                        ? "Preparing…"
                        : prepared
                          ? "Prepare a fresh transaction"
                          : "Prepare transaction"}
                      <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}
                {prepared && (
                  <>
                    <dl className="transaction-details">
                      <div>
                        <dt>Network</dt>
                        <dd>{networkInfo.label}</dd>
                      </div>
                      <div>
                        <dt>Operation</dt>
                        <dd>Payment to self</dd>
                      </div>
                      <div>
                        <dt>Destination (your own account)</dt>
                        <dd title={prepared.address}>
                          {short(prepared.address)}
                        </dd>
                      </div>
                      <div>
                        <dt>Amount</dt>
                        <dd>
                          {NETWORKS[state.network].demoAmount} XLM{" "}
                          <span>(stays in your account)</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Maximum fee</dt>
                        <dd>{MAX_FEE_XLM} XLM</dd>
                      </div>
                      <div>
                        <dt>Memo</dt>
                        <dd>Scopuly connect demo</dd>
                      </div>
                      <div>
                        <dt>Valid for</dt>
                        <dd className={expired ? "expired" : ""}>
                          {expired
                            ? "Expired — prepare again"
                            : `${Math.max(0, Math.ceil(prepared.expiresAt - now / 1000))} seconds`}
                        </dd>
                      </div>
                    </dl>
                    <details className="xdr-details">
                      <summary>Inspect unsigned transaction XDR</summary>
                      <CopyButton
                        text={prepared.unsignedXdr}
                        label="Copy unsigned XDR"
                      />
                      <pre>{prepared.unsignedXdr}</pre>
                    </details>
                  </>
                )}
              </Step>

              <Step
                number={4}
                title="Review & sign"
                caption="Approve on your signing device. Signing alone sends nothing."
                active={!!prepared && !signedXdr}
                done={!!signedXdr}
              >
                {prepared && (
                  <>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        expired ||
                        !canSpend ||
                        !!signedXdr ||
                        !!submission ||
                        !session
                      }
                      onClick={() => void controller.sign()}
                    >
                      {phase === "signing"
                        ? "Approve in Scopuly…"
                        : signedXdr
                          ? "Signature verified ✓"
                          : "Sign with Scopuly"}
                      <span aria-hidden="true">→</span>
                    </button>
                    {signedXdr && (
                      <details className="xdr-details">
                        <summary>Inspect signed transaction XDR</summary>
                        <CopyButton text={signedXdr} label="Copy signed XDR" />
                        <pre>{signedXdr}</pre>
                      </details>
                    )}
                  </>
                )}
              </Step>

              <Step
                number={5}
                title="Submit & verify"
                caption="A separate, explicit action sends the signed transaction to Stellar."
                active={!!signedXdr && !submission}
                done={submission?.status === "success"}
              >
                {signedXdr && !submission && (
                  <button
                    className={`button ${mainnet ? "mainnet-submit" : "primary"}`}
                    disabled={busy || expired || !canSpend || !session}
                    onClick={() => void controller.submit()}
                  >
                    {phase === "submitting"
                      ? "Submitting…"
                      : `Submit to ${networkInfo.label}`}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
                {submission && (
                  <div className={`receipt ${submission.status}`}>
                    <div className="receipt-title">
                      <span>
                        {submission.status === "success"
                          ? "✓"
                          : submission.status === "failed"
                            ? "!"
                            : "◷"}
                      </span>
                      <strong>
                        {phase === "submitting"
                          ? "Awaiting network confirmation"
                          : submission.status === "success"
                            ? "Confirmed on Stellar"
                            : submission.status === "failed"
                              ? "Transaction failed"
                              : "Confirmation pending"}
                      </strong>
                    </div>
                    <p>
                      {NETWORKS[submission.network].label}
                      {submission.ledger
                        ? ` · Ledger ${submission.ledger.toLocaleString("en-US")}`
                        : ""}
                    </p>
                    <code>{submission.hash}</code>
                    <div className="button-row">
                      <ExternalLink
                        href={`${NETWORKS[submission.network].explorer}/tx/${submission.hash}`}
                      >
                        View in explorer
                      </ExternalLink>
                      <CopyButton text={submission.hash} label="Copy hash" />
                    </div>
                    {pending && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void controller.checkStatus()}
                      >
                        {phase === "checking"
                          ? "Checking…"
                          : "Check transaction status"}
                      </button>
                    )}
                    {submission.status === "success" && (
                      <p className="microcopy">
                        End-to-end complete. Refresh your balance to see the
                        network fee.
                      </p>
                    )}
                  </div>
                )}
              </Step>
            </div>
            <div className="developer-column">
              <Inspector
                traces={state.traces}
                code={code}
                clear={controller.clearTraces}
                theme={theme}
              />
              <div className="developer-help">
                <span className="eyebrow">BUILD YOUR OWN</span>
                <h3>Three ways in. One wallet.</h3>
                <p>
                  Use Wallets Kit for a multi-wallet app, Provider API for
                  direct control, or WalletConnect for a remote session.
                </p>
                <ExternalLink href={DOCS}>
                  Read the integration guide
                </ExternalLink>
              </div>
            </div>
          </div>
          <section className="ready-check" aria-labelledby="ready-title">
            <span className="eyebrow">BEFORE YOU CONNECT</span>
            <h3 id="ready-title">A quick setup check.</h3>
            <ul>
              <li>
                <span aria-hidden="true">01</span>
                <div>
                  <strong>Keep Scopuly up to date</strong>
                  <p>
                    Open the app on your signing device before requesting
                    access.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <div>
                  <strong>Pair once, approve each request</strong>
                  <p>
                    Use the paired extension or the in-app browser.
                    WalletConnect is a separate connection.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <div>
                  <strong>Match the network</strong>
                  <p>
                    Choose the same network in Scopuly and in the topbar. Start
                    with Testnet.
                  </p>
                </div>
              </li>
            </ul>
            <ExternalLink href={EXTENSION}>
              Install & set up Scopuly
            </ExternalLink>
          </section>

          <section className="how-it-works">
            <div>
              <span className="eyebrow">THE TRUST BOUNDARY</span>
              <h2>
                Your app requests.
                <br />
                Your wallet approves.
              </h2>
            </div>
            <p>
              The dApp builds the transaction. Scopuly reviews and signs it on
              your signing device. This demo checks the signature and submits
              only when you ask it to. The browser extension does not store your
              secret keys.
            </p>
            <ExternalLink href="https://github.com/Creit-Tech/Stellar-Wallets-Kit">
              Explore Stellar Wallets Kit
            </ExternalLink>
          </section>
          <section className="faq-section" aria-labelledby="faq-title">
            <div className="faq-heading">
              <span className="eyebrow">GOOD TO KNOW</span>
              <h2 id="faq-title">
                A little context.
                <br />A smoother connection.
              </h2>
              <p>
                Answers to the things that can otherwise slow down your first
                integration.
              </p>
              <ExternalLink href={DOCS}>
                Full provider documentation
              </ExternalLink>
            </div>
            <div className="faq-items">
              <details>
                <summary>
                  Why does the extension need the Scopuly app?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  The extension connects your dApp to a paired Scopuly signing
                  device on iOS, Android, or macOS. Your keys stay on that
                  device. You review and approve sensitive requests there; the
                  extension does not hold your secret keys.
                </p>
              </details>
              <details>
                <summary>
                  Do all three methods need an extension?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  No. Wallets Kit and Provider API use the provider from the
                  extension or Scopuly’s in-app browser. WalletConnect creates a
                  separate remote session and does not require an extension. It
                  needs a Reown project ID configured by the developer.
                </p>
              </details>
              <details>
                <summary>
                  Will this demo spend my XLM?<span aria-hidden="true">+</span>
                </summary>
                <p>
                  On Testnet, funds have no monetary value. On Mainnet, the demo
                  sends {NETWORKS.mainnet.demoAmount} XLM back to your own
                  account and deducts a real network fee, capped here at{" "}
                  {MAX_FEE_XLM} XLM. Signing does not submit anything: you must
                  press the separate submit button. Ledger-included failures may
                  also incur a fee.
                </p>
              </details>
              <details>
                <summary>
                  What if a request stalls or the network changes?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  Check that Scopuly is open and online and the wallet network
                  matches the demo. If an approval times out, close the pending
                  request before reconnecting. If submission is marked unknown,
                  check its original hash in the explorer instead of sending
                  another transaction.
                </p>
              </details>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
