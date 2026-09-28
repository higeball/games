import { nextRandom } from "../game/simulation/rng";
import { playerName } from "./identity";
import { backfillCareerHistory } from "./history";
import {
  CAMPS,
  CLUBS,
  PHASE_FLOW,
  emptyCampPlan,
  SENIOR_LIMIT,
  POSITIONS,
  STAFF_ROLES,
  blankRecord,
  money,
  type WorldState,
  type Player,
  type Team,
  type Staff,
  type OwnerAction,
  type Skill,
  type Phase,
  type Fixture,
  type RecordLine,
} from "./model";
import {
  handleOperation,
  seniorRoster,
  chooseActive,
  phaseBlockers,
  announceFa,
  makeActiveDraftPool,
  campTraining,
  finalizeFa,
  contractAssessment,
  queueCompensation,
  resetOperations,
} from "./operations";

const clamp = (n: number, lo = 1, hi = 100) => Math.max(lo, Math.min(hi, n));
export function random(w: WorldState) {
  const [r, s] = nextRandom(w.seed);
  w.seed = s;
  return r;
}
export function integer(w: WorldState, min: number, max: number) {
  return min + Math.floor(random(w) * (max - min + 1));
}
function pick<T>(w: WorldState, items: readonly T[]): T {
  return items[integer(w, 0, items.length - 1)];
}
export function news(w: WorldState, title: string, body: string) {
  w.news.unshift({ id: w.nextId++, year: w.year, title, body });
  w.news = w.news.slice(0, 100);
}
export function roster(w: WorldState, id = 0) {
  return w.players.filter((p) => p.team === id && p.market === "roster");
}
export function ability(p: Player) {
  return p.position === "投"
    ? p.skills.control * 0.32 +
        p.skills.stamina * 0.17 +
        (p.velocity - 110) * 0.6 +
        p.pitches.reduce((a, b) => a + b.level, 0) * 1.7
    : p.skills.contact * 0.28 +
        p.skills.power * 0.24 +
        p.skills.speed * 0.12 +
        p.skills.arm * 0.1 +
        p.skills.fielding * 0.16 +
        p.skills.catching * 0.1;
}
export function desiredSalary(p: Player) {
  const a = ability(p);
  return (
    Math.round(
      Math.max(
        500,
        900 +
          Math.max(0, a - 28) ** 2 * 7 +
          p.popularity * 22 +
          (p.reports[
            Object.keys(p.reports)
              .map(Number)
              .sort((a, b) => b - a)[0]
          ]?.hr ?? 0) *
            70,
      ) / 100,
    ) * 100
  );
}
function coach(w: WorldState, t: number, role: string) {
  return w.staff.find((s) => s.team === t && s.role === role);
}
export function payroll(w: WorldState, id = 0) {
  return (
    roster(w, id).reduce((n, p) => n + p.salary, 0) +
    w.staff.filter((s) => s.team === id).reduce((n, s) => n + s.salary, 0)
  );
}
export function operatingCost(w: WorldState, id = 0) {
  const f = w.teams[id].finance;
  return (
    payroll(w, id) +
    85000 +
    f.marketing * 6 +
    f.facilities.reduce((a, b) => a + b, 0) * 700
  );
}
export function post(
  w: WorldState,
  t: number,
  category: string,
  amount: number,
) {
  const f = w.teams[t].finance;
  f.cash += amount;
  const year = ["season", "cs", "series", "settlement"].includes(w.phase)
    ? w.year
    : w.year + 1;
  f.ledger.push({ year, phase: w.phase, category, amount });
}
export function spend(
  w: WorldState,
  t: number,
  category: string,
  amount: number,
) {
  const f = w.teams[t].finance;
  const reserve =
    t !== 0
      ? 0
      : ["review", "release", "staff", "draft"].includes(w.phase)
        ? 1600
        : w.phase === "autumn"
          ? category === "キャンプ"
            ? 800
            : 1600
          : [
                "release2",
                "fa",
                "tryout",
                "activeDraft",
                "contracts",
                "budget",
              ].includes(w.phase)
            ? 800
            : 0;
  const compensationReserve =
    t === 0
      ? w.compensations.reduce((n, c) => {
          const p = w.players.find((p) => p.id === c.player)!;
          return n + Math.round(p.salary * (p.faRank === "A" ? 0.3 : 0.2));
        }, 0)
      : 0;
  if (
    f.cash <
    amount +
      reserve +
      Math.max(0, compensationReserve - (category === "FA補償金" ? amount : 0))
  )
    throw Error(
      "資金が不足しています。必須キャンプ費を残して予算を見直してください。",
    );
  if (f.debt > 0 && ["設備投資", "契約金"].includes(category))
    throw Error(
      "再建融資の返済中は大型投資・契約金を伴う補強を制限しています。",
    );
  post(w, t, category, -amount);
}
export function newPlayer(
  w: WorldState,
  team: number | null,
  position: Player["position"],
  market: Player["market"] = "roster",
  species?: Player["species"],
): Player {
  const id = w.nextId++;
  const young = market === "draft";
  const age = young ? pick(w, [18, 18, 22, 22, 24]) : integer(w, 20, 38);
  const kind = species ?? "cat";
  const names =
    kind === "cat"
      ? [
          "ミケ",
          "クロ",
          "チャチャ",
          "モフ",
          "フク",
          "ルナ",
          "レオ",
          "ギン",
          "ハチ",
          "ソラ",
          "タマ",
          "ムギ",
          "ユズ",
          "アオ",
          "コハク",
          "リン",
        ]
      : [
          "シバ",
          "アキ",
          "コロ",
          "ハク",
          "ゴン",
          "ラブ",
          "プク",
          "ダイ",
          "ビス",
          "シェル",
          "チロ",
          "ポン",
          "ボル",
          "シオン",
          "ダル",
          "サム",
        ];
  const strength =
    team === 0
      ? 39
      : team !== null
        ? 45 + (team % 6) * 3
        : young
          ? integer(w, 31, 49)
          : integer(w, 35, 59);
  const skills = {} as Player["skills"];
  for (const k of [
    "contact",
    "power",
    "speed",
    "arm",
    "fielding",
    "catching",
    "control",
    "stamina",
  ] as Skill[])
    skills[k] = clamp(strength + integer(w, -18, 20));
  const p: Player = {
    id: `p${id}`,
    name: playerName(
      kind,
      integer(w, 0, names.length - 1) * 10 + integer(w, 0, 9) + id * 101,
      new Set(w.players.map((p) => p.name)),
    ),
    species: kind,
    breed: integer(w, 0, 19),
    age,
    pro: young ? 0 : Math.max(0, age - integer(w, 18, 24)),
    team,
    position,
    throws: random(w) < 0.25 ? "左" : "右",
    bats: random(w) < 0.35 ? "左" : "右",
    skills,
    velocity: clamp(
      119 + Math.round(strength * 0.5) + integer(w, -7, 8),
      120,
      163,
    ),
    trajectory: integer(w, 1, 4),
    pitches: [
      {
        name: pick(w, ["スライダー", "カーブ", "カットボール"]),
        level: integer(w, 1, 5),
      },
      {
        name: pick(w, ["フォーク", "チェンジアップ", "シンカー"]),
        level: integer(w, 1, 5),
      },
    ],
    potential: clamp(strength + integer(w, 12, 35)),
    peak: integer(w, 26, 33),
    durability: integer(w, 35, 95),
    fatigue: 0,
    injured: 0,
    morale: 60,
    popularity: integer(w, 10, 70),
    trait: pick(w, [
      "勝負強い",
      "長打職人",
      "選球眼",
      "韋駄天",
      "守備職人",
      "精密投球",
      "鉄腕",
      "ムードメーカー",
    ]),
    salary: 0,
    ask: 0,
    contractYear: w.year,
    market,
    registration: "senior",
    negotiation: "pending",
    meetingReason: "",
    incentive: 0,
    promise: "none",
    draftYear: young ? w.year + 1 : 0,
    formerTeam: null,
    faRank: "C",
    reports: {},
    growth: [],
    scouting: 0,
    preference: pick(w, ["優勝", "出場", "年俸"]),
    offerRound: 0,
    offers: [],
  };
  p.ask = desiredSalary(p);
  p.salary = young ? 600 : Math.round(p.ask * (team === 0 ? 1.25 : 1));
  w.players.push(p);
  return p;
}
function newStaff(w: WorldState, team: number | null, role: Staff["role"]) {
  const id = w.nextId++;
  const skill = () => integer(w, 25, 90);
  const s: Staff = {
    id: `s${id}`,
    name: `${pick(w, ["猫田", "犬山", "白井", "黒崎", "茶野", "灰原"])} ${pick(w, ["誠", "健", "修", "大介", "哲也", "光"])}${id}`,
    age: integer(w, 38, 67),
    role,
    team,
    salary: 0,
    ask: 0,
    contractYear: w.year,
    evaluation: skill(),
    tactics: skill(),
    teaching: skill(),
    youth: skill(),
    veterans: skill(),
    health: skill(),
    leadership: skill(),
    projection: skill(),
    policy: pick(w, ["バランス", "勝利優先", "若手育成"]),
    history: [],
  };
  s.ask =
    Math.round(
      ((s.teaching + s.tactics + s.youth + s.evaluation + s.health) * 4) / 100,
    ) * 100;
  s.salary = s.ask;
  w.staff.push(s);
  return s;
}

