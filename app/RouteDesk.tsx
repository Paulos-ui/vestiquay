import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatUnits,
  prepareRoute,
  quoteRoute,
  executeRoute,
  rheaRouteAvailability,
  type RouteReceipt,
} from "../lib/routes";
import { executeIntents, prepareIntents, quoteIntents } from "../lib/intents";
import { wrap, wrapPreview } from "../lib/recovery";
import {
  solanaDestinations,
  type SolanaDestination,
} from "../lib/route-assets";
import Icon from "./Icon";
import SolanaRecipient from "./SolanaRecipient";

type Props = {
  connected: string;
  initialSender: string;
  initialAmount?: string;
  busy: boolean;
  run: (work: () => Promise<void>) => void;
  connect: () => Promise<unknown>;
  save: (receipt: RouteReceipt) => void;
};

type Draft =
  | {
      provider: "intents";
      plan: Awaited<ReturnType<typeof quoteIntents>>;
      prepared?: Awaited<ReturnType<typeof prepareIntents>>;
    }
  | {
      provider: "rhea";
      plan: Awaited<ReturnType<typeof quoteRoute>>;
      prepared?: Awaited<ReturnType<typeof prepareRoute>>;
    };

export default function RouteDesk({
  connected,
  initialSender,
  initialAmount,
  busy,
  run,
  connect,
  save,
}: Props) {
  const [mode, setMode] = useState<"intents" | "rhea">("intents");
  const [manualSender, setManualSender] = useState(initialSender);
  const [recipient, setRecipient] = useState("");
  const [output, setOutput] = useState<SolanaDestination>("USDC");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [draft, setDraft] = useState<Draft>();
  const [wrapped, setWrapped] =
    useState<Awaited<ReturnType<typeof wrapPreview>>>();
  const [routing, setRouting] = useState<
    "checking" | Awaited<ReturnType<typeof rheaRouteAvailability>>
  >("checking");
  const [now, setNow] = useState(0);
  const [note, setNote] = useState("");
  const quoteHeading = useRef<HTMLHeadingElement>(null);
  const walletHeading = useRef<HTMLHeadingElement>(null);
  const sender = connected || manualSender.trim();
  const destination = solanaDestinations[mode === "intents" ? output : "USDC"];

  useEffect(() => {
    let active = true;
    if (mode !== "rhea") return;
    setRouting("checking");
    void rheaRouteAvailability().then((availability) => {
      if (active) setRouting(availability);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (!draft) return;
    const update = () => setNow(Date.now());
    update();
    const clock = window.setInterval(update, 1000);
    return () => window.clearInterval(clock);
  }, [draft]);

  const setDestination = useCallback((address: string) => {
    setRecipient(address);
    setDraft(undefined);
  }, []);

  const current =
    draft?.plan.sender === sender &&
    draft.plan.recipient === recipient &&
    draft.plan.amount === amount.trim() &&
    (draft.provider !== "intents" || draft.plan.output === output)
      ? draft
      : undefined;
  const wrapPlan =
    wrapped?.tx.signerId === sender && wrapped.amount === amount.trim()
      ? wrapped
      : undefined;
  const intentTerms =
    current?.provider === "intents"
      ? (current.prepared ?? current.plan)
      : undefined;
  const terms = intentTerms ?? current?.plan;
  const expired = Boolean(terms && now >= terms.expiresAt);
  const ready = mode === "intents" || routing === "ready";

  useEffect(() => {
    if (!current) return;
    const heading = current.prepared
      ? walletHeading.current
      : quoteHeading.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "center" });
  }, [current]);

  function selectProvider(provider: "intents" | "rhea") {
    setMode(provider);
    setDraft(undefined);
    setWrapped(undefined);
    setNote("");
  }

  function preview(event: React.FormEvent) {
    event.preventDefault();
    setDraft(undefined);
    setNote("");
    run(async () => {
      if (mode === "intents") {
        const plan = await quoteIntents(
          sender,
          recipient,
          amount.trim(),
          output,
        );
        setNow(Date.now());
        setDraft({ provider: mode, plan });
      } else {
        const plan = await quoteRoute(sender, recipient, amount.trim());
        setNow(Date.now());
        setDraft({ provider: mode, plan });
      }
    });
  }

  function approve(order: Draft) {
    if (order.provider === "intents" && order.prepared) {
      return executeIntents(order.prepared, save);
    }
    if (order.provider === "rhea" && order.prepared) {
      return executeRoute(order.plan, order.prepared, save);
    }
    throw Error("Prepare the wallet review first.");
  }

  return (
    <>
      <div className="tabs receiptTabs" aria-label="Routing provider">
        <button
          type="button"
          aria-pressed={mode === "intents"}
          disabled={busy}
          onClick={() => selectProvider("intents")}
        >
          NEAR Intents
        </button>
        <button
          type="button"
          aria-pressed={mode === "rhea"}
          disabled={busy}
          onClick={() => selectProvider("rhea")}
        >
          Rhea route
        </button>
      </div>
      {mode === "rhea" && ready && (
        <p className="rheaRouteNote">
          Rhea’s swap API access is checked when you request a quote. This route
          quotes USDC.
        </p>
      )}
      {!ready ? (
        <div className="routeNotice">
          <strong>
            {routing === "checking"
              ? "Checking Rhea access…"
              : routing === "unconfigured"
                ? "Rhea swap access needs to be configured on this deployment."
                : "Could not check Rhea swap access."}
          </strong>
          {routing !== "checking" && (
            <p>Choose NEAR Intents for a live quote.</p>
          )}
        </div>
      ) : (
        <form className="routeInputs" onSubmit={preview}>
          {connected ? (
            <div className="routeSender">
              <span className="cardIcon">
                <Icon name="wallet" />
              </span>
              <div>
                <small>From your NEAR wallet</small>
                <strong>{connected}</strong>
              </div>
              <span className="evidenceTag" data-state="confirmed">
                Connected
              </span>
            </div>
          ) : (
            <div className="routeSenderInput">
              <label>
                NEAR sender
                <input
                  value={manualSender}
                  required
                  disabled={busy}
                  maxLength={64}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="your-account.near"
                  onChange={(event) => {
                    setManualSender(event.target.value);
                    setDraft(undefined);
                    setWrapped(undefined);
                  }}
                />
              </label>
              <button
                type="button"
                className="minor"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setDraft(undefined);
                    await connect();
                  })
                }
              >
                <Icon name="wallet" /> Connect source wallet
              </button>
              <p>
                Enter a public account to preview a quote, or connect the wallet
                that will send it.
              </p>
            </div>
          )}
          <label>
            Amount on NEAR
            <input
              value={amount}
              required
              disabled={busy}
              maxLength={50}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => {
                setAmount(event.target.value);
                setWrapped(undefined);
                setDraft(undefined);
              }}
            />
          </label>
          {mode === "intents" && (
            <label>
              Receive on Solana
              <select
                className="destinationSelect"
                disabled={busy}
                value={output}
                onChange={(event) => {
                  setOutput(event.target.value === "SOL" ? "SOL" : "USDC");
                  setDraft(undefined);
                }}
              >
                <option value="USDC">USDC</option>
                <option value="SOL">SOL</option>
              </select>
            </label>
          )}
          <SolanaRecipient
            recipient={recipient}
            asset={destination.symbol}
            busy={busy}
            onChange={setDestination}
            run={run}
          />
          {mode === "rhea" && (
            <details>
              <summary>Wrap native NEAR for this route</summary>
              <p>
                Rhea may quote wNEAR as the source token. Wrapping is a separate
                transaction.
              </p>
              <button
                type="button"
                className="minor"
                disabled={busy || !sender || !amount.trim()}
                onClick={() =>
                  run(async () =>
                    setWrapped(await wrapPreview(sender, amount.trim())),
                  )
                }
              >
                Preview wrap
              </button>
              {wrapPlan && (
                <div className="orderReview">
                  <p>
                    Wrap {wrapPlan.amount} NEAR. Additional storage{" "}
                    {wrapPlan.storage} NEAR. Network gas also applies.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const hash = await wrap(
                          sender,
                          wrapPlan.amount,
                          wrapPlan.storage,
                        );
                        setWrapped(undefined);
                        setNote("Wrap transaction " + hash);
                      })
                    }
                  >
                    Sign wrap
                  </button>
                </div>
              )}
            </details>
          )}
          <button type="submit" disabled={busy}>
            Request live quote <Icon name="arrow" />
          </button>
          {note && <p role="status">{note}</p>}
        </form>
      )}
      {ready && current && terms && (
        <div className="receipt routeQuote">
          <h3 className="eyebrow" tabIndex={-1} ref={quoteHeading}>
            {current.provider === "intents"
              ? "NEAR Intents"
              : current.plan.q.route.router}
            {" · "}
            {destination.symbol} on Solana
          </h3>
          <dl className="proofDetails">
            <div>
              <dt>Expected {destination.symbol}</dt>
              <dd>
                {formatUnits(
                  current.provider === "intents"
                    ? (current.prepared ?? current.plan).expected
                    : current.plan.q.estimatedOut,
                  destination.decimals,
                )}
              </dd>
            </div>
            <div>
              <dt>Minimum {destination.symbol}</dt>
              <dd>
                {formatUnits(
                  current.provider === "intents"
                    ? (current.prepared ?? current.plan).minimum
                    : current.plan.q.minAmountOut,
                  destination.decimals,
                )}
              </dd>
            </div>
            {intentTerms?.withdrawalFee && (
              <div>
                <dt>Destination fee included in quote</dt>
                <dd>
                  {formatUnits(intentTerms.withdrawalFee, destination.decimals)}{" "}
                  {destination.symbol}
                </dd>
              </div>
            )}
            <div>
              <dt>Solana recipient</dt>
              <dd>{recipient}</dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>
                {expired
                  ? "Quote expired"
                  : Math.ceil((terms.expiresAt - now) / 1000) + " seconds"}
              </dd>
            </div>
          </dl>
          {current.provider === "intents" && (
            <p>
              Quote includes the provider’s swap and destination costs. Your
              NEAR wallet shows the source network gas.
            </p>
          )}
          {current.prepared && (
            <div className="orderReview">
              <h3 tabIndex={-1} ref={walletHeading}>
                Wallet review
              </h3>
              {current.provider === "intents" ? (
                <dl className="proofDetails">
                  <div>
                    <dt>NEAR to send</dt>
                    <dd>{current.plan.amount} NEAR</dd>
                  </div>
                  <div>
                    <dt>Deposit account</dt>
                    <dd>{current.prepared.deposit}</dd>
                  </div>
                  <div>
                    <dt>On-chain refund address</dt>
                    <dd>{current.plan.sender} · NEAR</dd>
                  </div>
                </dl>
              ) : (
                <p>
                  Send {current.plan.amount} {current.plan.symbol}. NEAR
                  receivers {current.prepared.receivers.join(", ")}. Additional
                  attached NEAR {current.prepared.attachedNear}.
                </p>
              )}
              <p>
                Your wallet checks the available NEAR and network gas before you
                approve.
              </p>
            </div>
          )}
          {current.prepared ? (
            <button
              type="button"
              disabled={busy || expired || !connected}
              onClick={() =>
                run(async () => {
                  await approve(current);
                })
              }
            >
              Review in NEAR wallet <Icon name="arrow" />
            </button>
          ) : connected ? (
            <button
              type="button"
              disabled={busy || expired}
              onClick={() =>
                run(async () => {
                  if (current.provider === "intents")
                    setDraft({
                      ...current,
                      prepared: await prepareIntents(current.plan),
                    });
                  else
                    setDraft({
                      ...current,
                      prepared: await prepareRoute(current.plan),
                    });
                })
              }
            >
              Prepare wallet review
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || expired}
              onClick={() =>
                run(async () => {
                  await connect();
                })
              }
            >
              Connect to continue <Icon name="wallet" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
