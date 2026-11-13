"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
const states = [
  [
    "Holding",
    "Your stake is in shares.",
    "An rNEAR balance tells you how many shares the account holds. A withdrawal appears separately after an unstake request.",
    "Inspect shares",
  ],
  [
    "Waiting",
    "A withdrawal is pending.",
    "The staking contract records pending NEAR. An estimated unlock time helps you plan when to check again.",
    "Check eligibility",
  ],
  [
    "Eligible",
    "The owner can review a claim.",
    "Once the contract confirms eligibility, Vestiquay shows the receiver, amount and method. The wallet owner reviews the withdrawal before signing.",
    "Review withdrawal",
  ],
];
export default function WithdrawalGuide() {
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  return (
    <section className="evidenceGuide" aria-labelledby="evidence-title">
      <div>
        <small>READING A POSITION</small>
        <h2 id="evidence-title">
          What can I<br />
          <em>withdraw today?</em>
        </h2>
        <p>
          Shares held, NEAR waiting, and NEAR ready to claim answer different
          questions. Move through an example withdrawal to see what changes.
        </p>
      </div>
      <div className="stateSheet">
        <small>ILLUSTRATED WITHDRAWAL</small>
        <div className="stateRail" aria-label="Withdrawal stages">
          <motion.i
            aria-hidden="true"
            animate={{ scaleX: step / 2 }}
            transition={{ duration: reduced ? 0 : 0.45 }}
          />
          {states.map(([name], n) => (
            <button
              key={name}
              aria-pressed={step === n}
              onClick={() => setStep(n)}
            >
              <b aria-hidden="true">{n + 1}</b>
              {name}
            </button>
          ))}
        </div>
        <motion.div
          key={step}
          initial={reduced ? false : { y: 7, opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          aria-live="polite"
        >
          <h3>{states[step][1]}</h3>
          <p>{states[step][2]}</p>
          <small>NEXT ACTION　/　{states[step][3]}</small>
        </motion.div>
      </div>
    </section>
  );
}