export function createWorld(seed = 20261026): WorldState {
  const w: WorldState = {
    version: 3,
    revision: 0,
    seed: seed || 1,
    nextId: 1,
    year: 2026,
    month: 10,
    phase: "review",
    teams: [],
    players: [],
    staff: [],
    schedule: [],
    news: [],
    archives: [],
    draftRound: 0,
    draftOrder: [],
    draftCursor: 0,
    draftPassed: [],
    campDone: false,
    finalists: [],
    champion: null,
    scoutsLeft: 8,
    milestones: [],
    explanation:
      "2026年、福岡の球団にヤスが就任。70人枠と来季予算をやりくりし、猫たちの未来をつくります。",
    seriesLog: [],
    draftLog: [],
    lottery: null,
    activeDraftDone: false,
    activeDraftPool: [],
    compensations: [],
    campPlan: emptyCampPlan(),
    preseasonDone: false,
    preseasonReport: [],
  };
  CLUBS.forEach(({ name, short, city, color, league }, id) => {
    w.teams.push({
      id,
      name,
      short,
      city,
      color,
      league,
      policy:
        id === 0 ? "若手育成" : pick(w, ["バランス", "勝利優先", "若手育成"]),
      wins: 0,
      losses: 0,
      draws: 0,
      scored: 0,
      conceded: 0,
      previousRank: id === 0 ? 6 : 6 - (id % 6),
      finance: {
        cash: id === 0 ? 280000 : 320000 + id * 6000,
        debt: 0,
        popularity: id === 0 ? 28 : 45 + (id % 6) * 6,
        capacity: id === 0 ? 40000 : 32000 + (id % 6) * 1500,
        ticket: 2600,
        marketing: 500,
        sponsor: 18000,
        sponsorKind: 0,
        facilities: [1, 1, 1, 1],
        ledger: [],
        budget: 0,
        lastProfit: 0,
        attendance: 0,
        salaryBudget: id === 0 ? 280000 : 500000,
      },
      titles: 0,
      roster: [],
      activeIds: [],
    });
    for (let i = 0; i < 72; i++) {
      const pos = i < 32 ? "投" : i < 38 ? "捕" : POSITIONS[2 + ((i - 38) % 7)];
      const p = newPlayer(
        w,
        id,
        pos,
        "roster",
        [0, 1, 38, 39, 40].includes(i) ? "dog" : "cat",
      );
      if (i >= 66) {
        p.registration = "development";
        p.salary = 300;
        p.ask = 300;
        p.age = integer(w, 18, 23);
        p.pro = 1;
      }
    }
    for (const role of STAFF_ROLES) newStaff(w, id, role);
    chooseActive(w, id);
  });
  // Generate internally consistent baseline records for the completed 2026 season.
  w.phase = "season";
  w.teams.forEach((t) => {
    t.finance.budget = operatingCost(w, t.id);
  });
  w.schedule = createSchedule();
  for (let month = 4; month <= 9; month++)
    simulateMonthMutable(w, month, false);
  w.teams.forEach((t) => {
    t.previousRank = standings(w, t.league).findIndex((x) => x.id === t.id) + 1;
    t.finance.cash = t.id === 0 ? 280000 : 320000 + t.id * 6000;
    t.finance.debt = 0;
  });
  seedCareerHistory(w);
  prepareOffseason(w);
  w.phase = "review";
  backfillCareerHistory(w);
  w.news = [];
  w.milestones = [];
  news(
    w,
    "ヤス、新オーナー就任",
    "福岡ソフトにゃんくホークスの再建を託されました。70人枠・年俸予算・補強方針を見直し、2027年の開幕へ。",
  );
  return w;
}
/** Pre-ownership history for NEW worlds only; never backfill an existing save. */
function seedCareerHistory(w: WorldState) {
  for (const year of [w.year - 2, w.year - 1]) {
    const past = structuredClone(w),
      gap = w.year - year;
    past.year = year;
    past.seed = (w.seed ^ (year * 100003)) >>> 0;
    past.schedule = createSchedule();
    past.players.forEach((p) => {
      p.reports = {};
      p.age -= gap;
      p.pro -= gap;
      p.injured = 0;
      p.fatigue = 0;
      p.morale = 60;
      if (p.pro < 1 || p.age < 18) p.market = "retired";
    });
    past.teams.forEach((t) => {
      t.wins = t.losses = t.draws = t.scored = t.conceded = 0;
      t.finance.ledger = [];
      t.finance.cash = 500000;
      t.finance.debt = 0;
      replenish(past, t.id);
      chooseActive(past, t.id);
      t.finance.budget = operatingCost(past, t.id);
    });
    for (let month = 4; month <= 9; month++)
      simulateMonthMutable(past, month, false);
    const records = new Map(past.players.map((p) => [p.id, p.reports[year]]));
    for (const p of w.players) {
      const report = records.get(p.id);
      if (p.pro > gap && p.age - gap >= 18 && report) p.reports[year] = report;
    }
  }
}
function prepareOffseason(w: WorldState) {
  const ranks = new Map(
    w.teams.map((t) => [
      t.id,
      standings(w, t.league).findIndex((x) => x.id === t.id) + 1,
    ]),
  );
  w.teams.forEach((t) => {
    t.previousRank = ranks.get(t.id)!;
  });
  resetOperations(w);
  w.month = 10;
  w.campDone = false;
  w.draftRound = 0;
  w.draftCursor = 0;
  w.draftPassed = [];
  w.scoutsLeft = w.year === 2026 ? 12 : 4;
  w.finalists = [];
  w.champion = null;
  w.seriesLog = [];
  w.players.forEach((p) => {
    if (p.market === "draft" && p.draftYear <= w.year) {
      p.market = "tryout";
      p.ask = 600;
    }
    p.offers = [];
    p.offerRound = 0;
    p.ask = desiredSalary(p);
    if (p.team !== null) {
      p.negotiation = p.contractYear > w.year ? "accepted" : "pending";
      p.incentive = p.contractYear > w.year ? p.incentive : 0;
      p.promise = p.contractYear > w.year ? p.promise : "none";
      if (p.age >= 39 && random(w) < 0.35) {
        p.market = "retired";
        news(
          w,
          `${p.name}が引退`,
          `${w.teams[p.team].short}での現役生活に幕。`,
        );
        p.team = null;
      }
    }
  });
  for (const t of w.teams) {
    if (t.id) {
      const list = seniorRoster(w, t.id).sort(
        (a, b) => ability(a) - a.age * 0.6 - (ability(b) - b.age * 0.6),
      );
      for (const p of list
        .filter((p) => p.contractYear <= w.year)
        .slice(0, Math.max(0, list.length - 64))) {
        p.team = null;
        p.market = "tryout";
      }
    }
  }
  for (
    let i = w.players.filter(
      (p) => p.market === "draft" && p.draftYear === w.year + 1,
    ).length;
    i < 144;
    i++
  )
    newPlayer(
      w,
      null,
      i % 3 === 0 ? "投" : POSITIONS[1 + (i % 8)],
      "draft",
      "cat",
    );
  for (let i = 0; i < 24; i++) {
    const p = newPlayer(
      w,
      null,
      i % 3 === 0 ? "投" : POSITIONS[1 + (i % 8)],
      "tryout",
      "cat",
    );
    p.age = integer(w, 29, 37);
    p.pro = Math.min(p.pro, p.age - 18);
    p.peak = 28;
    p.ask = 600 + (i % 3) * 300;
    if (i % 3 === 0) {
      p.skills.control = 78;
      p.trait = "左キラー";
    } else if (i % 3 === 1) {
      p.skills.speed = 88;
      p.skills.contact = 30;
      p.trait = "代走の切り札";
    } else {
      p.skills.fielding = 82;
      p.skills.catching = 80;
      p.trait = "守備職人";
    }
  }
  for (const p of w.players) {
    if (p.market === "tryout" && p.age >= 39) p.market = "retired";
  }
  w.staff.forEach((s) => {
    s.ask = Math.round((s.salary * (0.97 + random(w) * 0.12)) / 100) * 100;
  });
  for (const role of STAFF_ROLES)
    for (let i = 0; i < 3; i++) newStaff(w, null, role);
}
export function standings(w: WorldState, league: Team["league"]) {
  return w.teams
    .filter((t) => t.league === league)
    .sort(
      (a, b) =>
        b.wins / Math.max(1, b.wins + b.losses) -
          a.wins / Math.max(1, a.wins + a.losses) ||
        b.wins - a.wins ||
        headToHead(w, b.id, a.id) - headToHead(w, a.id, b.id) ||
        a.previousRank - b.previousRank,
    );
}
function headToHead(w: WorldState, a: number, b: number) {
  return w.schedule.filter(
    (f) => f.played && f.winner === a && (f.home === b || f.away === b),
  ).length;
}
export function createSchedule(): Fixture[] {
  const rounds: { home: number; away: number }[][] = [];
  const circle = (ids: number[]) => {
    let a = [...ids];
    const result: { home: number; away: number }[][] = [];
    for (let r = 0; r < ids.length - 1; r++) {
      const games = [];
      for (let i = 0; i < a.length / 2; i++)
        games.push({ home: a[i], away: a[a.length - 1 - i] });
      result.push(games);
      a = [a[0], a[a.length - 1], ...a.slice(1, -1)];
    }
    return result;
  };
  const cats = circle([0, 1, 2, 3, 4, 5]);
  const dogs = circle([6, 7, 8, 9, 10, 11]);
  for (let repeat = 0; repeat < 25; repeat++)
    for (let r = 0; r < 5; r++)
      rounds.push(
        [...cats[r], ...dogs[r]].map((g) =>
          repeat % 2 ? { home: g.away, away: g.home } : g,
        ),
      );
  const inter = [];
  for (let shift = 0; shift < 6; shift++)
    for (let repeat = 0; repeat < 3; repeat++)
      inter.push(
        Array.from({ length: 6 }, (_, id) =>
          repeat % 2
            ? { home: 6 + ((id + shift) % 6), away: id }
            : { home: id, away: 6 + ((id + shift) % 6) },
        ),
      );
  rounds.splice(48, 0, ...inter);
  return rounds.flatMap((games, index) =>
    games.map((g) => ({
      ...g,
      month: 4 + Math.min(5, Math.floor((index * 6) / 143)),
      played: false,
    })),
  );
}
function record(p: Player, w: WorldState) {
  return (
    p.reports[w.year] ?? (p.reports[w.year] = blankRecord(w.year, p.team ?? -1))
  );
}
function lineup(w: WorldState, team: number) {
  const t = w.teams[team];
  const manager = coach(w, team, "監督");
  const registered = seniorRoster(w, team);
  const ids = w.teams[team].activeIds;
  const active = registered.filter((p) => ids.includes(p.id) && !p.injured);
  // Injuries are delegated to the manager: replacements keep the four-foreigner limit.
  const list = [...active];
  const reserves = registered
    .filter((p) => !list.includes(p) && !p.injured)
    .sort((a, b) => ability(b) - ability(a));
  const addReserve = (p: Player | undefined) => {
    if (
      p &&
      !list.includes(p) &&
      list.length < 31 &&
      (p.species !== "dog" ||
        list.filter((p) => p.species === "dog").length < 4)
    )
      list.push(p);
  };
  for (const pos of POSITIONS.slice(1)) {
    const needed = pos === "捕" ? 2 : 1;
    for (const p of reserves.filter(
      (p) => p.position === pos && p.species === "cat",
    )) {
      if (list.filter((p) => p.position === pos).length >= needed) break;
      addReserve(p);
    }
  }
  for (const p of reserves.filter(
    (p) => p.position !== "投" && p.species === "cat",
  )) {
    if (list.filter((p) => p.position !== "投").length >= 9) break;
    addReserve(p);
  }
  for (const p of registered
    .filter((p) => !ids.includes(p.id) && !p.injured)
    .sort((a, b) => ability(b) - ability(a))) {
    if (list.length >= 31) break;
    if (
      p.species === "dog" &&
      list.filter((p) => p.species === "dog").length >= 4
    )
      continue;
    list.push(p);
  }
  const score = (p: Player) =>
    ability(p) +
    (p.promise !== "none" ? 10 : 0) +
    (t.policy === "若手育成" ? Math.max(0, 28 - p.age) * 1.6 : 0) -
    p.fatigue * 0.12 -
    (p.injured ? 80 : 0) +
    (100 - (manager?.evaluation ?? 50)) *
      ((Number(p.id.slice(1)) % 7) - 3) *
      0.08;
  const batters: Player[] = [];
  for (const pos of POSITIONS.slice(1)) {
    const p =
      list
        .filter((p) => p.position === pos && !batters.includes(p))
        .sort((a, b) => score(b) - score(a))[0] ??
      list
        .filter((p) => p.position !== "投" && !batters.includes(p))
        .sort((a, b) => score(b) - score(a))[0];
    if (p) batters.push(p);
  }
  const dh = list
    .filter((p) => p.position !== "投" && !batters.includes(p))
    .sort((a, b) => score(b) - score(a))[0];
  if (dh) batters.push(dh);
  const arms = list
    .filter((p) => p.position === "投")
    .sort((a, b) => score(b) - score(a));
  return {
    batters: batters.sort(
      (a, b) =>
        Number(b.promise === "order") - Number(a.promise === "order") ||
        b.skills.contact - a.skills.contact,
    ),
    arms,
  };
}
export function validateRoster(w: WorldState, id = 0) {
  const list = seniorRoster(w, id);
  if (list.length < 28 || list.length > SENIOR_LIMIT)
    return "支配下は28〜70選手で編成してください。";
  if (list.filter((p) => p.position === "投").length < 10)
    return "投手が最低10名必要です。";
  if (list.filter((p) => p.position === "捕").length < 2)
    return "捕手が最低2名必要です。";
  for (const pos of POSITIONS.slice(2))
    if (!list.some((p) => p.position === pos))
      return `${pos}の守備位置を担当できる選手が必要です。`;
  return null;
}
function replenish(w: WorldState, id: number) {
  let guard = 0;
  while (validateRoster(w, id) && guard++ < 40) {
    const list = seniorRoster(w, id);
    const pos =
      list.filter((p) => p.position === "投").length < 10
        ? "投"
        : list.filter((p) => p.position === "捕").length < 2
          ? "捕"
          : (POSITIONS.slice(2).find(
              (pos) => !list.some((p) => p.position === pos),
            ) ??
            (list.filter((p) => p.position === "投").length < 16
              ? "投"
              : pick(w, POSITIONS.slice(1))));
    const p =
      w.players
        .filter((p) => p.market === "tryout" && p.position === pos)
        .sort((a, b) => ability(b) - ability(a))[0] ??
      newPlayer(w, null, pos, "tryout", "cat");
    p.team = id;
    p.market = "roster";
    p.salary = p.ask;
    p.contractYear = w.year + 1;
  }
}

