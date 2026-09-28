import { useState } from "react";
import { roster } from "./engine";
import {
  CAT_BREEDS,
  DOG_BREEDS,
  POSITIONS,
  SKILLS,
  money,
  type Player,
  type OwnerAction,
  type WorldState,
} from "./model";
import { seniorRoster } from "./operations";
import { AnimalPortrait } from "./AnimalPortrait";
import { AbilityBadge, GradeMark } from "./AbilityBadge";
import {
  releaseCandidates,
  releaseReasons,
  isCorePlayer,
  isPendingRelease,
} from "./release";
import { RecentResults } from "./RecentResults";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProfileAbilities } from "./ProfileAbilities";
export function ReleasePanel({
  w,
  act,
}: {
  w: WorldState;
  act: (a: OwnerAction) => void;
}) {
  const [mode, setMode] = useState("戦力外"),
    [excludeYoung, setYoung] = useState(true),
    [excludeCore, setCore] = useState(true),
    [position, setPosition] = useState("全守備"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [confirmation, setConfirmation] = useState<{
      id: string;
      type: "release" | "development";
    } | null>(null);
  const confirmingPlayer = w.players.find((p) => p.id === confirmation?.id);
  const list = releaseCandidates(w, {
    excludeYoung,
    excludeCore,
    mode,
    position,
    search,
  });
  const pages = Math.max(1, Math.ceil(list.length / 10)),
    current = Math.min(page, pages - 1);
  const changeFilter = (change: () => void) => {
    change();
    setPage(0);
  };
  const positions = ["全守備", ...POSITIONS];
  const positionNames: Record<string, string> = {
    全守備: "全員",
    投: "投手",
    捕: "捕手",
    一: "一塁",
    二: "二塁",
    三: "三塁",
    遊: "遊撃",
    左: "左翼",
    中: "中堅",
    右: "右翼",
  };
  const tabCounts = Object.fromEntries(
    positions.map((pos) => [
      pos,
      releaseCandidates(w, {
        excludeYoung,
        excludeCore,
        mode,
        position: pos,
        search,
      }).length,
    ]),
  );
  return (
    <section className="release-panel" aria-label="戦力外候補の選択">
      <h2>戦力外候補を比較する</h2>
      <p>
        現在の空き枠は<strong>{70 - seniorRoster(w).length}人</strong>
        。通告した選手は一覧に残り、この通告期間を終了するまではキャンセルできます。
      </p>
      <div
        className="position-tabs"
        role="tablist"
        aria-label="戦力外候補のポジション"
      >
        {positions.map((pos, index) => (
          <button
            key={pos}
            id={`release-tab-${index}`}
            role="tab"
            type="button"
            aria-selected={position === pos}
            aria-controls="release-position-panel"
            tabIndex={position === pos ? 0 : -1}
            onClick={() => changeFilter(() => setPosition(pos))}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (index + 1) % positions.length
                  : e.key === "ArrowLeft"
                    ? (index + positions.length - 1) % positions.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? positions.length - 1
                        : -1;
              if (next < 0) return;
              e.preventDefault();
              changeFilter(() => setPosition(positions[next]));
              document.getElementById(`release-tab-${next}`)?.focus();
            }}
          >
            {positionNames[pos]}
            <small>{tabCounts[pos]}</small>
          </button>
        ))}
      </div>
      <div className="release-filters">
        <label>
          <input
            type="checkbox"
            checked={excludeYoung}
            onChange={(e) => changeFilter(() => setYoung(e.target.checked))}
          />
          3年目までの選手を除外
        </label>
        <label>
          <input
            type="checkbox"
            checked={excludeCore}
            onChange={(e) => changeFilter(() => setCore(e.target.checked))}
          />
          主力選手を除外
        </label>
        <small>
          主力の目安：野手60試合／180打席、投手10先発／30登板／10セーブ／10ホールド。除外を解除すれば主力も選べます。
        </small>
        <div className="filters">
          <input
            aria-label="戦力外候補を検索"
            placeholder="名前・特殊能力で検索"
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          />
        </div>
      </div>
      <div className="segmented">
        {["戦力外", "育成打診"].map((v) => (
          <button
            key={v}
            className={mode === v ? "selected" : ""}
            onClick={() => changeFilter(() => setMode(v))}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="muted">
        表示 {list.length}人 / 所属 {roster(w).length}人 ·
        来季の契約が残る選手は通告不可。育成打診は拒否されると退団します。
      </p>
      <div
        className="release-candidates"
        role="tabpanel"
        id="release-position-panel"
        aria-labelledby={`release-tab-${positions.indexOf(position)}`}
      >
        {list.slice(current * 10, current * 10 + 10).map((p) => {
          const released = isPendingRelease(p, w);
          const locked = p.contractYear > w.year;
          const depth = roster(w).filter(
            (x) =>
              x.registration === "senior" &&
              x.position === p.position &&
              x.id !== p.id,
          ).length;
          const skills =
            p.position === "投"
              ? (["control", "stamina", "fielding"] as const)
              : ([
                  "contact",
                  "power",
                  "speed",
                  "arm",
                  "fielding",
                  "catching",
                ] as const);
          return (
            <article
              className={`release-candidate${released ? " release-selected" : ""}`}
              key={p.id}
              data-player-id={p.id}
              data-pro={p.pro}
              data-position={p.position}
              data-released={released}
              data-core={isCorePlayer(p, w.year)}
            >
              <div className="candidate-heading">
                <AnimalPortrait p={p} />
                <div>
                  <h3>{p.name}</h3>
                  {released && (
                    <span className="release-state">戦力外通告済み</span>
                  )}
                  <p>
                    {p.position} /{" "}
                    {(p.species === "cat" ? CAT_BREEDS : DOG_BREEDS)[p.breed]} /{" "}
                    {p.age}歳 / プロ{Math.max(1, p.pro)}年目
                  </p>
                  <p>
                    {p.throws}投{p.bats}打 ·{" "}
                    {p.registration === "development"
                      ? "育成"
                      : p.species === "dog"
                        ? "外国人・支配下"
                        : "支配下"}{" "}
                    {isCorePlayer(p, w.year) && (
                      <span className="core-badge">主力</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="candidate-contract">
                <span>
                  年俸 <b>{money(p.salary)}</b>
                </span>
                <span>
                  契約 <b>{p.contractYear}年まで</b>
                </span>
                <span>
                  同守備の支配下 <b>他{depth}人</b>
                </span>
                <span>
                  成長期待 <GradeMark value={p.potential} /> / ピーク目安{" "}
                  <b>{p.peak}歳</b>
                </span>
              </div>
              <div className="candidate-skills">
                {skills.map((k) => (
                  <AbilityBadge key={k} label={SKILLS[k]} low={p.skills[k]} />
                ))}
              </div>
              <ProfileAbilities p={p} />
              <RecentResults p={p} w={w} />
              <p className="candidate-reasons">
                判断材料：{releaseReasons(p, w.year).join(" / ")}
              </p>
              {locked && (
                <p className="warning">
                  来季以降の契約が残るため、通告・育成打診はできません。
                </p>
              )}
              {!locked &&
                !released &&
                depth <
                  (p.position === "投" ? 10 : p.position === "捕" ? 2 : 1) &&
                p.registration === "senior" && (
                  <p className="warning">
                    この選手を外すと守備位置の人数が不足します。別の選手の獲得・昇格・コンバートが必要です。
                  </p>
                )}
              <button
                className={`candidate-action${released ? " cancel-release" : ""}`}
                disabled={locked}
                aria-label={
                  released
                    ? `${p.name}の戦力外通告をキャンセル`
                    : `${p.name}に${mode === "戦力外" ? "戦力外通告" : "育成契約を打診"}`
                }
                onClick={() => {
                  if (released) act({ type: "cancelRelease", id: p.id });
                  else
                    setConfirmation({
                      id: p.id,
                      type: mode === "戦力外" ? "release" : "development",
                    });
                }}
              >
                {locked
                  ? "契約継続中"
                  : released
                    ? "戦力外通告をキャンセル"
                    : mode === "戦力外"
                      ? "この選手に戦力外通告"
                      : "この選手に育成契約を打診"}
              </button>
            </article>
          );
        })}
      </div>
      {confirmation && confirmingPlayer && (
        <ConfirmDialog
          title={
            confirmation.type === "release"
              ? "戦力外通告の確認"
              : "育成契約打診の確認"
          }
          confirmLabel={
            confirmation.type === "release"
              ? "戦力外通告を確定"
              : "育成契約を打診"
          }
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            act({ type: confirmation.type, id: confirmation.id });
            setConfirmation(null);
          }}
        >
          <p>
            <strong>{confirmingPlayer.name}</strong>に
            {confirmation.type === "release" ? "戦力外通告" : "育成契約を打診"}
            しますか？
          </p>
          {isCorePlayer(confirmingPlayer, w.year) && (
            <p className="warning">
              主力選手です。退団はチーム戦力とファン評価に影響します。
            </p>
          )}
          <p>
            {confirmation.type === "release"
              ? "この通告期間を終了するまでは、一覧の「戦力外通告をキャンセル」で戻せます。終了すると退団が確定します。"
              : "育成打診は選手が拒否すると退団します。育成打診の結果は取り消せません。"}
          </p>
        </ConfirmDialog>
      )}
      {!list.length && (
        <p className="empty">
          条件に合う候補はいません。除外チェックや守備位置を見直してください。
        </p>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            前の候補
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            次の候補
          </button>
        </div>
      )}
      <p className="muted">
        通告は必須ではありません。必要な枠が確保できていれば次のイベントへ進めます。
      </p>
      {w.news
        .filter(
          (n) =>
            n.year === w.year && /戦力外通告|育成契約|育成打診/.test(n.title),
        )
        .slice(0, 4)
        .map((n) => (
          <p className="notice" key={n.id}>
            {n.title}：{n.body}
          </p>
        ))}
    </section>
  );
}
