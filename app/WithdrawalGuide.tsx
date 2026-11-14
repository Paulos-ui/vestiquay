const questions = [
  [
    "What happens if the Rhea website goes down?",
    "Your staking position lives on NEAR. The recovery desk reads the contract directly. A downloaded client can do the same from another origin as long as NEAR RPC is reachable.",
  ],
  [
    "Do I need a wallet just to look up an account?",
    "No. Public balances, withdrawal status and historical transaction verification work without wallet access. You connect a compatible NEAR wallet to authorize an unstake, claim or transfer.",
  ],
  [
    "Why can’t I claim my rNEAR immediately?",
    "rNEAR represents staking shares. A delayed unstake puts NEAR in a pending withdrawal. The contract determines when the pending balance becomes eligible. Any time displayed in the desk is an estimate.",
  ],
  [
    "What does the receipt prove?",
    "The desk checks the signer, staking contract and final execution. It shows an exact NEAR payout when a matching successful transfer receipt is available.",
  ],
  [
    "Can I send recovered funds to Solana?",
    "The hosted desk can quote Solana USDC or native SOL through NEAR Intents. Review the destination and the minimum output, then approve the native NEAR deposit in your wallet. You can also keep the payout in your NEAR wallet.",
  ],
];

export default function WithdrawalGuide() {
  return (
    <div className="faqList">
      {questions.map(([question, answer]) => (
        <details key={question}>
          <summary>
            {question}
            <span aria-hidden="true">+</span>
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
