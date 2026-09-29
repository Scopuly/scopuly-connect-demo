import BrandLogo from "./BrandLogo";

export default function HeroFlow() {
  return (
    <div
      className="hero-flow"
      aria-label="Connection flow illustration, not a live session"
    >
      <div className="flow-orbit flow-orbit-outer" aria-hidden="true" />
      <div className="flow-orbit flow-orbit-inner" aria-hidden="true" />
      <div className="flow-star flow-star-one" aria-hidden="true">
        ✦
      </div>
      <div className="flow-star flow-star-two" aria-hidden="true">
        ✦
      </div>
      <div className="flow-browser">
        <div className="flow-browser-bar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>your-dapp.dev</span>
          <span aria-hidden="true">↗</span>
        </div>
        <div className="flow-browser-body">
          <span className="flow-label">01 / YOUR APPLICATION</span>
          <h2>Make the request.</h2>
          <div className="flow-code">
            <code>
              <span>await</span> wallet.getAddress();
              <br />
              <span>await</span> wallet.signTransaction(xdr);
            </code>
          </div>
          <span className="flow-chip">Public address. No secret keys.</span>
        </div>
      </div>
      <div className="flow-connector" aria-hidden="true">
        <span />
        <b>↗</b>
        <span />
      </div>
      <div className="flow-wallet">
        <span className="phone-notch" aria-hidden="true" />
        <BrandLogo />
        <span className="flow-label">02 / YOUR SIGNING DEVICE</span>
        <h3>
          You review.
          <br />
          You approve.
        </h3>
        <div className="flow-wallet-detail">
          <span>Keys stay with you</span>
          <span aria-hidden="true">◇</span>
        </div>
        <span className="flow-approval">
          <span aria-hidden="true">✓</span> Explicit approval
        </span>
      </div>
      <div className="flow-stellar">
        <span className="stellar-orbit-icon" aria-hidden="true">
          ↗
        </span>
        <div>
          <span className="flow-label">03 / STELLAR NETWORK</span>
          <strong>Submit when you’re ready.</strong>
        </div>
      </div>
      <p className="flow-caption">
        CONNECTION FLOW <span>·</span> NOT A LIVE SESSION
      </p>
    </div>
  );
}
