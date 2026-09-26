import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { draftCandidates, STAT_LABELS } from './game/content/cats'
import { OPPONENTS } from './game/content/opponents'
import { clearActiveRun, EMPTY_META, loadSave, saveGame } from './game/save'
import { createMatch, resolveDecision, simulateToNextDecision } from './game/simulation/match'
import type { CatPlayer, MatchState, MetaProgress, RunState, Stats, TacticId } from './game/types'
import { POSITIONS } from './game/types'
import type { StadiumUpdate } from './phaser/GameScene'
import { CatPortrait, YasuPortrait } from './ui/Sprites'
import { activateUpdate, registerPwa } from './pwa'

const Stadium = lazy(() => import('./phaser/Stadium').then(module => ({ default: module.Stadium })))

const POSITION_NAMES = { P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手', SS: '遊撃手', LF: '左翼手', CF: '中堅手', RF: '右翼手' }
const TRAINING: Array<{ key: keyof Stats | 'rest' | 'meeting'; label: string; icon: string }> = [
  { key: 'contact', label: '打撃練習', icon: '⚾' }, { key: 'power', label: '筋力練習', icon: '💪' },
  { key: 'speed', label: '走塁練習', icon: '💨' }, { key: 'defense', label: '守備練習', icon: '🧤' },
  { key: 'pitching', label: '投球練習', icon: '🎯' }, { key: 'rest', label: 'ひなたぼっこ', icon: '☀' },
  { key: 'meeting', label: '作戦会議', icon: '💬' }
]

function makeRun(): RunState {
  return {
    schemaVersion: 1, seed: Date.now() >>> 0, phase: 'draft', roster: [], draftRound: 0,
    trainingActions: 0, trainingLimit: 3, gameIndex: 0, wins: 0, losses: 0,
    morale: 50, match: null, champion: false
  }
}

function App() {
  const initial = useMemo(loadSave, [])
  const [run, setRun] = useState<RunState | null>(initial.activeRun)
  const [resumeAvailable, setResumeAvailable] = useState(Boolean(initial.activeRun))
  const [meta, setMeta] = useState<MetaProgress>(initial.meta ?? EMPTY_META)
  const [muted, setMuted] = useState(initial.muted)
  const [selectedCat, setSelectedCat] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)

  useEffect(() => { saveGame(run, meta, muted) }, [run, meta, muted])
  useEffect(() => registerPwa(() => setNeedRefresh(true)), [])
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) saveGame(run, meta, muted) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [run, meta, muted])

  const dispatchStadium = (match: MatchState, event: StadiumUpdate['event']) => {
    window.dispatchEvent(new CustomEvent<StadiumUpdate>('neko-stadium-update', { detail: {
      ourScore: match.ourScore, theirScore: match.theirScore, inning: match.inning,
      half: match.half, lastPlay: match.lastPlay, event
    } }))
  }

  const candidates = useMemo(() => run?.phase === 'draft' ? draftCandidates(run.seed, run.draftRound) : [], [run?.phase, run?.seed, run?.draftRound])

  const chooseDraft = (cat: CatPlayer) => {
    if (!run) return
    const roster = [...run.roster, cat]
    setRun({ ...run, roster, draftRound: run.draftRound + 1, phase: roster.length === 9 ? 'training' : 'draft' })
  }

  const train = (key: keyof Stats | 'rest' | 'meeting') => {
    if (!run || run.trainingActions >= run.trainingLimit) return
    if (key === 'meeting') {
      setRun({ ...run, morale: Math.min(100, run.morale + 12), trainingActions: run.trainingActions + 1 })
      return
    }
    const roster = run.roster.map((cat, index) => {
      if (index !== selectedCat) return cat
      if (key === 'rest') return { ...cat, condition: Math.min(100, cat.condition + 25) }
      if (key === 'pitching' && cat.position !== 'P') return cat
      return { ...cat, stats: { ...cat.stats, [key]: Math.min(9, cat.stats[key] + 1) } }
    })
    setRun({ ...run, roster, trainingActions: run.trainingActions + 1 })
  }

  const startMatch = () => {
    if (!run) return
    const created = createMatch(run.roster, OPPONENTS[run.gameIndex], run.seed + run.gameIndex * 911)
    const match = simulateToNextDecision(created, run.roster)
    setRun({ ...run, phase: 'match', match, trainingActions: 0 })
    window.setTimeout(() => dispatchStadium(match, 'idle'), 100)
  }

  const chooseTactic = (tactic: TacticId) => {
    if (!run?.match || advancing) return
    const wasScore = run.match.ourScore + run.match.theirScore
    const resolved = resolveDecision(run.match, run.roster, tactic)
    setRun({ ...run, match: resolved })
    dispatchStadium(resolved, resolved.ourScore + resolved.theirScore > wasScore ? 'score' : 'play')
    setAdvancing(true)
    window.setTimeout(() => {
      const advanced = simulateToNextDecision(resolved, run.roster)
      setRun(current => current ? { ...current, match: advanced } : current)
      dispatchStadium(advanced, advanced.finished ? (advanced.won ? 'win' : 'lose') : 'idle')
      setAdvancing(false)
    }, 650)
  }

  const closeMatch = () => {
    if (!run?.match?.finished) return
    const won = run.match.won === true
    const wins = run.wins + (won ? 1 : 0)
    const losses = run.losses + (won ? 0 : 1)
    if (run.gameIndex < 2) {
      setRun({ ...run, phase: 'training', match: null, gameIndex: run.gameIndex + 1, wins, losses, trainingActions: 0, trainingLimit: 3 })
      return
    }
    if (run.gameIndex === 2 && wins >= 2) {
      setRun({ ...run, phase: 'training', match: null, gameIndex: 3, wins, losses, trainingActions: 0, trainingLimit: 1 })
      return
    }
    const champion = run.gameIndex === 3 && won
    const newMeta = {
      seasons: meta.seasons + 1,
      championships: meta.championships + (champion ? 1 : 0),
      discoveredCats: [...new Set([...meta.discoveredCats, ...run.roster.map(cat => cat.breed)])]
    }
    setMeta(newMeta)
    setRun({ ...run, phase: 'seasonEnd', match: null, wins, losses, champion })
  }

  const backToTitle = () => {
    clearActiveRun(meta, muted)
    setResumeAvailable(false)
    setRun(null)
  }

  return (
    <main className="app-shell">
      <div className="game-frame">
        {run?.phase !== 'match' && <header className="topbar"><span>NEKO NINE</span><button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? '音を出す' : '消音する'}>{muted ? '🔇' : '🔊'}</button></header>}
        {!run && <TitleScreen meta={meta} hasContinue={resumeAvailable} onStart={() => { setResumeAvailable(false); setRun(makeRun()) }} onContinue={() => { setResumeAvailable(false); setRun(initial.activeRun) }} />}
        {run?.phase === 'draft' && <DraftScreen run={run} candidates={candidates} onChoose={chooseDraft} />}
        {run?.phase === 'training' && <TrainingScreen run={run} selected={selectedCat} onSelect={setSelectedCat} onTrain={train} onStart={startMatch} />}
        {run?.phase === 'match' && run.match && <MatchScreen run={run} advancing={advancing} onTactic={chooseTactic} onClose={closeMatch} />}
        {run?.phase === 'seasonEnd' && <SeasonEnd run={run} onTitle={backToTitle} />}
        {needRefresh && <div className="update-toast"><span>新しいシーズンデータがあります</span><button onClick={activateUpdate}>更新</button><button onClick={() => setNeedRefresh(false)}>あとで</button></div>}
      </div>
      <div className="landscape-warning">スマホを縦向きにして遊んでね</div>
    </main>
  )
}

