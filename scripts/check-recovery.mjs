import assert from "node:assert/strict";
import { build } from "esbuild";

const { outputFiles } = await build({
  stdin: {
    contents: `
      export { assessExit, replayWithdrawal } from "./lib/exit-plan";
      export { publicRecovery, recoveryReceipt, verifyNearSource } from "./lib/receipts";
      export { prepareIntents, quoteIntents, refreshIntentReceipt } from "./lib/intents";
      export { validateReceipt } from "./lib/routes";
      export { solanaDestinations } from "./lib/route-assets";
      export { verifySolanaDelivery } from "./lib/solana";
    `,
    resolveDir: process.cwd(),
  },
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});

const app = await import(
  "data:text/javascript;base64," +
    Buffer.from(outputFiles[0].text).toString("base64")
);
const position = {
  shares: { raw: "1", amount: "0.000000000000000000000001" },
  position: {
    pendingNear: { raw: "10", amount: "0.00000000000000000000001" },
    canWithdraw: true,
    unstakeAvailableEpochHeight: 15,
  },
};
assert.equal(app.assessExit(position).action, "claim");
position.position.canWithdraw = false;
assert.deepEqual(app.assessExit(position), { action: "wait", epoch: 15 });
position.position.pendingNear.raw = "0";
assert.equal(app.assessExit(position).action, "unstake");
position.shares.raw = "0";
assert.equal(app.assessExit(position).action, "none");

const beforeBlock = "A1C2Fb9thHAM2SjpJqJBDWdyw39EtT3f2XLmLjMtYNx9";
const claimBlock = "23cM36Ywo3XKwBGKdcCkPjFfc1r1gT8j3vfDWYu2g9qg";
const solanaAddress = "DxuTPWkkJNAkprvsXzkZPECQ6VJ62LbdkWeE1949Ny48";
const solanaSignature =
  "5moGTv9Douu5BQbZzEtKrZVB8jchAM3JdYF1fL8NVznm6tu8XHipyDbPS7W7Kgs1QM17Rt53V9RQgYHrz19fCX24";
const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const deposit = "a".repeat(64);
const oneNear = "1000000000000000000000000";
const record = app.recoveryReceipt(
  app.publicRecovery.account,
  app.publicRecovery.hash,
);
const evidence = {
  execution: "confirmed",
  payout: "5",
  claimBlockHash: claimBlock,
};
const balance = {
  accountIndex: 1,
  mint: usdc,
  owner: solanaAddress,
  uiTokenAmount: { amount: "5000000", decimals: 6 },
};
const fetchBeforeTest = globalThis.fetch;
let changedRefund = false;
let wrongBlock = false;
let memoRequired = false;
let transferred = oneNear;
let savedQuote;

function archiveResponse(payload) {
  if (payload.method === "block") {
    assert.equal(payload.params.block_id, claimBlock);
    return { header: { hash: claimBlock, prev_hash: beforeBlock } };
  }
  assert.equal(payload.params.account_id, "lst.rhealab.near");
  assert.deepEqual(JSON.parse(atob(payload.params.args_base64)), {
    account_id: record.account,
  });
  assert.ok([beforeBlock, claimBlock].includes(payload.params.block_id));
  const before = payload.params.block_id === beforeBlock;
  const result = JSON.stringify({
    account_id: record.account,
    can_withdraw: before,
    unstaked_balance: before ? "5000000000000000000000000" : "0",
  });
  return {
    block_hash: before && !wrongBlock ? beforeBlock : claimBlock,
    block_height: before ? 208782562 : 208782563,
    result: [...Buffer.from(result)],
  };
}

