import {
  RNearClient,
  NearRpcProvider,
  parseNearAmount,
  formatNearAmount,
  type RawAccountDetails,
} from "@rhea-finance/rnear-sdk";
import { NearConnector } from "@hot-labs/near-connect";
import { isBase58Bytes } from "./addresses";
import { stakingContract } from "./contracts";
export { stakingContract } from "./contracts";
export const wrapContract = "wrap.near";
const pinnedHash = "EPLT4C61pkVYf5Km6dC4X9x5PMo6rfBwuEwo7vgKpmuv";
const rpcUrls = [
  "https://near.drpc.org",
  "https://free.rpc.fastnear.com",
  "https://rpc.mainnet.near.org",
];
export const rpc = new NearRpcProvider(rpcUrls, 7000);
export const staking = new RNearClient({
  network: "mainnet",
  config: { rpcUrls, requestTimeoutMs: 7000 },
});
let connector: NearConnector | undefined;
export function accountId(value: string) {
  const id = value.trim();
  if (
    id.length < 2 ||
    id.length > 64 ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)
  )
    throw Error("Enter a valid NEAR account ID.");
  return id;
}
function positiveAmount(value: string, label: string) {
  if (!/^\d{1,39}(?:\.\d{1,24})?$/.test(value))
    throw Error(
      `Enter a positive ${label} amount with up to 24 decimal places.`,
    );
  const raw = parseNearAmount(value);
  if (BigInt(raw) <= 0n) throw Error(`Enter a positive ${label} amount.`);
  return raw;
}
export function nearWallet() {
  return (connector ??= new NearConnector({ network: "mainnet" }));
}
export async function walletFor(id: string) {
  const provider = nearWallet();
  const session = await provider.getConnectedWallet().catch(() => null);
  const wallet = session?.wallet ?? (await provider.connect());
  if (!(await wallet.getAccounts()).some((a) => a.accountId === id))
    throw Error("Select the same NEAR account you inspected.");
  return wallet;
}
export async function inspect(
  input: string,
  onRead?: (read: "shares" | "withdrawal") => void,
) {
  const id = accountId(input);
  const [position, shares] = await Promise.all([
    positionDetails(id).then((value) => {
      onRead?.("withdrawal");
      return value;
    }),
    staking.getRNearBalance(id).then((value) => {
      onRead?.("shares");
      return value;
    }),
  ]).catch((error: unknown) => {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError", "TypeError"].includes(error.name)
    )
      throw Error("NEAR RPC did not respond. Retry the position lookup.");
    throw error;
  });
  return { id, position, shares, observedAt: Date.now() };
}
async function positionDetails(id: string) {
  try {
    return await staking.getAccountDetails(id);
  } catch {
    // The SDK's epoch estimate uses extra RPC calls. Keep the contract state readable if those fail.
    const raw = await rpc.viewFunction<RawAccountDetails>(
      stakingContract,
      "get_account_details",
      { account_id: id },
    );
    const pending = BigInt(raw.unstaked_balance) >= 10n ** 19n;
    const pendingRaw = pending ? raw.unstaked_balance : "0";
    return {
      accountId: raw.account_id,
      stakedNear: {
        raw: raw.staked_balance,
        amount: formatNearAmount(raw.staked_balance),
      },
      pendingNear: { raw: pendingRaw, amount: formatNearAmount(pendingRaw) },
      canWithdraw: pending && raw.can_withdraw,
      unstakeAvailableEpochHeight: Number(raw.unstaked_available_epoch_height),
      estimatedUnlockAtMs: null,
      raw,
    };
  }
}
async function checkedContractBlock() {
  const account = await rpc.send<{ code_hash: string; block_height: number }>(
    "query",
    {
      request_type: "view_account",
      account_id: stakingContract,
      finality: "final",
    },
  );
  if (account.code_hash !== pinnedHash)
    throw Error("Staking contract changed. Review the adapter before signing.");
  return account.block_height;
}
export async function reviewUnstake(id: string, shares: string) {
  id = accountId(id);
  const sharesRaw = positiveAmount(shares, "rNEAR");
  const [info, block] = await Promise.all([
    inspect(id),
    checkedContractBlock(),
  ]);
  if (BigInt(sharesRaw) > BigInt(info.shares.raw))
    throw Error("The request exceeds the rNEAR balance.");
  const tx = await staking.buildUnstakeTransaction({
    accountId: id,
    rNearAmount: shares,
  });
  const action = tx.actions[0];
  const raw = action?.params.args.amount;
  if (
    tx.signerId !== id ||
    tx.receiverId !== stakingContract ||
    tx.actions.length !== 1 ||
    action?.params.methodName !== "unstake" ||
    typeof raw !== "string" ||
    BigInt(raw) <= 0n
  )
    throw Error("The SDK returned an unexpected unstake request.");
  return {
    id,
    shares,
    nearAmount: formatNearAmount(raw),
    pending: info.position.pendingNear.raw,
    canWithdraw: info.position.canWithdraw,
    unlockEpoch: info.position.unstakeAvailableEpochHeight,
    block,
    tx,
  };
}
export async function submitUnstake(
  review: Awaited<ReturnType<typeof reviewUnstake>>,
) {
  const wallet = await walletFor(review.id);
  const fresh = await reviewUnstake(review.id, review.shares);
  if (
    fresh.nearAmount !== review.nearAmount ||
    fresh.pending !== review.pending ||
    fresh.canWithdraw !== review.canWithdraw ||
    fresh.unlockEpoch !== review.unlockEpoch
  )
    throw Error(
      "The conversion or withdrawal state changed. Review the request again.",
    );
  return submitRecovery(wallet, fresh.tx);
}
export async function reviewWithdrawal(id: string) {
  id = accountId(id);
  const [info, block] = await Promise.all([
    inspect(id),
    checkedContractBlock(),
  ]);
  if (
    !info.position.canWithdraw ||
    BigInt(info.position.pendingNear.raw) === 0n
  )
    throw Error("There is no eligible delayed withdrawal for this account.");
  const amount = info.position.pendingNear.amount;
  const tx = staking.buildWithdrawTransaction({
    accountId: id,
    nearAmount: amount,
  });
  if (
    tx.signerId !== id ||
    tx.receiverId !== stakingContract ||
    tx.actions.length !== 1 ||
    tx.actions[0]?.params.methodName !== "withdraw" ||
    tx.actions[0].params.args.amount !== info.position.pendingNear.raw
  )
    throw Error("The SDK returned an unexpected withdrawal request.");
  return { id, amount, block, tx };
}
export async function withdraw(
  review: Awaited<ReturnType<typeof reviewWithdrawal>>,
) {
  const wallet = await walletFor(review.id);
  const current = await reviewWithdrawal(review.id);
  if (current.amount !== review.amount)
    throw Error("The position changed. Inspect it again before signing.");
  return submitRecovery(wallet, current.tx);
}