function TitleScreen({ meta, hasContinue, onStart, onContinue }: { meta: MetaProgress; hasContinue: boolean; onStart: () => void; onContinue: () => void }) {
  return <section className="title-screen screen">
    <div className="title-rays" />
    <div className="title-logo"><span>ヤス監督の挑戦</span><h1>ネコ<br /><b>ナイン</b></h1><i>NINE LIVES. ONE DREAM.</i></div>
    <div className="title-duo"><YasuPortrait mood={0} /><CatPortrait index={0} /></div>
    <p className="title-copy">9匹を選び、育て、<br />ここぞの采配で頂点へ。</p>
    <div className="title-actions">
      {hasContinue && <button className="primary-button" onClick={onContinue}>つづきから</button>}
      <button className={hasContinue ? 'secondary-button' : 'primary-button'} onClick={onStart}>新しいシーズン</button>
      <button type="button" className="secondary-button" onClick={() => { window.location.href = '../' }}>◀ ヒゲボールゲームズへ</button>
    </div>
    <div className="career"><span>シーズン {meta.seasons}</span><span>優勝 {meta.championships}</span><span>図鑑 {meta.discoveredCats.length}/9</span></div>
    <div style={{ marginTop: '10px', fontSize: '10px', color: '#fff8e899', textAlign: 'center', letterSpacing: '0.5px' }}>
      © 2026 株式会社ヒゲボール / ヒゲボール制作委員会
    </div>
  </section>
}

