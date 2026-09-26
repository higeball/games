import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { draftCandidates, STAT_LABELS } from './game/content/cats'
import { OPPONENTS } from './game/content/opponents'
import { clearActiveRun, EMPTY_META, loadSave, saveGame } from './game/save'
import { createMatch, resolveDecision, simulateToNextDecision } from './game/simulation/match'
import type { CatPlayer, MatchState, MetaProgress, RunState, Stats, TacticId } from './game/types'
import { POSITIONS } from './game/types'
import type { StadiumUpdate } from './three/Stadium3D'
import { CatPortrait, YasuPortrait } from './ui/Sprites'
import { activateUpdate, registerPwa } from './pwa'

const Stadium = lazy(() => import('./three/Stadium3D').then(module => ({ default: module.Stadium3D })))

const POSITION_NAMES = {
  P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手',
  SS: '遊撃手', LF: '左翼手', CF: '中堅手', RF: '右翼手'
}

const TRAINING_MENUS: Array<{ key: keyof Stats | 'rest' | 'meeting'; label: string; icon: string; desc: string }> = [
  { key: 'contact', label: '打撃', icon: '⚾', desc: 'ミート+1' },
  { key: 'power', label: '筋力', icon: '💪', desc: '長打+1' },
  { key: 'speed', label: '走塁', icon: '💨', desc: '走力+1' },
  { key: 'defense', label: '守備', icon: '🧤', desc: '守備+1' },
  { key: 'pitching', label: '投球', icon: '🎯', desc: '投球+1' },
  { key: 'rest', label: '休養', icon: '☀', desc: '調子+25' },
  { key: 'meeting', label: '作戦', icon: '💬', desc: '士気+12' }
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

  // 特訓メニューを一括確定実行
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
      setAdvancing(false)
      dispatchStadium(advanced, advanced.finished ? (advanced.won ? 'win' : 'lose') : 'idle')
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
            <span>新しいバージョンがあります</span>
            <button onClick={activateUpdate}>更新</button>
          </div>
        )}
      </div>
      <div className="landscape-warning">スマホを縦向きにして遊んでね</div>
    </main>
  )
}

function TitleScreen({ meta, hasContinue, onStart, onContinue }: { meta: MetaProgress; hasContinue: boolean; onStart: () => void; onContinue: () => void }) {
  return (
    <section className="title-screen screen compact-title">
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
      <div style={{ marginTop: '8px', fontSize: '9px', color: '#fff8e899', textAlign: 'center', letterSpacing: '0.5px' }}>
        © 2026 株式会社ヒゲボール / ヒゲボール制作委員会
      </div>
    </section>
  )
}

// 1画面にぴったり収まるタブ切り替えドラフト
function DraftScreen({ run, candidates, onChoose }: { run: RunState; candidates: CatPlayer[]; onChoose: (cat: CatPlayer) => void }) {
  const position = POSITIONS[run.draftRound]
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0)

  useEffect(() => {
    setSelectedCandidateIndex(0)
  }, [run.draftRound])

  const activeCat = candidates[selectedCandidateIndex] || candidates[0]

  return (
    <section className="screen paper-screen draft-screen-compact">
      <div className="section-heading compact-heading">
        <div className="heading-row">
          <small>DRAFT {run.draftRound + 1}/9</small>
          <h2>{POSITION_NAMES[position]}を指名</h2>
        </div>
      </div>

      <div className="draft-progress compact-progress">
        {POSITIONS.map((value, index) => (
          <span key={value} className={index < run.draftRound ? 'done' : index === run.draftRound ? 'active' : ''}>
            {value}
          </span>
        ))}
      </div>

      {/* 3候補切り替えタブ（1画面で直感比較） */}
      <div className="candidate-tabs" role="tablist">
        {candidates.map((cat, idx) => {
          const isSelected = idx === selectedCandidateIndex
          return (
            <button
              key={cat.id}
              type="button"
              className={`candidate-tab-btn ${isSelected ? 'active' : ''} ${cat.isSpecial ? 'special-tab' : ''}`}
              onClick={() => setSelectedCandidateIndex(idx)}
            >
              <span className="tab-idx">第{idx + 1}候補</span>
              <strong className="tab-name">{cat.isSpecial ? `✨${cat.name}✨` : cat.name}</strong>
              <small className="tab-pos">{POSITION_NAMES[cat.position]}</small>
            </button>
          )
        })}
      </div>

      {activeCat && (
        <article className={`player-card compact-card ${activeCat.isSpecial ? 'special-card' : ''}`} key={activeCat.id}>
          {activeCat.isSpecial && (
            <div className="special-badge">
              <span className="sparkle">✨</span>
              <b>{activeCat.specialTitle || '★ 超逸材 ★'}</b>
              <span className="sparkle">✨</span>
            </div>
          )}
          <div className="card-top">
            <CatPortrait index={activeCat.breedIndex} />
            <div>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <span className="position-chip">{POSITION_NAMES[activeCat.position]}</span>
                {activeCat.isSpecial && <span className="special-chip">超逸材</span>}
                <span className="cond-chip">調子 100%</span>
              </div>
              <h3>{activeCat.name}</h3>
              <p>{activeCat.breed}・{activeCat.personality}</p>
            </div>
          </div>
          <div className="stat-grid compact-stat-grid">
            {(Object.keys(STAT_LABELS) as Array<keyof Stats>)
              .filter(key => key !== 'pitching' || activeCat.position === 'P')
              .map(key => (
                <div key={key}>
                  <span>{STAT_LABELS[key]}</span>
                  <b>
                    {'■'.repeat(activeCat.stats[key])}
                    <i>{'□'.repeat(Math.max(0, 9 - activeCat.stats[key]))}</i>
                  </b>
                </div>
              ))}
          </div>
          <div className="trait compact-trait">
            <strong>★ {activeCat.trait.name}</strong>
            <span>{activeCat.trait.description}</span>
          </div>
          <button
            type="button"
            className={`pick-button ${activeCat.isSpecial ? 'pick-special' : ''}`}
            onClick={() => onChoose(activeCat)}
          >
            {activeCat.isSpecial ? `★ 超逸材【${activeCat.name}】を指名！ ★` : `【${activeCat.name}】を指名して次へ ▶`}
          </button>
        </article>
      )}
    </section>
  )
}