async function submitRecovery(
  wallet: Awaited<ReturnType<typeof walletFor>>,
  tx: ReturnType<RNearClient["buildWithdrawTransaction"]>,
) {
  const results = await wallet.signAndSendTransactions({ transactions: [tx] });
  const hash = results[0]?.transaction?.hash;
  if (!hash || !isBase58Bytes(hash, 32))
    throw Error(
      "The wallet returned no transaction hash. Check its activity before retrying. You can verify the hash in Receipts.",
    );
  return hash;
}

export async function wrapPreview(id: string, human: string) {
  id = accountId(id);
  const value = BigInt(positiveAmount(human, "NEAR"));
  const [registration, bounds, liquid] = await Promise.all([
    rpc.viewFunction<unknown>(wrapContract, "storage_balance_of", {
      account_id: id,
    }),
    rpc.viewFunction<{ min: string }>(
      wrapContract,
      "storage_balance_bounds",
      {},
    ),
    staking.getNearBalance(id),
  ]);
  const storage = registration ? "0" : bounds.min;
  if (BigInt(liquid.raw) <= value + BigInt(storage))
    throw Error("Leave NEAR for storage and gas, or enter a smaller amount.");
  const actions = registration
    ? []
    : [
        {
          type: "FunctionCall" as const,
          params: {
            methodName: "storage_deposit",
            args: { account_id: id, registration_only: true },
            gas: "30000000000000",
            deposit: storage,
          },
        },
      ];
  actions.push({
    type: "FunctionCall",
    params: {
      methodName: "near_deposit",
      args: {},
      gas: "30000000000000",
      deposit: value.toString(),
    },
  } as (typeof actions)[number]);
  return {
    storage: formatNearAmount(storage),
    amount: human,
    tx: { signerId: id, receiverId: wrapContract, actions },
  };
}
export async function wrap(
  id: string,
  amount: string,
  expectedStorage: string,
) {
  const wallet = await walletFor(id),
    plan = await wrapPreview(id, amount);
  if (plan.storage !== expectedStorage)
    throw Error("Storage requirements changed. Review wrapping again.");
  const outcomes = await wallet.signAndSendTransactions({
    transactions: [plan.tx],
  });
  if (
    !outcomes.length ||
    outcomes.some(
      (o) =>
        !o.status ||
        typeof o.status !== "object" ||
        !("SuccessValue" in o.status),
    )
  )
    throw Error("Wrap was not confirmed. Check your wallet activity.");
  return outcomes.map((o) => o.transaction.hash).join(", ");
}
