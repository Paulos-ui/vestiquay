"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import Brand from "./Brand";
import { Chart } from "./Chart";
import Icon, { type IconName } from "./Icon";
import Passage from "./Passage";
import ThemeToggle from "./ThemeToggle";
import WithdrawalGuide from "./WithdrawalGuide";
import {
  publicRecovery,
  nearExplorer,
  stakingContract,
} from "../lib/contracts";

const proofUrl = "/desk?tab=Receipt&proof=example";
const navLinks = [
  ["Workflow", "#recovery"],
  ["Proof", "#proof"],
  ["Independent client", "#independent"],
  ["Guide", "#guide"],
];
const actions: { icon: IconName; title: string; copy: string; href: string }[] =
  [
    {
      icon: "search",
      title: "Inspect a position",
      copy: "Read the shares, pending amount and withdrawal status of any NEAR account.",
      href: "/desk?account=lp.ref-labs.near",
    },
    {
      icon: "lock",
      title: "Claim unlocked NEAR",
      copy: "Review the amount and sign a withdrawal once the staking contract marks it eligible.",
      href: "/desk",
    },
    {
      icon: "receipt",
      title: "Verify the payout",
      copy: "Trace the successful transfer from the staking contract to the signing account.",
      href: proofUrl,
    },
  ];
