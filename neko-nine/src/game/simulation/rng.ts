export function nextRandom(state: number): [number, number] {
  let value = state | 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const next = value >>> 0 || 0x9e3779b9
  return [next / 0x100000000, next]
}

export function hashSeed(seed: number, salt: number) {
  return ((seed ^ (salt * 0x9e3779b9)) >>> 0) || 1
}
