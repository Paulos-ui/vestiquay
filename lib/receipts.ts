import { formatNearAmount, NearRpcProvider } from "@rhea-finance/rnear-sdk";
import { isBase58Bytes } from "./addresses";
import { stakingContract } from "./contracts";
import { accountId, rpc } from "./recovery";
export { nearExplorer, publicRecovery } from "./contracts";

export type RecoveryReceipt = {
  kind: "near-recovery";
  version: 1;
  account: string;
  hash: string;
};

type NearTransaction = {
  final_execution_status?: string;
  status?: { SuccessValue?: string; Failure?: unknown } | string;
  transaction?: {
    hash: string;
    signer_id: string;
    receiver_id: string;
    actions: Array<{ FunctionCall?: { method_name: string; args: string } }>;
  };
  transaction_outcome?: { block_hash: string };
  receipts?: Array<{
    receipt_id: string;
    predecessor_id: string;
    receiver_id: string;
    receipt: {
      Action?: { actions: Array<{ Transfer?: { deposit: string } }> };
    };
  }>;
  receipts_outcome?: Array<{
    id: string;
    outcome: { status: { SuccessValue?: string } | string };
  }>;
};

export type NearExecution = "pending" | "failed" | "confirmed";
export type RecoveryEvidence = {
  method?: string;
  requested?: string;
  payout?: string;
  execution: NearExecution;
  blockHash?: string;
  checkedAt: number;
};

export const recoveryReceiptKey = "vestiquay.recovery.v1";
const archival = new NearRpcProvider(
  ["https://archival-rpc.mainnet.fastnear.com"],
  12000,
);
const methods = new Set(["withdraw", "withdraw_all", "unstake", "unstake_all"]);

export function recoveryReceipt(
  account: string,
  hash: string,
): RecoveryReceipt {
  const trimmed = hash.trim();
  if (!isBase58Bytes(trimmed, 32))
    throw Error("Enter a valid NEAR transaction hash.");
  return {
    kind: "near-recovery",
    version: 1,
    account: accountId(account),
    hash: trimmed,
  };
}

export function parseRecoveryReceipt(value: unknown): RecoveryReceipt {
  const r = value as Partial<RecoveryReceipt> | null;
  if (
    r?.kind !== "near-recovery" ||
    r.version !== 1 ||
    typeof r.account !== "string" ||
    typeof r.hash !== "string"
  )
    throw Error("Choose a Vestiquay NEAR recovery receipt.");
  return recoveryReceipt(r.account, r.hash);
}

function executionStatus(outcome: NearTransaction): NearExecution {
  if (
    outcome.final_execution_status !== "FINAL" ||
    !outcome.status ||
    typeof outcome.status !== "object"
  )
    return "pending";
  if ("Failure" in outcome.status) return "failed";
  return "SuccessValue" in outcome.status ? "confirmed" : "pending";
}

async function readTransaction(
  account: string,
  hash: string,
  withReceipts = false,
) {
  const params = {
    tx_hash: hash,
    sender_account_id: account,
    wait_until: "NONE",
  };
  const method = withReceipts ? "EXPERIMENTAL_tx_status" : "tx";
  const recent = rpc.send<NearTransaction>(method, params);
  const historical = archival.send<NearTransaction>(method, params);
  try {
    // Recent nodes can disagree about historical availability.
    const result = await Promise.any([recent, historical]);
    if (
      withReceipts &&
      result.final_execution_status === "FINAL" &&
      !result.receipts?.length
    ) {
      const archived = await historical.catch(() => undefined);
      return archived?.final_execution_status === "FINAL" ? archived : result;
    }
    return result;
  } catch {
    throw Error(
      "NEAR could not verify this transaction. Check the signing account and hash, then retry.",
    );
  }
}

export async function verifyNearSource(account: string, hash: string) {
  const r = recoveryReceipt(account, hash);
  const outcome = await readTransaction(r.account, r.hash);
  if (
    outcome.transaction &&
    (outcome.transaction.hash !== r.hash ||
      outcome.transaction.signer_id !== r.account)
  )
    throw Error(
      "The NEAR transaction does not match the supplied hash and signer.",
    );
  return outcome.transaction ? executionStatus(outcome) : "pending";
}

export async function verifyRecovery(
  r: RecoveryReceipt,
): Promise<RecoveryEvidence> {
  const outcome = await readTransaction(r.account, r.hash, true);
  const checkedAt = Date.now();
  const tx = outcome.transaction;
  if (!tx) {
    if (outcome.final_execution_status === "FINAL")
      throw Error(
        "NEAR returned no transaction details. Try checking the hash again.",
      );
    return { execution: "pending", checkedAt };
  }
  const call = tx.actions?.[0]?.FunctionCall;
  if (
    tx.hash !== r.hash ||
    tx.signer_id !== r.account ||
    tx.receiver_id !== stakingContract ||
    tx.actions?.length !== 1 ||
    !call ||
    !methods.has(call.method_name)
  )
    throw Error(
      "This hash does not match a Rhea staking withdrawal or unstake by this account.",
    );

  let requested: string | undefined;
  if (call.method_name === "withdraw" || call.method_name === "unstake") {
    try {
      const args = JSON.parse(atob(call.args));
      if (typeof args.amount === "string" && /^\d{1,39}$/.test(args.amount))
        requested = formatNearAmount(args.amount);
    } catch {}
  }
  const execution = executionStatus(outcome);
  const payout =
    execution === "confirmed" && call.method_name.startsWith("withdraw")
      ? confirmedPayout(outcome, r.account)
      : undefined;
  return {
    method: call.method_name,
    requested,
    payout,
    execution,
    blockHash: outcome.transaction_outcome?.block_hash,
    checkedAt,
  };
}

function confirmedPayout(outcome: NearTransaction, recipient: string) {
  let total = 0n;
  for (const receipt of outcome.receipts ?? []) {
    if (
      receipt.predecessor_id !== stakingContract ||
      receipt.receiver_id !== recipient
    )
      continue;
    const status = outcome.receipts_outcome?.find(
      (item) => item.id === receipt.receipt_id,
    )?.outcome.status;
    if (!status || typeof status !== "object" || !("SuccessValue" in status))
      continue;
    for (const action of receipt.receipt.Action?.actions ?? []) {
      const value = action.Transfer?.deposit;
      if (typeof value === "string" && /^\d{1,39}$/.test(value))
        total += BigInt(value);
    }
  }
  return total > 0n ? formatNearAmount(total.toString()) : undefined;
}
