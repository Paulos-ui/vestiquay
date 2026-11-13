import "./fonts.css";
import "./style.css";
import "./harbor.css";
export const metadata = {
  icons: {icon:"/vestiquay-mark.svg"},
  title: "Vestiquay — NEAR exit atlas",
  description:
    "Inspect your Rhea position, claim unlocked NEAR, and follow a cross-chain exit.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
