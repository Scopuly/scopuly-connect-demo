import BrandLogo from "./BrandLogo";

type FooterLink = { label: string; href: string; badge?: string };
const groups: { title: string; links: FooterLink[] }[] = [
  {
    title: "Scopuly apps",
    links: [
      { label: "Web app", href: "https://app.scopuly.com/" },
      {
        label: "iOS app",
        href: "https://apps.apple.com/app/id1383402218?platform=iphone",
      },
      {
        label: "Android app",
        href: "https://play.google.com/store/apps/details?id=com.sdex.app",
      },
      {
        label: "macOS app",
        href: "https://apps.apple.com/app/id1383402218?platform=mac",
      },
      { label: "Browser extension", href: "https://extension.scopuly.com/" },
    ],
  },
  {
    title: "Build & explore",
    links: [
      {
        label: "AI Payments",
        href: "https://app.scopuly.com/ai-payments/",
      },
      {
        label: "Provider playground",
        href: "https://extension.scopuly.com/playground/",
      },
      {
        label: "x402 payments demo",
        href: "https://app.scopuly.com/x402-demo/",
        badge: "Mainnet",
      },
      {
        label: "Provider API",
        href: "https://extension.scopuly.com/docs/provider-api/",
      },
      {
        label: "Integration guide",
        href: "https://extension.scopuly.com/docs/integration/",
      },
      {
        label: "Signer API on npm",
        href: "https://www.npmjs.com/package/@scopuly/signer-extension-api",
      },
      {
        label: "x402 gateway status",
        href: "https://api.scopuly.com/x402/status",
      },
    ],
  },
  {
    title: "Open source",
    links: [
      {
        label: "Browser extension",
        href: "https://github.com/Scopuly/scopuly-browser-extension",
      },
      {
        label: "Signer Extension API",
        href: "https://github.com/Scopuly/signer-extension-api",
      },
      {
        label: "x402 Stellar Guard",
        href: "https://github.com/Scopuly/x402-stellar-guard",
        badge: "Preview",
      },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Scopuly ecosystem">
      <div className="footer-main">
        <div className="footer-brand">
          <a
            href="https://scopuly.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="Scopuly home"
          >
            <BrandLogo />
          </a>
          <h2>
            More ways to connect.
            <br />
            More things to build.
          </h2>
          <p>
            Explore Scopuly apps, hands-on demos, and open-source tools for your
            next Stellar integration.
          </p>
          <div className="footer-socials" aria-label="Scopuly community">
            <a
              href="https://github.com/Scopuly"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <span aria-hidden="true">↗</span>
            </a>
            <a href="https://x.com/scopuly" target="_blank" rel="noreferrer">
              X <span aria-hidden="true">↗</span>
            </a>
            <a href="https://t.me/scopuly" target="_blank" rel="noreferrer">
              Telegram <span aria-hidden="true">↗</span>
            </a>
            <a
              href="https://scopuly.medium.com/"
              target="_blank"
              rel="noreferrer"
            >
              Medium <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <nav
          className="footer-navigation"
          aria-label="Scopuly products and developer resources"
        >
          {groups.map((group) => (
            <div className="footer-group" key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer">
                      <span>{link.label}</span>
                      {link.badge && (
                        <small className="footer-badge">{link.badge}</small>
                      )}
                      <span className="footer-link-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} Scopuly{" "}
          <span className="footer-dot">·</span> Connect Lab
        </span>
        <span className="footer-built">Built for Stellar developers</span>
        <a href="mailto:info@scopuly.com">
          Contact Scopuly <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}