try {
  globalThis.fetch = async (url, init) => {
    if (url.includes("/v0/status?")) {
      assert.match(url, new RegExp(deposit + "$"));
      return Response.json({
        status: "PENDING_DEPOSIT",
        quoteResponse: savedQuote,
      });
    }
    const request = JSON.parse(init.body);
    if (request.method === "tx") {
      return Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          final_execution_status: "FINAL",
          status: { SuccessValue: "" },
          transaction: {
            hash: record.hash,
            signer_id: record.account,
            receiver_id: deposit,
            actions: [{ Transfer: { deposit: transferred } }],
          },
        },
      });
    }
    if (url.includes("fastnear.com")) {
      return Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: archiveResponse(request),
      });
    }
    if (url.includes("chaindefuser.com")) {
      assert.equal(request.recipient, solanaAddress);
      assert.equal(request.refundTo, record.account);
      assert.equal(request.amount, oneNear);
      const isSol =
        request.destinationAsset === app.solanaDestinations.SOL.assetId;
      const quoteResponse = {
        quoteRequest: {
          ...request,
          refundTo: changedRefund ? "another.near" : request.refundTo,
        },
        quote: {
          amountIn: request.amount,
          amountOut: isSol ? "44000000" : "3000000",
          minAmountOut: isSol ? "43900001" : "2900000",
          depositAddress: request.dry ? undefined : deposit,
          depositMemo: memoRequired ? "test" : undefined,
        },
      };
      if (!request.dry) savedQuote = quoteResponse;
      return Response.json(quoteResponse);
    }
    assert.equal(request.method, "getTransaction");
    assert.equal(request.params[1].commitment, "finalized");
    return Response.json({
      result: {
        slot: 469127705,
        transaction: {
          signatures: [solanaSignature],
          message: { accountKeys: [{ pubkey: solanaAddress, signer: false }] },
        },
        meta: {
          err: null,
          preBalances: [1_000_000],
          postBalances: [51_000_000],
          preTokenBalances: [],
          postTokenBalances: [balance],
        },
      },
    });
  };

  const replay = await app.replayWithdrawal(record, evidence);
  assert.equal(replay.reconciled, true);
  assert.equal(
    (await app.replayWithdrawal(record, { ...evidence, payout: "6" }))
      .reconciled,
    false,
  );
  wrongBlock = true;
  await assert.rejects(
    app.replayWithdrawal(record, evidence),
    /different block/,
  );

  const quote = await app.quoteIntents(record.account, solanaAddress, "1");
  assert.equal(quote.minimum, "2900000");
  assert.equal((await app.prepareIntents(quote)).deposit, deposit);
  memoRequired = true;
  await assert.rejects(app.prepareIntents(quote), /unexpected deposit/);
  changedRefund = true;
  await assert.rejects(
    app.quoteIntents(record.account, solanaAddress, "1"),
    /different quote terms/,
  );
  changedRefund = false;
  memoRequired = false;
  const sol = await app.quoteIntents(record.account, solanaAddress, "1", "SOL");
  assert.equal((await app.prepareIntents(sol)).minimum, "43900001");
  const solReceipt = app.validateReceipt({
    provider: "intents",
    asset: "NEAR",
    output: "SOL",
    depositAddress: deposit,
    sender: record.account,
    recipient: solanaAddress,
    input: "1",
    minimum: "0.043900001",
    status: "wallet approval requested",
    created: Date.now(),
    txHashes: [],
  });
  assert.equal(
    (await app.refreshIntentReceipt(solReceipt)).status,
    "awaiting deposit",
  );
  await assert.rejects(
    app.refreshIntentReceipt({ ...solReceipt, output: "USDC" }),
    /does not match/,
  );
  const legacy = {
    ...solReceipt,
    provider: undefined,
    output: undefined,
    depositAddress: undefined,
  };
  assert.equal(app.validateReceipt(legacy).output, undefined);
  assert.throws(
    () => app.validateReceipt({ ...legacy, output: "SOL" }),
    /valid Vestiquay route receipt/,
  );

  const expectedDeposit = { receiver: deposit, amount: oneNear };
  assert.equal(
    await app.verifyNearSource(record.account, record.hash, expectedDeposit),
    "confirmed",
  );
  transferred = "1000000000000000000000001";
  await assert.rejects(
    app.verifyNearSource(record.account, record.hash, expectedDeposit),
    /quoted deposit/,
  );

  assert.equal(
    (await app.verifySolanaDelivery(solanaSignature, solanaAddress)).amount,
    "5000000",
  );
  await assert.rejects(
    app.verifySolanaDelivery(
      solanaSignature,
      "11111111111111111111111111111111",
    ),
    /positive USDC balance change/,
  );
  assert.equal(
    (
      await app.verifySolanaDelivery(
        solanaSignature,
        solanaAddress,
        "SOL",
        "44000000",
      )
    ).amount,
    "50000000",
  );
  await assert.rejects(
    app.verifySolanaDelivery(solanaSignature, solanaAddress, "SOL", "50000001"),
    /quote’s minimum/,
  );
} finally {
  globalThis.fetch = fetchBeforeTest;
}

console.log(
  "Recovery, quote binding, exact native NEAR deposits and Solana recipient checks passed.",
);
