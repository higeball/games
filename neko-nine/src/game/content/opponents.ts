import type { Opponent } from '../types'

export const OPPONENTS: Opponent[] = [
  { id: 'sparrows', name: 'スズメ球団', color: 0xd9a441, strength: 4.4, tendency: '待球型', scouting: 'じっくり球を見て四球を狙う。攻めの投球が有効。' },
  { id: 'tanuki', name: 'タヌキスターズ', color: 0x8d5b3c, strength: 4.8, tendency: '長打型', scouting: '強振が多い。慎重な配球で空振りを誘おう。' },
  { id: 'kitsune', name: 'キツネスピリッツ', color: 0xd46b3f, strength: 5.2, tendency: '俊足型', scouting: '足を絡めてくる。ゴロを打たせて進塁を防ごう。' },
  { id: 'lion', name: 'ライオンキングス', color: 0xb94836, strength: 5.8, tendency: '王者型', scouting: '穴の少ない王者。状況に合った采配だけが勝機を作る。' }
]
