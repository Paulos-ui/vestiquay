export const solanaDestinations = {
  USDC: {
    symbol: "USDC",
    decimals: 6,
    assetId: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  SOL: {
    symbol: "SOL",
    decimals: 9,
    assetId: "nep141:sol.omft.near",
    mint: null,
  },
} as const;

export type SolanaDestination = keyof typeof solanaDestinations;