function DraftScreen({ run, candidates, onChoose }: { run: RunState; candidates: CatPlayer[]; onChoose: (cat: CatPlayer) => void }) {
  const position = POSITIONS[run.draftRound]
  return <section className="screen paper-screen">
    <div className="section-heading"><small>DRAFT {run.draftRound + 1}/9</small><h2>{POSITION_NAMES[position]}を選ぼう</h2><p>3匹の個性を見比べて指名！</p></div>
    <div className="draft-progress">{POSITIONS.map((value, index) => <span key={value} className={index < run.draftRound ? 'done' : index === run.draftRound ? 'active' : ''}>{value}</span>)}</div>
    <div className="candidate-list">{candidates.map(cat => <article className="player-card" key={cat.id}>
      <div className="card-top"><CatPortrait index={cat.breedIndex} /><div><span className="position-chip">{POSITION_NAMES[cat.position]}</span><h3>{cat.name}</h3><p>{cat.breed}・{cat.personality}</p></div></div>
      <div className="stat-grid">{(Object.keys(STAT_LABELS) as Array<keyof Stats>).filter(key => key !== 'pitching' || cat.position === 'P').map(key => <div key={key}><span>{STAT_LABELS[key]}</span><b>{'■'.repeat(cat.stats[key])}<i>{'□'.repeat(9 - cat.stats[key])}</i></b></div>)}</div>
      <div className="trait"><strong>★ {cat.trait.name}</strong><span>{cat.trait.description}</span></div>
      <button className="pick-button" onClick={() => onChoose(cat)}>この猫を指名</button>
    </article>)}</div>
  </section>
}

function TrainingScreen({ run, selected, onSelect, onTrain, onStart }: { run: RunState; selected: number; onSelect: (index: number) => void; onTrain: (key: keyof Stats | 'rest' | 'meeting') => void; onStart: () => void }) {
  const remaining = run.trainingLimit - run.trainingActions
  const opponent = OPPONENTS[run.gameIndex]
  return <section className="screen paper-screen training-screen">
    <div className="section-heading"><small>{run.gameIndex === 3 ? 'FINAL PREP' : `GAME ${run.gameIndex + 1} PREP`}</small><h2>{run.gameIndex === 3 ? '決勝前の最終調整' : '育成キャンプ'}</h2><p>残り行動 <b>{remaining}</b> / {run.trainingLimit}</p></div>
    <div className="scout-card"><span>次の相手</span><strong>{opponent.name}</strong><em>{opponent.tendency}</em><p>{opponent.scouting}</p></div>
    <div className="roster-strip">{run.roster.map((cat, index) => <button key={cat.id} className={selected === index ? 'selected' : ''} onClick={() => onSelect(index)}><CatPortrait index={cat.breedIndex} /><span>{cat.position}</span></button>)}</div>
    <div className="selected-player"><strong>{run.roster[selected]?.name}</strong><span>を育てる</span><i>チーム士気 {run.morale}</i></div>
    <div className="training-grid">{TRAINING.map(item => <button key={item.key} disabled={remaining === 0 || (item.key === 'pitching' && run.roster[selected]?.position !== 'P')} onClick={() => onTrain(item.key)}><span>{item.icon}</span><b>{item.label}</b></button>)}</div>
    <button className="primary-button sticky-action" disabled={remaining > 0} onClick={onStart}>{run.gameIndex === 3 ? '決勝へ！' : '試合開始'}</button>
  </section>
}

