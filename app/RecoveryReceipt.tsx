import { useState } from "react";
import {
  nearExplorer,
  parseRecoveryReceipt,
  publicRecovery,
  recoveryReceipt,
  type RecoveryEvidence,
  type RecoveryReceipt as Receipt,
} from "../lib/receipts";
import { download } from "../lib/routes";

type Props = {
  busy: boolean;
  record?: Receipt;
  saved?: Receipt;
  evidence?: RecoveryEvidence;
  run: (work: () => Promise<void>) => void;
  verify: (record: Receipt) => Promise<void>;
};

export default function RecoveryReceipt({
  busy,
  record,
  saved,
  evidence,
  run,
  verify,
}: Props) {
  const [account, setAccount] = useState(record?.account ?? "");
  const [hash, setHash] = useState(record?.hash ?? "");
  const status = evidence?.execution;

  return (
    <>
      {record && (
        <article className="proofSheet" aria-live="polite">
          <div className="proofHeading">
            <div>
              <small>
                {record.hash === publicRecovery.hash
                  ? "HISTORICAL MAINNET TRANSACTION"
                  : "NEAR MAINNET"}
              </small>
              <h4>
                {evidence?.method?.startsWith("withdraw")
                  ? "Rhea withdrawal"
                  : evidence?.method
                    ? "Rhea delayed unstake"
                    : "Recovery transaction"}
              </h4>
            </div>
            <span className="evidenceTag" data-state={status ?? "pending"}>
              {status === "confirmed"
                ? "Final on NEAR"
                : status === "failed"
                  ? "Failed on NEAR"
                  : status === "pending"
                    ? "Awaiting finality"
                    : "Verification required"}
            </span>
          </div>
          <dl className="proofDetails">
            <div>
              <dt>Signing account</dt>
              <dd>{record.account}</dd>
            </div>
            {evidence?.method && (
              <div>
                <dt>Method</dt>
                <dd>{evidence.method}</dd>
              </div>
            )}
            {evidence?.requested && (
              <div>
                <dt>Requested amount</dt>
                <dd>{evidence.requested} NEAR</dd>
              </div>
            )}
            {evidence?.payout && (
              <div className="payout">
                <dt>NEAR received</dt>
                <dd>{evidence.payout} NEAR</dd>
              </div>
            )}
            {evidence?.blockHash && (
              <div>
                <dt>Block</dt>
                <dd>
                  <a
                    href={"https://nearblocks.io/blocks/" + evidence.blockHash}
                  >
                    {evidence.blockHash}
                  </a>
                </dd>
              </div>
            )}
            <div>
              <dt>Transaction</dt>
              <dd>
                <a
                  href={nearExplorer(record.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {record.hash}
                </a>
              </dd>
            </div>
            {evidence && (
              <div>
                <dt>Last checked</dt>
                <dd>
                  <time dateTime={new Date(evidence.checkedAt).toISOString()}>
                    {new Date(evidence.checkedAt).toLocaleString()}
                  </time>
                </dd>
              </div>
            )}
          </dl>
          {status === "confirmed" &&
            evidence?.method?.startsWith("withdraw") &&
            !evidence.payout && (
              <p>
                The call finalized. The RPC response had no matching successful
                transfer receipt.
              </p>
            )}
          <div className="deskActions">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => verify(record))}
            >
              Recheck on NEAR
            </button>
            <button
              className="minor"
              type="button"
              onClick={() =>
                download(
                  "vestiquay-recovery.json",
                  JSON.stringify(record, null, 2),
                )
              }
            >
              Export JSON ↓
            </button>
          </div>
        </article>
      )}
      <form
        className="proofForm"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => verify(recoveryReceipt(account, hash)));
        }}
      >
        <label>
          Signing account
          <input
            disabled={busy}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            required
            maxLength={64}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="your-account.near"
          />
        </label>
        <label>
          NEAR transaction hash
          <input
            disabled={busy}
            value={hash}
            onChange={(event) => setHash(event.target.value)}
            required
            maxLength={44}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Paste a transaction hash"
          />
        </label>
        <div className="deskActions">
          <button type="submit" disabled={busy}>
            Verify transaction
          </button>
          <button
            className="minor"
            type="button"
            disabled={busy}
            onClick={() => {
              setAccount(publicRecovery.account);
              setHash(publicRecovery.hash);
              run(() =>
                verify(
                  recoveryReceipt(publicRecovery.account, publicRecovery.hash),
                ),
              );
            }}
          >
            Try a historical withdrawal
          </button>
          {saved && saved.hash !== record?.hash && (
            <button
              className="minor"
              type="button"
              disabled={busy}
              onClick={() => run(() => verify(saved))}
            >
              Open last wallet receipt
            </button>
          )}
        </div>
      </form>
      <label>
        Import NEAR recovery receipt
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            run(async () => {
              if (file.size > 64000) throw Error("Receipt file is too large.");
              const next = parseRecoveryReceipt(JSON.parse(await file.text()));
              setAccount(next.account);
              setHash(next.hash);
              await verify(next);
            });
          }}
        />
      </label>
    </>
  );
}
