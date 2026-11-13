import Desk from "../Desk";

export const metadata = { title: "Recovery desk" };

export default function RecoveryDesk() {
  return (
    <main className="workspace">
      <Desk hosted />
    </main>
  );
}
