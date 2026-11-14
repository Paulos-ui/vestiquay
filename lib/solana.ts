import { isBase58Bytes } from "./addresses";
import { solanaDestinations, type SolanaDestination } from "./route-assets";

const splToken = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const endpoints = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];
type TokenBalance = {
  accountIndex: number;
  owner?: string;
  mint: string;
  programId?: string;
  uiTokenAmount: { amount: string; decimals: number };
};
type SolanaTransaction = {
  slot: number;
  transaction: {
    signatures: string[];
    message?: { accountKeys?: { pubkey: string; signer: boolean }[] };
  };
  meta: {
    err: unknown;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
};

async function getTransaction(url: string, signature: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          commitment: "finalized",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 1,
        },
      ],
    }),
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) throw Error("Solana RPC is unavailable.");
  const body = (await response.json()) as {
    error?: unknown;
    result?: SolanaTransaction | null;
  };
  if (body.error || !body.result)
    throw Error("The Solana transaction is not finalized or is unavailable.");
  return body.result;
}

export async function verifySolanaDelivery(
  signature: string,
  recipient: string,
  output: SolanaDestination = "USDC",
  minimum?: string,
) {
  if (!isBase58Bytes(signature, 64) || !isBase58Bytes(recipient, 32))
    throw Error("Provide a valid Solana transaction and recipient.");
  let tx: SolanaTransaction;
  try {
    tx = await Promise.any(
      endpoints.map((url) => getTransaction(url, signature)),
    );
  } catch {
    throw Error(
      "Solana RPC has not returned a finalized transaction. Recheck shortly.",
    );
  }
  if (
    tx.transaction?.signatures?.[0] !== signature ||
    !Number.isSafeInteger(tx.slot) ||
    !tx.meta ||
    tx.meta.err !== null
  )
    throw Error("Solana did not return a successful finalized transaction.");

  let increase: bigint;
  if (output === "SOL") {
    const keys = tx.transaction.message?.accountKeys;
    const index = Array.isArray(keys)
      ? keys.findIndex((key) => key.pubkey === recipient)
      : -1;
    const before = tx.meta.preBalances?.[index];
    const after = tx.meta.postBalances?.[index];
    if (
      index < 0 ||
      before === undefined ||
      after === undefined ||
      !Number.isSafeInteger(before) ||
      !Number.isSafeInteger(after) ||
      before < 0 ||
      after < 0
    )
      throw Error("Solana did not return exact SOL balances for that wallet.");
    increase = BigInt(after) - BigInt(before);
  } else {
    increase = usdcIncrease(
      tx.meta.preTokenBalances,
      tx.meta.postTokenBalances,
      recipient,
    );
  }
  if (increase <= 0n)
    throw Error(
      `This transaction does not show a positive ${output} balance change for that wallet.`,
    );
  if (minimum && increase < BigInt(minimum))
    throw Error(`The wallet received less ${output} than the quote’s minimum.`);
  return { amount: increase.toString(), slot: tx.slot };
}

function usdcIncrease(
  before: TokenBalance[] | undefined,
  after: TokenBalance[] | undefined,
  recipient: string,
) {
  if (!Array.isArray(before) || !Array.isArray(after))
    throw Error("Solana did not return the transaction’s token balances.");

  function sum(balances: TokenBalance[]) {
    let total = 0n;
    for (const balance of balances) {
      if (
        balance.mint !== solanaDestinations.USDC.mint ||
        balance.owner !== recipient
      )
        continue;
      if (
        (balance.programId && balance.programId !== splToken) ||
        balance.uiTokenAmount?.decimals !== 6 ||
        typeof balance.uiTokenAmount.amount !== "string" ||
        !/^\d{1,20}$/.test(balance.uiTokenAmount.amount)
      )
        throw Error("Solana returned inconsistent USDC balance data.");
      total += BigInt(balance.uiTokenAmount.amount);
    }
    return total;
  }

  return sum(after) - sum(before);
}
