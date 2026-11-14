import { useEffect, useRef, useState } from "react";
import { formatNearAmount } from "@rhea-finance/rnear-sdk";
import { replayWithdrawal } from "../lib/exit-plan";
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
  shareable: boolean;
  onRoute?: () => void;
};

export default function RecoveryReceipt({
  busy,
  record,
  saved,
  evidence,
  run,
  verify,
  shareable,
  onRoute,
}: Props) {
  const [account, setAccount] = useState(record?.account ?? "");
  const [hash, setHash] = useState(record?.hash ?? "");
  const [share, setShare] = useState<{
    key: string;
    copied: boolean;
    url: string;
  }>();
  const [replay, setReplay] = useState<{
    receiptHash: string;
    checkedAt: number;
    data: Awaited<ReturnType<typeof replayWithdrawal>>;
  }>();
  const status = evidence?.execution;
  const comparison =
    replay &&
    replay.receiptHash === record?.hash &&
    replay.checkedAt === evidence?.checkedAt
      ? replay.data
      : undefined;
  const replayHeading = useRef<HTMLHeadingElement>(null);
  const shareKey = record && record.account + ":" + record.hash;
  const activeShare = share && share.key === shareKey ? share : undefined;

  async function copyProof(receipt: Receipt) {
    const url = new URL("/desk", location.origin);
    url.search = new URLSearchParams({
      tab: "Receipt",
      account: receipt.account,
      proof: receipt.hash,
    }).toString();
    let copied = false;
    try {
      await navigator.clipboard.writeText(url.href);
      copied = true;
    } catch {}
    setShare({
      key: receipt.account + ":" + receipt.hash,
      copied,
      url: url.href,
    });
  }

  useEffect(() => {
    if (!comparison) return;
    const heading = replayHeading.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "center" });
  }, [comparison]);

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
            {evidence?.payout && evidence.claimBlockHash && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const data = await replayWithdrawal(record, evidence);
                    setReplay({
                      receiptHash: record.hash,
                      checkedAt: evidence.checkedAt,
                      data,
                    });
                  })
                }
              >
                Replay claim on NEAR
              </button>
            )}
            <button
              className="minor"
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
            {shareable && status === "confirmed" && (
              <button
                className="minor"
                type="button"
                disabled={busy}
                onClick={() => {
                  void copyProof(record);
                }}
              >
                Copy proof link
              </button>
            )}
            {onRoute && (
              <button
                className="minor"
                type="button"
                disabled={busy}
                onClick={onRoute}
              >
                Route this payout to Solana
              </button>
            )}
          </div>
          {activeShare &&
            (activeShare.copied ? (
              <p role="status">Proof link copied</p>
            ) : (
              <label className="proofShare">
                Proof link
                <input
                  readOnly
                  value={activeShare.url}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
            ))}
        </article>
      )}
      {comparison && (
        <section
          className="replayProof"
          aria-label="Claim replay"
          aria-live="polite"
        >
          <div className="proofHeading">
            <h3 tabIndex={-1} ref={replayHeading}>
              Claim replay
            </h3>
            <span
              className="evidenceTag"
              data-state={comparison.reconciled ? "confirmed" : "pending"}
            >
              {comparison.reconciled
                ? "Payout reconciled"
                : "Amounts did not reconcile"}
            </span>
          </div>
          <dl className="proofDetails">
            <div>
              <dt>Pending before claim</dt>
              <dd>
                {formatNearAmount(comparison.before.pending)} NEAR
                <br />
                <a
                  href={`https://nearblocks.io/blocks/${comparison.before.hash}`}
                >
                  Block {comparison.before.height.toLocaleString()}
                </a>
              </dd>
            </div>
            <div>
              <dt>Pending after claim</dt>
              <dd>
                {formatNearAmount(comparison.after.pending)} NEAR
                <br />
                <a
                  href={`https://nearblocks.io/blocks/${comparison.after.hash}`}
                >
                  Block {comparison.after.height.toLocaleString()}
                </a>
              </dd>
            </div>
            <div className="payout">
              <dt>Wallet transfer</dt>
              <dd>{comparison.payout} NEAR</dd>
            </div>
          </dl>
          <p>
            {comparison.reconciled
              ? "The decrease in the pending balance matches the wallet transfer in the transaction receipt."
              : "The staking snapshots and the transfer receipt give different amounts. Review the two blocks and the transaction before relying on this comparison."}
          </p>
        </section>
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
