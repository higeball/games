export const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const
export type Position = (typeof POSITIONS)[number]

export type Stats = {
  contact: number
  power: number
  speed: number
  defense: number
  focus: number
  pitching: number
}

export type CatPlayer = {
  id: string
  name: string
  breed: string
  breedIndex: number
  position: Position
  personality: string
  trait: { name: string; description: string }
  stats: Stats
  condition: number
  isSpecial?: boolean
  specialTitle?: string
  conditionRank?: '絶好調' | '好調' | '普通' | '不調'
}

export type Opponent = {
  id: string
  name: string
  color: number
  strength: number
  tendency: string
  scouting: string
}

export type TacticId = 'contact' | 'power' | 'patience' | 'bunt' | 'attack' | 'careful' | 'grounder' | 'strikeout'

export type TacticOption = {
  id: TacticId
  label: string
  description: string
  hint: '有利' | '五分' | '危険'
  tacticEffect?: string
}

export type DecisionContext = {
  side: 'offense' | 'defense'
  title: string
  situation: string
  recommended: TacticId
  options: TacticOption[]
  activeCatName?: string
  activeCatTrait?: string
}

export type MatchState = {
  opponent: Opponent
  inning: number
  half: 'top' | 'bottom'
  outs: number
  balls: number
  strikes: number
  bases: [boolean, boolean, boolean]
  ourScore: number
  theirScore: number
  inningScores: { our: number[]; their: number[] }
  hits: { our: number; their: number }
  plateAppearances: number
  decisionCount: number
  nextDecisionAt: number
  rngState: number
  pending: DecisionContext | null
  commentary: string[]
  lastPlay: string
  lastOutcome?: 'homer' | 'double' | 'single' | 'walk' | 'out' | 'strikeout' | 'doubleplay'
  lastOutcomeText?: string
  finished: boolean
  won: boolean | null
}

export type Phase = 'title' | 'draft' | 'training' | 'match' | 'seasonEnd'

export type RunState = {
  schemaVersion: 1
  seed: number
  phase: Phase
  roster: CatPlayer[]
  draftRound: number
  trainingActions: number
  trainingLimit: number
  gameIndex: number
  wins: number
  losses: number
  morale: number
  match: MatchState | null
  champion: boolean
}

export type MetaProgress = {
  seasons: number
  championships: number
  discoveredCats: string[]
}

export type SaveData = {
  schemaVersion: 1
  activeRun: RunState | null
  meta: MetaProgress
  muted: boolean
}
