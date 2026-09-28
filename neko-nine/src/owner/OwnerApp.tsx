import { useEffect, useRef, useState } from "react";
import { activateUpdate, registerPwa } from "../pwa";
import {
  applyOwnerAction,
  estimate,
  operatingCost,
  payroll,
  potentialEstimate,
  roster,
  standings,
} from "./engine";
import {
  CAT_BREEDS,
  DOG_BREEDS,
  FACILITIES,
  POSITIONS,
  SKILLS,
  blankRecord,
  money,
  type OwnerAction,
  type Player,
  type Skill,
  type Staff,
  type WorldState,
} from "./model";
import { exportWorld, loadWorld, persistWorld, validateWorld } from "./storage";
import { YasuPortrait } from "../ui/Sprites";
import {
  Dashboard,
  FrontOffice,
  OwnerStatus,
  SalaryBudget,
  StaffPanel,
} from "./FrontOffice";
import { upgradeLegacy } from "./operations";
import { AnimalPortrait } from "./AnimalPortrait";
import { FoomyGuide, eventTab } from "./Secretary";
import { normalizePlayerNames } from "./identity";
import { backfillCareerHistory } from "./history";
import { AbilityBadge } from "./AbilityBadge";
import { RecentResults } from "./RecentResults";
import { PlayerAbilityPanel } from "./PlayerAbilityPanel";
import { ScoutingStatus } from "./ScoutingStatus";
import { normalizeSalaryScale } from "./salary";
import { SaveSlotsPanel } from "./SaveSlotsPanel";
import { ConfirmDialog } from "./ConfirmDialog";

type Tab = "ホーム" | "選手" | "編成" | "経営" | "リーグ";
const tabs: Tab[] = ["ホーム", "選手", "編成", "経営"];
const icons = ["⌂", "▦", "⚑", "▤", "♜"];
const breed = (p: Player) =>
  (p.species === "cat" ? CAT_BREEDS : DOG_BREEDS)[p.breed];
function portrait(p: Player) {
  return <AnimalPortrait p={p} />;
}
const avg = (hits: number, ab: number) =>
  ab ? (hits / ab).toFixed(3).replace(/^0/, "") : "—";
const era = (runs: number, outs: number) =>
  outs ? ((runs * 27) / outs).toFixed(2) : "—";
