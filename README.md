# Vestiquay | A verified exit for rNEAR

If the Rhea frontend goes down, an rNEAR holder still needs to answer three questions. What does the staking contract hold? What can my wallet claim right now? Did the exact NEAR reach it?

Vestiquay gives holders another way to inspect and claim a position on NEAR mainnet. Its recovery agent reads the existing Rhea staking contract, explains the next available action, and lets the owner review it in their wallet. The claim replay reconciles two archival snapshots with the actual wallet transfer. A downloadable client can repeat the same checks from another origin.

[Hosted demo](https://vestiquay.vercel.app) · [Open the replay example](https://vestiquay.vercel.app/desk?tab=Receipt&proof=example) · [Historical withdrawal on NearBlocks](https://nearblocks.io/txns/8SsF3LhEeecCD8JsNaH9a6F8JpwsaFHhnL2ZyXgxregn)

## Judge walkthrough

| Do this                                                                                                                                                                                                              | See this                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open **Position** and select **Try public account**.                                                                                                                                                                 | The app reads `lp.ref-labs.near` on mainnet. The recovery agent reports the account’s current stake and explains whether it can unstake, needs to wait, can claim, or has no position.                                                                                                       |
| Select **Historical withdrawal**, then **Replay claim on NEAR** once the receipt loads.                                                                                                                              | For `lele.near`, pending drops from **80,092.860748877858632866684973 NEAR** at block **208,782,562** to **0 NEAR** at block **208,782,563**. The transfer to the signer equals the difference. Both block links and the transaction are available. This is a public historical transaction. |
| Export the recovery JSON and download **Save client**. Open the HTML from another HTTPS origin or from localhost and import the receipt.                                                                             | The independent client reads the transaction again. Select **Replay claim on NEAR** to obtain the same arithmetic from archival RPC.                                                                                                                                                         |
| On **Route**, leave **NEAR Intents** selected. To preview without connecting a wallet, use `lele.near` as a public sender, enter a valid Solana receive address and enter **1 NEAR**. Select **Request live quote**. | The live preview shows expected and minimum USDC or SOL and the destination fee when supplied. Switch **Receive on Solana** to try the other asset. A connected NEAR account is the sender. A compatible Solana wallet can provide the receive address.                                      |

The walkthrough requires no signature. Use **Copy proof link** on a final recovery receipt to let someone open the transaction on a different device and verify it from NEAR again. For a fresh withdrawal, use your own account with a matured pending position. For a funded swap, review the recipient and quote terms, check the wallet’s signing prompt, then refresh the tracking receipt.

## Run it locally

Use Node.js 22 or 24.

```bash
npm ci
npm run build
npm run typecheck
node scripts/check.mjs
npm run dev
```

Open `http://127.0.0.1:3000`. The preview serves the production export. For the independent-client walkthrough, download the HTML to a separate directory and run `python3 -m http.server 4174 --bind 127.0.0.1` there. Open `http://127.0.0.1:4174/recovery.html`. Public reads still require NEAR RPC. Signing also requires a compatible wallet and supported origin.

## What the code checks

- **Own the next action.** The rule order is eligible NEAR → pending unlock → rNEAR held → empty position. A pending withdrawal takes precedence over a new unstake. Wallet approval is required for spending. Before a claim, the app re-reads eligibility and checks the pinned staking code hash.
- **Reconcile the claim.** The app verifies the final transaction, identifies the withdrawal call’s execution block, reads the prior and resulting contract state, and compares the pending balance decrease with successful native transfers to the signer. Gas refunds are excluded. If the amounts disagree, the app displays the discrepancy.
- **Track delivery independently.** The NEAR source check matches 1Click’s deposit account and the exact native NEAR transfer. The provider supplies the order status. When it returns a Solana signature, Vestiquay checks the finalized transaction for a USDC or native SOL balance increase for the destination wallet and checks it against the 1Click quote minimum.

## Routing and deployment

Vestiquay uses Rhea’s rNEAR SDK, NEAR JSON-RPC, NEAR Connect, the NEAR Intents 1Click API and Solana Wallet Standard. The hosted desk defaults to 1Click. It previews using the public API, then prepares a single native NEAR transfer to the exact-input deposit account returned by 1Click. 1Click handles settlement and uses the connected NEAR account as the refund destination.

The **Rhea route** tab uses Rhea’s public token catalog and its credentialed swap API for USDC. To enable it in production, use a Swap API access token from the [Rhea Boss portal](https://boss.rhea.finance/) as the server-side `RHEA_API_KEY` and redeploy. Select **Rhea route** and request a quote to check that access. The recovery desk reads Rhea’s staking contract through NEAR RPC.

On mobile, a compatible wallet browser can share its Solana address directly. You can also copy the receive address from your Solana wallet and paste it into the desk from Chrome or Safari.

The static Next.js build exports to `out/`. The included Vercel configuration uses the **Other** preset and the repository root. Set Node.js to 22.x or 24.x. The build also creates `out/recovery.html` and the Worker preview.

**Validation** · The archived NEAR replay and 1Click USDC and SOL quotes were checked against live endpoints. The wallet handoff was simulated. A new funded claim and an end-to-end NEAR-to-Solana delivery still require a wallet-funded session.

**Build credits** · Next.js, React and Motion power the UI. Instrument Sans and Instrument Serif notices are in `public/`. AI-assisted development and generated landing artwork were used during the build. The [legacy Ref inspector](public/ref-inspector.html) remains available separately.
