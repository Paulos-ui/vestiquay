import {
  formatUnits,
  parseUnits,
} from "@rhea-finance/cross-chain-aggregation-dex";
import { isBase58Bytes } from "./addresses";
import { accountId, walletFor } from "./recovery";
import { solanaDestinations, type SolanaDestination } from "./route-assets";
import type { RouteReceipt } from "./routes";

const base = "https://1click.chaindefuser.com/v0";
const originAsset = "nep141:wrap.near";
const slippageTolerance = 50;
const amountPattern = /^\d{1,39}(?:\.\d{1,24})?$/;
const unitPattern = /^\d{1,39}$/;

type QuoteRequest = {
  dry: boolean;
  swapType: "EXACT_INPUT";
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  deadline: string;
};

type QuoteResponse = {
  quoteRequest: QuoteRequest;
  quote: {
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    withdrawFee?: string;
    depositAddress?: string;
    depositMemo?: string;
    deadline?: string;
    timeWhenInactive?: string;
  };
};

type IntentQuote = {
  sender: string;
  recipient: string;
  amount: string;
  input: string;
  output: SolanaDestination;
  expected: string;
  minimum: string;
  withdrawalFee?: string;
  expiresAt: number;
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(18000),
      cache: "no-store",
    });
  } catch {
    throw Error(
      "Could not reach NEAR Intents. Check your connection and try again.",
    );
  }
  const data = (await response.json()) as T & { message?: unknown };
  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message.slice(0, 220)
        : "Try again in a moment.";
    throw Error(`NEAR Intents could not complete the request. ${message}`);
  }
  return data;
}

function matchesRequest(
  actual: QuoteRequest | undefined,
  expected: QuoteRequest,
) {
  return (
    actual &&
    Object.entries(expected).every(
      ([key, value]) => actual[key as keyof QuoteRequest] === value,
    )
  );
}

function checkQuote(data: QuoteResponse, terms: QuoteRequest) {
  const q = data.quote;
  if (
    !matchesRequest(data.quoteRequest, terms) ||
    q?.amountIn !== terms.amount ||
    ![q.amountOut, q.minAmountOut].every(
      (amount) => typeof amount === "string" && unitPattern.test(amount),
    ) ||
    BigInt(q.minAmountOut) <= 0n ||
    BigInt(q.amountOut) < BigInt(q.minAmountOut)
  )
    throw Error(
      "NEAR Intents returned different quote terms. Request a fresh quote.",
    );
  return q;
}

async function requestQuote(
  sender: string,
  recipient: string,
  amount: string,
  output: SolanaDestination,
  dry: boolean,
) {
  const terms: QuoteRequest = {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance,
    originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: solanaDestinations[output].assetId,
    amount,
    recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo: sender,
    refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  const quote = checkQuote(
    await request<QuoteResponse>("/quote", terms),
    terms,
  );
  return { quote, terms };
}

export async function quoteIntents(
  sender: string,
  recipient: string,
  amount: string,
  output: SolanaDestination = "USDC",
): Promise<IntentQuote> {
  sender = accountId(sender);
  if (!isBase58Bytes(recipient, 32))
    throw Error("Choose a Solana wallet or enter a valid Solana address.");
  if (!amountPattern.test(amount) || BigInt(parseUnits(amount, 24)) <= 0n)
    throw Error("Enter a positive NEAR amount.");
  const input = parseUnits(amount, 24);
  const { quote } = await requestQuote(sender, recipient, input, output, true);
  return {
    sender,
    recipient,
    amount,
    input,
    output,
    expected: quote.amountOut,
    minimum: quote.minAmountOut,
    withdrawalFee:
      typeof quote.withdrawFee === "string" &&
      unitPattern.test(quote.withdrawFee)
        ? quote.withdrawFee
        : undefined,
    expiresAt: Date.now() + 90_000,
  };
}

export async function prepareIntents(plan: IntentQuote) {
  if (Date.now() >= plan.expiresAt)
    throw Error("This quote expired. Request a fresh quote.");
  const { quote, terms } = await requestQuote(
    plan.sender,
    plan.recipient,
    plan.input,
    plan.output,
    false,
  );
  const deposit = quote.depositAddress;
  if (
    !deposit ||
    !/^[a-f0-9]{64}$/.test(deposit) ||
    deposit === plan.sender ||
    quote.depositMemo
  )
    throw Error("NEAR Intents returned an unexpected deposit account.");
  const expiryValues = [terms.deadline, quote.deadline, quote.timeWhenInactive]
    .filter((value): value is string => Boolean(value))
    .map(Date.parse);
  const expiresAt = Math.min(...expiryValues);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt)
    throw Error("The deposit quote expired. Request a fresh quote.");
  return {
    ...plan,
    expected: quote.amountOut,
    minimum: quote.minAmountOut,
    withdrawalFee:
      typeof quote.withdrawFee === "string" &&
      unitPattern.test(quote.withdrawFee)
        ? quote.withdrawFee
        : undefined,
    expiresAt,
    deposit,
  };
}

