import { useId, useState } from "react";
import Icon, { type IconName } from "./Icon";

const stages: {
  label: string;
  icon: IconName;
  title: string;
  detail: string;
}[] = [
  {
    label: "Inspect",
    icon: "search",
    title: "Read the account",
    detail: "Look up rNEAR shares and pending NEAR from the staking contract.",
  },
  {
    label: "Unstake",
    icon: "layers",
    title: "Request an unstake",
    detail:
      "Review the rNEAR amount and authorize the delayed withdrawal in your wallet.",
  },
  {
    label: "Claim",
    icon: "lock",
    title: "Claim unlocked NEAR",
    detail:
      "When the contract marks a withdrawal eligible, claim it to the signing account.",
  },
  {
    label: "Verify",
    icon: "receipt",
    title: "Check the payout",
    detail: "Verify the final transaction and its transfer receipt on NEAR.",
  },
];
const points = [
  [43, 139],
  [217, 101],
  [391, 83],
  [565, 33],
];
const course = "M43 139 C111 139 148 101 217 101 S323 83 391 83 S497 33 565 33";

export default function RecoveryPath({ current }: { current?: number }) {
  const [selection, select] = useState<number>();
  const index = selection ?? current ?? 0;
  const stage = stages[index];
  const id = useId();
  return (
    <article className="deskCard pathCard">
      <header className="cardHeading">
        <div>
          <h2>Recovery path</h2>
          <p>Explore the four stages of recovery.</p>
        </div>
        <span className="cardIcon">
          <Icon name="route" />
        </span>
      </header>
      <div className="pathFigure">
        <svg
          viewBox="0 0 608 163"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={id + "-line"}>
              <stop stopColor="var(--teal)" />
              <stop offset="1" stopColor="var(--lime)" />
            </linearGradient>
            <linearGradient id={id + "-area"} x2="0" y2="1">
              <stop stopColor="var(--mint)" stopOpacity=".19" />
              <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[33, 69, 104, 139].map((y) => (
            <path className="chartGrid" key={y} d={`M0 ${y}H608`} />
          ))}
          {points.map(([x]) => (
            <path className="chartGrid chartVert" key={x} d={`M${x} 13V151`} />
          ))}
          <path d={course + " V151 H43 Z"} fill={`url(#${id}-area)`} />
          <path
            className="chartTrace"
            d={course}
            pathLength="100"
            stroke={`url(#${id}-line)`}
          />
          <circle
            className="pathMarker"
            cx={points[index][0]}
            cy={points[index][1]}
            r="12"
          />
          {points.map(([x, y], n) => (
            <g className="pathPoint" key={x} onClick={() => select(n)}>
              <title>{stages[n].label}</title>
              <circle
                className="pathNode"
                data-active={index === n}
                cx={x}
                cy={y}
                r="5"
              />
              <circle className="pathHit" cx={x} cy={y} r="18" />
            </g>
          ))}
        </svg>
      </div>
      <div className="stageControls" aria-label="Recovery stages">
        {stages.map(({ label, icon }, n) => (
          <button
            type="button"
            className="stageButton"
            aria-pressed={index === n}
            key={label}
            onClick={() => select(n)}
          >
            <Icon name={icon} /> <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="pathDetail" aria-live="polite">
        <strong>{stage.title}</strong>
        <p>{stage.detail}</p>
      </div>
    </article>
  );
}
