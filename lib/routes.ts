import {
  type ChainExecutor,
  type NearTransaction,
  SwapClient,
  parseUnits,
  formatUnits,
} from "@rhea-finance/cross-chain-aggregation-dex";
import { createNearExecutor } from "@rhea-finance/cross-chain-aggregation-dex/executors/near";
import { rpc, walletFor, accountId, wrapContract } from "./recovery";
import { isBase58Bytes } from "./addresses";
import { verifyNearSource, type NearExecution } from "./receipts";
import { solanaDestinations, type SolanaDestination } from "./route-assets";
export { formatUnits };
const baseUrl =
  process.env.NEXT_PUBLIC_RHEA_PROXY !== "0" &&
  typeof location !== "undefined" &&
  location.protocol !== "file:"
    ? location.origin + "/rhea"
    : "https://api.rhea.finance";
export type RouteReceipt = {
  sender: string;
  recipient: string;
  input: string;
  asset: string;
  minimum: string;
  status: string;
  created: number;
  router?: string;
  orderId?: string;
  recordId?: string;
  txHashes: string[];
  destinationTx?: string;
  sourceStatus?: NearExecution;
  provider?: "intents";
  depositAddress?: string;
  output?: SolanaDestination;
};
export const receiptKey = "vestiquay.route.v2";
const decimal = /^\d{1,39}(?:\.\d{1,24})?$/;

