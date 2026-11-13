import {
  type ChainExecutor,
  SwapClient,
  parseUnits,
  formatUnits,
} from "@rhea-finance/cross-chain-aggregation-dex";
import { createNearExecutor } from "@rhea-finance/cross-chain-aggregation-dex/executors/near";
import { rpc, walletFor, accountId } from "./recovery";
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
};
export const receiptKey = "vestiquay.route.v2";
export function validateReceipt(value: unknown): RouteReceipt {
  const r = value as RouteReceipt;
  if (
    !r ||
    typeof r.sender !== "string" ||
    typeof r.recipient !== "string" ||
    typeof r.status !== "string" ||
    !Array.isArray(r.txHashes) ||
    !r.txHashes.every((v) => typeof v === "string") ||
    typeof r.created !== "number" ||
    typeof r.minimum !== "string" ||
    typeof r.input !== "string" ||
    typeof r.asset !== "string"
  )
    throw Error("This file is not a Vestiquay route receipt.");
  return r;
}
function client() {
  return new SwapClient({ baseUrl, timeoutMs: 20000 });
}
export async function quoteRoute(
  sender: string,
  recipient: string,
  amount: string,
) {
  accountId(sender);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(recipient))
    throw Error("Enter a Solana destination address.");
  if (
    !/^\d+(\.\d{1,24})?$/.test(amount) ||
    BigInt(parseUnits(amount, 24)) <= 0n
  )
    throw Error("Enter a positive source amount.");
  const c = client(),
    [from, to] = await Promise.all([
      c.getFromTokens({ chainId: 900001 }),
      c.getCrossChainToTokens({ chainId: 501 }),
    ]);
  const tokenIn =
    from.find((a) => a.isNative && a.symbol.toUpperCase() === "NEAR") ??
    from.find(
      (a) =>
        a.assetId === "nep141:wrap.near" ||
        a.contractAddress === "wrap.near" ||
        a.address === "wrap.near",
    );
  const tokenOut =
    to.find(
      (a) =>
        a.symbol === "USDC" &&
        a.contractAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    ) ??
    to.find(
      (a) =>
        a.assetId ===
        "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
    );
  if (!tokenIn || !tokenOut)
    throw Error("Rhea currently lists no matching NEAR / Solana USDC assets.");
  const q = await c.quote({
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
  };
}
export async function executeRoute(
  plan: Awaited<ReturnType<typeof quoteRoute>>,
  save: (r: RouteReceipt) => void,
) {
  const { q, sender, recipient, amount, symbol } = plan;
  if (q.expiresAt && Date.now() >= q.expiresAt)
    throw Error("Quote expired. Request a fresh quote.");
  const wallet = await walletFor(sender);
  if (symbol === "wNEAR") {
    const balance = await rpc.viewFunction<string>(
      "wrap.near",
      "ft_balance_of",
      { account_id: sender },
    );
    if (BigInt(balance) < BigInt(parseUnits(amount, 24)))
      throw Error(
        "This route spends wNEAR. Wrap NEAR before sending, then refresh the quote.",
      );
  }
  let receipt: RouteReceipt = {
    sender,
    recipient,
    input: amount,
    asset: symbol,
    minimum: formatUnits(q.minAmountOut, plan.decimals),
    created: Date.now(),
    status: "awaiting wallet confirmation",
    txHashes: [],
    router: q.route.router,
  };
  const executor = createNearExecutor({
    getChain: () => "near",
    async signAndSendTransactions(txs) {
      save(receipt);
      type Transactions = Parameters<
        typeof wallet.signAndSendTransactions
      >[0]["transactions"];
      const outcomes = await wallet.signAndSendTransactions({
        transactions: txs as Transactions,
      });
      const hashes = outcomes.map((r) => r.transaction.hash);
      if (!hashes.length)
        throw Error("No source transaction returned. Check wallet activity.");
      receipt = { ...receipt, txHashes: hashes, status: "source submitted" };
      save(receipt);
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
  const result = await new SwapClient({
    baseUrl,
    executors: [executor as ChainExecutor],
  }).swap({
    quote: q,
    waitFor: "submitted",
    idempotencyKey: crypto.randomUUID(),
  });
  receipt = {
    ...receipt,
    status: result.status,
    router: result.router,
    orderId: result.orderId,
    recordId: result.report?.recordId
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
    destinationTx: typeof dest === "string" ? dest : r.destinationTx,
  };
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
