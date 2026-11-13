"use client";
import { useEffect, useRef, useState } from "react";
import { useMotionValue, useReducedMotion, useScroll } from "motion/react";
import { Chart } from "./Chart";
import WithdrawalGuide from "./WithdrawalGuide";
import Passage from "./Passage";
import Brand from "./Brand";

const steps = [
  [
    "Inspect the position",
    "Enter a public NEAR account. Read the rNEAR balance and any withdrawal waiting at the staking contract.",
  ],
  [
    "Check the unlock",
    "Review the amount the contract makes available. Sign the withdrawal in your own wallet once it is eligible.",
  ],
  [
    "Keep the receipt",
    "Keep the proceeds on NEAR or review a cross-chain quote. Save the receipt to follow destination delivery later.",
  ],
];
export default function Landing() {
  const [menu, setMenu] = useState(false);
  const route = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: route,
    offset: ["start end", "end start"],
  });
  const fixed = useMotionValue(1),
    reduced = useReducedMotion();
  useEffect(() => {
    if (location.hash === "#desk") location.replace("/desk");
  }, []);
  return (
    <div className="port">
      <header className="mast">
        <Brand />
        <button
          className="menuTrigger"
          aria-expanded={menu}
          aria-controls="section-menu"
          onClick={() => setMenu(!menu)}
        >
          Menu
        </button>
        <nav
          id="section-menu"
          className={menu ? "menuOpen" : ""}
          onClick={() => setMenu(false)}
        >
          <a href="#recovery">Recovery</a>
          <a href="#routes">Routes</a>
          <a href="#guide">Field guide</a>
        </nav>
        <a className="primary" href="/desk">
          Launch app →
        </a>
      </header>
      <main>
        <section className="opening">
          <div className="titleblock">
            <small className="networkTag">
              <i />
              NEAR mainnet　/　Rhea Finance
            </small>
            <h1>
              Your stake.
              <br />
              Your <em>way out.</em>
            </h1>
            <p>
              Find your rNEAR, reclaim unlocked NEAR, and track a transfer to
              Solana from one recovery desk.
            </p>
            <a className="primary" href="/desk">
              Open recovery desk →
            </a>
            <a className="secondary" href="#recovery">
              Explore the workflow ↓
            </a>
          </div>
          <div className="manifest">
            <div className="manifestTitle">
              <span>Recovery manifest</span>
              <small>rNEAR</small>
            </div>
            <div className="manifestArt" aria-hidden="true">
              <img src="/vestiquay-mark.svg" alt="" />
            </div>
            <div className="manifestRows">
              {[
                ["Position", "Staking shares", "rNEAR"],
                ["Route", "Cross-chain exit", "USDC"],
                ["Receipt", "Delivery record", "JSON"],
              ].map(([tab, label, asset]) => (
                <a key={tab} href={"/desk?tab=" + tab}>
                  <span>{label}</span>
                  <small>{asset}</small>
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <section className="lookup">
          <div>
            <small>PUBLIC ACCOUNT LOOKUP</small>
            <h2>Inspect a NEAR account.</h2>
          </div>
          <form action="/desk">
            <label htmlFor="public-account">NEAR account</label>
            <div>
              <input
                id="public-account"
                name="account"
                required
                defaultValue="lp.ref-labs.near"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button>Inspect position →</button>
            </div>
          </form>
        </section>
        <section className="why">
          <div>
            <small>WHY VESTIQUAY EXISTS</small>
            <h2>
              A missing interface.
              <br />A position still onchain.
            </h2>
          </div>
          <div>
            <p>
              Your rNEAR shares and pending withdrawals live in a staking
              contract. Losing access to the original website can leave you
              unsure what you own, when it unlocks, or where to collect it.
            </p>
            <p>
              Vestiquay gives you another way to read that contract. Start with
              a public account, review the withdrawal details, and connect your
              wallet only when you choose to sign.
            </p>
          </div>
        </section>
        <Passage />
        <WithdrawalGuide />
        <section className="sdkCredits">
          <div>
            <small>TECHNICAL INTEGRATION</small>
            <h2>Built with Rhea’s SDKs.</h2>
            <p>
              Vestiquay adapts two Rhea Finance SDKs into a single recovery
              desk. Your NEAR wallet authorizes each transaction.
            </p>
          </div>
          <dl>
            <div>
              <dt>Liquid staking</dt>
              <dd>
                <code>@rhea-finance/rnear-sdk</code>
                <p>
                  Reads balances and withdrawal eligibility, converts rNEAR
                  shares, and builds delayed unstake and claim transactions.
                </p>
              </dd>
            </div>
            <div>
              <dt>Cross-chain routing</dt>
              <dd>
                <code>@rhea-finance/cross-chain-aggregation-dex</code>
                <p>
                  Discovers supported assets, requests a route quote and
                  prepares the transfer from NEAR to USDC on Solana.
                </p>
              </dd>
            </div>
          </dl>
        </section>
        <section id="routes" ref={route} className="chapter channel">
          <div>
            <small>CROSS-CHAIN ROUTING</small>
            <h2>
              Choose the
              <br />
              <em>other shore.</em>
            </h2>
            <p>
              Once you have your NEAR, you can keep it or request a Rhea quote
              for USDC on Solana. Review the receiving address and minimum
              output before you sign.
            </p>
            <a href="/desk?tab=Route">Review a route ↗</a>
          </div>
          <div>
            <Chart progress={reduced ? fixed : scrollYProgress} />
            <small>NEAR → SOLANA　/　ILLUSTRATED ROUTE</small>
          </div>
        </section>
        <section id="guide" className="chapter">
          <small>ABOUT VESTIQUAY　/　FIELD GUIDE</small>
          <h2>
            From public account
            <br />
            to <em>delivery receipt.</em>
          </h2>
          <p>
            Anyone can inspect a public account. Only the wallet owner can
            authorize a withdrawal or send funds. Follow one position through
            the recovery desk.
          </p>
          <div className="steps">
            {steps.map(([title, copy], i) => (
              <article key={title}>
                <small>0{i + 1}</small>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="chapter manual">
          <div>
            <small>INDEPENDENT CLIENT</small>
            <h2>Keep a copy.</h2>
            <a className="primary" href="/recovery.html" download>
              Download recovery client ↓
            </a>
          </div>
          <div>
            {[
              [
                "What does the download contain?",
                "A single HTML file containing the recovery interface. Keep it before an outage. It still needs a working internet connection and NEAR RPC to read the contract.",
              ],
              [
                "When do I connect a wallet?",
                "Open the desk and select Connect NEAR wallet to inspect your own account. You can also look up a public account first. Signing a withdrawal is a separate wallet action. For signing from a downloaded copy, serve it over HTTPS or localhost if your wallet requires it.",
              ],
              [
                "What if my withdrawal is still locked?",
                "Return to the Position tab and check again. The contract determines when a withdrawal becomes eligible.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <Brand />
        <div className="ecoLinks">
          <small>BUILT ON</small>
          <a href="https://near.org">NEAR Protocol ↗</a>
          <a href="https://rhea.finance">Rhea Finance ↗</a>
        </div>
        <div className="ecoLinks">
          <small>PROJECT</small>
          <a href="https://github.com/Paulos-ui/vestiquay">
            GitHub repository ↗
          </a>
          <a href="/vestiquay-mark.svg" download>
            Brand mark ↓
          </a>
          <a href="/ref-inspector.html">Ref exchange inspector ↗</a>
        </div>
        <a href="/desk">Recovery desk ↗</a>
      </footer>
    </div>
  );
}
