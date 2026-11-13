const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isBase58Bytes(value: string, size: number) {
  if (!value || value.length > Math.ceil(size * 1.37)) return false;

  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit === -1) return false;
    number = number * 58n + BigInt(digit);
  }
  const leadingZeroes = value.match(/^1*/)?.[0].length ?? 0;
  const payloadBytes =
    number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
  return leadingZeroes + payloadBytes === size;
}
