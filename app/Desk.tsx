"use client";
import { useEffect, useRef, useState } from "react";
import {
  inspect,
  nearWallet,
  reviewUnstake,
  submitUnstake,
  reviewWithdrawal,
  withdraw,
  wrapPreview,
  wrap,
  stakingContract,
} from "../lib/recovery";
import {
  quoteRoute,
  executeRoute,
  refreshReceipt,
  download,
  receiptKey,
  validateReceipt,
  formatUnits,
  type RouteReceipt,
} from "../lib/routes";
import Brand from "./Brand";
function displayAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  if (
    whole === "0" &&
    fraction &&
    Number(value) > 0 &&
    Number(value) < 0.000001
  )
    return "<0.000001";
  const tail = fraction.slice(0, 6).replace(/0+$/, "");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (tail ? "." + tail : "");
}
const views = ["Position", "Route", "Receipt"];
const titles: Record<string, string> = {
  Position: "Inspect a position",
  Route: "Plan a transfer",
  Receipt: "Track a receipt",
};
const hints: Record<string, string> = {
  Position: "Read the shares and withdrawal status of any NEAR account.",
  Route: "Review a NEAR to Solana quote before opening your wallet.",
  Receipt: "Follow a submitted Rhea order, or reopen an exported receipt.",
};
export default function Desk({ hosted = false }: { hosted?: boolean }) {
  const [tab, setTab] = useState("Position"),
    [account, id] = useState(""),
    [amount, setAmount] = useState("1"),
    [recipient, setRecipient] = useState(""),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const [pos, setPos] = useState<Awaited<ReturnType<typeof inspect>>>(),
    [review, setReview] =
      useState<Awaited<ReturnType<typeof reviewWithdrawal>>>(),
    [plan, setPlan] = useState<Awaited<ReturnType<typeof quoteRoute>>>(),
    [receipt, setReceipt] = useState<RouteReceipt>(),
    [withdrawn, setWithdrawn] = useState("");
  const [wr, setWr] = useState<Awaited<ReturnType<typeof wrapPreview>>>();
  const [sharesInput, setSharesInput] = useState("");
  const [unstakePlan, setUnstakePlan] =
    useState<Awaited<ReturnType<typeof reviewUnstake>>>();
  const [unstakeHashes, setUnstakeHashes] = useState<string[]>([]);
  const [connected, setConnected] = useState("");
  const [reading, setReading] = useState(false);
  const [reads, setReads] = useState<string[]>([]);
  const inspection = useRef(0);
  useEffect(() => {
    let active = true;
    const provider = nearWallet();
    const signedIn = (event: { accounts?: { accountId: string }[] }) => {
      if (active) setConnected(event.accounts?.[0]?.accountId ?? "");
    };
    const signedOut = () => {
      if (active) setConnected("");
    };
    provider.on("wallet:signIn", signedIn);
    provider.on("wallet:signOut", signedOut);
    provider
      .getConnectedWallet()
      .then((session) => {
        if (active) setConnected(session.accounts[0]?.accountId ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
      provider.off("wallet:signIn", signedIn);
      provider.off("wallet:signOut", signedOut);
    };
  }, []);
  async function scan(target: string) {
    const version = ++inspection.current;
    setReading(true);
    setReads([]);
    setReview(undefined);
    setUnstakePlan(undefined);
    setPos(undefined);
    try {
      const result = await inspect(target, (key) => {
        if (inspection.current === version)
          setReads((previous) => [...previous, key]);
      });
      setPos(result);
    } finally {
      inspection.current++;
      setReading(false);
    }
  }
  const lock = useRef(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("tab");
      if (view && ["Position", "Route", "Receipt"].includes(view)) setTab(view);
      const initial = params.get("account");
      if (initial) {
        id(initial);
        act(() => scan(initial));
      }
      const s = localStorage.getItem(receiptKey);
      if (s) setReceipt(validateReceipt(JSON.parse(s)));
    } catch {}
  }, []);
  function save(r: RouteReceipt) {
    setReceipt(r);
    localStorage.setItem(receiptKey, JSON.stringify(r));
  }
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function editId(v: string) {
    id(v);
    setUnstakePlan(undefined);
    setSharesInput("");
    setUnstakeHashes([]);
    setWr(undefined);
    setPos(undefined);
    setReview(undefined);
    setPlan(undefined);
    setWithdrawn("");
  }
  function selectView(view: string) {
    setTab(view);
    setMsg("");
    if (hosted) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", view);
      url.searchParams.delete("account");
      window.history.replaceState(null, "", url);
    }
  }
  const navigation = views.map((view, n) => (
    <button
      key={view}
      disabled={busy}
      aria-pressed={view === tab}
      onClick={() => selectView(view)}
    >
      {hosted && <span aria-hidden="true">{["◎", "⇄", "▤"][n]}</span>}
      {view}
    </button>
  ));
  return (
    <section className="desk" id="desk">
      {hosted && (
        <aside className="side">
          <Brand />
          <small>RECOVERY DESK</small>
          <nav aria-label="Workspace">{navigation}</nav>
          <div className="sideBottom">
            <a href="/#guide">Field guide ↗</a>
            <a href="/recovery.html" download>
              Save client ↓
            </a>
          </div>
        </aside>
      )}
      <div className="workBody">
        {hosted && (
          <div className="deskTop">
            <span>
              Recovery desk　/　<b>{tab}</b>
            </span>
            <div className="walletStrip">
              <small>● NEAR mainnet</small>
              {connected ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        editId(connected);
                        selectView("Position");
                        await scan(connected);
                      })
                    }
                  >
                    {connected}
                  </button>
                  <button
                    className="minor"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await nearWallet().disconnect();
                        setConnected("");
                      })
                    }
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const wallet = await nearWallet().connect();
                      const owner = (await wallet.getAccounts())[0]?.accountId;
                      if (!owner)
                        throw Error("The wallet returned no NEAR account.");
                      setConnected(owner);
                      editId(owner);
                      selectView("Position");
                      await scan(owner);
                    })
                  }
                >
                  Connect NEAR wallet
                </button>
              )}
            </div>
          </div>
        )}
        <div className={"deskBanner banner" + tab}>
          <div>
            <small>
              {tab === "Position"
                ? "RHEA LIQUID STAKING SDK"
                : "RHEA CROSS-CHAIN SDK"}
            </small>
            <h2>{titles[tab]}</h2>
            <p>{hints[tab]}</p>
          </div>
          {hosted && (
            <img src="/vestiquay-mark.svg" alt="" width="240" height="178" />
          )}
        </div>
        <div className="deskShell">
          {hosted ? (
            <h3>
              {tab === "Position"
                ? "Account lookup"
                : tab === "Route"
                  ? "Transfer details"
                  : "Delivery record"}
            </h3>
          ) : (
            <div className="tabs">{navigation}</div>
          )}
          {tab !== "Receipt" && (
            <label>
              NEAR account
              <input
                disabled={busy}
                value={account}
                placeholder="your-account.near"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => editId(e.target.value.trim())}
              />
            </label>
          )}
          {tab === "Position" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setReview(undefined);
                    await scan(account);
                    setWithdrawn("");
                  })
                }
              >
                {reading
                  ? "Inspecting…"
                  : pos
                    ? "Refresh position"
                    : "Inspect position"}
              </button>{" "}
              <button
                className="minor"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    editId("lp.ref-labs.near");
                    await scan("lp.ref-labs.near");
                  })
                }
              >
                Try public account
              </button>
              {reading && (
                <div className="scanPanel" aria-live="polite">
                  <b>Reading {account}</b>
                  {[
                    ["shares", "rNEAR balance"],
                    ["withdrawal", "Withdrawal record"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <span>
                        {reads.includes(key) ? "Received" : "Reading…"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {pos && (
                <div className="receipt">
                  <div className="observed">
                    <small>ONCHAIN POSITION / {pos.id}</small>
                    <time dateTime={new Date(pos.observedAt).toISOString()}>
                      Checked {new Date(pos.observedAt).toLocaleTimeString()}
                    </time>
                  </div>
                  <dl className="positionData">
                    <div>
                      <dt>rNEAR held</dt>
                      <dd>{displayAmount(pos.shares.amount)}</dd>
                    </div>
                    <div>
                      <dt>NEAR pending</dt>
                      <dd>{displayAmount(pos.position.pendingNear.amount)}</dd>
                    </div>
                    <div>
                      <dt>Withdrawal status</dt>
                      <dd>
                        {pos.position.canWithdraw
                          ? "Eligible to withdraw"
                          : pos.position.estimatedUnlockAtMs
                            ? "Estimated unlock " +
                              new Date(
                                pos.position.estimatedUnlockAtMs,
                              ).toLocaleString()
                            : "No unlocked withdrawal"}
                      </dd>
                    </div>
                  </dl>
                  <details>
                    <summary>Inspect the source record</summary>
                    <p>
                      Contract　
                      <a
                        href={
                          "https://nearblocks.io/address/" + stakingContract
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {stakingContract}
                      </a>
                    </p>
                    <p>
                      Exact shares　{pos.shares.amount} rNEAR
                      <br />
                      Pending withdrawal　{pos.position.pendingNear.amount} NEAR
                    </p>
                  </details>
                  {BigInt(pos.shares.raw) > 0n && (
                    <details className="unstakeBox">
                      <summary>Request a delayed unstake</summary>
                      <p>
                        Choose how much rNEAR to unstake. Rhea converts those
                        shares to a NEAR withdrawal request. You can claim it
                        when the contract marks it eligible.
                      </p>
                      {BigInt(pos.position.pendingNear.raw) > 0n && (
                        <p>
                          A withdrawal is already pending. An additional unstake
                          can move its unlock epoch.
                        </p>
                      )}
                      <label>
                        rNEAR to unstake
                        <input
                          inputMode="decimal"
                          disabled={busy}
                          value={sharesInput}
                          onChange={(e) => {
                            setSharesInput(e.target.value);
                            setUnstakePlan(undefined);
                          }}
                          placeholder="0.00"
                        />
                      </label>
                      <button
                        disabled={busy || !sharesInput}
                        onClick={() =>
                          act(async () => {
                            setUnstakePlan(undefined);
                            setUnstakePlan(
                              await reviewUnstake(pos.id, sharesInput),
                            );
                          })
                        }
                      >
                        Preview unstake
                      </button>
                      {unstakePlan && (
                        <div className="orderReview">
                          <small>RHEA SDK TRANSACTION REVIEW</small>
                          <h4>
                            {unstakePlan.shares} rNEAR →{" "}
                            {unstakePlan.nearAmount} NEAR queued
                          </h4>
                          <p>
                            Account　{pos.id}
                            <br />
                            Receiver　{unstakePlan.tx.receiverId}
                            <br />
                            Method　unstake
                            <br />
                            Contract checked at block{" "}
                            {unstakePlan.block.toLocaleString()}
                          </p>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                const plan = unstakePlan;
                                setUnstakePlan(undefined);
                                const hashes = await submitUnstake(plan);
                                setUnstakeHashes(hashes);
                                setSharesInput("");
                                await scan(plan.id);
                              })
                            }
                          >
                            Review in NEAR wallet
                          </button>
                        </div>
                      )}
                    </details>
                  )}
                  {pos.position.canWithdraw &&
                    BigInt(pos.position.pendingNear.raw) > 0n && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(async () =>
                            setReview(await reviewWithdrawal(pos.id)),
                          )
                        }
                      >
                        Review withdrawal
                      </button>
                    )}
                </div>
              )}
              {review && (
                <div className="receipt">
                  <b>Withdraw {review.amount} NEAR</b>
                  <p>
                    {stakingContract} → {account}
                    <br />
                    Method: {review.tx.actions[0].params.methodName}
                    <br />
                    Contract checked at block {review.block}
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const hashes = await withdraw(account, review.amount);
                        setWithdrawn(hashes.join(", "));
                        setReview(undefined);
                        await scan(account);
                      })
                    }
                  >
                    Sign with NEAR wallet
                  </button>
                </div>
              )}
              {unstakeHashes.map((hash) => (
                <p key={hash}>
                  Unstake confirmed ·{" "}
                  <a
                    href={
                      "https://nearblocks.io/txns/" + encodeURIComponent(hash)
                    }
                  >
                    View transaction ↗
                  </a>
                </p>
              ))}
              {withdrawn && <pre>Confirmed withdrawal: {withdrawn}</pre>}
            </>
          )}
          {tab === "Route" && (
            <>
              <label>
                Amount on NEAR
                <input
                  value={amount}
                  disabled={busy}
                  inputMode="decimal"
                  onChange={(e) => {
                    setWr(undefined);
                    setAmount(e.target.value);
                    setPlan(undefined);
                  }}
                />
              </label>
              <label>
                Receive USDC at this Solana address
                <input
                  value={recipient}
                  disabled={busy}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => {
                    setRecipient(e.target.value.trim());
                    setPlan(undefined);
                  }}
                />
              </label>
              <p>
                Rhea supplies live routes. Where the input is wrapped NEAR, the
                wallet must already hold enough wNEAR.
              </p>
              <details>
                <summary>Wrap native NEAR for this route</summary>
                <p>
                  Wrapping is a separate NEAR transaction. Review storage and
                  gas before signing.
                </p>
                <button
                  className="minor"
                  disabled={busy}
                  onClick={() =>
                    act(async () => setWr(await wrapPreview(account, amount)))
                  }
                >
                  Preview wrap
                </button>
                {wr && (
                  <div>
                    <p>
                      Wrap {wr.amount} NEAR at wrap.near. Additional storage
                      deposit: {wr.storage} NEAR. Network gas applies.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          const h = await wrap(account, amount, wr.storage);
                          setWr(undefined);
                          setMsg("Wrap confirmed: " + h);
                        })
                      }
                    >
                      Sign wrap
                    </button>
                  </div>
                )}
              </details>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setPlan(undefined);
                    setPlan(await quoteRoute(account, recipient, amount));
                  })
                }
              >
                Request Rhea quote ↗
              </button>
              {plan && (
                <div className="receipt">
                  <small>LIVE QUOTE / {plan.q.route.router}</small>
                  <pre>
                    {amount} {plan.symbol} → Solana USDC
                    <br />
                    Expected　{formatUnits(plan.q.estimatedOut, plan.decimals)}
                    <br />
                    Minimum　{formatUnits(plan.q.minAmountOut, plan.decimals)}
                    <br />
                    Recipient　{recipient}
                  </pre>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        setPlan(undefined);
                        await executeRoute(plan, save);
                        selectView("Receipt");
                      })
                    }
                  >
                    Review in wallet ↗
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "Receipt" && (
            <>
              {receipt ? (
                <div className="receipt">
                  <small>LAST SAVED ROUTE</small>
                  <pre>
                    {receipt.status}
                    <br />
                    {receipt.input} {receipt.asset} → min. {receipt.minimum}{" "}
                    USDC
                    <br />
                    {receipt.sender} → {receipt.recipient}
                    <br />
                    Source: {receipt.txHashes.join(", ") || "No hash recorded"}
                    <br />
                    Rhea order:{" "}
                    {receipt.recordId ?? receipt.orderId ?? "Awaiting ID"}
                    {receipt.destinationTx && (
                      <>
                        <br />
                        Destination: {receipt.destinationTx}
                      </>
                    )}
                  </pre>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => save(await refreshReceipt(receipt)))
                    }
                  >
                    Refresh order
                  </button>{" "}
                  <button
                    className="minor"
                    onClick={() =>
                      download(
                        "vestiquay-receipt.json",
                        JSON.stringify(receipt, null, 2),
                      )
                    }
                  >
                    Export receipt ↓
                  </button>
                </div>
              ) : (
                <p>
                  Your submitted route will appear here. You can also reopen an
                  exported receipt.
                </p>
              )}
              <label>
                Import route receipt
                <input
                  type="file"
                  accept=".json"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      act(async () => {
                        if (f.size > 64000)
                          throw Error("Receipt file is too large.");
                        save(validateReceipt(JSON.parse(await f.text())));
                      });
                  }}
                />
              </label>
            </>
          )}
          <p role="status">
            {busy ? "Retrieving evidence or waiting for wallet…" : msg}
          </p>
        </div>
      </div>
    </section>
  );
}