function game(
  w: WorldState,
  home: number,
  away: number,
  postseason = false,
): { home: number; away: number; winner: number | null } {
  const clubs = [away, home];
  const lines = clubs.map((id) => lineup(w, id));
  if (lines.some((l) => l.batters.length < 9 || !l.arms.length))
    throw Error("試合に必要な選手が不足しています。");
  const scores = [0, 0];
  const batting = [0, 0];
  const totalOuts = [0, 0];
  const participants = new Set<string>();
  const winners: Player[][] = [[], []];
  const pitchers = lines.map(
    (l) =>
      l.arms[
        Math.floor(
          w.schedule.filter(
            (f) =>
              f.played &&
              (f.home === l.arms[0].team || f.away === l.arms[0].team),
          ).length / 1,
        ) % Math.min(6, l.arms.length)
      ],
  );
  for (let side = 0; side < 2; side++) {
    const p = pitchers[side];
    if (!postseason) {
      record(p, w).starts++;
      participants.add(p.id);
    }
    winners[side].push(p);
  }
  const fieldErrors = [0, 0];
  for (
    let inning = 1;
    inning <= 12 || (postseason && scores[0] === scores[1]);
    inning++
  ) {
    for (let side = 0; side < 2; side++) {
      if (inning >= 9 && side === 1 && scores[1] > scores[0]) break;
      const def = 1 - side;
      const bases: (Player | null)[] = [null, null, null];
      let outs = 0;
      let appearances = 0;
      while (outs < 3) {
        const batter = lines[side].batters[batting[side]++ % 9];
        let pitcher = pitchers[def];
        if (
          totalOuts[side] >= Math.round(12 + pitcher.skills.stamina * 0.12) &&
          winners[def].length === 1
        ) {
          pitcher = lines[def].arms[6] ?? pitcher;
          pitchers[def] = pitcher;
          winners[def].push(pitcher);
        }
        if (
          totalOuts[side] >= 24 &&
          winners[def].length === 2 &&
          lines[def].arms[7]
        ) {
          const setup = pitcher;
          pitcher = lines[def].arms[7];
          pitchers[def] = pitcher;
          winners[def].push(pitcher);
          if (
            !postseason &&
            scores[def] > scores[side] &&
            scores[def] - scores[side] <= 3
          )
            record(setup, w).holds++;
        }
        participants.add(batter.id);
        participants.add(pitcher.id);
        const br = record(batter, w),
          pr = record(pitcher, w);
        const defense =
          lines[def].batters.reduce(
            (n, p) => n + p.skills.fielding + p.skills.catching,
            0,
          ) / 18;
        const management =
          ((coach(w, clubs[side], "監督")?.tactics ?? 50) -
            (coach(w, clubs[def], "監督")?.tactics ?? 50)) *
          0.00035;
        const fatigue = clamp(1 - pitcher.fatigue * 0.002, 0.75, 1);
        const pitching =
          (pitcher.skills.control * 0.45 +
            (pitcher.velocity - 110) * 0.6 +
            pitcher.pitches.reduce((n, p) => n + p.level, 0) * 2 +
            (pitcher.trait === "左キラー" && batter.bats === "左" ? 8 : 0)) *
          fatigue;
        const hit = clamp(
          0.235 +
            (batter.skills.contact - pitching) * 0.002 +
            (batter.morale - 50) * 0.0002 +
            (batter.trait === "勝負強い" && bases.some(Boolean) ? 0.015 : 0) +
            (batter.trait === "左キラー" && pitcher.throws === "左"
              ? 0.025
              : 0) +
            management,
          0.12,
          0.42,
        );
        const walk = clamp(
          0.09 +
            (50 - pitcher.skills.control) * 0.001 +
            (batter.trait === "選球眼" ? 0.018 : 0),
          0.025,
          0.17,
        );
        const hr = clamp(
          0.008 +
            batter.skills.power * 0.00035 +
            (batter.trajectory - 2) * 0.005 +
            (batter.trait === "長打職人" ? 0.008 : 0),
          0.004,
          0.07,
        );
        let roll = random(w);
        let outcome = "out";
        let advance = 0;
        if (++appearances > 60) roll = 0.999;
        if (roll < walk) outcome = "walk";
        else if (roll < walk + hit) {
          outcome = "hit";
          advance =
            roll < walk + hr
              ? 4
              : roll < walk + hr + 0.045
                ? 2
                : roll < walk + hr + 0.05
                  ? 3
                  : 1;
        } else if (
          roll <
          walk + hit + clamp((100 - defense) * 0.0003, 0.003, 0.025)
        )
          outcome = "error";
        if (!postseason) br.pa++;
        const score = (runner: Player, rbi: boolean) => {
          scores[side]++;
          if (!postseason) {
            record(runner, w).runs++;
            pr.allowed++;
            if (outcome !== "error" && fieldErrors[side] === 0) pr.earned++;
            if (rbi) br.rbi++;
          }
        };
        if (outcome === "out") {
          outs++;
          totalOuts[side]++;
          if (!postseason) {
            br.ab++;
            pr.outs++;
            if (
              random(w) <
              clamp(0.25 + (pitcher.velocity - 140) * 0.008, 0.1, 0.5)
            )
              pr.k++;
          }
        } else if (outcome === "walk" || outcome === "error") {
          if (!postseason) {
            if (outcome === "walk") {
              br.walks++;
              pr.bb++;
            } else {
              br.ab++;
              record(lines[def].batters[integer(w, 0, 7)], w).errors++;
              fieldErrors[side]++;
            }
          }
          if (bases[0]) {
            if (bases[1]) {
              if (bases[2]) score(bases[2], outcome === "walk");
              bases[2] = bases[1];
            }
            bases[1] = bases[0];
          }
          bases[0] = batter;
        } else {
          if (!postseason) {
            br.ab++;
            br.hits++;
            if (advance === 4) br.hr++;
            if (advance === 2) br.doubles++;
            if (advance === 3) br.triples++;
          }
          for (let i = 2; i >= 0; i--) {
            const runner = bases[i];
            if (!runner) continue;
            bases[i] = null;
            if (i + advance >= 3) score(runner, true);
            else bases[i + advance] = runner;
          }
          if (advance === 4) score(batter, true);
          else bases[advance - 1] = batter;
          if (
            advance === 1 &&
            bases[0] &&
            !bases[1] &&
            batter.skills.speed > 60 &&
            random(w) < 0.12
          ) {
            bases[1] = bases[0];
            bases[0] = null;
            if (!postseason) br.steals++;
          }
        }
        if (inning >= 9 && side === 1 && scores[1] > scores[0]) break;
      }
      fieldErrors[side] = 0;
    }
    if (inning >= 9 && scores[0] !== scores[1]) break;
  }
  const winSide =
    scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  if (!postseason) {
    for (const id of participants) {
      const p = w.players.find((p) => p.id === id)!;
      record(p, w).games++;
      p.fatigue = clamp(p.fatigue + (p.position === "投" ? 20 : 3), 0, 100);
    }
    for (let s = 0; s < 2; s++) {
      const t = w.teams[clubs[s]];
      t.scored += scores[s];
      t.conceded += scores[1 - s];
      if (winSide === null) t.draws++;
      else if (s === winSide) t.wins++;
      else t.losses++;
      if (winSide !== null) {
        const p = winners[s][0];
        if (s === winSide) {
          record(p, w).wins++;
          const relief = winners[s].length > 1 ? winners[s].at(-1) : undefined;
          if (relief && scores[s] - scores[1 - s] <= 3)
            record(relief, w).saves++;
        } else record(p, w).losses++;
      }
    }
    for (const p of [...roster(w, home), ...roster(w, away)]) {
      p.fatigue = Math.max(0, p.fatigue - 4);
      if (p.injured) p.injured--;
      else if (
        random(w) <
        (100 - p.durability) *
          0.000012 *
          (1.2 - (coach(w, p.team!, "育成コーチ")?.health ?? 50) / 200) *
          (1.1 - w.teams[p.team!].finance.facilities[1] * 0.1)
      )
        p.injured = integer(w, 3, 18);
    }
  }
  return {
    home: scores[1],
    away: scores[0],
    winner: winSide === null ? null : clubs[winSide],
  };
}

