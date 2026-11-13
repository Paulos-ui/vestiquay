import { useState, type ReactNode, type Ref } from "react";
import type { inspect } from "../lib/recovery";
import Icon from "./Icon";

type Position = Awaited<ReturnType<typeof inspect>>;

export function displayAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const tail = fraction.slice(0, 6).replace(/0+$/, "");
  if (whole === "0" && /[1-9]/.test(fraction) && !tail) return "<0.000001";
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (tail ? "." + tail : "");
}

export function claimState(position?: Position) {
  if (!position)
    return {
      label: "Awaiting lookup",
      message: "Inspect a NEAR account to check what it can claim.",
      stage: 0,
    };
  if (BigInt(position.position.pendingNear.raw) > 0n) {
    if (position.position.canWithdraw) {
      return {
        label: "Ready to claim",
        message: "The contract marks the pending amount as eligible.",
        stage: 2,
      };
    }
    return {
      label: "Pending unlock",
      message:
        "The staking contract determines when this withdrawal can be claimed.",
      stage: 1,
    };
  }
  if (BigInt(position.shares.raw) > 0n) {
    return {
      label: "Shares held",
      message: "This account can request a delayed unstake.",
      stage: 1,
    };
  }
  return {
    label: "No position",
    message: "This account has no rNEAR shares or pending withdrawal.",
    stage: 0,
  };
}

export function PositionSummary({
  position,
  children,
  sectionRef,
}: {
  position?: Position;
  children: ReactNode;
  sectionRef: Ref<HTMLElement>;
}) {
  const [metric, selectMetric] = useState<"balance" | "withdrawals">("balance");
  const pending = position?.position.pendingNear;
  const staked = position?.position.stakedNear;
  const claimable = position?.position.canWithdraw ? pending?.amount : "0";
  const stakedRaw = BigInt(staked?.raw ?? "0");
  const pendingRaw = BigInt(pending?.raw ?? "0");
  const total = stakedRaw + pendingRaw;
  const stakedShare = total ? Number((stakedRaw * 10000n) / total) / 100 : 0;
  const readings =
    metric === "balance"
      ? [
          {
            label: "rNEAR shares",
            value: position?.shares.amount,
            unit: "rNEAR",
            color: "mint",
          },
          {
            label: "NEAR staked",
            value: staked?.amount,
            unit: "NEAR",
            color: "teal",
          },
          {
            label: "NEAR pending",
            value: pending?.amount,
            unit: "NEAR",
            color: "lime",
          },
        ]
      : [
          {
            label: "NEAR pending",
            value: pending?.amount,
            unit: "NEAR",
            color: "lime",
          },
          {
            label: "NEAR claimable",
            value: position ? claimable : undefined,
            unit: "NEAR",
            color: "mint",
          },
        ];
  return (
    <section
      className="deskCard balanceCard"
      aria-label="Position balances"
      tabIndex={-1}
      ref={sectionRef}
    >
      <header className="cardHeading">
        <div>
          <h2>Position balances</h2>
          <p>
            {position
              ? position.id
              : "Select an account to load mainnet balances."}
          </p>
        </div>
        <div className="metricTabs" aria-label="Balance view">
          <button
            type="button"
            className="metricTab"
            aria-pressed={metric === "balance"}
            onClick={() => selectMetric("balance")}
          >
            Assets
          </button>
          <button
            type="button"
            className="metricTab"
            aria-pressed={metric === "withdrawals"}
            onClick={() => selectMetric("withdrawals")}
          >
            Withdrawals
          </button>
        </div>
      </header>
      <dl className="balanceReadings" aria-live="polite">
        {readings.map(({ label, value, unit, color }) => (
          <div key={label} data-color={color}>
            <dt>{label}</dt>
            <dd title={value !== undefined ? `${value} ${unit}` : undefined}>
              {value !== undefined ? displayAmount(value) : "···"}
              {value !== undefined && <small>{unit}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="balanceTrack" aria-hidden="true">
        {total > 0n && (
          <>
            <span style={{ width: `${stakedShare}%` }} />
            <span style={{ width: `${100 - stakedShare}%` }} />
          </>
        )}
      </div>
      {total > 0n && (
        <div className="balanceLegend">
          <span>Staked NEAR</span>
          <span>Pending NEAR</span>
        </div>
      )}
      {children}
    </section>
  );
}

export function ClaimStatus({
  position,
  children,
}: {
  position?: Position;
  children: ReactNode;
}) {
  const state = claimState(position);
  const unlock = position?.position.estimatedUnlockAtMs;
  return (
    <article className="deskCard claimCard">
      <header className="cardHeading">
        <h2>Claim status</h2>
        <span className="cardIcon">
          <Icon name="time" />
        </span>
      </header>
      <div className="claimReading" data-stage={state.stage}>
        <div className="claimDial">
          <Icon
            name={
              state.stage === 2 ? "check" : state.stage === 1 ? "time" : "lock"
            }
          />
        </div>
        <div>
          <strong>{state.label}</strong>
          <p>{state.message}</p>
        </div>
      </div>
      {unlock && (
        <p className="unlockTime">
          Estimated unlock{" "}
          <time dateTime={new Date(unlock).toISOString()}>
            {new Date(unlock).toLocaleString()}
          </time>
        </p>
      )}
      {children}
    </article>
  );
}
