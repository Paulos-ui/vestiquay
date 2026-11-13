"use client";
import { useState } from "react";
const stages = [
  {
    name: "Position",
    title: "Find the account that holds your stake.",
    copy: "Enter a public NEAR account to read its rNEAR shares, pending NEAR and withdrawal eligibility. You can inspect a position before connecting a wallet.",
    fields: [
      ["Source", "Rhea staking contract"],
      ["Read", "Shares & pending NEAR"],
      ["Wallet signature", "None required"],
    ],
  },
  {
    name: "Route",
    title: "Decide where the proceeds should land.",
    copy: "After withdrawing, keep NEAR in your wallet or ask Rhea for a route to USDC on Solana. Compare expected and minimum output, then review the recipient before signing.",
    fields: [
      ["Source", "NEAR / wrapped NEAR"],
      ["Destination", "USDC on Solana"],
      ["Review", "Minimum output"],
    ],
  },
  {
    name: "Receipt",
    title: "Follow the transfer after you sign.",
    copy: "Keep the source transaction and Rhea order together. Refresh the order to check delivery, or export the receipt and reopen it on another device.",
    fields: [
      ["Source evidence", "Transaction hash"],
      ["Route evidence", "Rhea order ID"],
      ["Portable copy", "JSON receipt"],
    ],
  },
];
export default function Passage() {
  const [index, select] = useState(0),
    stage = stages[index];
  return (
    <section className="passage" id="recovery">
      <small>THE RECOVERY WORKFLOW</small>
      <h2>One position, three decisions.</h2>
      <div className="passControls" aria-label="Explore recovery stages">
        {stages.map((s, n) => (
          <button
            key={s.name}
            aria-pressed={n === index}
            onClick={() => select(n)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className={"passContent stage" + index}>
        <div>
          <h3>{stage.title}</h3>
          <p>{stage.copy}</p>
          <a href={"/desk?tab=" + stage.name}>
            Open {stage.name.toLowerCase()} ↗
          </a>
        </div>
        <dl>
          {stage.fields.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