function simulateMonthMutable(w: WorldState, month: number, report = true) {
  w.month = month;
  const before = new Map(
    w.players.map((p) => [
      p.id,
      { ...(p.reports[w.year] ?? blankRecord(w.year, p.team ?? -1)) },
    ]),
  );
  for (const f of w.schedule.filter((f) => f.month === month && !f.played)) {
    const result = game(w, f.home, f.away);
    Object.assign(f, {
      played: true,
      hs: result.home,
      as: result.away,
      winner: result.winner ?? undefined,
    });
    const t = w.teams[f.home],
      fin = t.finance;
    const winRate = t.wins / Math.max(1, t.wins + t.losses);
    const stars =
      seniorRoster(w, t.id).reduce((n, p) => n + p.popularity, 0) /
      Math.max(1, seniorRoster(w, t.id).length);
    const demand = clamp(
      0.22 +
        fin.popularity * 0.005 +
        winRate * 0.25 +
        stars * 0.002 +
        fin.marketing * 0.000035 -
        (fin.ticket - 2400) * 0.00012,
      0.12,
      0.98,
    );
    const attendance = Math.floor(fin.capacity * demand);
    fin.attendance += attendance;
    post(w, t.id, "入場料", Math.round((attendance * fin.ticket) / 10000));
    post(
      w,
      t.id,
      "グッズ・飲食",
      Math.round((attendance * (600 + stars * 5)) / 10000),
    );
  }
  for (const t of w.teams) {
    const f = t.finance;
    post(w, t.id, "選手・スタッフ年俸", -Math.round(payroll(w, t.id) / 6));
    post(
      w,
      t.id,
      "運営・設備維持",
      -Math.round((85000 + f.facilities.reduce((a, b) => a + b, 0) * 700) / 6),
    );
    post(w, t.id, "販促", -f.marketing);
    post(w, t.id, "放映・分配金", 5000);
    post(w, t.id, "スポンサー", Math.round(f.sponsor / 6));
    if (month === 9)
      for (const p of roster(w, t.id).filter((p) => p.incentive > 0)) {
        const r = record(p, w);
        if (
          p.position === "投"
            ? r.wins >= 8 || r.saves >= 15
            : r.hr >= 15 || r.hits >= 100
        )
          post(w, t.id, "出来高報酬", -p.incentive);
      }
    f.popularity = clamp(
      f.popularity +
        (t.wins / (t.wins + t.losses || 1) - 0.5) * 4 +
        f.marketing / 2000,
    );
    if (f.cash < 0) {
      const loan = 20000 - f.cash;
      post(w, t.id, "再建融資", loan);
      f.debt += loan;
      if (report && t.id === 0)
        news(
          w,
          "再建融資を受けました",
          "補強と設備投資を制限し、将来の黒字から返済します。",
        );
    }
    for (const p of roster(w, t.id)) {
      const trainer = coach(w, t.id, "育成コーチ");
      const manager = coach(w, t.id, "監督");
      p.morale = clamp(
        p.morale +
          ((manager?.leadership ?? 50) - 45) / 20 +
          (t.policy === manager?.policy ? 1 : -0.5),
      );
      const experience = Math.min(
        1,
        (record(p, w).games - (before.get(p.id)?.games ?? 0)) / 15,
      );
      if (
        p.promise !== "none" &&
        record(p, w).games - (before.get(p.id)?.games ?? 0) < 6
      )
        p.morale = Math.max(1, p.morale - 8);
      if (
        p.age < p.peak &&
        random(w) <
          ((trainer?.youth ?? 50) / 180) *
            (0.6 + experience * 0.6) *
            (1 + f.facilities[0] * 0.07)
      ) {
        const key = pick(w, Object.keys(p.skills) as Skill[]);
        if (p.skills[key] < p.potential) p.skills[key]++;
        p.growth = [
          `${w.year}年${month}月：${key} 成長（育成方針・指導）`,
          ...p.growth,
        ].slice(0, 8);
      }
    }
  }
  if (report) {
    const awards: string[] = [];
    for (const league of ["パ", "セ"] as const) {
      const list = w.players.filter(
        (p) => p.team !== null && w.teams[p.team].league === league,
      );
      for (const pitching of [false, true]) {
        const best = list
          .filter((p) => (p.position === "投") === pitching)
          .sort((a, b) => monthValue(b) - monthValue(a))[0];
        if (best) {
          best.popularity = clamp(best.popularity + 5);
          awards.push(`${league}・${pitching ? "投手" : "野手"} ${best.name}`);
        }
      }
    }
    news(w, `${month}月 月間MVP`, awards.join(" ／ "));
    if (month === 7) {
      const stars = (["パ", "セ"] as const).map((l) =>
        w.players
          .filter((p) => p.team !== null && w.teams[p.team].league === l)
          .sort((a, b) => seasonValue(b, w) - seasonValue(a, w))
          .slice(0, 9),
      );
      const winner = random(w) < 0.5 ? "パ" : "セ";
      stars.flat().forEach((p) => (p.popularity = clamp(p.popularity + 8)));
      news(
        w,
        "オールスター開催",
        `${winner}・リーグ勝利！ 選出：${stars
          .flat()
          .map((p) => p.name)
          .join("、")}`,
      );
      w.teams.forEach((t) => post(w, t.id, "オールスター分配", 1000));
    }
    news(
      w,
      `${month}月 営業・戦況報告`,
      `${w.teams[0].wins}勝${w.teams[0].losses}敗。手元資金 ${money(w.teams[0].finance.cash)}。勝敗・人気・価格設定が動員に反映されています。`,
    );
  }
  function monthValue(p: Player) {
    const a = record(p, w),
      b = before.get(p.id) ?? blankRecord(w.year, -1);
    return p.position === "投"
      ? (a.wins - b.wins) * 8 +
          (a.k - b.k) * 0.3 -
          (a.earned - b.earned) * 0.6 +
          (a.outs - b.outs) * 0.1
      : a.hits - b.hits + (a.hr - b.hr) * 3 + (a.rbi - b.rbi) * 0.5;
  }
}
function seasonValue(p: Player, w: WorldState) {
  const r = record(p, w);
  return p.position === "投"
    ? r.wins * 8 + r.k * 0.3 - r.earned * 0.6 + r.outs * 0.1
    : r.hits + r.hr * 3 + r.rbi * 0.5;
}
export function simulateMonth(initial: WorldState): WorldState {
  const w = structuredClone(initial);
  if (w.phase !== "season") throw Error("ペナント期間ではありません。");
  simulateMonthMutable(w, w.month);
  if (w.month === 9) {
    prepareOffseason(w);
    w.phase = "review";
  } else w.month++;
  w.revision++;
  return w;
}
export function simulateRemainingSeason(initial: WorldState): WorldState {
  if (initial.phase !== "season") throw Error("シーズン期間ではありません。");
  let w = initial;
  while (w.phase === "season") w = simulateMonth(w);
  return w;
}
function series(
  w: WorldState,
  a: number,
  b: number,
  target: number,
  advantage = 0,
) {
  let aw = advantage,
    bw = 0;
  while (aw < target && bw < target) {
    const depleted = !!validateRoster(w, a) || !!validateRoster(w, b);
    const chance =
      0.5 +
      (w.teams[a].wins / Math.max(1, w.teams[a].wins + w.teams[a].losses) -
        w.teams[b].wins / Math.max(1, w.teams[b].wins + w.teams[b].losses)) *
        0.65;
    const r = depleted
      ? { winner: random(w) < chance ? a : b }
      : game(w, a, b, true);
    if (r.winner === a) aw++;
    else bw++;
  }
  w.seriesLog.push(`${w.teams[a].short} ${aw}－${bw} ${w.teams[b].short}`);
  return aw >= target ? a : b;
}
function archive(w: WorldState) {
  const champion = w.champion ?? standings(w, "パ")[0].id;
  const awards = (["パ", "セ"] as const).flatMap((l) => {
    const ps = w.players.filter(
      (p) =>
        p.team !== null &&
        w.teams[p.team].league === l &&
        p.reports[w.year]?.source !== "backfill",
    );
    return ["MVP", "最多本塁打", "最優秀防御率"].map((title) => {
      const list = ps
        .filter((p) =>
          title === "最多本塁打"
            ? p.position !== "投"
            : title === "最優秀防御率"
              ? record(p, w).outs >= 429
              : true,
        )
        .sort((a, b) =>
          title === "最多本塁打"
            ? record(b, w).hr - record(a, w).hr
            : title === "最優秀防御率"
              ? record(a, w).earned / Math.max(1, record(a, w).outs) -
                record(b, w).earned / Math.max(1, record(b, w).outs)
              : seasonValue(b, w) - seasonValue(a, w),
        );
      return `${l} ${title}：${list[0]?.name ?? "該当なし"}`;
    });
  });
  w.archives.push({
    year: w.year,
    standings: w.teams.map((t) => ({
      id: t.id,
      wins: t.wins,
      losses: t.losses,
      draws: t.draws,
      scored: t.scored,
      conceded: t.conceded,
    })),
    champion,
    leagueWinners: [standings(w, "パ")[0].id, standings(w, "セ")[0].id],
    finances: w.teams.map((t) => {
      const rows = t.finance.ledger.filter(
        (r) =>
          r.year === w.year && !["再建融資", "融資返済"].includes(r.category),
      );
      const income = rows
          .filter((r) => r.amount > 0)
          .reduce((n, r) => n + r.amount, 0),
        expense = -rows
          .filter((r) => r.amount < 0)
          .reduce((n, r) => n + r.amount, 0);
      t.finance.lastProfit = income - expense;
      return {
        team: t.id,
        income,
        expense,
        profit: income - expense,
        fans: Math.round(t.finance.popularity),
        attendance: t.finance.attendance,
        budget: t.finance.budget,
        payroll: payroll(w, t.id),
      };
    }),
    awards,
  });
  news(w, `${w.year}年 年間表彰`, awards.join(" ／ "));
  for (const t of w.teams) {
    if (t.finance.cash < 0) {
      const loan = 20000 - t.finance.cash;
      post(w, t.id, "再建融資", loan);
      t.finance.debt += loan;
    }
    if (t.finance.debt > 0 && t.finance.lastProfit > 0) {
      const pay = Math.min(
        t.finance.debt,
        t.finance.lastProfit * 0.5,
        t.finance.cash * 0.5,
      );
      post(w, t.id, "融資返済", -pay);
      t.finance.debt -= pay;
    }
  }
  const rank = standings(w, "パ").findIndex((t) => t.id === 0) + 1;
  const goals = [
    w.teams[0].finance.lastProfit > 0 ? "黒字化" : "",
    rank <= 3 ? "CS進出" : "",
    rank === 1 ? "リーグ優勝" : "",
    champion === 0 ? "日本一" : "",
  ];
  w.milestones = [...new Set([...w.milestones, ...goals.filter(Boolean)])];
}