function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0.72, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: reduced ? 0 : 0.46, ease: [0.22, 0.64, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const reduced = useReducedMotion();
  const hero = useRef<HTMLElement>(null);
  const route = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: routeScroll } = useScroll({
    target: route,
    offset: ["start end", "end start"],
  });
  const heroY = useTransform(heroScroll, [0, 1], [0, 77]);
  const fixed = useMotionValue(1);

  useEffect(() => {
    if (location.hash === "#desk") location.replace("/desk");
  }, []);

  return (
    <div className="port">
      <a className="skipLink button" href="#main">
        Skip to content
      </a>
      <header
        className="siteHeader"
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenu(false);
        }}
      >
        <div className="siteHeaderInner">
          <Brand />
          <nav
            id="site-menu"
            className={menu ? "siteNav isOpen" : "siteNav"}
            aria-label="Main navigation"
          >
            {navLinks.map(([name, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>
                {name}
              </a>
            ))}
          </nav>
          <div className="siteHeaderActions">
            <ThemeToggle />
            <button
              className="menuToggle"
              type="button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              aria-controls="site-menu"
              onClick={() => setMenu(!menu)}
            >
              <Icon name={menu ? "close" : "menu"} />
            </button>
            <a className="button siteLaunch" href="/desk">
              Open desk <Icon name="diagonal" />
            </a>
          </div>
        </div>
      </header>
      <main id="main">
        <section ref={hero} className="hero">
          <motion.div
            className="heroArt"
            style={reduced ? undefined : { y: heroY }}
            aria-hidden="true"
          />
          <div className="heroOverlay" aria-hidden="true" />
          <div className="frame heroFrame">
            <motion.div
              className="heroContent"
              initial={reduced ? false : { opacity: 0.72, y: 13 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.5 }}
            >
              <span className="networkLabel">NEAR mainnet · Rhea Finance</span>
              <h1>
                Your stake.
                <br />
                Your <em>way out.</em>
              </h1>
              <p>
                Recover your Rhea staking position when its website is
                unavailable. Claim unlocked NEAR and verify the payout onchain.
              </p>
              <div className="heroActions">
                <a className="button" href="/desk">
                  Open recovery desk <Icon name="arrow" />
                </a>
                <a className="button secondary" href={proofUrl}>
                  Verify a withdrawal <Icon name="diagonal" />
                </a>
              </div>
            </motion.div>
            <a href="#position" className="heroScroll">
              <Icon name="down" /> Explore recovery
            </a>
          </div>
        </section>

        <section id="position" className="landingSection positionSection">
          <div className="frame">
            <Reveal className="sectionHeading center">
              <p className="eyebrow">Rhea staking recovery</p>
              <h2>Access your position directly on NEAR.</h2>
              <p>
                The staking contract still holds your position when its website
                is out of reach. Start with a public lookup and sign only when
                you’re ready to act.
              </p>
            </Reveal>
            <Reveal className="actionTiles">
              {actions.map(({ icon, title, copy, href }) => (
                <a className="actionTile" key={title} href={href}>
                  <span className="tileIcon">
                    <Icon name={icon} />
                  </span>
                  <Icon className="tileArrow" name="diagonal" />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </a>
              ))}
            </Reveal>
            <Reveal className="lookupStrip">
              <div>
                <h3>Look up a NEAR account</h3>
                <p>Try the prefilled public account or enter your own.</p>
              </div>
              <form action="/desk">
                <label className="srOnly" htmlFor="public-account">
                  NEAR account
                </label>
                <input
                  id="public-account"
                  name="account"
                  defaultValue="lp.ref-labs.near"
                  required
                  maxLength={64}
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button className="button" type="submit">
                  Inspect position <Icon name="arrow" />
                </button>
              </form>
            </Reveal>
          </div>
        </section>

        <section id="recovery" className="landingSection workflowSection">
          <div className="frame sectionSplit">
            <Reveal className="sectionHeading">
              <p className="eyebrow">The recovery workflow</p>
              <h2>From staking shares to your wallet.</h2>
              <p>
                Walk through each stage and see when a wallet signature is
                needed. The contract decides when a pending withdrawal unlocks.
              </p>
            </Reveal>
            <Reveal>
              <Passage />
            </Reveal>
          </div>
        </section>

        <section id="proof" className="landingSection proofSection">
          <div className="frame sectionSplit proofSplit">
            <Reveal className="proofIllustration">
              <div className="illustratedReceipt">
                <span className="receiptSeal">
                  <Icon name="receipt" />
                </span>
                <p className="eyebrow">Historical NEAR transaction</p>
                <h3>Rhea withdrawal</h3>
                <dl>
                  <div>
                    <dt>Signing account</dt>
                    <dd>{publicRecovery.account}</dd>
                  </div>
                  <div>
                    <dt>Contract</dt>
                    <dd>{stakingContract}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>withdraw_all</dd>
                  </div>
                </dl>
                <a
                  className="inlineLink"
                  href={nearExplorer(publicRecovery.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on NearBlocks <Icon name="diagonal" />
                </a>
              </div>
            </Reveal>
            <Reveal className="sectionHeading">
              <p className="eyebrow">Onchain proof</p>
              <h2>See what reached the wallet.</h2>
              <p>
                Open a historical mainnet withdrawal and have Vestiquay read the
                chain again. The receipt shows final execution and the exact
                amount from the matching transfer.
              </p>
              <a className="button" href={proofUrl}>
                Verify on NEAR <Icon name="arrow" />
              </a>
            </Reveal>
          </div>
        </section>

        <section id="independent" className="landingSection independentSection">
          <div className="frame sectionSplit">
            <Reveal className="sectionHeading">
              <p className="eyebrow">Independent client</p>
              <h2>Keep the recovery desk with you.</h2>
              <p>
                Save one HTML file before an outage. Serve it from another
                origin, inspect a position, or import a receipt and verify it
                directly on NEAR.
              </p>
              <a className="button" href="/recovery.html" download>
                Download recovery client <Icon name="download" />
              </a>
            </Reveal>
            <Reveal className="downloadPlate">
              <div className="fileIdentity">
                <span>
                  <Icon name="download" />
                </span>
                <strong>recovery.html</strong>
                <small>HTML</small>
              </div>
              <dl>
                <div>
                  <dt>Public reads</dt>
                  <dd>NEAR RPC</dd>
                </div>
                <div>
                  <dt>Unstake and claim</dt>
                  <dd>Compatible wallet · HTTPS or localhost</dd>
                </div>
                <div>
                  <dt>Receipt verification</dt>
                  <dd>Import a saved JSON or paste a transaction hash</dd>
                </div>
              </dl>
              <a className="inlineLink" href="#guide">
                Read the field guide <Icon name="down" />
              </a>
            </Reveal>
          </div>
        </section>

        <section
          id="routes"
          ref={route}
          className="landingSection routeSection"
        >
          <div className="frame sectionSplit routeSplit">
            <Reveal className="routeArt">
              <Chart progress={reduced ? fixed : routeScroll} />
              <p>Illustrated route · NEAR to Solana</p>
            </Reveal>
            <Reveal className="sectionHeading">
              <p className="eyebrow">Optional cross-chain route</p>
              <h2>Choose where the funds go next.</h2>
              <p>
                Keep the proceeds on NEAR or request a Rhea quote for USDC on
                Solana. Review the recipient, minimum output and quote expiry
                before signing.
              </p>
              <a className="inlineLink" href="/desk?tab=Route">
                Check Rhea routing access <Icon name="diagonal" />
              </a>
            </Reveal>
          </div>
        </section>

        <section id="guide" className="landingSection guideSection">
          <div className="frame sectionSplit">
            <Reveal className="sectionHeading">
              <p className="eyebrow">Field guide</p>
              <h2>Before you recover.</h2>
              <p>
                What to expect from the lookup, claim and verification steps.
              </p>
            </Reveal>
            <Reveal>
              <WithdrawalGuide />
            </Reveal>
          </div>
        </section>

        <section className="landingSection closeSection">
          <Reveal className="frame sectionHeading center">
            <h2>Start with a NEAR account.</h2>
            <a className="button" href="/desk">
              Open recovery desk <Icon name="arrow" />
            </a>
          </Reveal>
        </section>
      </main>
      <footer className="siteFooter">
        <div className="frame footerGrid">
          <div>
            <Brand />
            <p>Rhea staking recovery on NEAR.</p>
          </div>
          <div className="footerLinks">
            <strong>Vestiquay</strong>
            <a href="/desk">Recovery desk</a>
            <a href="#guide">Field guide</a>
            <a href="/recovery.html" download>
              Download client
            </a>
          </div>
          <div className="footerLinks">
            <strong>Project</strong>
            <a href="https://github.com/Paulos-ui/vestiquay">GitHub</a>
            <a href="/ref-inspector.html">Ref exchange inspector</a>
            <a href="/vestiquay-mark.svg" download>
              Brand mark
            </a>
          </div>
          <div className="footerLinks">
            <strong>Ecosystem</strong>
            <a href="https://near.org">NEAR Protocol</a>
            <a href="https://rhea.finance">Rhea Finance</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
