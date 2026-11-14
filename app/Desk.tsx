"use client";
import { useEffect, useRef, useState } from "react";
import { parseUnits } from "@rhea-finance/cross-chain-aggregation-dex";
import {
  inspect,
  nearWallet,
  reviewUnstake,
  submitUnstake,
  reviewWithdrawal,
  withdraw,
  stakingContract,
} from "../lib/recovery";
import {
  refreshReceipt,
  refreshRouteSource,
  download,
  receiptKey,
  validateReceipt,
  formatUnits,
  type RouteReceipt,
} from "../lib/routes";
import {
  nearExplorer,
  parseRecoveryReceipt,
  publicRecovery,
  recoveryReceipt,
  recoveryReceiptKey,
  verifyRecovery,
  type RecoveryEvidence,
  type RecoveryReceipt as RecoveryRecord,
} from "../lib/receipts";
import { refreshIntentReceipt } from "../lib/intents";
import { verifySolanaDelivery } from "../lib/solana";
import {
  solanaDestinations,
  type SolanaDestination,
} from "../lib/route-assets";
import Brand from "./Brand";
import RecoveryAgent from "./RecoveryAgent";
import RouteDesk from "./RouteDesk";
import Icon, { type IconName } from "./Icon";
import RecoveryPath from "./RecoveryPath";
import RecoveryReceipt from "./RecoveryReceipt";
import { claimState, ClaimStatus, PositionSummary } from "./PositionSummary";
import ThemeToggle from "./ThemeToggle";

const views = ["Position", "Route", "Receipt"] as const;
type View = (typeof views)[number];
type ReceiptType = "recovery" | "route";

const pageContent: Record<
  View,
  { heading: string; description: string; icon: IconName; label: string }
