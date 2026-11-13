export const stakingContract = "lst.rhealab.near";
export const publicRecovery = {
  account: "lele.near",
  hash: "8SsF3LhEeecCD8JsNaH9a6F8JpwsaFHhnL2ZyXgxregn",
};

export function nearExplorer(hash: string) {
  return "https://nearblocks.io/txns/" + encodeURIComponent(hash);
}