function draftOrder(w: WorldState, round: number) {
  if (round === 0) return [0, ...w.teams.slice(1).map((t) => t.id)];
  const order = [...w.teams]
    .sort((a, b) => b.previousRank - a.previousRank || a.id - b.id)
    .map((t) => t.id);
  return round === 0 || round % 2 === 1 ? order : order.reverse();
}
export function acquire(
  w: WorldState,
  p: Player,
  id: number,
  salary: number,
  bonus = 0,
) {
  if (seniorRoster(w, id).length >= SENIOR_LIMIT)
    throw Error(
      "支配下70人枠が満員です。戦力外・育成打診で空きを作ってください。",
    );
  if (bonus) spend(w, id, "契約金", bonus);
  p.team = id;
  p.market = "roster";
  p.registration = "senior";
  p.negotiation = "accepted";
  p.salary = salary;
  p.contractYear = w.year + 1;
  p.offers = [];
  p.morale = 65;
}
function cpuPick(w: WorldState, id: number) {
  if (w.draftPicked?.includes(id)) return;
  if (w.draftPassed.includes(id) || seniorRoster(w, id).length >= SENIOR_LIMIT)
    return;
  const list = roster(w, id);
  const positionalPower = (pos: Player["position"]) => {
    const top = list
      .filter((p) => p.position === pos)
      .sort((a, b) => ability(b) - ability(a))
      .slice(0, pos === "投" ? 6 : 2);
    return (
      top.reduce((n, p) => n + ability(p) - Math.max(0, p.age - 30) * 0.7, 0) /
      Math.max(1, top.length)
    );
  };
  const needed =
    POSITIONS.find((pos) => !list.some((p) => p.position === pos)) ??
    [...POSITIONS].sort((a, b) => positionalPower(a) - positionalPower(b))[0];
  const p = w.players
    .filter((p) => p.market === "draft")
    .sort(
      (a, b) =>
        ability(b) +
        (b.position === needed ? 30 : 0) -
        (ability(a) + (a.position === needed ? 30 : 0)),
    )[0];
  if (p && w.teams[id].finance.cash >= 1000 && w.teams[id].finance.debt === 0) {
    acquire(w, p, id, 600, 1000);
    w.draftLog.push({ team: id, player: p.id, round: w.draftRound + 1 });
    (w.draftPicked ??= []).push(id);
  }
}
function advanceDraftCpu(w: WorldState) {
  while (w.draftRound < 6) {
    if (!w.draftOrder.length) {
      w.draftOrder = draftOrder(w, w.draftRound);
      w.draftCursor = 0;
      w.draftPicked = [];
    }
    while (w.draftCursor < 12) {
      const id = w.draftOrder[w.draftCursor];
      if (
        id === 0 &&
        !w.draftPassed.includes(0) &&
        seniorRoster(w).length < SENIOR_LIMIT
      )
        return;
      if (id !== 0) cpuPick(w, id);
      w.draftCursor++;
    }
    w.draftRound++;
    w.draftOrder = [];
  }
  news(
    w,
    "ドラフト終了",
    "新人の入団が決まりました。秋季キャンプで成長を確かめましょう。",
  );
  for (const p of w.players.filter(
    (p) => p.market === "draft" && p.draftYear === w.year + 1,
  )) {
    p.market = "tryout";
    p.ask = 600;
  }
}
function nextYear(w: WorldState) {
  const ranks = new Map(
    w.teams.map((t) => [
      t.id,
      standings(w, t.league).findIndex((x) => x.id === t.id) + 1,
    ]),
  );
  for (const t of w.teams) {
    t.previousRank = ranks.get(t.id)!;
    t.wins = 0;
    t.losses = 0;
    t.draws = 0;
    t.scored = 0;
    t.conceded = 0;
    t.finance.ledger = t.finance.ledger.filter((r) => r.year >= w.year - 1);
    t.finance.attendance = 0;
  }
  for (const p of w.players) {
    if (p.market === "retired") continue;
    p.age++;
    if (p.team !== null) p.pro++;
    p.fatigue = Math.min(30, p.fatigue);
    p.injured = 0;
    if (p.age > p.peak) {
      const decay = Math.min(5, 1 + Math.floor((p.age - p.peak) / 3));
      for (const k of Object.keys(p.skills) as Skill[])
        p.skills[k] = clamp(p.skills[k] - decay);
      p.velocity = Math.max(120, p.velocity - 1);
      p.growth = [
        `${w.year + 1}年：加齢による能力低下 −${decay}`,
        ...p.growth,
      ].slice(0, 8);
    }
  }
  for (const s of w.staff) {
    s.age++;
    if (s.age > 75 && s.contractYear < w.year + 1) {
      s.team = null;
    }
  }
  w.staff = w.staff.filter((s) => s.age <= 75 || s.team !== null);
  w.year++;
  w.schedule = createSchedule();
  w.month = 4;
  w.phase = "season";
  w.scoutsLeft = 18;
  for (let i = 0; i < 144; i++)
    newPlayer(
      w,
      null,
      i % 3 === 0 ? "投" : POSITIONS[1 + (i % 8)],
      "draft",
      "cat",
    );
  w.teams.slice(1).forEach((t) => chooseActive(w, t.id));
  w.teams.forEach((t) => {
    t.finance.budget = operatingCost(w, t.id);
  });
  news(
    w,
    `${w.year}年 開幕`,
    `${w.teams[0].policy}の方針で143試合に挑みます。起用と試合運営は監督に委任されています。`,
  );
}

