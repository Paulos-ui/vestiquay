import { assessExit } from "../lib/exit-plan";
import type { inspect } from "../lib/recovery";
import Icon from "./Icon";

type Props = {
  position: Awaited<ReturnType<typeof inspect>>;
  busy: boolean;
  reviewClaim: () => void;
  openReceipt: () => void;
};

export default function RecoveryAgent({
  position,
  busy,
  reviewClaim,
  openReceipt,
}: Props) {
  const decision = assessExit(position);
  const when = position.position.estimatedUnlockAtMs;
  const waitFor =
    decision.action === "wait" && decision.epoch > 0
      ? "Unlock epoch " + decision.epoch.toLocaleString()
      : undefined;
  const copy = {
    claim: [
      "Claim unlocked NEAR",
      "The staking contract marks the pending balance as withdrawable.",
    ],
    wait: [
      "Wait for the unlock",
      "The contract reports a pending withdrawal and has not marked it eligible.",
    ],
    unstake: [
      "Review a delayed unstake",
      "This account holds rNEAR shares and has no pending withdrawal.",
    ],
    none: [
      "No recovery action available",
      "The account has no rNEAR shares or pending NEAR.",
    ],
  }[decision.action];
  return (
    <section className="deskCard exitAgent" aria-labelledby="exit-agent-title">
      <header className="cardHeading">
        <div>
          <h2 id="exit-agent-title">Recovery agent</h2>
          <p>{position.id} · Rules-based onchain assessment</p>
        </div>
        <span className="cardIcon">
          <Icon name="shield" />
        </span>
      </header>
      <div className="agentDecision" data-action={decision.action}>
        <strong>{copy[0]}</strong>
        <p>{copy[1]}</p>
        {decision.action === "claim" && (
          <p className="agentAmount">{decision.amount} NEAR available</p>
        )}
        {waitFor && (
          <p>
            {waitFor}
            {when ? " · estimated " + new Date(when).toLocaleString() : ""}
          </p>
        )}
      </div>
      <div className="deskActions">
        {decision.action === "claim" && (
          <button type="button" disabled={busy} onClick={reviewClaim}>
            Review withdrawal <Icon name="arrow" />
          </button>
        )}
        {decision.action === "unstake" && (
          <a className="button" href="#unstake">
            Review unstake <Icon name="down" />
          </a>
        )}
        <button
          type="button"
          className="minor"
          disabled={busy}
          onClick={openReceipt}
        >
          Verify a past withdrawal
        </button>
      </div>
    </section>
  );
}