> = {
  Position: {
    heading: "Position overview",
    description: "Inspect rNEAR, review an unstake and claim unlocked NEAR.",
    icon: "position",
    label: "Position",
  },
  Route: {
    heading: "Route to Solana",
    description:
      "Send NEAR from your wallet and receive USDC or native SOL on Solana.",
    icon: "route",
    label: "Route",
  },
  Receipt: {
    heading: "Transaction receipts",
    description:
      "Verify a NEAR recovery transaction or follow a Solana delivery.",
    icon: "receipt",
    label: "Receipts",
  },
};
export default function Desk({ hosted = false }: { hosted?: boolean }) {
  const [tab, setTab] = useState<View>("Position"),
    [account, id] = useState(""),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const [pos, setPos] = useState<Awaited<ReturnType<typeof inspect>>>();
  const [review, setReview] =
    useState<Awaited<ReturnType<typeof reviewWithdrawal>>>();
  const [receipt, setReceipt] = useState<RouteReceipt>();
  const [routeAmount, setRouteAmount] = useState<string>();
  const [delivery, setDelivery] = useState<{
    signature: string;
    recipient: string;
    output: SolanaDestination;
    minimum: string;
    amount: string;
    slot: number;
  }>();
  const receiptAsset = solanaDestinations[receipt?.output ?? "USDC"];
  const [sharesInput, setSharesInput] = useState("");
  const [unstakePlan, setUnstakePlan] =
    useState<Awaited<ReturnType<typeof reviewUnstake>>>();
  const [connected, setConnected] = useState("");
  const [reading, setReading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupRevision, setLookupRevision] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const [reads, setReads] = useState<string[]>([]);
  const [record, setRecord] = useState<RecoveryRecord>();
  const [savedRecovery, setSavedRecovery] = useState<RecoveryRecord>();
  const [evidence, setEvidence] = useState<RecoveryEvidence>();
  const [receiptType, setReceiptType] = useState<ReceiptType>("recovery");
  const inspection = useRef(0);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const actionReview = useRef<HTMLElement>(null);
  const positionBalances = useRef<HTMLElement>(null);
  const canConnect =
    hosted ||
    (typeof location !== "undefined" && location.protocol !== "file:");
  useEffect(() => {
    if (!canConnect) return;
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
  }, [canConnect]);
  async function scan(target: string) {
    const version = ++inspection.current;
    setLookupError("");
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
      if (inspection.current === version) {
        setPos(result);
        setLookupRevision(version);
      }
    } catch (error) {
      if (inspection.current === version)
        setLookupError(
          error instanceof Error
            ? error.message
            : "Could not read this position.",
        );
    } finally {
      if (inspection.current === version) {
        inspection.current++;
        setReading(false);
      }
    }
  }
  const lock = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = views.find((name) => name === params.get("tab"));
    if (view) setTab(view);
    if (params.get("receipt") === "route") setReceiptType("route");
    const initial = params.get("account");
    if (initial && (!view || view === "Position")) {
      id(initial);
      act(() => scan(initial));
    } else if (initial && view === "Route") {
      id(initial);
    }
    try {
      const s = localStorage.getItem(receiptKey);
      if (s) setReceipt(validateReceipt(JSON.parse(s)));
    } catch {}
    try {
      const saved = localStorage.getItem(recoveryReceiptKey);
      if (saved) {
        const previous = parseRecoveryReceipt(JSON.parse(saved));
        setSavedRecovery(previous);
        setRecord(previous);
      }
    } catch {}
    if (view === "Receipt" && params.get("receipt") !== "route") {
      const proof = params.get("proof");
      if (proof === "example") {
        act(() =>
          checkRecovery(
            recoveryReceipt(publicRecovery.account, publicRecovery.hash),
          ),
        );
      } else if (proof && initial) {
        act(() => checkRecovery(recoveryReceipt(initial, proof)));
      }
    }
  }, []);
  function remember(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setMsg(
        "Browser storage is unavailable. Export the receipt to keep a copy.",
      );
    }
  }
  function saveRoute(r: RouteReceipt) {
    setReceipt(r);
    remember(receiptKey, r);
  }
  function runDeliveryCheck(route: RouteReceipt) {
    act(async () => {
      setDelivery(undefined);
      const current =
        route.provider === "intents"
          ? await refreshIntentReceipt(route)
          : hosted && (route.recordId || route.orderId)
            ? await refreshReceipt(route)
            : route;
      if (current !== route) saveRoute(current);
      const signature = current.destinationTx;
      if (!signature)
        throw Error("The provider has not returned a Solana transaction.");
      const recipient = current.recipient;
      const output = current.output ?? "USDC";
      setDelivery({
        signature,
        recipient,
        output,
        minimum: current.minimum,
        ...(await verifySolanaDelivery(
          signature,
          recipient,
          output,
          current.provider === "intents"
            ? parseUnits(current.minimum, solanaDestinations[output].decimals)
            : undefined,
        )),
      });
    });
  }
  async function checkRecovery(r: RecoveryRecord) {
    const next = await verifyRecovery(r);
    setRecord(r);
    setEvidence(next);
  }
  async function finishRecovery(owner: string, hash: string) {
    const next = recoveryReceipt(owner, hash);
    selectView("Receipt", "recovery");
    setRecord(next);
    setSavedRecovery(next);
    setEvidence(undefined);
    remember(recoveryReceiptKey, next);
    await checkRecovery(next);
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
    setLookupError("");
    setUnstakePlan(undefined);
    setSharesInput("");
    setPos(undefined);
    setReview(undefined);
  }
  async function connectWallet() {
    const wallet = await nearWallet().connect();
    const owner = (await wallet.getAccounts())[0]?.accountId;
    if (!owner) throw Error("The wallet returned no NEAR account.");
    setConnected(owner);
    if (tab === "Position") {
      editId(owner);
      await scan(owner);
    }
    return owner;
  }

  function planFromPayout() {
    if (!evidence?.payout || record?.account !== connected) return;
    setRouteAmount(evidence.payout);
    selectView("Route");
  }

  function selectView(view: View, kind: ReceiptType = receiptType) {
    setTab(view);
    setNavigated(true);
    if (view === "Receipt") setReceiptType(kind);
    if (view !== "Route") setRouteAmount(undefined);
    setMsg("");
    if (hosted) {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", view);
      url.searchParams.delete("account");
      url.searchParams.delete("proof");
      if (view === "Receipt" && kind === "route")
        url.searchParams.set("receipt", kind);
      else url.searchParams.delete("receipt");
      window.history.replaceState(null, "", url);
    }
  }
  useEffect(() => {
    if (navigated) panelHeading.current?.focus({ preventScroll: true });
  }, [tab, navigated]);

  useEffect(() => {
    if (review) actionReview.current?.focus();
  }, [review]);
  useEffect(() => {
    if (lookupRevision && window.matchMedia("(max-width: 610px)").matches)
      positionBalances.current?.focus();
  }, [lookupRevision]);

  const page = pageContent[tab];
  const positionState = claimState(pos);
  const navigation = views.map((view) => (
    <button
      key={view}
      type="button"
      disabled={busy}
      aria-pressed={view === tab}
      onClick={() => selectView(view)}
    >
      <Icon name={pageContent[view].icon} /> {pageContent[view].label}
    </button>
  ));

  return (
    <section className="desk" data-hosted={hosted} id="desk">
      {hosted && (
        <aside className="deskSide">
          <Brand />
          <nav className="deskNav" aria-label="Workspace">
            {navigation}
          </nav>
          <div className="deskSideLinks">
            <a href="/#guide">
              <Icon name="guide" /> Field guide
            </a>
            <a href="/recovery.html" download>
              <Icon name="download" /> Save client
            </a>
          </div>
        </aside>
      )}
      <div className="workBody">
        <div className="deskTop">
          <div className="deskIdentity">
            {hosted ? (
              <span className="networkLabel">NEAR mainnet</span>
            ) : (
              <Brand linked={false} />
            )}
            {!hosted && (
              <span className="independentLabel">Independent client</span>
            )}
          </div>
          <div className="walletStrip">
            <ThemeToggle />
            {connected ? (
              <>
                <button
                  type="button"
                  className="walletAccount minor"
                  title={connected}
                  aria-label={`Inspect connected account ${connected}`}
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      editId(connected);
                      selectView("Position");
                      await scan(connected);
                    })
                  }
                >
                  <Icon name="wallet" />
                  <span>{connected}</span>
                </button>
                <button
                  type="button"
                  className="walletDisconnect minor"
                  aria-label="Disconnect wallet"
                  title="Disconnect wallet"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await nearWallet().disconnect();
                      setConnected("");
                    })
                  }
                >
                  <Icon name="logout" />
                </button>
              </>
            ) : !canConnect ? (
              <span className="walletHint">
                Serve over HTTPS or localhost to sign
              </span>
            ) : (
              <button
                type="button"
                className="connectWallet"
                aria-label="Connect NEAR wallet"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await connectWallet();
                  })
                }
              >
                <Icon name="wallet" />
                <span>
                  Connect<span className="walletLong"> NEAR wallet</span>
                </span>
              </button>
            )}
          </div>
        </div>
        {!hosted && (
          <nav className="deskNav standaloneNav" aria-label="Workspace">
            {navigation}
          </nav>
        )}
        <header className="deskIntro">
          <div>
            <h1 tabIndex={-1} ref={panelHeading}>
              {page.heading}
            </h1>
            <p>{page.description}</p>
          </div>
          {hosted && tab === "Position" && (
            <a className="deskTextLink" href="/desk?tab=Receipt&proof=example">
              Historical withdrawal <Icon name="diagonal" />
            </a>
          )}
        </header>
        {tab === "Position" ? (
          <div className="deskGrid" data-view={tab}>
            <section
              className="deskCard lookupCard"
              aria-labelledby="lookup-heading"
            >
              <header className="cardHeading">
                <div>
                  <h2 id="lookup-heading">Inspect an account</h2>
                  <p>Public lookup · Wallet optional</p>
                </div>
                <span className="cardIcon">
                  <Icon name="search" />
                </span>
              </header>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  act(() => scan(account));
                }}
              >
                <label>
                  NEAR account
                  <input
                    required
                    disabled={busy}
                    value={account}
                    placeholder="your-account.near"
                    maxLength={64}
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => editId(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  {reading
                    ? "Inspecting…"
                    : pos
                      ? "Refresh position"
                      : "Inspect position"}{" "}
                  <Icon name="arrow" />
                </button>
              </form>
              <button
                type="button"
                className="minor publicAccount"
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
                  <strong>Reading {account}</strong>
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
              {lookupError && (
                <p className="lookupError" role="alert">
                  {lookupError}
                </p>
              )}
            </section>
            <RecoveryPath key={lookupRevision} current={positionState.stage} />
            <PositionSummary position={pos} sectionRef={positionBalances}>
              {pos && (
                <details className="sourceRecord">
                  <summary>Inspect the source record</summary>
                  <p>ONCHAIN POSITION / {pos.id}</p>
                  <p>
                    Contract{" "}
                    <a
                      href={"https://nearblocks.io/address/" + stakingContract}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {stakingContract}
                    </a>
                  </p>
                  <p>
                    Exact shares {pos.shares.amount} rNEAR
                    <br />
                    Pending withdrawal {pos.position.pendingNear.amount} NEAR
                  </p>
                  <p>
                    <time dateTime={new Date(pos.observedAt).toISOString()}>
                      Checked {new Date(pos.observedAt).toLocaleTimeString()}
                    </time>
                  </p>
                </details>
              )}
            </PositionSummary>
            <ClaimStatus position={pos}>
              {pos && positionState.stage === 2 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      setReview(await reviewWithdrawal(pos.id));
                    })
                  }
                >
                  Review withdrawal
                </button>
              )}
              {pos &&
                positionState.stage !== 2 &&
                BigInt(pos.shares.raw) > 0n && (
                  <a className="deskTextLink" href="#unstake">
                    Request a delayed unstake <Icon name="down" />
                  </a>
                )}
            </ClaimStatus>
            {msg && (
              <p className="deskStatus positionStatus" role="status">
                {msg}
              </p>
            )}

            {pos && (
              <RecoveryAgent
                position={pos}
                busy={busy}
                reviewClaim={() =>
                  act(async () => setReview(await reviewWithdrawal(pos.id)))
                }
                openReceipt={() => selectView("Receipt", "recovery")}
              />
            )}
            {review && (
              <article
                className="deskCard actionCard orderReview"
                tabIndex={-1}
                ref={actionReview}
              >
                <header className="cardHeading">
                  <div>
                    <h2>Withdraw {review.amount} NEAR</h2>
                    <p>
                      {stakingContract} → {review.id}
                    </p>
                  </div>
                  <span className="cardIcon">
                    <Icon name="wallet" />
                  </span>
                </header>
                <p>
                  Method {review.tx.actions[0].params.methodName}
                  <br />
                  Contract checked at block {review.block.toLocaleString()}
                  <br />
                  Network gas applies.
                </p>
                <button
                  type="button"
                  disabled={busy || !canConnect}
                  onClick={() =>
                    act(async () => {
                      setReview(undefined);
                      const hash = await withdraw(review);
                      setPos(undefined);
                      await finishRecovery(review.id, hash);
                    })
                  }
                >
                  Sign with NEAR wallet <Icon name="arrow" />
                </button>
              </article>
            )}
            {pos && BigInt(pos.shares.raw) > 0n && (
              <article className="deskCard actionCard" id="unstake">
                <header className="cardHeading">
                  <div>
                    <h2>Request a delayed unstake</h2>
                    <p>
                      Rhea converts your shares to a NEAR withdrawal. You can
                      claim it once the contract marks it eligible.
                    </p>
                  </div>
                  <span className="cardIcon">
                    <Icon name="layers" />
                  </span>
                </header>
                {BigInt(pos.position.pendingNear.raw) > 0n && (
                  <p className="inlineWarning">
                    An additional unstake can move the unlock epoch of your
                    pending withdrawal.
                  </p>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(async () => {
                      setUnstakePlan(undefined);
                      setUnstakePlan(
                        await reviewUnstake(pos.id, sharesInput.trim()),
                      );
                    });
                  }}
                >
                  <label>
                    rNEAR to unstake
                    <input
                      inputMode="decimal"
                      disabled={busy}
                      value={sharesInput}
                      onChange={(event) => {
                        setSharesInput(event.target.value);
                        setUnstakePlan(undefined);
                      }}
                      required
                      placeholder="0.00"
                    />
                  </label>
                  <button type="submit" disabled={busy || !sharesInput.trim()}>
                    Preview unstake
                  </button>
                </form>
                {unstakePlan && (
                  <div className="orderReview">
                    <h3>
                      {unstakePlan.shares} rNEAR → {unstakePlan.nearAmount} NEAR
                      queued
                    </h3>
                    <p>
                      Account {pos.id}
                      <br />
                      Receiver {unstakePlan.tx.receiverId}
                      <br />
                      Method unstake
                      <br />
                      Contract checked at block{" "}
                      {unstakePlan.block.toLocaleString()}
                    </p>
                    <button
                      type="button"
                      disabled={busy || !canConnect}
                      onClick={() =>
                        act(async () => {
                          const plan = unstakePlan;
                          setUnstakePlan(undefined);
                          const hash = await submitUnstake(plan);
                          setSharesInput("");
                          setPos(undefined);
                          await finishRecovery(plan.id, hash);
                        })
                      }
                    >
                      Review in NEAR wallet <Icon name="arrow" />
                    </button>
                  </div>
                )}
              </article>
            )}
          </div>
        ) : (
          <div className="detailGrid">
            <section className="deskCard deskShell">
              <p className="deskStatus" role="status" data-busy={busy}>
                {busy
                  ? reading
                    ? "Reading the NEAR position…"
                    : "Waiting for the current request…"
                  : msg}
              </p>

              {tab === "Route" &&
                (hosted ? (
                  <RouteDesk
                    connected={connected}
                    initialSender={account}
                    initialAmount={routeAmount}
                    busy={busy}
                    run={act}
                    connect={connectWallet}
                    save={(next) => {
                      saveRoute(next);
                      selectView("Receipt", "route");
                    }}
                  />
                ) : (
                  <div className="routeNotice">
                    <strong>Cross-chain routing uses the hosted desk</strong>
                    <p>
                      Use this copy to inspect, unstake, claim and verify NEAR.
                    </p>
                    <button
                      className="minor"
                      type="button"
                      onClick={() => selectView("Position")}
                    >
                      Back to position
                    </button>
                  </div>
                ))}
              {tab === "Receipt" && (
                <>
                  <div className="tabs receiptTabs" aria-label="Receipt type">
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={receiptType === "recovery"}
                      onClick={() => selectView("Receipt", "recovery")}
                    >
                      NEAR recovery
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={receiptType === "route"}
                      onClick={() => selectView("Receipt", "route")}
                    >
                      Cross-chain route
                    </button>
                  </div>
                  {receiptType === "recovery" ? (
                    <RecoveryReceipt
                      busy={busy}
                      record={record}
                      saved={savedRecovery}
                      evidence={evidence}
                      run={act}
                      verify={checkRecovery}
                      shareable={hosted}
                      onRoute={
                        hosted &&
                        evidence?.payout &&
                        record?.account === connected
                          ? planFromPayout
                          : undefined
                      }
                    />
                  ) : (
                    <>
                      {receipt ? (
                        <article className="proofSheet">
                          <div className="proofHeading">
                            <div>
                              <small>NEAR → SOLANA</small>
                              <h4>
                                {receipt.input} {receipt.asset} to{" "}
                                {receiptAsset.symbol}
                              </h4>
                            </div>
                          </div>
                          <dl className="proofDetails">
                            <div>
                              <dt>Minimum quoted</dt>
                              <dd>
                                {receipt.minimum} {receiptAsset.symbol}
                              </dd>
                            </div>
                            <div>
                              <dt>Sender</dt>
                              <dd>{receipt.sender}</dd>
                            </div>
                            <div>
                              <dt>Solana recipient</dt>
                              <dd>{receipt.recipient}</dd>
                            </div>
                            <div>
                              <dt>NEAR transaction execution</dt>
                              <dd>
                                {receipt.sourceStatus === "confirmed"
                                  ? "Final on NEAR"
                                  : receipt.sourceStatus === "failed"
                                    ? "Failed on NEAR"
                                    : receipt.sourceStatus === "pending"
                                      ? "Awaiting finality"
                                      : "Verification required"}
                                {receipt.txHashes.map((hash) => (
                                  <a
                                    className="hashLink"
                                    key={hash}
                                    href={nearExplorer(hash)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {hash}
                                  </a>
                                ))}
                              </dd>
                            </div>
                            <div>
                              <dt>
                                {receipt.provider === "intents"
                                  ? "Saved NEAR Intents status"
                                  : "Saved Rhea status"}
                              </dt>
                              <dd>{receipt.status}</dd>
                            </div>
                            <div>
                              <dt>Tracking ID</dt>
                              <dd>
                                {receipt.depositAddress ??
                                  receipt.recordId ??
                                  receipt.orderId ??
                                  "Unavailable"}
                              </dd>
                            </div>
                            {receipt.destinationTx && (
                              <div>
                                <dt>Solana transaction hash</dt>
                                <dd>
                                  <a
                                    href={
                                      "https://explorer.solana.com/tx/" +
                                      receipt.destinationTx
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {receipt.destinationTx}
                                  </a>
                                </dd>
                              </div>
                            )}
                            {delivery?.signature === receipt.destinationTx &&
                              delivery?.recipient === receipt.recipient &&
                              delivery.output === receiptAsset.symbol &&
                              delivery.minimum === receipt.minimum && (
                                <div className="payout">
                                  <dt>
                                    {receiptAsset.symbol} verified on Solana
                                  </dt>
                                  <dd>
                                    {formatUnits(
                                      delivery.amount,
                                      receiptAsset.decimals,
                                    )}{" "}
                                    {receiptAsset.symbol} · Slot{" "}
                                    {delivery.slot.toLocaleString()}
                                  </dd>
                                </div>
                              )}
                          </dl>
                          <div className="deskActions">
                            <button
                              type="button"
                              disabled={busy || !receipt.txHashes.length}
                              onClick={() =>
                                act(async () =>
                                  saveRoute(await refreshRouteSource(receipt)),
                                )
                              }
                            >
                              Check NEAR hashes
                            </button>
                            {(receipt.provider === "intents" ||
                              (hosted &&
                                (receipt.recordId || receipt.orderId))) && (
                              <button
                                type="button"
                                className="minor"
                                disabled={busy}
                                onClick={() =>
                                  act(async () =>
                                    saveRoute(
                                      await (receipt.provider === "intents"
                                        ? refreshIntentReceipt(receipt)
                                        : refreshReceipt(receipt)),
                                    ),
                                  )
                                }
                              >
                                Refresh provider order
                              </button>
                            )}
                            {receipt.destinationTx && (
                              <button
                                type="button"
                                className="minor"
                                disabled={busy}
                                onClick={() => runDeliveryCheck(receipt)}
                              >
                                Verify Solana delivery
                              </button>
                            )}
                            <button
                              type="button"
                              className="minor"
                              onClick={() =>
                                download(
                                  "vestiquay-route.json",
                                  JSON.stringify(receipt, null, 2),
                                )
                              }
                            >
                              Export JSON ↓
                            </button>
                          </div>
                        </article>
                      ) : (
                        <p>
                          Submit a transfer or import a saved route receipt to
                          check its NEAR source.
                        </p>
                      )}
                      <label>
                        Import route receipt
                        <input
                          type="file"
                          accept=".json,application/json"
                          disabled={busy}
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            input.value = "";
                            if (!file) return;
                            act(async () => {
                              if (file.size > 64000)
                                throw Error("Receipt file is too large.");
                              saveRoute(
                                validateReceipt(JSON.parse(await file.text())),
                              );
                            });
                          }}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </section>
            <aside className="deskCard sideCard">
              {tab === "Route" ? (
                <>
                  <header className="cardHeading">
                    <h2>Before you sign</h2>
                    <span className="cardIcon">
                      <Icon name="shield" />
                    </span>
                  </header>
                  <div className="sideCheck">
                    <Icon name="wallet" />
                    <p>
                      <strong>Source wallet</strong>Review the asset, amount and
                      network gas before signing.
                    </p>
                  </div>
                  <div className="sideCheck">
                    <Icon name="route" />
                    <p>
                      <strong>Solana recipient</strong>Review the address and
                      minimum output in the quote.
                    </p>
                  </div>
                  <div className="sideCheck">
                    <Icon name="time" />
                    <p>
                      <strong>Quote expiry</strong>Refresh an expired quote
                      before opening your wallet.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <header className="cardHeading">
                    <h2>What a receipt proves</h2>
                    <span className="cardIcon">
                      <Icon name="shield" />
                    </span>
                  </header>
                  <div className="sideCheck">
                    <Icon name="check" />
                    <p>
                      <strong>NEAR execution</strong>The transaction reached
                      finality with a success or failure outcome.
                    </p>
                  </div>
                  <div className="sideCheck">
                    <Icon name="wallet" />
                    <p>
                      <strong>Wallet payout</strong>A matching transfer shows
                      how much NEAR the signing account received.
                    </p>
                  </div>
                  <div className="sideCheck">
                    <Icon name="route" />
                    <p>
                      <strong>Cross-chain delivery</strong>Check the provider’s
                      status, then verify the balance change on Solana.
                    </p>
                  </div>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