export async function executeIntents(
  plan: Awaited<ReturnType<typeof prepareIntents>>,
  save: (receipt: RouteReceipt) => void,
) {
  if (Date.now() >= plan.expiresAt) throw Error("This deposit quote expired.");
  const wallet = await walletFor(plan.sender);
  if (Date.now() + 10_000 >= plan.expiresAt)
    throw Error(
      "This deposit quote is too close to expiry. Request a fresh quote.",
    );

  const receipt: RouteReceipt = {
    sender: plan.sender,
    recipient: plan.recipient,
    input: plan.amount,
    asset: "NEAR",
    minimum: formatUnits(
      plan.minimum,
      solanaDestinations[plan.output].decimals,
    ),
    status: "wallet approval requested",
    created: Date.now(),
    provider: "intents",
    depositAddress: plan.deposit,
    output: plan.output,
    txHashes: [],
  };
  save(receipt);
  const outcome = await wallet.signAndSendTransaction({
    signerId: plan.sender,
    receiverId: plan.deposit,
    actions: [{ type: "Transfer", params: { deposit: plan.input } }],
  });
  const hash = outcome.transaction?.hash;
  const matches =
    outcome.transaction?.signer_id === plan.sender &&
    typeof hash === "string" &&
    isBase58Bytes(hash, 32);
  const failed =
    outcome.status &&
    typeof outcome.status === "object" &&
    "Failure" in outcome.status;
  save({
    ...receipt,
    txHashes: matches ? [hash] : [],
    status: failed
      ? "source transaction failed"
      : matches
        ? "source submitted"
        : "source hash unavailable",
  });
  if (!matches || failed)
    throw Error(
      "Check the saved order and your wallet activity before trying another transfer.",
    );
}

type IntentStatusResponse = {
  status: string;
  quoteResponse?: QuoteResponse;
  swapDetails?: {
    originChainTxHashes?: { hash?: string }[];
    destinationChainTxHashes?: { hash?: string }[];
  };
};

const statuses: Record<string, string> = {
  PENDING_DEPOSIT: "awaiting deposit",
  KNOWN_DEPOSIT_TX: "deposit detected",
  PROCESSING: "processing",
  INCOMPLETE_DEPOSIT: "incomplete deposit",
  SUCCESS: "delivered",
  REFUNDED: "refunded",
  FAILED: "failed",
};

export async function refreshIntentReceipt(
  receipt: RouteReceipt,
): Promise<RouteReceipt> {
  if (
    receipt.asset !== "NEAR" ||
    !receipt.depositAddress ||
    !/^[a-f0-9]{64}$/.test(receipt.depositAddress)
  )
    throw Error("The NEAR Intents receipt has no valid deposit account.");
  const data = await request<IntentStatusResponse>(
    "/status?depositAddress=" + receipt.depositAddress,
  );
  const q = data.quoteResponse;
  const destination = solanaDestinations[receipt.output ?? "USDC"];
  if (
    q?.quote?.depositAddress !== receipt.depositAddress ||
    q.quoteRequest?.dry !== false ||
    q.quoteRequest.originAsset !== originAsset ||
    q.quoteRequest.destinationAsset !== destination.assetId ||
    q.quoteRequest.refundTo !== receipt.sender ||
    q.quoteRequest.recipient !== receipt.recipient ||
    q.quoteRequest.amount !== parseUnits(receipt.input, 24) ||
    q.quoteRequest.depositType !== "ORIGIN_CHAIN" ||
    q.quoteRequest.recipientType !== "DESTINATION_CHAIN" ||
    q.quoteRequest.refundType !== "ORIGIN_CHAIN" ||
    q.quoteRequest.swapType !== "EXACT_INPUT" ||
    q.quote.minAmountOut !== parseUnits(receipt.minimum, destination.decimals)
  )
    throw Error("The provider order does not match this receipt.");
  const txHashes = (
    Array.isArray(data.swapDetails?.originChainTxHashes)
      ? data.swapDetails.originChainTxHashes
      : []
  ).flatMap((item) =>
    typeof item?.hash === "string" && isBase58Bytes(item.hash, 32)
      ? [item.hash]
      : [],
  );
  const destinationTx = (
    Array.isArray(data.swapDetails?.destinationChainTxHashes)
      ? data.swapDetails.destinationChainTxHashes
      : []
  ).find(
    (item) => typeof item?.hash === "string" && isBase58Bytes(item.hash, 64),
  )?.hash;
  return {
    ...receipt,
    status: Object.hasOwn(statuses, data.status)
      ? statuses[data.status]
      : "unknown provider status",
    txHashes: [...new Set([...receipt.txHashes, ...txHashes])].slice(0, 12),
    destinationTx: data.status === "SUCCESS" ? destinationTx : undefined,
  };
}
