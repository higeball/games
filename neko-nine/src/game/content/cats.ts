import { POSITIONS, type CatPlayer, type Position, type Stats } from '../types'
import { hashSeed, nextRandom } from '../simulation/rng'

const BREEDS = [
  ['三毛猫', 'ムードメーカー', '福まねき', '接戦で集中が上がる'],
  ['黒猫', 'クール', '夜目', '終盤の守備に強い'],
  ['茶トラ', '元気', '全力スイング', '長打狙いと好相性'],
  ['ペルシャ', 'マイペース', '威風堂々', 'プレッシャーに強い'],
  ['スコティッシュ', '慎重', 'やわらかキャッチ', '守備のミスを減らす'],
  ['シャム', '頭脳派', '読み勝ち', '待球策と好相性'],
  ['ベンガル', '野性派', '電光石火', '走者がいると打撃上昇'],
  ['ロシアンブルー', '職人気質', '精密制御', '投球とミートが安定'],
  ['ハチワレ', '陽気', 'ねばり腰', '二死から集中が上がる']
] as const

const NAMES = [
  ['ミケマル', 'こはく', 'あんみつ'], ['クロスケ', 'ノワール', 'すみ'], ['チャチャ', 'きなこ', 'トラオ'],
  ['モフ', 'しらたま', 'マロン'], ['ふく', 'まるみ', 'おもち'], ['ルナ', 'サファ', 'ミント'],
  ['レオ', 'ヒョウタ', 'ソラ'], ['ギン', 'アオ', 'レイン'], ['ハチ', 'タビ', 'ゴマ']
]

const POSITION_BONUS: Record<Position, Partial<Stats>> = {
  P: { pitching: 3, focus: 1 }, C: { defense: 2, focus: 2 }, '1B': { power: 2 },
  '2B': { defense: 1, speed: 1 }, '3B': { power: 1, defense: 1 }, SS: { defense: 2, speed: 1 },
  LF: { contact: 1, power: 1 }, CF: { speed: 2, defense: 1 }, RF: { power: 1, defense: 1 }
}

function cap(value: number) { return Math.max(1, Math.min(9, value)) }

export function draftCandidates(seed: number, round: number): CatPlayer[] {
  const position = POSITIONS[round]
  let rng = hashSeed(seed, round + 1)
  const used = new Set<number>()
  return Array.from({ length: 3 }, (_, candidateIndex) => {
    let roll: number
    do {
      [roll, rng] = nextRandom(rng)
    } while (used.has(Math.floor(roll * BREEDS.length)))
    const breedIndex = Math.floor(roll * BREEDS.length)
    used.add(breedIndex)

    let specialRoll: number
    ;[specialRoll, rng] = nextRandom(rng)
    const isSpecial = specialRoll < 0.05 // 約5%の確率でスペシャル選手！

    const baseRolls: number[] = []
    for (let i = 0; i < 6; i += 1) {
      let value: number
      ;[value, rng] = nextRandom(rng)
      if (isSpecial) {
        // スペシャル選手は基本値が 7〜9 と超強力！
        baseRolls.push(7 + Math.floor(value * 3))
      } else {
        baseRolls.push(3 + Math.floor(value * 4))
      }
    }
    const base: Stats = {
      contact: cap(baseRolls[0]), power: cap(baseRolls[1]), speed: cap(baseRolls[2]), defense: cap(baseRolls[3]),
      focus: cap(baseRolls[4]), pitching: position === 'P' ? cap(baseRolls[5]) : (isSpecial ? 6 : 1)
    }
    for (const [key, value] of Object.entries(POSITION_BONUS[position])) {
      base[key as keyof Stats] = cap(base[key as keyof Stats] + (isSpecial ? (value ?? 0) + 2 : (value ?? 0)))
    }
    const breed = BREEDS[breedIndex]
    const specialTitles = position === 'P'
      ? ['★黄金の守護神★', '★伝説の剛腕★', '★魔球使い★']
      : ['★天才スラッガー★', '★超新星ドラ1★', '★神速の韋駄天★']
    const specialTitle = specialTitles[candidateIndex % specialTitles.length]

    return {
      id: `${position}-${round}-${candidateIndex}-${breedIndex}`,
      name: NAMES[breedIndex][candidateIndex],
      breed: breed[0],
      breedIndex,
      position,
      personality: isSpecial ? `超逸材（${breed[1]}）` : breed[1],
      trait: isSpecial
        ? { name: `★${breed[2]}・極★`, description: `【スペシャル能力】${breed[3]}、さらに全局面で驚異的な集中力を発揮！` }
        : { name: breed[2], description: breed[3] },
      stats: base,
      condition: isSpecial ? 100 : 75 + Math.floor(specialRoll * 500) % 26,
      isSpecial,
      specialTitle: isSpecial ? specialTitle : undefined,
      conditionRank: isSpecial ? '絶好調' : '好調'
    }
  })
}

export const STAT_LABELS: Record<keyof Stats, string> = {
  contact: '打撃', power: '長打', speed: '走力', defense: '守備', focus: '集中', pitching: '投球'
}