export function applyOwnerAction(
  initial: WorldState,
  action: OwnerAction,
): WorldState {
  const w = structuredClone(initial);
  if (
    "value" in action &&
    typeof action.value === "number" &&
    !Number.isFinite(action.value)
  )
    throw Error("設定値は有限の数値で指定してください。");
  const t = w.teams[0];
  const f = t.finance;
  const targetYear = w.year + 1;
  const player = (id: string) => {
    const p = w.players.find((p) => p.id === id);
    if (!p) throw Error("選手が見つかりません。");
    return p;
  };
  const requirePhase = (phases: Phase[]) => {
    if (!phases.includes(w.phase))
      throw Error("現在の期間ではこの操作はできません。");
  };
  if (handleOperation(w, action)) {
    w.revision++;
    return w;
  }
  switch (action.type) {
    case "release": {
      requirePhase(["release", "release2"]);
      const p = player(action.id);
      if (p.team !== 0) throw Error("自球団の選手ではありません。");
      if (p.contractYear > w.year)
        throw Error("来季以降の契約が残る選手は戦力外通告できません。");
      const previousPopularity = f.popularity;
      p.releaseNotice = {
        year: w.year,
        phase: w.phase as "release" | "release2",
        market: p.market,
        popularityLoss: 0,
      };
      p.team = null;
      p.market = "tryout";
      f.popularity = clamp(f.popularity - p.popularity * 0.025);
      p.releaseNotice.popularityLoss = previousPopularity - f.popularity;
      news(
        w,
        `${p.name}に戦力外通告`,
        `${money(p.salary)}の年俸枠を整理しました。人気選手の退団はファン評価にも影響します。`,
      );
      break;
    }
    case "cancelRelease": {
      requirePhase(["release", "release2"]);
      const p = player(action.id),
        notice = p.releaseNotice;
      if (
        !notice ||
        notice.year !== w.year ||
        notice.phase !== w.phase ||
        p.team !== null ||
        p.market !== "tryout"
      )
        throw Error(
          "この戦力外通告は取り消せません。通告した期間内にキャンセルしてください。",
        );
      if (p.registration === "senior" && seniorRoster(w).length >= SENIOR_LIMIT)
        throw Error(
          "支配下枠が満員のためキャンセルできません。枠を空けてください。",
        );
      p.team = 0;
      p.market = notice.market;
      f.popularity = clamp(f.popularity + notice.popularityLoss);
      delete p.releaseNotice;
      news(
        w,
        `${p.name}の戦力外通告をキャンセル`,
        "所属・支配下枠・ファン評価を復元しました。選手の成績と契約は変更しません。",
      );
      break;
    }
    case "hire": {
      requirePhase(["staff", "budget"]);
      const s = w.staff.find((s) => s.id === action.id);
      if (!s || (s.team !== null && s.team !== 0))
        throw Error("契約できないスタッフです。");
      if (s.contractYear >= targetYear)
        throw Error("今年度の契約は確定済みです。");
      const old = coach(w, 0, s.role);
      if (old && old.id !== s.id) {
        if (old.contractYear === targetYear)
          throw Error("この役職は来季契約済みです。");
        old.team = null;
      }
      s.team = 0;
      s.salary = s.ask;
      s.contractYear = targetYear;
      news(
        w,
        `${s.role}：${s.name}と契約`,
        `${money(s.salary)}／年。得意分野は今後の起用と育成へ反映されます。`,
      );
      break;
    }
    case "draft": {
      requirePhase(["draft"]);
      const p = player(action.id);
      if (p.market !== "draft" || w.draftRound >= 6)
        throw Error("指名できない候補です。");
      if (seniorRoster(w).length >= SENIOR_LIMIT)
        throw Error("支配下70人枠に空きがありません。");
      if (f.cash < 1000 || f.debt)
        throw Error("契約金の予算が不足しています。");
      if (w.draftRound === 0) {
        const rivals = w.teams
          .slice(1)
          .filter(
            (x) =>
              seniorRoster(w, x.id).length < SENIOR_LIMIT &&
              !w.draftPicked?.includes(x.id) &&
              x.finance.cash >= 1000 &&
              !x.finance.debt &&
              random(w) < clamp((ability(p) - 45) / 100, 0.05, 0.3),
          );
        const winner = pick(w, [0, ...rivals.map((x) => x.id)]);
        w.lottery = { player: p.id, rivals: rivals.map((x) => x.id), winner };
        if (winner !== 0) {
          acquire(w, p, winner, 600, 1000);
          w.draftLog.push({ team: winner, player: p.id, round: 1 });
          (w.draftPicked ??= []).push(winner);
          news(
            w,
            "1位指名・抽選結果",
            `${p.name}は${w.teams[winner].short}が交渉権を獲得。再指名してください。`,
          );
          break;
        }
        news(
          w,
          "1位指名・交渉権獲得",
          `${p.name}を獲得！ ${rivals.length ? "競合抽選を突破。" : "単独指名。"}`,
        );
      }
      acquire(w, p, 0, 600, 1000);
      w.draftLog.push({ team: 0, player: p.id, round: w.draftRound + 1 });
      w.draftCursor++;
      advanceDraftCpu(w);
      break;
    }
    case "passDraft":
      requirePhase(["draft"]);
      w.draftPassed.push(0);
      advanceDraftCpu(w);
      break;
    case "camp": {
      requirePhase(["autumn", "spring"]);
      if (w.campDone) throw Error("キャンプは実施済みです。");
      const camp = CAMPS[action.location];
      if (
        !camp ||
        !Object.keys(roster(w)[0]?.skills ?? {}).includes(action.focus)
      )
        throw Error("キャンプ設定が不正です。");
      spend(w, 0, "キャンプ", camp.cost);
      campTraining(w, action.location, action.focus);
      f.popularity = clamp(f.popularity + camp.fan);
      w.campDone = true;
      news(
        w,
        "キャンプ成果報告",
        `${camp.name}を完了。選手詳細で能力の成長履歴を確認できます。`,
      );
      break;
    }
    case "offer": {
      requirePhase(["fa", "contracts"]);
      const p = player(action.id);
      if (p.market !== "fa") throw Error("FA市場の選手ではありません。");
      if (seniorRoster(w).length >= SENIOR_LIMIT || f.debt > 0)
        throw Error("選手枠または再建措置により交渉できません。");
      if (
        !Number.isFinite(action.salary) ||
        action.salary < 500 ||
        action.salary > f.cash
      )
        throw Error("提示年俸は500万円以上、手元資金以内で指定してください。");
      p.offerRound++;
      p.offers = [
        { team: 0, salary: Math.round(action.salary) },
        ...w.teams
          .slice(1)
          .filter(
            (x) =>
              seniorRoster(w, x.id).length < SENIOR_LIMIT &&
              x.finance.debt === 0 &&
              x.finance.cash > p.ask,
          )
          .slice(0, 3)
          .map((x) => ({
            team: x.id,
            salary: Math.round(p.ask * (0.8 + random(w) * 0.5)),
          })),
      ];
      const score = (o: Player["offers"][number]) =>
        (o.salary / p.ask) * (p.preference === "年俸" ? 1.5 : 1) +
        (p.preference === "優勝"
          ? (7 - w.teams[o.team].previousRank) * 0.1
          : 0) +
        (p.preference === "出場"
          ? (70 - seniorRoster(w, o.team).length) * 0.025
          : 0);
      const best = [...p.offers].sort((a, b) => score(b) - score(a))[0];
      if (p.offerRound >= 3 || score(best) >= 1.6) {
        acquire(w, p, best.team, best.salary);
        queueCompensation(w, p, best.team);
        news(
          w,
          "FA交渉決着",
          `${p.name}は${w.teams[best.team].short}と${money(best.salary)}で契約。`,
        );
      } else
        news(
          w,
          "FA交渉・継続",
          `${p.name}の希望は「${p.preference}」。競合最高額 ${money(Math.max(...p.offers.slice(1).map((o) => o.salary), 0))}。第${p.offerRound}回交渉を終えました。`,
        );
      break;
    }
    case "sign": {
      requirePhase(["tryout", "contracts"]);
      const p = player(action.id);
      if (p.market !== "tryout")
        throw Error("トライアウト候補ではありません。");
      if (p.ask > f.cash) throw Error("年俸予算が不足しています。");
      acquire(w, p, 0, p.ask);
      news(w, "トライアウトから入団", `${p.name}と${money(p.salary)}で契約。`);
      break;
    }
    case "renew": {
      requirePhase(["contracts"]);
      const p = player(action.id);
      if (p.team !== 0 || p.contractYear >= targetYear)
        throw Error("契約更新の対象ではありません。");
      if (
        !Number.isFinite(action.salary) ||
        action.salary < 500 ||
        action.salary > f.cash
      )
        throw Error("年俸額が予算の範囲外です。");
      if (action.salary < p.ask * 0.9) {
        p.morale = clamp(p.morale - 8);
        news(
          w,
          "契約更改・保留",
          `${p.name}は提示額に難色。希望年俸 ${money(p.ask)}を参考に再提示してください。`,
        );
      } else {
        p.salary = Math.round(action.salary);
        p.contractYear = targetYear;
        p.negotiation = "accepted";
      }
      break;
    }
    case "renewAll":
      requirePhase(["contracts"]);
      roster(w)
        .filter(
          (p) => p.contractYear < targetYear && p.negotiation !== "meeting",
        )
        .forEach((p) => {
          p.salary = p.ask;
          p.contractYear = targetYear;
          p.negotiation = "accepted";
        });
      news(
        w,
        "一括提示の結果",
        `通常査定の選手は契約済み。要面談 ${roster(w).filter((p) => p.contractYear < targetYear).length}人を個別交渉してください。`,
      );
      break;
    case "scout": {
      requirePhase(["season", "draft", "fa", "tryout", "contracts"]);
      if (w.scoutsLeft <= 0) throw Error("今季の追加調査枠を使い切りました。");
      const p = player(action.id);
      if (p.team === 0) throw Error("所属選手は調査不要です。");
      spend(w, 0, "スカウト調査", 200);
      p.scouting = clamp(
        p.scouting +
          25 +
          (coach(w, 0, "スカウト責任者")?.evaluation ?? 40) / 3 +
          f.facilities[2] * 3,
        0,
        100,
      );
      w.scoutsLeft--;
      break;
    }
    case "policy":
      if (!["バランス", "勝利優先", "若手育成"].includes(action.value))
        throw Error("方針が不正です。");
      t.policy = action.value;
      break;
    case "ticket":
      requirePhase(["budget"]);
      f.ticket = clamp(Math.round(action.value), 1200, 6000);
      break;
    case "marketing":
      requirePhase(["budget"]);
      f.marketing = clamp(Math.round(action.value), 0, 3000);
      break;
    case "sponsor":
      requirePhase(["budget"]);
      if (![0, 1, 2].includes(action.value))
        throw Error("スポンサーが不正です。");
      f.sponsorKind = action.value;
      f.sponsor =
        action.value === 0
          ? 18000
          : action.value === 1
            ? 12000 + f.popularity * 200
            : 8000;
      break;
    case "invest": {
      requirePhase(["budget"]);
      const i = action.facility;
      if (i < 0 || i > 3 || !Number.isInteger(i))
        throw Error("施設が不正です。");
      if (f.facilities[i] >= 5) throw Error("施設は最高レベルです。");
      spend(w, 0, "設備投資", f.facilities[i] * 6000);
      f.facilities[i]++;
      if (i === 3) f.capacity += 3000;
      break;
    }
    case "advance":
      advancePhaseMutable(w);
      break;
  }
  w.revision++;
  return w;
}

