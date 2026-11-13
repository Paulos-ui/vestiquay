# Vestiquay
Vestiquay is a NEAR recovery desk for Rhea liquid-staking positions. The field guide follows one position from the staking contract to the destination wallet. The chart is explanatory, and all balances in the desk come from SDK calls.
## Run and deploy
Use Node 22 or newer. Run `npm ci`, `npm run build`, then `npm run dev`. Open http://127.0.0.1:3000. Run `npm run typecheck` and `node scripts/check.mjs` to verify the build and proxy boundary. The deployment includes a Next.js static export and a small Worker that serves assets and calls Rhea. For Vercel use the repository's vercel.json and API handler. Set RHEA_API_KEY as a server-side secret issued by Rhea Boss. Public reads work without this key.
## Operator guide
1. Use Position to inspect a mainnet account without a wallet. The SDK returns rNEAR shares, pending NEAR and withdrawal eligibility. Pre-stage any demonstration unstake on the protocol in advance. A timer is never sufficient evidence of eligibility.
2. For a mature position, review the amount, staking contract and method. The client compares the deployed code hash with the pinned mainnet snapshot, and checks eligibility again before requesting a NEAR Connect signature. The pinned hash is a change detector, not an audit.
3. Download the independent client before a drill. Serve the HTML on an independent HTTPS origin or localhost for wallet compatibility. Block the original staking website and Vestiquay host, open the saved HTML and perform the same lookup. Network access to RPC and the wallet is still required. The standalone client can withdraw without the hosted proxy. A live cross-chain quote generally requires Rhea's authenticated service.
4. In Route, enter the sender and Solana recipient. Rhea's live catalog determines input eligibility. The verified catalog returned wNEAR, so wrap separately if needed. Review the amount, token and storage deposit for the wrap. Request a quote and inspect the minimum USDC received. Wallet approval is separate for the swap.
5. Submitted routes are saved on this browser. Export a JSON receipt before changing devices. Import and refresh it to check Rhea's reported order status. A source hash alone does not prove destination delivery. If submission or reporting was interrupted, inspect wallet activity before retrying. Do not share exported receipts unless you intend to disclose their account identifiers.
## Validation state
The rNEAR mainnet SDK lookup and discovery of the wNEAR/Solana USDC pair were exercised. The upstream quote endpoint requires an authorized Bearer credential. A funded signature, final cross-chain receipt and independent outage withdrawal remain unverified until a holder participates. Earlier Ref exchange inspection and the clearly labeled simulation are available from the footer.
## Design
White ledger surfaces, green actions and gold contour lines connect the landing page to the recovery desk. The interactive manifest links directly to the three operations. Its metallic highlight responds to hover and keyboard focus, with a reduced-motion fallback. The harbor chart is drawn from deterministic shoreline contours. Scroll progress moves its interface overlay and traces the route. The live desk has no scroll-dependent financial state. On small screens the guide uses normal vertical flow. Reduced-motion preferences disable the scrubbed chart.

### Site navigation
The landing page at `/` introduces rNEAR recovery, illustrates the cross-chain route, and includes a field guide. The inspector opens `/desk` with the public account selected. The desk supports direct Position, Route, and Receipt links through the `tab` query parameter. The harbor mark is available at `/vestiquay-mark.svg`.

Connect a NEAR wallet in the desk header to inspect its selected account. Public lookups work separately. Refresh a position to read its shares and withdrawal state again. The observation time records when both SDK reads completed. Expand the source record to see the full token precision and staking contract.

## Adapting the Rhea Finance SDKs
Vestiquay uses `@rhea-finance/rnear-sdk` for public balance and eligibility reads and for building delayed unstake and withdrawal transactions. Inspect a holder, expand **Request a delayed unstake**, enter rNEAR shares, and preview the NEAR amount and receiving contract. Only a matching wallet can sign. The client rechecks the balance, contract hash, conversion and pending amount before submission. Once confirmed, retain the explorer transaction and return after the unlock to claim.

The route desk uses `@rhea-finance/cross-chain-aggregation-dex` for token discovery, quotes, transfer preparation and order tracking. The hosted proxy requires a server-side Rhea API key for authenticated operations. The source transaction and destination receipt are separate evidence.

## Deploy from Windows PowerShell

Install Node.js 22 LTS with npm. Extract the ZIP, open PowerShell in the folder containing package.json and run:

    npm ci
    npm run build
    npm run typecheck
    node scripts/check.mjs
    npm run dev

Visit http://localhost:3000 and open the desk. For authenticated local quotes, set the RHEA_API_KEY environment variable in the same terminal before starting the server. Press Ctrl+C to stop it.

    npx vercel@latest login
    npx vercel@latest link

Choose your Vercel account and the intended project (create vestiquay for a first deployment). Use ./ for the project root. Use Other for the framework preset. vercel.json configures the build, static output and API routing.

If Rhea has issued your API credential, add it at the hidden prompt before deploying:

    npx vercel@latest env add RHEA_API_KEY production
    npx vercel@latest --prod

Without a key, run the deployment command on its own. Set the key later and redeploy to enable authenticated operations. Keep the key server-side. Check the production URL, /desk and /recovery.html. Refresh /desk directly and try a public account lookup before connecting a wallet.
