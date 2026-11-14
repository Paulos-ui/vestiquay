import { useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import {
  StandardConnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardEventsFeature,
} from "@wallet-standard/features";
import { isBase58Bytes } from "../lib/addresses";

type Wallet = ReturnType<ReturnType<typeof getWallets>["get"]>[number];
type Selection = { wallet: Wallet; address: string };

function solanaWallet(wallet: Wallet) {
  return (
    wallet.chains.includes("solana:mainnet") &&
    StandardConnect in wallet.features
  );
}

export default function SolanaRecipient({
  recipient,
  asset,
  busy,
  onChange,
  run,
}: {
  recipient: string;
  asset: string;
  busy: boolean;
  onChange: (address: string) => void;
  run: (work: () => Promise<void>) => void;
}) {
  const [wallets, setWallets] = useState<readonly Wallet[]>([]);
  const [selection, setSelection] = useState<Selection>();
  const [phantomLink, setPhantomLink] = useState("");
  useEffect(() => {
    const registry = getWallets();
    const sync = () => setWallets(registry.get().filter(solanaWallet));
    const offRegister = registry.on("register", sync);
    const offUnregister = registry.on("unregister", sync);
    sync();
    if (
      /Android|iPhone|iPad/i.test(navigator.userAgent) &&
      location.protocol === "https:"
    ) {
      const target = location.origin + "/desk?tab=Route";
      setPhantomLink(
        "https://phantom.com/ul/browse/" +
          encodeURIComponent(target) +
          "?ref=" +
          encodeURIComponent(location.origin),
      );
    }
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  useEffect(() => {
    if (!selection) return;
    const feature = (
      selection.wallet.features as Partial<StandardEventsFeature>
    )[StandardEvents];
    return feature?.on("change", ({ accounts }) => {
      if (
        accounts &&
        !accounts.some(
          (a) =>
            a.address === selection.address &&
            a.chains.includes("solana:mainnet"),
        )
      ) {
        setSelection(undefined);
        onChange("");
      }
    });
  }, [selection, onChange]);

  async function choose(wallet: Wallet) {
    const connector = (wallet.features as StandardConnectFeature)[
      StandardConnect
    ];
    const { accounts } = await connector.connect();
    const account = accounts.find(
      (a) =>
        a.chains.includes("solana:mainnet") && isBase58Bytes(a.address, 32),
    );
    if (!account)
      throw Error("The wallet did not return a Solana mainnet address.");
    setSelection({ wallet, address: account.address });
    onChange(account.address);
  }

  return (
    <div className="recipientWallet">
      <label>
        Solana destination
        <input
          value={recipient}
          disabled={busy}
          maxLength={44}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Connect a wallet or paste an address"
          onChange={(event) => {
            setSelection(undefined);
            onChange(event.target.value.trim());
          }}
        />
      </label>
      {selection && <p>Destination selected from {selection.wallet.name}.</p>}
      <div className="deskActions">
        {wallets.map((wallet, index) => (
          <button
            type="button"
            className="minor"
            disabled={busy}
            key={wallet.name + index}
            onClick={() => run(() => choose(wallet))}
          >
            Use {wallet.name}
          </button>
        ))}
        {phantomLink &&
          !wallets.some((wallet) => wallet.name === "Phantom") && (
            <a className="button secondary" href={phantomLink}>
              Open in Phantom ↗
            </a>
          )}
      </div>
      <p>
        Use the Solana wallet’s receive address for {asset}. The NEAR wallet
        signs the source transaction.
      </p>
    </div>
  );
}