function advancePhaseMutable(w: WorldState) {
  const target = w.year + 1;
  const phases = PHASE_FLOW;
  if (w.phase === "season") throw Error("月次処理を実行してください。");
  const blockers = phaseBlockers(w);
  if (blockers.length) throw Error(blockers.join(" "));
  if (w.phase === "release" || w.phase === "release2")
    for (const p of w.players)
      if (p.releaseNotice?.year === w.year && p.releaseNotice.phase === w.phase)
        delete p.releaseNotice;
  if (w.phase === "budget") {
    for (const id of w.teams.slice(1).map((t) => t.id))
      for (const role of STAFF_ROLES) {
        let s = coach(w, id, role);
        if (!s) s = newStaff(w, id, role);
        s.contractYear = target;
        s.salary = s.ask;
      }
  }
  if (w.phase === "contracts") {
    finalizeFa(w);
    if (w.compensations.length) {
      news(
        w,
        "FA交渉締め切り",
        "獲得が決まりました。人的補償を確定してから日程を進めてください。",
      );
      return;
    }
  }
  if (w.phase === "budget") {
    w.teams[0].finance.budget = operatingCost(w);
  }
  if (w.phase === "registration") {
    const error = validateRoster(w);
    if (error) throw Error(`${error} 編成画面で不足選手を補充してください。`);
    for (const t of w.teams.slice(1)) {
      replenish(w, t.id);
      roster(w, t.id).forEach((p) => {
        if (p.contractYear < target) {
          p.salary = p.ask;
          p.contractYear = target;
        }
      });
      if (t.finance.cash > 30000 && !t.finance.debt) {
        const i = integer(w, 0, 2);
        if (t.finance.facilities[i] < 5) {
          post(w, t.id, "設備投資", -6000 * t.finance.facilities[i]);
          t.finance.facilities[i]++;
        }
      }
    }
    nextYear(w);
    return;
  }
  if (w.phase === "cs") {
    w.seriesLog = [];
    w.finalists = (["パ", "セ"] as const).map((l) => {
      const top = standings(w, l);
      const challenger = series(w, top[1].id, top[2].id, 2);
      return series(w, top[0].id, challenger, 4, 1);
    });
    news(w, "CS決着", w.seriesLog.join(" ／ "));
    w.phase = "series";
    return;
  }
  if (w.phase === "series") {
    w.champion = series(w, w.finalists[0], w.finalists[1], 4);
    w.teams[w.champion].titles++;
    w.finalists.forEach((t) =>
      post(w, t, "ポストシーズン興行", t === w.champion ? 12000 : 6000),
    );
    news(
      w,
      "日本シリーズ決着",
      `${w.teams[w.champion].name}が日本一！ ${w.seriesLog.at(-1)}`,
    );
    for (const t of w.teams)
      if (
        t.finance.sponsorKind === 2 &&
        standings(w, t.league).findIndex((x) => x.id === t.id) < 3
      )
        post(w, t.id, "スポンサー達成報酬", 20000);
    w.phase = "settlement";
    archive(w);
    return;
  }
  if (w.phase === "settlement") {
    for (const s of w.staff.filter((s) => s.team !== null))
      s.history = [
        `${w.year} ${w.teams[s.team!].short} ${w.teams[s.team!].wins}勝`,
        ...s.history,
      ].slice(0, 15);
    prepareOffseason(w);
    w.phase = "release";
    news(
      w,
      `${w.year}年 オフシーズンへ`,
      "年間成績を踏まえて、来季の編成と契約を見直しましょう。",
    );
    return;
  }
  const next = phases[phases.indexOf(w.phase) + 1];
  if (next) w.phase = next;
  if (next === "draft") {
    w.draftPicked = [];
    w.draftOrder = draftOrder(w, 0);
    w.draftCursor = 0;
    advanceDraftCpu(w);
  }
  if (next === "spring" || next === "autumn") {
    w.campDone = false;
    w.campPlan = emptyCampPlan();
  }
  if (next === "release2") {
    if (!w.archives.some((a) => a.year === w.year)) {
      w.teams.forEach((t) => chooseActive(w, t.id));
      w.phase = "cs";
      advancePhaseMutable(w);
      advancePhaseMutable(w);
    }
    w.phase = "release2";
    announceFa(w);
  }
  if (next === "activeDraft") makeActiveDraftPool(w);
  if (next === "contracts") contractAssessment(w);
  if (next === "registration") chooseActive(w);
}