export async function rheaRouteAvailability() {
  try {
    const result = await fetch("/rhea/availability", {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!result.ok) return "unavailable";
    const data = await result.json();
    if (data.configured === true) return "ready";
    return data.configured === false ? "unconfigured" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function validateReceipt(value: unknown): RouteReceipt {
  const r = value as Partial<RouteReceipt> | null;
  if (
    !r ||
    typeof r.sender !== "string" ||
    typeof r.recipient !== "string" ||
    !isBase58Bytes(r.recipient, 32) ||
    typeof r.status !== "string" ||
    r.status.length > 100 ||
    !Array.isArray(r.txHashes) ||
    r.txHashes.length > 12 ||
    !r.txHashes.every((v) => typeof v === "string" && isBase58Bytes(v, 32)) ||
    typeof r.created !== "number" ||
    !Number.isFinite(r.created) ||
    typeof r.minimum !== "string" ||
    !decimal.test(r.minimum) ||
    typeof r.input !== "string" ||
    !decimal.test(r.input) ||
    (r.asset !== "NEAR" && r.asset !== "wNEAR") ||
    (r.output !== undefined &&
      r.output !== "USDC" &&
      (r.output !== "SOL" || r.provider !== "intents")) ||
    [r.recordId, r.orderId, r.router].some(
      (item) =>
        item !== undefined && (typeof item !== "string" || item.length > 256),
    ) ||
    (r.provider !== undefined &&
      (r.provider !== "intents" ||
        r.asset !== "NEAR" ||
        typeof r.depositAddress !== "string" ||
        !/^[a-f0-9]{64}$/.test(r.depositAddress))) ||
    (r.destinationTx !== undefined &&
      (typeof r.destinationTx !== "string" ||
        !isBase58Bytes(r.destinationTx, 64)))
  )
    throw Error("Choose a valid Vestiquay route receipt.");
  const {
    sender,
    recipient,
    status,
    txHashes,
    created,
    minimum,
    input,
    asset,
    recordId,
    orderId,
    router,
    destinationTx,
    provider,
    depositAddress,
    output,
  } = r;
  return {
    sender: accountId(sender),
    recipient,
    status,
    txHashes,
    created,
    minimum,
    input,
    asset,
    recordId,
    orderId,
    router,
    destinationTx,
    provider,
    depositAddress: provider === "intents" ? depositAddress : undefined,
    output,
  };
}
const publicCatalog = new SwapClient({
  baseUrl: "https://api.rhea.finance",
  timeoutMs: 20000,
});
function makeClient() {
  return new SwapClient({ baseUrl, timeoutMs: 20000 });
}
let publicClient: SwapClient | undefined;
function client() {
  return (publicClient ??= makeClient());
}

export async function quoteRoute(
  sender: string,
  recipient: string,
  amount: string,
) {
  sender = accountId(sender);
  if (!isBase58Bytes(recipient, 32))
    throw Error("Enter a Solana destination address.");
  if (!decimal.test(amount) || BigInt(parseUnits(amount, 24)) <= 0n)
    throw Error("Enter a positive source amount.");
  const [from, to] = await Promise.all([
    publicCatalog.getFromTokens({ chainId: 900001 }),
    publicCatalog.getCrossChainToTokens({ chainId: 501 }),
  ]).catch(() => {
    throw Error(
      "The public Rhea token catalog is unavailable. Try NEAR Intents for this route.",
    );
  });
  const tokenIn =
    from.find((a) => a.isNative && a.symbol.toUpperCase() === "NEAR") ??
    from.find(
      (a) =>
        a.assetId === "nep141:" + wrapContract ||
        a.contractAddress === wrapContract ||
        a.address === wrapContract,
    );
  const tokenOut =
    to.find(
      (a) =>
        a.symbol === "USDC" &&
        a.decimals === solanaDestinations.USDC.decimals &&
        a.contractAddress === solanaDestinations.USDC.mint,
    ) ??
    to.find(
      (a) =>
        a.symbol === "USDC" &&
        a.decimals === solanaDestinations.USDC.decimals &&
        a.contractAddress == null &&
        a.assetId === solanaDestinations.USDC.assetId,
    );
  if (!tokenIn || tokenIn.decimals !== 24 || !tokenOut)
    throw Error("Rhea currently lists no matching NEAR / Solana USDC assets.");
  const q = await client().quote({
    fromChain: "near",
    toChain: "solana",
    tokenIn,
    tokenOut,
    sender,
    recipient,
    amountIn: parseUnits(amount, tokenIn.decimals),
    slippageBps: 50,
  });
  return {
    q,
    symbol: tokenIn.isNative ? "NEAR" : "wNEAR",
    decimals: tokenOut.decimals,
    sender,
    recipient,
    amount,
    expiresAt: Math.min(q.expiresAt ?? Infinity, q.receivedAt + 90_000),
    executionKey: crypto.randomUUID(),
  };
}

export function assertQuoteActive(
  plan: Awaited<ReturnType<typeof quoteRoute>>,
) {
  if (Date.now() >= plan.expiresAt)
    throw Error("This quote expired. Request a fresh quote before signing.");
}

function checkRouteActions(
  txs: NearTransaction[],
  signer: string,
  symbol: string,
  amount: string,
) {
  let source = 0n;
  let attached = 0n;
  for (const tx of txs) {
    accountId(tx.receiverId);
    if (tx.signerId && tx.signerId !== signer)
      throw Error("Rhea returned a transaction for a different signer.");
    for (const raw of tx.actions) {
      const action = raw as {
        type: string;
        params: Record<string, unknown>;
      } | null;
      if (
        !action ||
        !action.params ||
        !["FunctionCall", "Transfer"].includes(action.type) ||
        typeof action.params.deposit !== "string" ||
        !/^\d{1,39}$/.test(action.params.deposit)
      )
        throw Error("Rhea returned an unsupported wallet action.");
      const deposit = BigInt(action.params.deposit);
      attached += deposit;
      if (symbol === "NEAR") {
        if (
          action.type === "Transfer" ||
          action.params.methodName === "near_deposit"
        )
          source += deposit;
        continue;
      }
      if (
        tx.receiverId !== wrapContract ||
        !["ft_transfer", "ft_transfer_call"].includes(
          String(action.params.methodName),
        )
      )
        continue;
      const args = action.params.args as { amount?: unknown } | undefined;
      if (typeof args?.amount !== "string" || !/^\d{1,39}$/.test(args.amount))
        throw Error("Rhea returned an invalid wrapped NEAR amount.");
      source += BigInt(args.amount);
    }
  }
  if (source !== BigInt(amount))
    throw Error(
      "The wallet actions spend a different source amount. Request a fresh quote.",
    );
  return {
    attachedNear: formatUnits(
      (attached - (symbol === "NEAR" ? source : 0n)).toString(),
      24,
    ),
    receivers: [...new Set(txs.map((tx) => tx.receiverId))],
  };
}

export async function prepareRoute(
  plan: Awaited<ReturnType<typeof quoteRoute>>,
) {
  assertQuoteActive(plan);
  const { q } = plan;
  const build = await client().buildSwap({
    quote: q,
    idempotencyKey: plan.executionKey,
  });
  const quotedInput = q.tokenIn.isNative
    ? [q.tokenIn.address, String(q.buildContext.request.tokenIn)]
    : [q.tokenIn.address, wrapContract, "nep141:" + wrapContract];
  const output = solanaDestinations.USDC;
  if (
    build.execution.kind !== "near-transaction-batch" ||
    !build.isCrossChain ||
    build.fromChain !== "near" ||
    build.toChain !== "solana" ||
    build.tokenIn.decimals !== 24 ||
    !quotedInput.includes(build.tokenIn.address) ||
    build.tokenOut.decimals !== output.decimals ||
    (build.tokenOut.address !== output.mint &&
      build.tokenOut.address !== output.assetId) ||
    build.amountIn !== q.amountIn ||
    BigInt(build.minAmountOut) < BigInt(q.minAmountOut)
  )
    throw Error(
      "Rhea returned different transfer terms. Request a fresh quote.",
    );
  const summary = checkRouteActions(
    build.execution.transactions,
    plan.sender,
    plan.symbol,
    q.amountIn,
  );
  assertQuoteActive(plan);
  return { build, ...summary };
}

export async function executeRoute(
  plan: Awaited<ReturnType<typeof quoteRoute>>,
  prepared: Awaited<ReturnType<typeof prepareRoute>>,
  save: (r: RouteReceipt) => void,
) {
  const { q, sender, recipient, amount, symbol } = plan;
  const { build } = prepared;
  assertQuoteActive(plan);
  if (symbol === "wNEAR") {
    const balance = await rpc.viewFunction<string>(
      wrapContract,
      "ft_balance_of",
      { account_id: sender },
    );
    if (BigInt(balance) < BigInt(parseUnits(amount, 24)))
      throw Error(
        "This route spends wNEAR. Wrap NEAR before sending, then refresh the quote.",
      );
  }
  assertQuoteActive(plan);
  const wallet = await walletFor(sender);
  let receipt: RouteReceipt = {
    sender,
    recipient,
    input: amount,
    asset: symbol,
    minimum: formatUnits(q.minAmountOut, plan.decimals),
    created: Date.now(),
    status: "awaiting wallet confirmation",
    txHashes: [],
    router: build.order?.router ?? build.router,
    orderId: build.order?.orderId,
  };
  const executor = createNearExecutor({
    getChain: () => "near",
    async signAndSendTransactions(txs) {
      assertQuoteActive(plan);
      type Transactions = Parameters<
        typeof wallet.signAndSendTransactions
      >[0]["transactions"];
      const outcomes = await wallet
        .signAndSendTransactions({
          transactions: txs.map((tx) => ({
            ...tx,
            signerId: sender,
          })) as Transactions,
        })
        .catch(() => {
          throw Error(
            "The wallet did not return a result. Check wallet activity before sending again.",
          );
        });
      const hashes = outcomes
        .map((r) => r.transaction?.hash)
        .filter(
          (hash): hash is string =>
            typeof hash === "string" && isBase58Bytes(hash, 32),
        );
      const failed = outcomes.some(
        (o) =>
          o.status && typeof o.status === "object" && "Failure" in o.status,
      );
      receipt = {
        ...receipt,
        txHashes: hashes,
        status: failed ? "source transaction failed" : "source submitted",
        sourceStatus: failed ? "failed" : "pending",
      };
      if (hashes.length) save(receipt);
      if (!hashes.length || hashes.length !== txs.length || failed)
        throw Error(
          "The source submission did not complete. Check the transaction hashes and wallet activity before retrying.",
        );
      return { txHashes: hashes, raw: outcomes };
    },
    async waitForTransactions(hashes) {
      for (const hash of hashes) {
        const out = await rpc.send<{ status: Record<string, unknown> }>("tx", {
          tx_hash: hash,
          sender_account_id: sender,
          wait_until: "FINAL",
        });
        if (!out.status || !("SuccessValue" in out.status))
          return { status: "failed" };
      }
      return { status: "confirmed" };
    },
  });
  const swap = new SwapClient({
    baseUrl,
    timeoutMs: 20000,
    executors: [executor as ChainExecutor],
  });
  let result;
  try {
    result = await swap.executeSwap({ build, waitFor: "submitted" });
  } catch (error) {
    if (receipt.txHashes.length)
      throw Error(
        "A source transaction was recorded. Open Receipts and check its status before retrying.",
      );
    if (error instanceof Error && error.cause instanceof Error)
      throw error.cause;
    throw error;
  }
  receipt = {
    ...receipt,
    status: result.status,
    orderId: result.orderId ?? receipt.orderId,
    recordId:
      result.report?.recordId != null
        ? String(result.report.recordId)
        : undefined,
    txHashes:
      result.txHashes ?? (result.txHash ? [result.txHash] : receipt.txHashes),
  };
  save(receipt);
  return receipt;
}
export async function refreshReceipt(r: RouteReceipt) {
  if (!r.recordId && !r.orderId)
    throw Error(
      "No Rhea tracking ID is available. Inspect the source transaction in your wallet before taking another action.",
    );
  const s = await client().getOrderStatus({
    recordId: r.recordId,
    orderId: r.orderId,
    router: r.router,
  });
  const dest = s.raw.to_hash ?? s.raw.destinationTxHash;
  return {
    ...r,
    status: s.status,
    destinationTx:
      typeof dest === "string" && isBase58Bytes(dest, 64) ? dest : undefined,
  };
}

export async function refreshRouteSource(receipt: RouteReceipt) {
  if (!receipt.txHashes.length)
    throw Error("This receipt has no NEAR transaction hash.");
  const deposit =
    receipt.provider === "intents" && receipt.depositAddress
      ? {
          receiver: receipt.depositAddress,
          amount: parseUnits(receipt.input, 24),
        }
      : undefined;
  const checks = await Promise.all(
    receipt.txHashes.map((hash) =>
      verifyNearSource(receipt.sender, hash, deposit),
    ),
  );
  const sourceStatus: NearExecution = checks.includes("failed")
    ? "failed"
    : checks.every((item) => item === "confirmed")
      ? "confirmed"
      : "pending";
  return { ...receipt, sourceStatus };
}
export function download(name: string, data: string) {
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
