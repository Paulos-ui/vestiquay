import { themeBootstrap } from "../lib/theme.mjs";
import "./fonts.css";
import "./style.css";
import "./harbor.css";
import "./desk.css";

export const metadata = {
  icons: { icon: "/vestiquay-mark.svg" },
  title: {
    default: "Vestiquay | NEAR recovery desk",
    template: "%s | Vestiquay",
  },
  description:
    "Recover your Rhea staking position and verify the payout directly on NEAR.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