export function estimate(w: WorldState, p: Player, k: Skill) {
  if (p.team === 0) return { low: p.skills[k], high: p.skills[k] };
  const scout = coach(w, 0, "スカウト責任者");
  const width = Math.max(
    0,
    Math.round(
      (1 - p.scouting / 100) *
        (32 -
          (scout?.evaluation ?? 40) * 0.08 -
          w.teams[0].finance.facilities[2]),
    ),
  );
  const offset =
    ((((Number(p.id.slice(1)) * 7 + k.length * 3) % 9) - 4) * width) / 5;
  const middle = clamp(Math.round(p.skills[k] + offset));
  return { low: clamp(middle - width), high: clamp(middle + width) };
}
export function advancePhase(w: WorldState) {
  return applyOwnerAction(w, { type: "advance" });
}

export function potentialEstimate(w: WorldState, p: Player) {
  const assessor = coach(w, 0, "スカウト責任者");
  const certainty =
    (assessor?.projection ?? 40) * 0.5 +
    p.scouting * 0.5 +
    w.teams[0].finance.facilities[2] * 5;
  if (certainty < 40) return "調査不足";
  const width = Math.max(5, Math.round(28 - certainty * 0.2));
  const center = clamp(
    p.potential + ((Number(p.id.slice(1)) % 5) - 2) * width * 0.3,
  );
  return `${gradeForPotential(center)}（推定・評価幅 ±${width}）`;
}
function gradeForPotential(n: number) {
  return n >= 75
    ? "高い成長余地"
    : n >= 55
      ? "着実な成長を期待"
      : "即戦力・現能力を重視";
}