export default function OwnerApp() {
  const [w, setW] = useState<WorldState | null>(null),
    [loaded, setLoaded] = useState(false),
    [tab, setTab] = useState<Tab>("ホーム"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [settings, setSettings] = useState(false),
    [update, setUpdate] = useState(false),
    [detail, setDetail] = useState<string | null>(null);
  const [atTitle, setAtTitle] = useState(() => {
    try {
      return sessionStorage.getItem("neko-owner-title") === "1";
    } catch {
      return false;
    }
  });
  const [newGameConfirm, setNewGameConfirm] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem("neko-owner-title", atTitle ? "1" : "0");
    } catch {
      /* Game persistence uses IndexedDB. */
    }
  }, [atTitle]);
  const [eventVisit, setEventVisit] = useState(0);
  const worker = useRef<Worker | null>(null),
    job = useRef(0),
    pending = useRef(
      new Map<
        number,
        { resolve: (w: WorldState) => void; reject: (e: Error) => void }
      >(),
    ),
    lock = useRef(false);
  useEffect(() => {
    loadWorld()
      .then((s) => {
        setW(s);
        setLoaded(true);
      })
      .catch((e) => {
        setError(String(e));
        setLoaded(true);
      });
    const instance = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = instance;
    instance.onmessage = (e) => {
      const m = e.data;
      if (m.progress) {
        setBusy(m.progress);
        return;
      }
      const wait = pending.current.get(m.id);
      if (!wait) return;
      pending.current.delete(m.id);
      if (m.error) wait.reject(Error(m.error));
      else wait.resolve(m.result);
    };
    instance.onerror = () => {
      for (const p of pending.current.values())
        p.reject(
          Error(
            "計算を完了できませんでした。保存済み状態から再試行してください。",
          ),
        );
      pending.current.clear();
    };
    const off = registerPwa(() => setUpdate(true));
    return () => {
      instance.terminate();
      off();
    };
  }, []);
  function compute(type: "create" | "month" | "skip"): Promise<WorldState> {
    return new Promise((resolve, reject) => {
      const id = ++job.current;
      pending.current.set(id, { resolve, reject });
      worker.current?.postMessage({ id, type, world: w, seed: 20261026 });
    });
  }
  async function commit(next: WorldState) {
    backfillCareerHistory(next);
    normalizeSalaryScale(next);
    await persistWorld(next);
    setW(next);
    setError("");
  }
  async function act(a: OwnerAction) {
    if (!w || lock.current) return;
    lock.current = true;
    setBusy("保存しています…");
    try {
      const next =
        (a.type === "advance" || a.type === "skipSeason") &&
        w.phase === "season"
          ? await compute(a.type === "skipSeason" ? "skip" : "month")
          : applyOwnerAction(w, a);
      await commit(next);
      if (a.type === "advance" || a.type === "skipSeason") {
        setDetail(null);
        setEventVisit((n) => n + 1);
        setTab(eventTab(next));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (a.type === "advance") setTab(eventTab(w));
    } finally {
      setBusy("");
      lock.current = false;
    }
  }
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy("2026年の12球団を準備しています…");
    try {
      await commit(await compute("create"));
      setAtTitle(false);
      setSettings(false);
      setDetail(null);
      setTab("ホーム");
    } catch (e) {
      setError(String(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function restore(file?: File) {
    try {
      if (
        file &&
        w &&
        !confirm(
          "現在のデータを読み込み内容で置き換えます。直前の状態はバックアップに残ります。",
        )
      )
        return;
      let next = file ? JSON.parse(await file.text()) : await loadWorld(true);
      if (next?.version === 2) next = upgradeLegacy(next);
      validateWorld(next);
      normalizePlayerNames(next);
      backfillCareerHistory(next);
      await commit(next);
      setSettings(false);
      setDetail(null);
      setTab("ホーム");
      setAtTitle(false);
    } catch (e) {
      setError(String(e));
    }
  }
  const selected = w?.players.find((p) => p.id === detail);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [tab, w?.phase]);
  return (
    <div className="owner-app">
      <div className="owner-shell">
        <header className="masthead">
          <button className="brand" onClick={() => setTab("ホーム")}>
            <span className="brand-ball">⚾</span>
            <span>
              NEKO NINE<small>BASEBALL CLUB OWNER</small>
            </span>
          </button>
          <button
            aria-label="保存と設定"
            onClick={() => setSettings(!settings)}
          >
            ☰
          </button>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")}>閉じる</button>
          </div>
        )}
        {!loaded ? (
          <div className="empty">セーブデータを読んでいます…</div>
        ) : !w || atTitle ? (
          <section className="welcome">
            <div className="eyebrow">OWNER'S EDITION / 2026</div>
            <h1>
              弱小球団に、
              <br />
              <em>新しい未来を。</em>
            </h1>
            <div className="welcome-portrait">
              <YasuPortrait mood={0} />
              <span>
                新オーナー
                <br />
                <b>ヤス</b>
              </span>
            </div>
            <p>
              福岡ソフトにゃんくホークス。
              <br />
              選手を見つけ、人を育て、球団を変える。
              <br />
              あなたの決断が、次の一年をつくる。
            </p>
            {w && (
              <button
                className="primary"
                onClick={() => {
                  setAtTitle(false);
                  setTab(eventTab(w));
                  setEventVisit((n) => n + 1);
                }}
              >
                続きから再開する
              </button>
            )}
            <button
              className={w ? "secondary" : "primary"}
              disabled={!!busy}
              onClick={() => (w ? setNewGameConfirm(true) : void start())}
            >
              {w ? "2026年から最初からプレイ" : "2026年オフから就任する"} →
            </button>
            <button onClick={() => setSettings(true)}>
              セーブ枠からロードする
            </button>
            <small>
              セ・パ12球団 ／ 支配下70人・一軍31人
              <br />
              判断ごとに自動保存。いつでも再開できます。
            </small>
          </section>
        ) : (
          <>
            <OwnerStatus
              w={w}
              onAdvance={() => act({ type: "advance" })}
              onStopDraft={() => act({ type: "passDraft" })}
            />
            <main className="workspace" key={tab}>
              {(tab === "ホーム" ||
                tab === "編成" ||
                (tab === "経営" && w.phase === "budget")) && (
                <FoomyGuide w={w} compact={tab !== "ホーム"} />
              )}
              {tab === "ホーム" && <Dashboard w={w} act={act} go={setTab} />}
              {tab === "選手" && <Players w={w} open={setDetail} />}
              {tab === "編成" && (
                <FrontOffice
                  key={`${w.phase}-${eventVisit}`}
                  w={w}
                  act={act}
                  open={setDetail}
                />
              )}
              {tab === "経営" && <Business w={w} act={act} />}
              {tab === "リーグ" && <League w={w} open={setDetail} />}
            </main>
            <nav className="bottom-nav" aria-label="メインメニュー">
              {tabs.map((t, i) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  <span>{icons[i]}</span>
                  {t === "選手"
                    ? "選手名鑑"
                    : t === "編成"
                      ? "編成・補強"
                      : t === "経営"
                        ? "施設・経営"
                        : t}
                </button>
              ))}
            </nav>
          </>
        )}
        {settings && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="保存と設定"
            >
              <button className="close" onClick={() => setSettings(false)}>
                閉じる ×
              </button>
              <h2>保存と設定</h2>
              <p>
                セーブはこのブラウザに保存されます。端末を変える前に書き出してください。
              </p>
              <SaveSlotsPanel
                w={w}
                onLoad={async (next) => {
                  if (lock.current)
                    throw Error("保存処理が終わるまでお待ちください。");
                  lock.current = true;
                  try {
                    await commit(next);
                    setDetail(null);
                    setAtTitle(false);
                    setTab(eventTab(next));
                    setEventVisit((n) => n + 1);
                    setSettings(false);
                  } finally {
                    lock.current = false;
                  }
                }}
              />
              {w && (
                <button onClick={() => exportWorld(w)}>セーブを書き出す</button>
              )}
              <label className="file-button">
                セーブを読み込む
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => restore(e.target.files?.[0])}
                />
              </label>
              <button onClick={() => restore()}>
                直前のバックアップを復元
              </button>
              {w && (
                <button
                  disabled={!!busy}
                  onClick={() => {
                    setSettings(false);
                    setDetail(null);
                    setAtTitle(true);
                  }}
                >
                  タイトル画面に戻る
                </button>
              )}
              {update && (
                <button onClick={activateUpdate}>新しいバージョンへ更新</button>
              )}
              <p className="muted">
                旧版のセーブは別の保存領域に残っています。旧オーナー版は読み込み時に引き継げます。
              </p>
            </section>
          </div>
        )}
        {selected && w && (
          <PlayerDetail
            key={selected.id}
            p={selected}
            w={w}
            close={() => setDetail(null)}
            act={act}
          />
        )}{" "}
        {newGameConfirm && (
          <ConfirmDialog
            title="最初からプレイしますか？"
            confirmLabel="最初から始める"
            onClose={() => setNewGameConfirm(false)}
            onConfirm={() => {
              setNewGameConfirm(false);
              void start();
            }}
          >
            <p>
              現在の自動セーブは新しいゲームに置き換わります。残したいプレイは先にセーブ枠へ保存してください。3つの手動セーブ枠は変更しません。
            </p>
            <button
              onClick={() => {
                setNewGameConfirm(false);
                setSettings(true);
              }}
            >
              先にセーブ枠へ保存する
            </button>
          </ConfirmDialog>
        )}
        {busy && (
          <div className="busy" role="status">
            <span className="spinner" />
            {busy}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlayerList({
  w,
  list,
  open,
  action,
  label,
}: {
  w: WorldState;
  list: Player[];
  open: (id: string) => void;
  action?: (p: Player) => void;
  label?: string;
}) {
  const [search, setSearch] = useState(""),
    [pos, setPos] = useState("全守備"),
    [sort, setSort] = useState("名前"),
    [page, setPage] = useState(0);
  const filtered = list
    .filter(
      (p) =>
        (pos === "全守備" || p.position === pos) &&
        `${p.name}${breed(p)}${p.trait}`.includes(search),
    )
    .sort((a, b) =>
      sort === "年齢"
        ? a.age - b.age
        : sort === "年俸"
          ? b.salary - a.salary
          : sort === "ポジション"
            ? POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position)
            : sort === "本塁打"
              ? (b.reports[w.year]?.hr ?? 0) - (a.reports[w.year]?.hr ?? 0)
              : a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <div className="filters">
        <input
          aria-label="選手名・種類・役割で検索"
          placeholder="選手名・種類・役割で検索"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="守備位置"
          value={pos}
          onChange={(e) => {
            setPos(e.target.value);
            setPage(0);
          }}
        >
          <option>全守備</option>
          {POSITIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="並び順"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {["名前", "年齢", "年俸", "ポジション", "本塁打"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <small className="muted">
        {filtered.length}選手 ／ 直近3年成績は一覧表示・タップで能力と契約
      </small>
      <div className="player-list">
        {filtered.slice(current * 20, current * 20 + 20).map((p) => (
          <article className="player-row" key={p.id} data-player-id={p.id}>
            <button className="player-summary" onClick={() => open(p.id)}>
              {portrait(p)}
              <div>
                <small>
                  {p.position} / {breed(p)} / {p.age}歳 /{" "}
                  {p.species === "dog"
                    ? "外国人"
                    : p.registration === "development"
                      ? "育成"
                      : "支配下"}
                </small>
                <strong>{p.name}</strong>
                <span>
                  {p.team === null ? "未所属" : w.teams[p.team].short} ·{" "}
                  {p.market === "draft"
                    ? `未契約 · 入団時年俸 ${money(p.ask)}`
                    : money(p.team === 0 ? p.salary : p.ask)}
                </span>
                <span className="role-tag">
                  {p.trait}
                  {p.team === 0 &&
                  p.negotiation === "meeting" &&
                  p.contractYear < w.year + 1
                    ? " ／ 要面談"
                    : ""}
                </span>
                {p.market === "draft" && <ScoutingStatus p={p} />}
              </div>
              <b>›</b>
            </button>
            {p.market !== "draft" && <RecentResults p={p} w={w} />}
            {action && (
              <button className="row-action" onClick={() => action(p)}>
                {label}
              </button>
            )}
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty">該当する選手はいません。</div>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            前へ
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            次へ
          </button>
        </div>
      )}
    </>
  );
}
function Players({ w, open }: { w: WorldState; open: (id: string) => void }) {
  const [team, setTeam] = useState("0");
  return (
    <>
      <div className="eyebrow">PLAYER DIRECTORY</div>
      <h1>選手名鑑</h1>
      <p className="intro">
        成績だけでなく、年齢、年俸、伸びしろも。
        <br />
        次のチームを形づくる一人を見つけよう。
      </p>
      <select
        className="wide-select"
        aria-label="球団を選択"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
      >
        <option value="all">全12球団</option>
        {w.teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        <option value="retired">引退選手</option>
      </select>
      <PlayerList
        w={w}
        open={open}
        list={w.players.filter((p) =>
          team === "retired"
            ? p.market === "retired"
            : p.market === "roster" &&
              (team === "all" || p.team === Number(team)),
        )}
      />
    </>
  );
}
export function StaffCard({
  s,
  target,
  hire,
}: {
  s: Staff;
  target: number;
  hire?: () => void;
}) {
  return (
    <article className="staff-card">
      <div className="staff-title">
        <span className="staff-avatar">{s.role === "監督" ? "♜" : "⚑"}</span>
        <div>
          <small>
            {s.age}歳 / {s.team === 0 ? "現職" : "候補"}
          </small>
          <h3>{s.name}</h3>
        </div>
        <strong>{money(s.ask)}</strong>
      </div>
      <div className="staff-stats">
        {[
          ["評価", s.evaluation],
          ["采配", s.tactics],
          ["指導", s.teaching],
          ["若手", s.youth],
          ["ベテラン", s.veterans],
          ["健康管理", s.health],
          ["求心力", s.leadership],
          ["将来性評価", s.projection],
        ].map(([k, v]) => (
          <span key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </span>
        ))}
      </div>
      <p>
        方針：{s.policy} {s.history[0] && `／ ${s.history[0]}`}
      </p>
      {hire && (
        <button disabled={s.contractYear >= target} onClick={hire}>
          {s.contractYear >= target
            ? "来季契約済み"
            : s.team === 0
              ? "契約を更新"
              : "このスタッフと契約"}
        </button>
      )}
    </article>
  );
}

function PlayerDetail({
  p,
  w,
  close,
  act,
}: {
  p: Player;
  w: WorldState;
  close: () => void;
  act: (a: OwnerAction) => void;
}) {
  const [offer, setOffer] = useState(p.ask),
    [years, setYears] = useState(1),
    [incentive, setIncentive] = useState(false),
    [promise, setPromise] = useState<Player["promise"]>("none");
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLButtonElement>(".player-detail .close")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
      if (active?.isConnected) active.focus();
    };
  }, [p.id]);
  const ours = p.team === 0;
  return (
    <div className="modal-backdrop">
      <section
        className="modal player-detail"
        role="dialog"
        aria-modal="true"
        aria-label="選手詳細"
      >
        <button className="close" onClick={close}>
          閉じる ×
        </button>
        <div className="detail-hero">
          {portrait(p)}
          <div>
            <small>
              {p.position} / {breed(p)}
            </small>
            <h2>{p.name}</h2>
            <p>
              {p.age}歳・プロ{p.pro}年目
              <br />
              {p.throws}投{p.bats}打 ／{" "}
              {p.team === null ? "未所属" : w.teams[p.team].short}
            </p>
          </div>
        </div>
        <p className="muted">
          {p.species === "dog"
            ? "外国人"
            : p.registration === "development"
              ? "育成契約"
              : "支配下"}{" "}
          ／ 調査度 {Math.round(p.scouting)}%
          {p.market === "fa" ? ` ／ FA ${p.faRank}ランク` : ""}
        </p>
        <PlayerAbilityPanel p={p} w={w} />
        {!ours && <ScoutingStatus p={p} />}
        <p className="muted">
          将来性：
          {p.age >= 32 ? "ベテラン調整" : potentialEstimate(w, p)} ／ 人気{" "}
          {p.popularity}
          <br />
          耐久性 {ours ? p.durability : "未確定"} ／ 調子{" "}
          {ours ? Math.round(p.morale) : "未確定"} ／{" "}
          {p.injured ? `離脱中（残り${p.injured}試合目安）` : "活動中"}
        </p>
        <h3>契約</h3>
        <div className="contract-facts">
          <span>
            現在 <b>{p.market === "draft" ? "未契約" : money(p.salary)}</b>
          </span>
          <span>
            {p.market === "draft" ? "入団時年俸" : "希望"} <b>{money(p.ask)}</b>
          </span>
          <span>
            契約年度 <b>{p.contractYear}</b>
          </span>
          <span>
            重視するもの <b>{p.preference}</b>
          </span>
        </div>
        {p.meetingReason && p.contractYear < w.year + 1 && (
          <p className="warning">要面談：{p.meetingReason}</p>
        )}
        {((p.market === "fa" && ["fa", "contracts"].includes(w.phase)) ||
          (ours && w.phase === "contracts" && p.contractYear < w.year + 1)) && (
          <div className="offer-box">
            <label>
              提示年俸（万円）
              <input
                aria-label="提示年俸"
                type="number"
                min="300"
                step="100"
                value={offer}
                onChange={(e) => setOffer(Number(e.target.value))}
              />
            </label>
            {ours && (
              <>
                <label className="field">
                  契約期間
                  <select
                    aria-label="契約期間"
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}年
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={incentive}
                    onChange={(e) => setIncentive(e.target.checked)}
                  />
                  出来高を追加（年俸の18%・達成時支払い）
                </label>
                <label className="field">
                  起用法のカード
                  <select
                    aria-label="起用確約"
                    value={promise}
                    onChange={(e) =>
                      setPromise(e.target.value as Player["promise"])
                    }
                  >
                    <option value="none">確約なし</option>
                    <option value="position">守備位置の優先起用を確約</option>
                    <option value="order">上位打順を確約</option>
                  </select>
                </label>
                <p className="muted">
                  複数年は将来の契約と枠を固定。確約が守られないと調子が下がります。
                </p>
              </>
            )}
            <button
              onClick={() =>
                act(
                  p.market === "fa"
                    ? { type: "offer", id: p.id, salary: offer }
                    : {
                        type: "negotiate",
                        id: p.id,
                        salary: offer,
                        years,
                        incentive,
                        promise,
                      },
                )
              }
            >
              年俸を提示する
            </button>
            {p.offerRound > 0 && (
              <p>
                第{p.offerRound}回交渉済み ／ 競合：
                {p.offers
                  .filter((o) => o.team !== 0)
                  .map((o) => `${w.teams[o.team].short} ${money(o.salary)}`)
                  .join("、")}
              </p>
            )}
          </div>
        )}
        {!ours &&
          ["season", "draft", "fa", "tryout", "contracts"].includes(w.phase) &&
          p.market !== "retired" && (
            <button
              disabled={w.scoutsLeft <= 0 || p.scouting >= 100}
              onClick={() => act({ type: "scout", id: p.id })}
            >
              {p.scouting >= 100
                ? "調査完了"
                : `追加調査 200万円（${(p.scoutingCount ?? 0) + 1}回目・残り${w.scoutsLeft}件）`}
            </button>
          )}
        <h3>直近3年・年度別成績</h3>
        <RecentResults p={p} w={w} />
        <div className="history-list">
          {Object.values(p.reports)
            .sort((a, b) => b.year - a.year)
            .map((r) => (
              <article key={r.year}>
                <b>
                  {r.year} · {w.teams[r.team]?.short ?? "海外／所属不明"}
                  {r.source === "backfill" ? "（補完データ）" : ""}
                </b>
                <p>
                  {p.position === "投"
                    ? `${r.games}登板 / ${r.wins}勝${r.losses}敗 / ${r.saves}S ${r.holds}H / 防御率${era(r.earned, r.outs)} / ${Math.floor(r.outs / 3)}.${r.outs % 3}回 / ${r.k}奪三振 / ${r.bb}四球 / 自責${r.earned}`
                    : `${r.games}試合 / ${r.pa}打席 ${r.ab}打数${r.hits}安打 / 打率${avg(r.hits, r.ab)} / ${r.hr}本 ${r.rbi}打点 ${r.steals}盗塁 / ${r.errors}失策`}
                </p>
              </article>
            ))}
        </div>
        {!Object.keys(p.reports).length && (
          <p className="muted">プロ入り前のため成績はありません。</p>
        )}
        <h3>成長とコンディション</h3>
        {p.growth.length ? (
          p.growth.map((g, i) => (
            <p className="growth-line" key={i}>
              {g.replace(
                /contact|power|speed|arm|fielding|catching|control|stamina/g,
                (k) => SKILLS[k as Skill],
              )}
            </p>
          ))
        ) : (
          <p className="muted">キャンプやシーズン経過で履歴が蓄積します。</p>
        )}
      </section>
    </div>
  );
}

function Business({
  w,
  act,
}: {
  w: WorldState;
  act: (a: OwnerAction) => void;
}) {
  const f = w.teams[0].finance,
    editable = w.phase === "budget",
    rows = f.ledger.filter(
      (r) =>
        r.year ===
        (["season", "cs", "series", "settlement"].includes(w.phase)
          ? w.year
          : w.year + 1),
    ),
    categories = [...new Set(rows.map((r) => r.category))];
  return (
    <>
      <div className="eyebrow">CLUB BUSINESS</div>
      <h1>球団経営</h1>
      {editable && (
        <div className="event-progression">
          <p>
            施設への投資は任意です。監督・コーチ6職種の契約を確定したら進めます。
          </p>
        </div>
      )}
      <p className="intro">
        強いチームを支える、続けられる経営。
        <br />
        固定費と投資のバランスを整えよう。
      </p>
      <div className="metrics">
        <div>
          <small>現金残高</small>
          <strong>{money(f.cash)}</strong>
          <em>融資残高 {money(f.debt)}</em>
        </div>
        <div>
          <small>年間運営費見込み</small>
          <strong>{money(operatingCost(w))}</strong>
          <em>契約金・大型投資は別途</em>
        </div>
      </div>
      {!editable && (
        <p className="notice">経営計画期間に設定を変更できます。</p>
      )}
      <h2>チケットと集客</h2>
      {editable && <SalaryBudget w={w} act={act} />}
      <label className="field">
        平均チケット価格 <b>{f.ticket.toLocaleString()}円</b>
        <select
          aria-label="チケット価格"
          disabled={!editable}
          value={f.ticket}
          onChange={(e) =>
            act({ type: "ticket", value: Number(e.target.value) })
          }
        >
          {[1200, 1800, 2200, 2600, 3000, 3600, 4200, 5000, 6000].map((n) => (
            <option key={n} value={n}>
              {n}円
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        月間販促予算
        <select
          disabled={!editable}
          value={f.marketing}
          onChange={(e) =>
            act({ type: "marketing", value: Number(e.target.value) })
          }
        >
          {[0, 500, 1000, 2000, 3000].map((n) => (
            <option key={n} value={n}>
              {money(n)}
            </option>
          ))}
        </select>
      </label>
      <div className="info-line">
        収容人数 {f.capacity.toLocaleString()}人 ／ ファン支持{" "}
        {Math.round(f.popularity)} / 100
      </div>
      <h2>スポンサー</h2>
      <div className="choice-list">
        {[
          ["地元企業連合", "安定型：年間1.80億円"],
          ["ライフスタイル企業", "人気連動型：1.20億円＋人気評価"],
          ["スポーツブランド", "成果型：0.80億円＋CS進出で2億円"],
        ].map(([name, description], i) => (
          <button
            disabled={!editable}
            className={f.sponsorKind === i ? "selected" : ""}
            key={name}
            onClick={() => act({ type: "sponsor", value: i })}
          >
            <strong>
              {f.sponsorKind === i ? "✓ " : ""}
              {name}
            </strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <h2>球団設備</h2>
      <div className="facility-grid">
        {FACILITIES.map((name, i) => (
          <article key={name}>
            <small>LEVEL {f.facilities[i]} / 5</small>
            <h3>{name}</h3>
            <p>
              {
                [
                  "キャンプと練習効率を改善",
                  "故障リスクを軽減",
                  "候補選手の評価幅を縮小",
                  "収容人数を3,000人拡張",
                ][i]
              }
            </p>
            <span>
              投資 {money(f.facilities[i] * 6000)}
              <br />
              維持費 年+700万円
            </span>
            <button
              disabled={!editable || f.facilities[i] >= 5 || f.debt > 0}
              onClick={() => act({ type: "invest", facility: i })}
            >
              投資する
            </button>
          </article>
        ))}
      </div>
      <h2>年度収支明細</h2>
      <div className="ledger">
        {categories.map((c) => {
          const amount = rows
            .filter((r) => r.category === c)
            .reduce((n, r) => n + r.amount, 0);
          return (
            <div key={c}>
              <span>{c}</span>
              <b className={amount < 0 ? "negative" : "positive"}>
                {amount > 0 ? "+" : ""}
                {money(amount)}
              </b>
            </div>
          );
        })}
        {!rows.length && <p>新年度の収支はこれから記録されます。</p>}
      </div>
      <Annual w={w} />
      {editable && <StaffPanel w={w} act={act} />}
    </>
  );
}
function League({ w, open }: { w: WorldState; open: (id: string) => void }) {
  const [league, setLeague] = useState<"パ" | "セ">("パ"),
    [kind, setKind] = useState("打者");
  const list = w.players
    .filter(
      (p) =>
        p.reports[w.year]?.source !== "backfill" &&
        w.teams[p.reports[w.year]?.team ?? p.team ?? -1]?.league === league &&
        (kind === "投手" ? p.position === "投" : p.position !== "投"),
    )
    .sort((a, b) =>
      kind === "投手"
        ? (b.reports[w.year]?.wins ?? 0) - (a.reports[w.year]?.wins ?? 0)
        : (b.reports[w.year]?.hr ?? 0) - (a.reports[w.year]?.hr ?? 0),
    );
  return (
    <>
      <div className="eyebrow">LEAGUE REPORT</div>
      <h1>プロ野球年鑑</h1>
      <div className="segmented">
        {(["パ", "セ"] as const).map((l) => (
          <button
            className={league === l ? "selected" : ""}
            key={l}
            onClick={() => setLeague(l)}
          >
            {l}・リーグ
          </button>
        ))}
      </div>
      <div className="standings">
        <div className="standings-head">
          <span>球団</span>
          <span>勝</span>
          <span>敗</span>
          <span>分</span>
          <span>勝率</span>
        </div>
        {standings(w, league).map((t, i) => (
          <div key={t.id} className={t.id === 0 ? "our-team" : ""}>
            <span>
              <b>{i + 1}</b> {t.short}
            </span>
            <span>{t.wins}</span>
            <span>{t.losses}</span>
            <span>{t.draws}</span>
            <span>
              {t.wins + t.losses
                ? (t.wins / (t.wins + t.losses)).toFixed(3)
                : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="muted">
        143試合制・上位3球団がCS進出。交流戦18試合を含みます。
      </p>
      {w.seriesLog.length > 0 && (
        <section className="task-card">
          <h2>ポストシーズン</h2>
          {w.seriesLog.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </section>
      )}
      <div className="section-title">
        <h2>{w.year}年 個人成績</h2>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option>打者</option>
          <option>投手</option>
        </select>
      </div>
      <div className="leaders">
        {list.slice(0, 15).map((p, i) => {
          const r = p.reports[w.year] ?? blankRecord(w.year, p.team!);
          return (
            <button key={p.id} onClick={() => open(p.id)}>
              <span>{i + 1}</span>
              <div>
                <b>{p.name}</b>
                <small>
                  {w.teams[r.team]?.short} / {p.age}歳
                </small>
              </div>
              <strong>
                {kind === "投手" ? `${r.wins}勝` : `${r.hr}本`}
                <small>
                  {kind === "投手"
                    ? `防御率 ${era(r.earned, r.outs)}`
                    : `打率 ${avg(r.hits, r.ab)}`}
                </small>
              </strong>
            </button>
          );
        })}
      </div>
      <h2>歴代日本一</h2>
      {[...w.archives].reverse().map((a) => (
        <div className="archive-row" key={a.year}>
          <b>{a.year}</b>
          <span>{w.teams[a.champion].name}</span>
        </div>
      ))}
    </>
  );
}
export function Annual({ w }: { w: WorldState }) {
  const a = w.archives.at(-1);
  if (!a) return null;
  const f = a.finances[0],
    previous = w.archives.at(-2)?.finances[0];
  return (
    <section className="annual">
      <div className="eyebrow">ANNUAL REPORT {a.year}</div>
      <h2>一年の決算</h2>
      <div className="ledger">
        <div>
          <span>営業収入</span>
          <b>{money(f.income)}</b>
        </div>
        <div>
          <span>年間支出</span>
          <b>{money(f.expense)}</b>
        </div>
        <div>
          <span>収支</span>
          <b className={f.profit >= 0 ? "positive" : "negative"}>
            {money(f.profit)}
          </b>
        </div>
        {previous && (
          <div>
            <span>前年との差</span>
            <b>{money(f.profit - previous.profit)}</b>
          </div>
        )}
        <div>
          <span>ファン支持</span>
          <b>{f.fans}/100</b>
        </div>
        <div>
          <span>主催試合の観客動員</span>
          <b>{f.attendance.toLocaleString()}人</b>
        </div>
        <div>
          <span>年俸総額</span>
          <b>{money(f.payroll)}</b>
        </div>
        <div>
          <span>運営予算（投資を除く）</span>
          <b>{money(f.budget)}</b>
        </div>
      </div>
      <p>
        {f.profit < 0
          ? "固定費が収入を上回りました。年俸・設備維持費の見直しと、観客動員の改善が次年度の課題です。"
          : "収支は黒字。若手育成・補強・設備のどこへ再投資するかが、次の一年の鍵です。"}
      </p>
      {a.awards.map((s) => (
        <p className="award" key={s}>
          ★ {s}
        </p>
      ))}
    </section>
  );
}
