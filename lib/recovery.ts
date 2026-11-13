import {
  RNearClient,
  NearRpcProvider,
  parseNearAmount,
  formatNearAmount,
} from "@rhea-finance/rnear-sdk";
import { NearConnector } from "@hot-labs/near-connect";
export const stakingContract = "lst.rhealab.near";
const pinnedHash = "EPLT4C61pkVYf5Km6dC4X9x5PMo6rfBwuEwo7vgKpmuv";
export const rpc = new NearRpcProvider(
  ["https://rpc.mainnet.near.org", "https://free.rpc.fastnear.com"],
  12000,
);
export const staking = new RNearClient({ network: "mainnet" });
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
    staking.getAccountDetails(id).then((value) => {
      onRead?.("withdrawal");
      return value;
    }),
    staking.getRNearBalance(id).then((value) => {
      onRead?.("shares");
      return value;
    }),
  ]);
  return { id, position, shares, observedAt: Date.now() };
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
  if (
    !/^\d+(?:\.\d{1,24})?$/.test(shares) ||
    BigInt(parseNearAmount(shares)) <= 0n
  )
    throw Error("Enter a positive rNEAR amount with up to 24 decimal places.");
  const [info, block] = await Promise.all([
    inspect(id),
    checkedContractBlock(),
  ]);
  if (BigInt(parseNearAmount(shares)) > BigInt(info.shares.raw))
    throw Error("The request exceeds the rNEAR balance.");
  const tx = await staking.buildUnstakeTransaction({
    accountId: id,
    rNearAmount: shares,
  });
  const action = tx.actions[0];
  const raw = action.params.args.amount;
  if (
    tx.receiverId !== stakingContract ||
    action.params.methodName !== "unstake" ||
    typeof raw !== "string" ||
    BigInt(raw) <= 0n
  )
    throw Error("The SDK returned an unexpected unstake request.");
  return {
    id,
    shares,
    nearAmount: formatNearAmount(raw),
    pending: info.position.pendingNear.raw,
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
    fresh.pending !== review.pending
  )
    throw Error(
      "The conversion or pending balance changed. Review the request again.",
    );
  const results = await wallet.signAndSendTransactions({
    transactions: [fresh.tx],
  });
  if (
    !results.length ||
    results.some(
      (r) => typeof r.status !== "object" || !("SuccessValue" in r.status),
    )
  )
    throw Error(
      "Unstake was not confirmed. Check wallet activity before retrying.",
    );
  return results.map((r) => r.transaction.hash);
}
export async function reviewWithdrawal(id: string) {
  const [info, block] = await Promise.all([
    inspect(id),
    checkedContractBlock(),
  ]);
  if (
    !info.position.canWithdraw ||
    BigInt(info.position.pendingNear.raw) === 0n
  )
    throw Error("There is no eligible delayed withdrawal for this account.");
  return {
    amount: info.position.pendingNear.amount,
    block,
    tx: staking.buildWithdrawTransaction({ accountId: id }),
  };
}
export async function withdraw(id: string, expected: string) {
  const wallet = await walletFor(id),
    current = await reviewWithdrawal(id);
  if (current.amount !== expected)
    throw Error("The position changed. Inspect it again before signing.");
  const results = await wallet.signAndSendTransactions({
    transactions: [current.tx],
  });
  if (!results.length)
    throw Error(
      "No wallet outcome returned. Inspect activity before retrying.",
    );
  for (const result of results) {
    if (typeof result.status !== "object" || !("SuccessValue" in result.status))
      throw Error(
        "Withdrawal was not confirmed. Inspect wallet activity before retrying.",
      );
  }
  return results.map((r) => r.transaction.hash);
}
export async function wrapPreview(id: string, human: string) {
  const { parseNearAmount, formatNearAmount } =
    await import("@rhea-finance/rnear-sdk");
  const value = BigInt(parseNearAmount(human));
  if (value <= 0n) throw Error("Enter a positive amount to wrap.");
  const [registration, bounds, liquid] = await Promise.all([
    rpc.viewFunction<unknown>("wrap.near", "storage_balance_of", {
      account_id: id,
    }),
    rpc.viewFunction<{ min: string }>(
      "wrap.near",
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
    tx: { signerId: id, receiverId: "wrap.near", actions },
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
      (o) => typeof o.status !== "object" || !("SuccessValue" in o.status),
    )
  )
    throw Error("Wrap was not confirmed. Check your wallet activity.");
  return outcomes.map((o) => o.transaction.hash).join(", ");
}
