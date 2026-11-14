import {
  formatNearAmount,
  type RawAccountDetails,
} from "@rhea-finance/rnear-sdk";
import { isBase58Bytes } from "./addresses";
import { stakingContract } from "./contracts";
import {
  archival,
  type RecoveryEvidence,
  type RecoveryReceipt,
} from "./receipts";
import type { inspect } from "./recovery";

type Position = Awaited<ReturnType<typeof inspect>>;

export function assessExit(position: Position) {
  const pending = BigInt(position.position.pendingNear.raw);
  if (pending > 0n && position.position.canWithdraw)
    return {
      action: "claim" as const,
      amount: position.position.pendingNear.amount,
    };
  if (pending > 0n)
    return {
      action: "wait" as const,
      epoch: position.position.unstakeAvailableEpochHeight,
    };
  if (BigInt(position.shares.raw) > 0n)
    return { action: "unstake" as const, amount: position.shares.amount };
  return { action: "none" as const };
}

type HistoricalState = {
  height: number;
  hash: string;
  pending: string;
  canWithdraw: boolean;
};

async function readHistoricalState(
  account: string,
  block: number | string,
): Promise<HistoricalState> {
  const result = await archival.send<{
    block_height: number;
    block_hash: string;
    result: number[];
  }>("query", {
    request_type: "call_function",
    account_id: stakingContract,
    method_name: "get_account_details",
    args_base64: btoa(JSON.stringify({ account_id: account })),
    block_id: block,
  });
  const data: RawAccountDetails = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(result.result)),
  );
  if (
    data.account_id !== account ||
    !/^\d{1,39}$/.test(data.unstaked_balance) ||
    typeof data.can_withdraw !== "boolean" ||
    !Number.isSafeInteger(result.block_height) ||
    !isBase58Bytes(result.block_hash, 32)
  )
    throw Error("The archival node returned an incomplete staking snapshot.");
  if (typeof block === "string" && result.block_hash !== block)
    throw Error("The archival node returned a different block.");
  return {
    height: result.block_height,
    hash: result.block_hash,
    pending: data.unstaked_balance,
    canWithdraw: data.can_withdraw,
  };
}

export async function replayWithdrawal(
  record: RecoveryReceipt,
  evidence: RecoveryEvidence,
) {
  if (
    evidence.execution !== "confirmed" ||
    !evidence.payout ||
    !evidence.claimBlockHash
  )
    throw Error(
      "Choose a final Rhea withdrawal with a matching NEAR payout and execution block.",
    );
  const account = record.account;
  const block = await archival.send<{
    header: { hash: string; prev_hash: string };
  }>("block", {
    block_id: evidence.claimBlockHash,
  });
  if (
    block.header.hash !== evidence.claimBlockHash ||
    !isBase58Bytes(block.header.prev_hash, 32)
  )
    throw Error("The archival node returned a different claim block.");

  const [before, after] = await Promise.all([
    readHistoricalState(account, block.header.prev_hash),
    readHistoricalState(account, block.header.hash),
  ]);
  const delta = BigInt(before.pending) - BigInt(after.pending);
  return {
    before,
    after,
    payout: evidence.payout,
    reconciled:
      before.canWithdraw &&
      delta > 0n &&
      formatNearAmount(delta.toString()) === evidence.payout,
  };
}
