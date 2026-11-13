"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Icon, { type IconName } from "./Icon";

const stages: {
  label: string;
  icon: IconName;
  title: string;
  body: string;
  evidence: [string, string][];
  action: string;
  href: string;
}[] = [
  {
    label: "Inspect",
    icon: "search",
    title: "See what the contract holds.",
    body: "Enter a public NEAR account to see its rNEAR balance, NEAR pending and withdrawal eligibility.",
    evidence: [
      ["Source", "Rhea staking contract"],
      ["Signing", "Public read"],
    ],
    action: "Inspect a public position",
    href: "/desk?account=lp.ref-labs.near",
  },
  {
    label: "Unstake",
    icon: "layers",
    title: "Put a withdrawal in motion.",
    body: "Review how much rNEAR to unstake and the estimated NEAR amount. The wallet owner approves the request and the contract queues the withdrawal.",
    evidence: [
      ["Input", "rNEAR shares"],
      ["Signing", "Owner’s NEAR wallet"],
    ],
    action: "Review a position",
    href: "/desk",
  },
  {
    label: "Claim",
    icon: "lock",
    title: "Bring unlocked NEAR back.",
    body: "Once the contract confirms eligibility, review the exact claim amount and sign. The transfer goes to the signing account.",
    evidence: [
      ["Eligibility", "Checked onchain"],
      ["Destination", "Signing NEAR account"],
    ],
    action: "Check eligibility",
    href: "/desk",
  },
  {
    label: "Verify",
    icon: "receipt",
    title: "See the payout onchain.",
    body: "Check the final transaction and its transfer receipt. Export the account and hash to verify them from another device or the independent client.",
    evidence: [
      ["Execution", "NEAR finality"],
      ["Payout", "Matching transfer receipt"],
    ],
    action: "Verify a historical withdrawal",
    href: "/desk?tab=Receipt&proof=example",
  },
];

export default function Passage() {
  const [index, select] = useState(0);
  const reduced = useReducedMotion();
  const stage = stages[index];

  return (
    <div className="passageControl">
      <div className="passageTabs" aria-label="Recovery workflow">
        {stages.map(({ label, icon }, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === i}
            onClick={() => select(i)}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <motion.div
        className="passageReadout"
        key={stage.label}
        initial={reduced ? false : { opacity: 0.55, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        aria-live="polite"
      >
        <div className="passageIcon">
          <Icon name={stage.icon} />
        </div>
        <h3>{stage.title}</h3>
        <p>{stage.body}</p>
        <dl>
          {stage.evidence.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <a className="inlineLink" href={stage.href}>
          {stage.action} <Icon name="diagonal" />
        </a>
      </motion.div>
    </div>
  );
}
