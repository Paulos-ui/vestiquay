# Vestiquay

Vestiquay is a recovery desk for Rhea liquid staking on NEAR mainnet. If the staking website is unavailable, a holder can look up their rNEAR position, request a delayed unstake, claim eligible NEAR to the same account and verify what the wallet received. Vestiquay builds transactions against the existing staking contract. The holder signs in their NEAR wallet.

## Run locally

Use Node.js 22 or 24.

```bash
npm ci
npm run build
npm run typecheck
node scripts/check.mjs
npm run dev
```

Open [the landing page](http://127.0.0.1:3000/) or [the recovery desk](http://127.0.0.1:3000/desk). The preview serves the production export. Run the build again after editing the source.

## Use the desk

**Position** has an account lookup, onchain balances and a claim status card. Switch between **Assets** and **Withdrawals** to see shares, pending NEAR and what the contract marks eligible. The **Recovery path** shows the steps for inspecting, unstaking, claiming and verifying a position. The line illustrates the workflow.

Use the sun and moon buttons to switch between light and dark. The landing page and hosted desk share the selected theme. The downloaded client has both themes and embeds its styles and fonts.

## Try it as a judge

1. In **Position**, select **Try public account**. The desk reads the current rNEAR balance, pending NEAR and withdrawal eligibility for `lp.ref-labs.near`. You can also enter any public NEAR account.
2. In **Receipts → NEAR recovery**, select **Try a historical withdrawal**. Vestiquay checks an existing mainnet `withdraw_all` transaction for `lele.near` and shows its successful transfer from the staking contract to the signer. It queries NEAR when you click and marks this transaction as historical.
3. Select **Export JSON** and **Save client**. Serve the downloaded `recovery.html` from a different origin, such as a directory served by `python3 -m http.server 4174 --bind 127.0.0.1`. Open [the independent client](http://127.0.0.1:4174/recovery.html), select **Receipts**, and import the JSON. The client queries NEAR again and shows the same payout even when the Vestiquay and Rhea frontend origins are unavailable.
4. To demonstrate a fresh withdrawal, inspect an account you control with matured pending NEAR. Review the exact amount, receiver and method. Sign in a NEAR wallet, then reopen the receipt to check finality and the payout. If the account only holds rNEAR, an unstake must mature before a claim becomes available. The unlock time is an estimate.

[Public historical transaction on NearBlocks](https://nearblocks.io/txns/8SsF3LhEeecCD8JsNaH9a6F8JpwsaFHhnL2ZyXgxregn)

## How it works

| Action | Implementation |
| --- | --- |
| Inspect | Rhea's rNEAR SDK reads shares and the delayed withdrawal record on mainnet. A direct contract read preserves pending state if the SDK cannot estimate its unlock. |
| Unstake or claim | The rNEAR SDK builds a transaction for `lst.rhealab.near`. Before signing, the desk checks the wallet account, re-reads the position and compares the contract code hash with the reviewed snapshot. A claim binds the amount shown in the preview. |
| Verify a recovery | NEAR RPC provides the transaction, execution status and receipts. Vestiquay checks the signer, receiver and method and requires final execution. The payout comes from successful native transfers from the staking contract to the signer, excluding gas refunds. |
| Reopen a receipt | The recovery JSON stores the account and hash. Reopening it rechecks the chain. The desk keeps the last wallet-submitted recovery on the same browser. |
| Route to Solana | The Rhea routing SDK discovers the pair, quotes USDC and prepares NEAR wallet actions. The wallet review shows receiver accounts and additional attached NEAR. The receipt tracks NEAR transaction execution and Rhea-reported order status. |

The downloaded client uses public NEAR RPC, including an archival endpoint for older transactions. Wallet connection and signing require a compatible wallet and a supported HTTPS or localhost origin. Opening the HTML directly supports read-only inspection and verification when the browser permits RPC requests. The code hash check detects changes to the reviewed staking contract snapshot.

## Vercel deployment

Import the repository into Vercel and use the root containing `package.json`. Set the framework preset to **Other** and Node.js to **22.x** or **24.x**. The included `vercel.json` builds the static export in `out` and maps the desk and Rhea API paths. A Worker bundle is also generated at `dist/server/index.js` for the local preview and Worker-compatible hosting.

Public lookups, recovery signing and recovery receipts require no server API key. For authenticated routing, request a credential from [Rhea Boss](https://boss.rhea.finance/), set `RHEA_API_KEY` as a server-side Vercel environment variable and redeploy. For local preview, launch `npm run dev` with the same variable exported in the terminal. Check **Route** after deployment. The desk shows when routing credentials are missing, and Rhea still has to accept the credential when you request a quote.

If the live catalog offers wNEAR, the sending wallet needs the wrapped balance. Wrap separately after reviewing the storage deposit. Review the Solana recipient, expected and minimum USDC, expiry and prepared NEAR actions before signing. For an interrupted swap, use the saved source hashes and any available Rhea tracking ID before sending again.

## Validation

The public mainnet position, historical withdrawal payout and JSON export/import can be checked without a wallet. The historical payout is an existing onchain transaction. A new funded claim, a new signed withdrawal from the independent origin, and an authenticated NEAR-to-Solana delivery need a funded account and, for the route, a working Rhea credential.

The earlier [Ref exchange inspector](public/ref-inspector.html) remains accessible from the site footer. Instrument Sans and Instrument Serif license notices are included in `public/`.
