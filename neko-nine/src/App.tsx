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

const POSITION_NAMES = {
  P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手',
  SS: '遊撃手', LF: '左翼手', CF: '中堅手', RF: '右翼手'
}

const TRAINING_MENUS: Array<{ key: keyof Stats | 'rest' | 'meeting'; label: string; icon: string; desc: string }> = [
  { key: 'contact', label: '打撃練習', icon: '⚾', desc: '打撃（ミート）+1' },
  { key: 'power', label: '筋力練習', icon: '💪', desc: '長打（パワー）+1' },
  { key: 'speed', label: '走塁練習', icon: '💨', desc: '走力（スピード）+1' },
  { key: 'defense', label: '守備練習', icon: '🧤', desc: '守備力+1' },
  { key: 'pitching', label: '投球練習', icon: '🎯', desc: '投球（投手専用）+1' },
  { key: 'rest', label: 'ひなたぼっこ', icon: '☀', desc: '調子+25（コンディション回復）' },
  { key: 'meeting', label: '作戦会議', icon: '💬', desc: 'チーム士気+12（全員に効果）' }
]

type TrainingPlan = {
  id: string
  catIndex: number
  key: keyof Stats | 'rest' | 'meeting'
  label: string
  icon: string
  targetName: string
}

function makeRun(): RunState {
  const querySeed = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('seed') : null
  const seed = querySeed ? parseInt(querySeed, 10) : (Date.now() >>> 0)
  return {
    schemaVersion: 1, seed: seed >>> 0, phase: 'draft', roster: [], draftRound: 0,
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
  const [lastActionOutcome, setLastActionOutcome] = useState<{ kind: string; text: string } | null>(null)
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

  // 3つの特訓メニューを一括確定実行
  const commitTrainingPlans = (plans: TrainingPlan[]) => {
    if (!run || plans.length === 0) return
    let updatedRoster = [...run.roster]
    let updatedMorale = run.morale

    for (const plan of plans) {
      if (plan.key === 'meeting') {
        updatedMorale = Math.min(100, updatedMorale + 12)
      } else if (plan.key === 'rest') {
        updatedRoster = updatedRoster.map((cat, idx) => {
          if (idx !== plan.catIndex) return cat
          return { ...cat, condition: Math.min(100, cat.condition + 25) }
        })
      } else {
        const statKey = plan.key as keyof Stats
        updatedRoster = updatedRoster.map((cat, idx) => {
          if (idx !== plan.catIndex) return cat
          if (statKey === 'pitching' && cat.position !== 'P') return cat
          return { ...cat, stats: { ...cat.stats, [statKey]: Math.min(9, cat.stats[statKey] + 1) } }
        })
      }
    }

    setRun({
      ...run,
      roster: updatedRoster,
      morale: updatedMorale,
      trainingActions: run.trainingActions + plans.length
    })
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
    
    // 結果演出バナーを設定
    if (resolved.lastOutcome) {
      setLastActionOutcome({ kind: resolved.lastOutcome, text: resolved.lastOutcomeText || resolved.lastPlay })
    }

    setAdvancing(true)
    window.setTimeout(() => {
      const advanced = simulateToNextDecision(resolved, run.roster)
      setRun(current => current ? { ...current, match: advanced } : current)
      dispatchStadium(advanced, advanced.finished ? (advanced.won ? 'win' : 'lose') : 'idle')
      setAdvancing(false)
      window.setTimeout(() => setLastActionOutcome(null), 1200)
    }, 900)
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
        {run?.phase !== 'match' && (
          <header className="topbar">
            <span>NEKO NINE</span>
            <button className="icon-button" onClick={() => setMuted(!muted)} aria-label={muted ? '音を出す' : '消音する'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </header>
        )}
        {!run && (
          <TitleScreen
            meta={meta}
            hasContinue={resumeAvailable}
            onStart={() => { setResumeAvailable(false); setRun(makeRun()) }}
            onContinue={() => { setResumeAvailable(false); setRun(initial.activeRun) }}
          />
        )}
        {run?.phase === 'draft' && <DraftScreen run={run} candidates={candidates} onChoose={chooseDraft} />}
        {run?.phase === 'training' && (
          <TrainingScreen
            run={run}
            selected={selectedCat}
            onSelect={setSelectedCat}
            onCommitPlans={commitTrainingPlans}
            onStart={startMatch}
          />
        )}
        {run?.phase === 'match' && run.match && (
          <MatchScreen
            run={run}
            advancing={advancing}
            lastOutcome={lastActionOutcome}
            onTactic={chooseTactic}
            onClose={closeMatch}
          />
        )}
        {run?.phase === 'seasonEnd' && <SeasonEnd run={run} onTitle={backToTitle} />}
        {needRefresh && (
          <div className="update-toast">
            <span>新しいシーズンデータがあります</span>
            <button onClick={activateUpdate}>更新</button>
            <button onClick={() => setNeedRefresh(false)}>あとで</button>
          </div>
        )}
      </div>
      <div className="landscape-warning">スマホを縦向きにして遊んでね</div>
    </main>
  )
}

function TitleScreen({ meta, hasContinue, onStart, onContinue }: { meta: MetaProgress; hasContinue: boolean; onStart: () => void; onContinue: () => void }) {
  return (
    <section className="title-screen screen">
      <div className="title-rays" />
      <div className="title-logo">
        <span>ヤス監督の挑戦</span>
        <h1>ネコ<br /><b>ナイン</b></h1>
        <i>NINE LIVES. ONE DREAM.</i>
      </div>
      <div className="title-duo">
        <YasuPortrait mood={0} />
        <CatPortrait index={0} />
      </div>
      <p className="title-copy">9匹を選び、育て、<br />ここぞの采配で頂点へ。</p>
      <div className="title-actions">
        {hasContinue && <button className="primary-button" onClick={onContinue}>つづきから</button>}
        <button className={hasContinue ? 'secondary-button' : 'primary-button'} onClick={onStart}>新しいシーズン</button>
        <button type="button" className="secondary-button" onClick={() => { window.location.href = '../' }}>◀ ヒゲボールゲームズへ</button>
      </div>
      <div className="career">
        <span>シーズン {meta.seasons}</span>
        <span>優勝 {meta.championships}</span>
        <span>図鑑 {meta.discoveredCats.length}/9</span>
      </div>
      <div style={{ marginTop: '12px', fontSize: '10px', color: '#fff8e899', textAlign: 'center', letterSpacing: '0.5px' }}>
        © 2026 株式会社ヒゲボール / ヒゲボール制作委員会
      </div>
    </section>
  )
}

function DraftScreen({ run, candidates, onChoose }: { run: RunState; candidates: CatPlayer[]; onChoose: (cat: CatPlayer) => void }) {
  const position = POSITIONS[run.draftRound]
  return (
    <section className="screen paper-screen">
      <div className="section-heading">
        <small>DRAFT {run.draftRound + 1}/9</small>
        <h2>{POSITION_NAMES[position]}を選ぼう</h2>
        <p>個性と能力を見比べて指名！</p>
      </div>
      <div className="draft-progress">
        {POSITIONS.map((value, index) => (
          <span key={value} className={index < run.draftRound ? 'done' : index === run.draftRound ? 'active' : ''}>
            {value}
          </span>
        ))}
      </div>
      <div className="candidate-list">
        {candidates.map(cat => (
          <article className={`player-card ${cat.isSpecial ? 'special-card' : ''}`} key={cat.id}>
            {cat.isSpecial && (
              <div className="special-badge">
                <span className="sparkle">✨</span>
                <b>{cat.specialTitle || '★ 超逸材 ★'}</b>
                <span className="sparkle">✨</span>
              </div>
            )}
            <div className="card-top">
              <CatPortrait index={cat.breedIndex} />
              <div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="position-chip">{POSITION_NAMES[cat.position]}</span>
                  {cat.isSpecial && <span className="special-chip">超逸材</span>}
                </div>
                <h3>{cat.name}</h3>
                <p>{cat.breed}・{cat.personality}</p>
              </div>
            </div>
            <div className="stat-grid">
              {(Object.keys(STAT_LABELS) as Array<keyof Stats>)
                .filter(key => key !== 'pitching' || cat.position === 'P')
                .map(key => (
                  <div key={key}>
                    <span>{STAT_LABELS[key]}</span>
                    <b>
                      {'■'.repeat(cat.stats[key])}
                      <i>{'□'.repeat(Math.max(0, 9 - cat.stats[key]))}</i>
                    </b>
                  </div>
                ))}
            </div>
            <div className="trait">
              <strong>★ {cat.trait.name}</strong>
              <span>{cat.trait.description}</span>
            </div>
            <button className={`pick-button ${cat.isSpecial ? 'pick-special' : ''}`} onClick={() => onChoose(cat)}>
              {cat.isSpecial ? '★ この超逸材を指名！ ★' : 'この猫を指名'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function TrainingScreen({
  run,
  selected,
  onSelect,
  onCommitPlans,
  onStart
}: {
  run: RunState
  selected: number
  onSelect: (index: number) => void
  onCommitPlans: (plans: TrainingPlan[]) => void
  onStart: () => void
}) {
  const remaining = run.trainingLimit - run.trainingActions
  const opponent = OPPONENTS[run.gameIndex]
  const [plans, setPlans] = useState<TrainingPlan[]>([])

  const addPlan = (menu: typeof TRAINING_MENUS[number]) => {
    if (plans.length >= remaining) return
    const targetCat = run.roster[selected]
    const plan: TrainingPlan = {
      id: `${Date.now()}-${Math.random()}`,
      catIndex: selected,
      key: menu.key,
      label: menu.label,
      icon: menu.icon,
      targetName: menu.key === 'meeting' ? '全員' : (targetCat?.name || `猫#${selected + 1}`)
    }
    setPlans(prev => [...prev, plan])
  }

  const removePlan = (index: number) => {
    setPlans(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleCommit = () => {
    if (plans.length === 0) return
    onCommitPlans(plans)
    setPlans([])
  }

  const selectedCatObj = run.roster[selected]

  return (
    <section className="screen paper-screen training-screen">
      <div className="section-heading">
        <small>{run.gameIndex === 3 ? 'FINAL PREP' : `GAME ${run.gameIndex + 1} PREP`}</small>
        <h2>{run.gameIndex === 3 ? '決勝前の最終調整' : '育成キャンプ'}</h2>
        <p>残り特訓可能回数: <b>{remaining}</b> 回</p>
      </div>

      <div className="scout-card">
        <span>次の相手球団</span>
        <strong>{opponent.name}</strong>
        <em>{opponent.tendency}</em>
        <p>{opponent.scouting}</p>
      </div>

      {/* 9匹全員一覧グリッド（タップで選択） */}
      <div className="roster-grid-label">
        <span>▼ 特訓する猫選手を選んでください（全9匹）</span>
      </div>
      <div className="roster-grid">
        {run.roster.map((cat, index) => {
          const isSelected = selected === index
          return (
            <button
              key={cat.id}
              className={`roster-grid-cell ${isSelected ? 'selected' : ''} ${cat.isSpecial ? 'special-cell' : ''}`}
              onClick={() => onSelect(index)}
              title={`${cat.name} (${cat.position})`}
            >
              <div className="roster-cell-pos">{cat.position}</div>
              <CatPortrait index={cat.breedIndex} className="roster-cell-icon" />
              <div className="roster-cell-name">{cat.name}</div>
              <div className="roster-cell-cond" title={`調子: ${cat.condition}`}>
                {cat.condition >= 90 ? '😆' : cat.condition >= 75 ? '😊' : cat.condition >= 50 ? '😐' : '🙁'}
              </div>
            </button>
          )
        })}
      </div>

      {/* 選択中の猫の情報 */}
      {selectedCatObj && (
        <div className="selected-cat-banner">
          <div className="banner-left">
            <strong>{selectedCatObj.name}</strong>
            <span className="banner-breed">[{POSITION_NAMES[selectedCatObj.position]}] {selectedCatObj.breed}</span>
          </div>
          <div className="banner-right">
            <span>士気 {run.morale}</span>
            <span>調子 {selectedCatObj.condition}%</span>
          </div>
        </div>
      )}

      {/* 特訓予約スロット（3枠選んでから確定） */}
      {remaining > 0 && (
        <div className="training-planner">
          <div className="planner-header">
            <span>📋 特訓メニュー予約スロット ({plans.length} / {remaining})</span>
            <small>メニューを選んでスロットを埋め、最後に確定！</small>
          </div>
          <div className="planner-slots">
            {Array.from({ length: remaining }).map((_, idx) => {
              const plan = plans[idx]
              return (
                <div
                  key={idx}
                  className={`planner-slot ${plan ? 'filled' : 'empty'}`}
                  onClick={() => plan && removePlan(idx)}
                  title={plan ? 'タップで取り消し' : '未選択'}
                >
                  {plan ? (
                    <>
                      <span className="slot-idx">{idx + 1}</span>
                      <span className="slot-icon">{plan.icon}</span>
                      <div className="slot-text">
                        <b>{plan.label}</b>
                        <small>➔ {plan.targetName}</small>
                      </div>
                      <span className="slot-remove">✕</span>
                    </>
                  ) : (
                    <span className="slot-empty-text">【 {idx + 1}枠目 未選択 】</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 3枠決定ボタン */}
          <button
            className="primary-button commit-plan-btn"
            disabled={plans.length === 0}
            onClick={handleCommit}
          >
            {plans.length === remaining
              ? `【特訓確定！】${plans.length}つのメニューを実行する ▶`
              : `選択中の特訓を実行 (${plans.length}/${remaining}枠) ▶`}
          </button>
        </div>
      )}

      {/* 練習メニューボタン群 */}
      {remaining > 0 ? (
        <div className="training-menu-section">
          <div className="menu-section-title">▼ 実行したい特訓メニューをタップ</div>
          <div className="training-grid">
            {TRAINING_MENUS.map(item => {
              const isPitching = item.key === 'pitching'
              const disabled = plans.length >= remaining || (isPitching && selectedCatObj?.position !== 'P')
              return (
                <button
                  key={item.key}
                  disabled={disabled}
                  onClick={() => addPlan(item)}
                >
                  <span className="training-btn-icon">{item.icon}</span>
                  <div className="training-btn-text">
                    <b>{item.label}</b>
                    <small>{item.desc}</small>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="training-complete-notice">
          ★ 本日のキャンプ特訓はすべて完了しました！
        </div>
      )}

      {/* 試合開始ボタン */}
      <button className="primary-button sticky-action" disabled={remaining > 0} onClick={onStart}>
        {run.gameIndex === 3 ? '決勝戦へ突入！ ▶' : '試合開始！ ▶'}
      </button>
    </section>
  )
}

function MatchScreen({
  run,
  advancing,
  lastOutcome,
  onTactic,
  onClose
}: {
  run: RunState
  advancing: boolean
  lastOutcome: { kind: string; text: string } | null
  onTactic: (id: TacticId) => void
  onClose: () => void
}) {
  const match = run.match!
  const isOffense = match.half === 'bottom'
  const mood = match.finished
    ? (match.won ? 2 : 3)
    : match.pending?.options.find(option => option.id === match.pending?.recommended)?.hint === '有利' ? 1 : 0

  // 9イニングのスコア表示用配列
  const maxInnings = Math.max(9, match.inning)
  const inningsArray = Array.from({ length: maxInnings }, (_, i) => i + 1)

  return (
    <section className="match-screen">
      <Suspense fallback={<div className="stadium stadium-loading">球場を準備中…</div>}>
        <Stadium />
      </Suspense>

      {/* 攻守が一目でわかる特大モードバナー */}
      <div className={`inning-mode-banner ${isOffense ? 'mode-attack' : 'mode-defense'}`}>
        <span className="mode-badge">{isOffense ? '⚡ 攻撃中' : '🛡️ 守備中'}</span>
        <span className="mode-desc">
          {isOffense ? '自チームの攻撃！ 監督の采配で得点を奪え！' : '相手チームの攻撃！ 堅守の采配でゼロに抑えろ！'}
        </span>
      </div>

      {/* 本格スコアボード（電光掲示板スタイル） */}
      <div className="scoreboard-container">
        <div className="scoreboard-table-wrap">
          <table className="scoreboard-table">
            <thead>
              <tr>
                <th className="team-col">TEAM</th>
                {inningsArray.map(inn => (
                  <th key={inn} className={inn === match.inning ? 'current-inn' : ''}>{inn}</th>
                ))}
                <th className="total-col">R</th>
                <th className="total-col">H</th>
              </tr>
            </thead>
            <tbody>
              <tr className={!isOffense ? 'active-batting' : ''}>
                <td className="team-col opponent-team-name">{match.opponent.name.slice(0, 5)}</td>
                {inningsArray.map((_, i) => (
                  <td key={i} className={i + 1 === match.inning ? 'current-inn' : ''}>
                    {match.inningScores?.their?.[i] !== undefined ? match.inningScores.their[i] : (i + 1 < match.inning ? 0 : '-')}
                  </td>
                ))}
                <td className="total-col total-score">{match.theirScore}</td>
                <td className="total-col total-hits">{match.hits?.their ?? 0}</td>
              </tr>
              <tr className={isOffense ? 'active-batting' : ''}>
                <td className="team-col my-team-name">NEKO</td>
                {inningsArray.map((_, i) => (
                  <td key={i} className={i + 1 === match.inning ? 'current-inn' : ''}>
                    {match.inningScores?.our?.[i] !== undefined ? match.inningScores.our[i] : (i + 1 < match.inning ? 0 : '-')}
                  </td>
                ))}
                <td className="total-col total-score">{match.ourScore}</td>
                <td className="total-col total-hits">{match.hits?.our ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BSO・アウトカウント・ランナーランプ */}
        <div className="count-and-runner-bar">
          <div className="bso-board">
            <div className="bso-row">
              <span className="bso-lbl bso-b">B</span>
              <span className={`lamp lamp-green ${match.balls >= 1 ? 'on' : ''}`} />
              <span className={`lamp lamp-green ${match.balls >= 2 ? 'on' : ''}`} />
              <span className={`lamp lamp-green ${match.balls >= 3 ? 'on' : ''}`} />
            </div>
            <div className="bso-row">
              <span className="bso-lbl bso-s">S</span>
              <span className={`lamp lamp-yellow ${match.strikes >= 1 ? 'on' : ''}`} />
              <span className={`lamp lamp-yellow ${match.strikes >= 2 ? 'on' : ''}`} />
            </div>
            <div className="bso-row">
              <span className="bso-lbl bso-o">O</span>
              <span className={`lamp lamp-red ${match.outs >= 1 ? 'on' : ''}`} />
              <span className={`lamp lamp-red ${match.outs >= 2 ? 'on' : ''}`} />
            </div>
          </div>

          <div className="inning-text-pill">
            <b>{match.inning}回{match.half === 'top' ? '表' : '裏'}</b>
          </div>

          {/* 走者ダイヤモンド */}
          <div className="diamond-mini">
            <span className={`base base-2 ${match.bases[1] ? 'occupied' : ''}`} title="2塁" />
            <span className={`base base-3 ${match.bases[2] ? 'occupied' : ''}`} title="3塁" />
            <span className={`base base-1 ${match.bases[0] ? 'occupied' : ''}`} title="1塁" />
          </div>
        </div>
      </div>

      {/* 采配実行後のダイナミック結果バナー演出 */}
      {lastOutcome && (
        <div className={`result-cutin-banner cutin-${lastOutcome.kind}`}>
          <div className="cutin-content">
            <span className="cutin-sub">PLAY RESULT</span>
            <strong className="cutin-title">
              {lastOutcome.kind === 'homer' && '🏆 特大ホームラン！！'}
              {lastOutcome.kind === 'double' && '💥 ツーベースヒット！！'}
              {lastOutcome.kind === 'single' && '⚾ クリーンヒット！'}
              {lastOutcome.kind === 'walk' && '🚶 フォアボール！'}
              {lastOutcome.kind === 'strikeout' && '⚡ 空振り三振！'}
              {lastOutcome.kind === 'doubleplay' && '🛡️ ダブルプレー（併殺）！'}
              {lastOutcome.kind === 'out' && '🧤 打者アウト！'}
            </strong>
            <p className="cutin-desc">{lastOutcome.text}</p>
          </div>
        </div>
      )}

      {/* 采配コマンドパネル */}
      {!match.finished && (
        <div className="command-panel">
          <div className="coach-line">
            <YasuPortrait mood={mood} />
            <div>
              <div className="coach-bubble-tag">
                {match.pending?.side === 'offense' ? '⚡ 攻撃の采配' : '🛡️ 守備の采配'}
                {match.pending?.activeCatName && ` ─ 【${match.pending.activeCatName}】`}
              </div>
              <strong>{advancing ? '試合が動いている…' : match.pending?.title}</strong>
              <span>{match.pending?.situation}</span>
              {match.pending?.activeCatTrait && (
                <span className="cat-trait-hint">特技: {match.pending.activeCatTrait}</span>
              )}
            </div>
          </div>

          <div className="tactic-list">
            {match.pending?.options.map(option => (
              <button
                disabled={advancing}
                key={option.id}
                className={`tactic-btn tactic-${option.hint}`}
                onClick={() => onTactic(option.id)}
              >
                <span className={`hint hint-${option.hint}`}>{option.hint}</span>
                <div className="tactic-info">
                  <b>{option.label}</b>
                  <small>{option.description}</small>
                  {option.tacticEffect && <span className="tactic-effect">{option.tacticEffect}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* 実況メッセージ */}
          <div className="commentary-box">
            <span className="commentary-label">実況</span>
            <p className="commentary">{match.commentary[0]}</p>
          </div>
        </div>
      )}

      {/* 試合終了結果パネル */}
      {match.finished && (
        <div className="result-panel">
          <YasuPortrait mood={match.won ? 2 : 3} />
          <small>GAME SET</small>
          <h2>{match.won ? '🎉 勝利！！' : '😢 惜敗…'}</h2>
          <p className="result-score-line">
            NEKO {match.ourScore} ─ {match.theirScore} {match.opponent.name}
          </p>
          <button className="primary-button" onClick={onClose}>次へ進む ▶</button>
        </div>
      )}
    </section>
  )
}

function SeasonEnd({ run, onTitle }: { run: RunState; onTitle: () => void }) {
  return (
    <section className={`screen season-end ${run.champion ? 'champion' : ''}`}>
      <div className="confetti" />
      <YasuPortrait mood={run.champion ? 2 : 3} />
      <small>{run.champion ? 'LEAGUE CHAMPION' : 'SEASON COMPLETE'}</small>
      <h2>{run.champion ? '🏆 ネコナイン、優勝！' : '挑戦はつづく'}</h2>
      <p>{run.wins}勝 {run.losses}敗</p>
      <div className="final-roster">
        {run.roster.map(cat => (
          <CatPortrait key={cat.id} index={cat.breedIndex} />
        ))}
      </div>
      <p className="end-message">
        {run.champion ? '9匹とヤス監督が、ついに頂点へ！歓喜のビールかけ！' : '猫たちは確かに強くなった。次のドラフトで雪辱だ。'}
      </p>
      <button className="primary-button" onClick={onTitle}>タイトルへもどる ▶</button>
    </section>
  )
}

export default App