function MatchScreen({ run, advancing, onTactic, onClose }: { run: RunState; advancing: boolean; onTactic: (id: TacticId) => void; onClose: () => void }) {
  const match = run.match!
  const mood = match.finished ? (match.won ? 2 : 3) : match.pending?.options.find(option => option.id === match.pending?.recommended)?.hint === '有利' ? 1 : 0
  return <section className="match-screen">
    <Suspense fallback={<div className="stadium stadium-loading">球場を準備中…</div>}><Stadium /></Suspense>
    <div className="scoreboard"><div><small>NEKO</small><b>{match.ourScore}</b></div><span>{match.inning}回{match.half === 'top' ? '表' : '裏'}<i>{'●'.repeat(match.outs)}{'○'.repeat(3 - match.outs)}</i></span><div><small>{match.opponent.name.slice(0, 4)}</small><b>{match.theirScore}</b></div></div>
    <div className="diamond" aria-label="走者"><i className={match.bases[1] ? 'on' : ''}/><i className={match.bases[2] ? 'on' : ''}/><i className={match.bases[0] ? 'on' : ''}/></div>
    {!match.finished && <div className="command-panel">
      <div className="coach-line"><YasuPortrait mood={mood} /><div><small>{match.pending?.side === 'offense' ? '攻撃の采配' : '守備の采配'}</small><strong>{advancing ? '試合が動いている…' : match.pending?.title}</strong><span>{match.pending?.situation}</span></div></div>
      <div className="tactic-list">{match.pending?.options.map(option => <button disabled={advancing} key={option.id} onClick={() => onTactic(option.id)}><span className={`hint hint-${option.hint}`}>{option.hint}</span><b>{option.label}</b><small>{option.description}</small></button>)}</div>
      <p className="commentary">{match.commentary[0]}</p>
    </div>}
    {match.finished && <div className="result-panel"><YasuPortrait mood={match.won ? 2 : 3} /><small>GAME SET</small><h2>{match.won ? '勝利！' : '惜敗…'}</h2><p>{match.ourScore} — {match.theirScore}</p><button className="primary-button" onClick={onClose}>次へ</button></div>}
  </section>
}

function SeasonEnd({ run, onTitle }: { run: RunState; onTitle: () => void }) {
  return <section className={`screen season-end ${run.champion ? 'champion' : ''}`}>
    <div className="confetti" /><YasuPortrait mood={run.champion ? 2 : 3} />
    <small>{run.champion ? 'LEAGUE CHAMPION' : 'SEASON COMPLETE'}</small>
    <h2>{run.champion ? 'ネコナイン、優勝！' : '挑戦はつづく'}</h2>
    <p>{run.wins}勝 {run.losses}敗</p>
    <div className="final-roster">{run.roster.map(cat => <CatPortrait key={cat.id} index={cat.breedIndex} />)}</div>
    <p className="end-message">{run.champion ? '9匹とヤス監督が、ついに頂点へ。' : '猫たちは確かに強くなった。次のドラフトで雪辱だ。'}</p>
    <button className="primary-button" onClick={onTitle}>タイトルへ</button>
  </section>
}

export default App
