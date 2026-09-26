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
    const baseRolls: number[] = []
    for (let i = 0; i < 6; i += 1) {
      let value: number
      ;[value, rng] = nextRandom(rng)
      baseRolls.push(3 + Math.floor(value * 4))
    }
    const base: Stats = {
      contact: baseRolls[0], power: baseRolls[1], speed: baseRolls[2], defense: baseRolls[3],
      focus: baseRolls[4], pitching: position === 'P' ? baseRolls[5] : 1
    }
    for (const [key, value] of Object.entries(POSITION_BONUS[position])) {
      base[key as keyof Stats] = cap(base[key as keyof Stats] + (value ?? 0))
    }
    const breed = BREEDS[breedIndex]
    return {
      id: `${position}-${round}-${candidateIndex}-${breedIndex}`,
      name: NAMES[breedIndex][candidateIndex], breed: breed[0], breedIndex, position,
      personality: breed[1], trait: { name: breed[2], description: breed[3] }, stats: base, condition: 100
    }
  })
}

export const STAT_LABELS: Record<keyof Stats, string> = {
  contact: '打撃', power: '長打', speed: '走力', defense: '守備', focus: '集中', pitching: '投球'
}