// 1画面に収まるコンパクト育成キャンプ
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
    <section className="screen paper-screen training-screen-compact">
      <div className="section-heading compact-heading">
        <div className="heading-row">
          <small>{run.gameIndex === 3 ? 'FINAL' : `GAME ${run.gameIndex + 1}`}</small>
          <h2>{run.gameIndex === 3 ? '決勝前調整' : '育成キャンプ'}</h2>
          <span className="remaining-badge">残り特訓 <b>{remaining}</b>回</span>
        </div>
      </div>

      <div className="scout-bar-compact">
        <span className="scout-tag">次戦</span>
        <strong>{opponent.name}</strong>
        <em>({opponent.tendency})</em>
        <span>{opponent.scouting}</span>
      </div>

      {/* 9匹ロスター一覧（コンパクト3x3グリッド） */}
      <div className="roster-grid-compact">
        {run.roster.map((cat, index) => {
          const isSelected = selected === index
          return (
            <button
              key={cat.id}
              type="button"
              className={`roster-grid-cell compact-cell ${isSelected ? 'selected' : ''} ${cat.isSpecial ? 'special-cell' : ''}`}
              onClick={() => onSelect(index)}
              title={`${cat.name} (${cat.position})`}
            >
              <span className="roster-cell-pos">{cat.position}</span>
              <CatPortrait index={cat.breedIndex} className="roster-cell-icon" />
              <span className="roster-cell-name">{cat.name}</span>
              <span className="roster-cell-cond">
                {cat.condition >= 90 ? '😆' : cat.condition >= 75 ? '😊' : cat.condition >= 50 ? '😐' : '🙁'}
              </span>
            </button>
          )
        })}
      </div>

      {/* 選択中の猫ステータス & 予約スロット & 確定ボタン */}
      {remaining > 0 && (
        <div className="training-planner compact-planner">
          <div className="planner-top-row">
            <span className="planner-target">
              対象: <b>{selectedCatObj?.name}</b> [{POSITION_NAMES[selectedCatObj?.position || 'P']}]
              <small>調子{selectedCatObj?.condition}%/士気{run.morale}</small>
            </span>
            <button
              type="button"
              className="commit-plan-btn compact-commit-btn"
              disabled={plans.length === 0}
              onClick={handleCommit}
            >
              {plans.length === remaining ? `【特訓確定】実行 ▶` : `特訓確定 (${plans.length}/${remaining}) ▶`}
            </button>
          </div>
          <div className="planner-slots compact-slots">
            {Array.from({ length: remaining }).map((_, idx) => {
              const plan = plans[idx]
              return (
                <div
                  key={idx}
                  className={`planner-slot compact-slot ${plan ? 'filled' : 'empty'}`}
                  onClick={() => plan && removePlan(idx)}
                >
                  {plan ? (
                    <>
                      <span className="slot-icon">{plan.icon}</span>
                      <span className="slot-name">{plan.label}➔{plan.targetName}</span>
                      <span className="slot-remove">✕</span>
                    </>
                  ) : (
                    <span className="slot-empty-text">{idx + 1}枠目:未選択</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 練習メニューボタン群（コンパクトグリッド） */}
      {remaining > 0 ? (
        <div className="training-menu-section compact-menu-section">
          <div className="training-grid compact-grid">
            {TRAINING_MENUS.map(item => {
              const isPitching = item.key === 'pitching'
              const disabled = plans.length >= remaining || (isPitching && selectedCatObj?.position !== 'P')
              return (
                <button
                  key={item.key}
                  type="button"
                  className="training-menu-btn compact-btn"
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
        <div className="training-complete-notice compact-notice">
          ★ 本日のキャンプ特訓はすべて完了しました！
        </div>
      )}

      {/* 試合開始ボタン */}
      <button type="button" className="primary-button sticky-action compact-action" disabled={remaining > 0} onClick={onStart}>
        {run.gameIndex === 3 ? '決勝戦へ挑む！ ▶' : '試合開始！ ▶'}
      </button>
    </section>
  )
}

// 3D野球場 & 1画面収まるコンパクト試合画面
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

  const maxInnings = Math.max(9, match.inning)
  const inningsArray = Array.from({ length: maxInnings }, (_, i) => i + 1)

  return (
    <section className="match-screen compact-match-screen">
      {/* 3D Baseball Stadium (Three.js) */}
      <div className="stadium-3d-wrap">
        <Suspense fallback={<div className="stadium stadium-loading">3D球場を展開中…</div>}>
          <Stadium />
        </Suspense>

        {/* 攻守特大モードバナー（3Dスタジアム上部にフロート） */}
        <div className={`inning-mode-banner compact-mode-banner ${isOffense ? 'mode-attack' : 'mode-defense'}`}>
          <span className="mode-badge">{isOffense ? '⚡ 攻撃中' : '🛡️ 守備中'}</span>
          <span className="mode-desc">
            {isOffense ? '【攻撃】采配で得点を奪え！' : '【守備】堅守采配で抑えろ！'}
          </span>
        </div>

        {/* 采配実行後のダイナミック結果バナー演出（3D空間上にポップアップ） */}
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
                {lastOutcome.kind === 'doubleplay' && '🛡️ 併殺打（ゲッツー）！'}
                {lastOutcome.kind === 'out' && '🧤 打者アウト！'}
              </strong>
              <p className="cutin-desc">{lastOutcome.text}</p>
            </div>
          </div>
        )}
      </div>

      {/* 電光掲示スコアボード & カウントバー（コンパクト） */}
      <div className="scoreboard-container compact-scoreboard">
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
                <td className="team-col opponent-team-name">{match.opponent.name.slice(0, 4)}</td>
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

        {/* BSOランプ & イニング & 走者ダイヤモンド */}
        <div className="count-and-runner-bar compact-count-bar">
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

          <div className="inning-text-pill compact-pill">
            <b>{match.inning}回{match.half === 'top' ? '表' : '裏'}</b>
          </div>

          <div className="diamond-mini">
            <span className={`base base-1 ${match.bases?.[0] ? 'occupied' : ''}`} />
            <span className={`base base-2 ${match.bases?.[1] ? 'occupied' : ''}`} />
            <span className={`base base-3 ${match.bases?.[2] ? 'occupied' : ''}`} />
          </div>
        </div>
      </div>

      {/* 采配コマンドパネル（2x2グリッドで1画面に収める） */}
      {!match.finished && (
        <div className="command-panel compact-command-panel">
          <div className="coach-line compact-coach-line">
            <YasuPortrait mood={mood} />
            <div className="coach-text-wrap">
              <div className="coach-bubble-tag">
                {match.pending?.side === 'offense' ? '⚡ 攻撃の采配' : '🛡️ 守備の采配'}
                {match.pending?.activeCatName && ` ─ 【${match.pending.activeCatName}】`}
              </div>
              <strong className="situation-title">{advancing ? '試合が動いている…' : match.pending?.title}</strong>
              <div className="situation-sub">
                <span>{match.pending?.situation}</span>
                {match.pending?.activeCatTrait && (
                  <span className="cat-trait-hint">特技: {match.pending.activeCatTrait}</span>
                )}
              </div>
            </div>
          </div>

          <div className="tactic-list tactic-grid-2x2">
            {match.pending?.options.map(option => (
              <button
                type="button"
                disabled={advancing}
                key={option.id}
                className={`tactic-btn compact-tactic-btn tactic-${option.hint}`}
                onClick={() => onTactic(option.id)}
              >
                <span className={`hint hint-${option.hint}`}>{option.hint}</span>
                <div className="tactic-info">
                  <b>{option.label}</b>
                  {option.tacticEffect && <span className="tactic-effect">{option.tacticEffect}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* 実況メッセージ（1行テロップ） */}
          <div className="commentary-box compact-commentary">
            <span className="commentary-label">実況</span>
            <p className="commentary">{match.commentary[0]}</p>
          </div>
        </div>
      )}

      {/* 試合終了結果パネル */}
      {match.finished && (
        <div className="result-panel compact-result-panel">
          <YasuPortrait mood={match.won ? 2 : 3} />
          <small>GAME SET</small>
          <h2>{match.won ? '🎉 勝利！！' : '😢 惜敗…'}</h2>
          <p className="result-score-line">
            NEKO {match.ourScore} ─ {match.theirScore} {match.opponent.name}
          </p>
          <button type="button" className="primary-button" onClick={onClose}>次へ進む ▶</button>
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
      <button type="button" className="primary-button" onClick={onTitle}>タイトルへもどる ▶</button>
    </section>
  )
}

export default App
