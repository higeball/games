export type Skill =
  | "contact"
  | "power"
  | "speed"
  | "arm"
  | "fielding"
  | "catching"
  | "control"
  | "stamina";
export const SKILLS: Record<Skill, string> = {
  contact: "ミート",
  power: "パワー",
  speed: "走力",
  arm: "肩力",
  fielding: "守備力",
  catching: "捕球",
  control: "制球",
  stamina: "スタミナ",
};
export type Position =
  "投" | "捕" | "一" | "二" | "三" | "遊" | "左" | "中" | "右";
export const POSITIONS: Position[] = [
  "投",
  "捕",
  "一",
  "二",
  "三",
  "遊",
  "左",
  "中",
  "右",
];
export type RecordLine = {
  source?: "backfill";
  year: number;
  team: number;
  games: number;
  pa: number;
  ab: number;
  hits: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  runs: number;
  walks: number;
  steals: number;
  errors: number;
  starts: number;
  wins: number;
  losses: number;
  outs: number;
  allowed: number;
  earned: number;
  k: number;
  bb: number;
  saves: number;
  holds: number;
};
export type Player = {
  id: string;
  name: string;
  species: "cat" | "dog";
  breed: number;
  age: number;
  pro: number;
  team: number | null;
  position: Position;
  throws: "右" | "左";
  bats: "右" | "左";
  skills: Record<Skill, number>;
  velocity: number;
  trajectory: number;
  pitches: { name: string; level: number }[];
  potential: number;
  peak: number;
  durability: number;
  fatigue: number;
  injured: number;
  morale: number;
  popularity: number;
  trait: string;
  salary: number;
  ask: number;
  contractYear: number;
  market: "roster" | "draft" | "fa" | "tryout" | "foreign" | "retired";
  registration: "senior" | "development";
  negotiation: "pending" | "meeting" | "accepted";
  meetingReason: string;
  incentive: number;
  promise: "none" | "position" | "order";
  draftYear: number;
  formerTeam: number | null;
  faRank: "A" | "B" | "C";
  reports: Record<number, RecordLine>;
  /** Fictional reserve-league reference stats; never included in league totals. */
  farmReports?: Record<number, RecordLine>;
  /** Reversible notice, valid only until this release period is finished. */
  releaseNotice?: {
    year: number;
    phase: "release" | "release2";
    market: Player["market"];
    popularityLoss: number;
  };
  growth: string[];
  scouting: number;
  scoutingCount?: number;
  scoutingLegacy?: true;
  lastScouting?: { before: number; after: number; count: number };
  preference: "優勝" | "出場" | "年俸";
  offerRound: number;
  offers: { team: number; salary: number }[];
};
export const STAFF_ROLES = [
  "監督",
  "打撃コーチ",
  "投手コーチ",
  "守備走塁コーチ",
  "育成コーチ",
  "スカウト責任者",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Staff = {
  id: string;
  name: string;
  age: number;
  role: StaffRole;
  team: number | null;
  salary: number;
  ask: number;
  contractYear: number;
  evaluation: number;
  tactics: number;
  teaching: number;
  youth: number;
  veterans: number;
  health: number;
  leadership: number;
  projection: number;
  policy: Policy;
  history: string[];
};
export type Policy = "バランス" | "勝利優先" | "若手育成";
export type Ledger = {
  year: number;
  phase: string;
  category: string;
  amount: number;
};
export type Finance = {
  cash: number;
  debt: number;
  popularity: number;
  capacity: number;
  ticket: number;
  marketing: number;
  sponsor: number;
  sponsorKind: number;
  facilities: number[];
  ledger: Ledger[];
  budget: number;
  lastProfit: number;
  attendance: number;
  salaryBudget: number;
};
export type Team = {
  id: number;
  name: string;
  short: string;
  city: string;
  league: "パ" | "セ";
  color: string;
  policy: Policy;
  wins: number;
  losses: number;
  draws: number;
  scored: number;
  conceded: number;
  previousRank: number;
  finance: Finance;
  titles: number;
  roster: number[];
  activeIds: string[];
};
export type Phase =
  | "review"
  | "release"
  | "release2"
  | "activeDraft"
  | "preseason"
  | "registration"
  | "staff"
  | "draft"
  | "autumn"
  | "fa"
  | "tryout"
  | "contracts"
  | "budget"
  | "spring"
  | "season"
  | "cs"
  | "series"
  | "settlement";
export const PHASE_NAMES: Record<Phase, string> = {
  review: "シーズン総括",
  release: "第1次戦力外通告",
  release2: "FA公示・第2次戦力外",
  activeDraft: "現役ドラフト",
  preseason: "オープン戦",
  registration: "開幕一軍登録",
  staff: "監督・コーチ人事",
  draft: "ドラフト会議",
  autumn: "秋季キャンプ",
  fa: "FA交渉",
  tryout: "合同トライアウト",
  contracts: "契約更改",
  budget: "自主トレ・施設・人事",
  spring: "春季キャンプ",
  season: "ペナント",
  cs: "クライマックスシリーズ",
  series: "日本シリーズ",
  settlement: "年間決算",
};
export type Fixture = {
  home: number;
  away: number;
  month: number;
  played: boolean;
  hs?: number;
  as?: number;
  winner?: number;
};
export type News = { id: number; year: number; title: string; body: string };
export type YearReport = {
  year: number;
  standings: {
    id: number;
    wins: number;
    losses: number;
    draws: number;
    scored: number;
    conceded: number;
  }[];
  champion: number;
  leagueWinners: number[];
  finances: {
    team: number;
    income: number;
    expense: number;
    profit: number;
    fans: number;
    attendance: number;
    budget: number;
    payroll: number;
  }[];
  awards: string[];
};
export type WorldState = {
  version: 3;
  salaryModelVersion?: 1;
  revision: number;
  seed: number;
  nextId: number;
  year: number;
  month: number;
  phase: Phase;
  teams: Team[];
  players: Player[];
  staff: Staff[];
  schedule: Fixture[];
  news: News[];
  archives: YearReport[];
  draftRound: number;
  draftOrder: number[];
  draftCursor: number;
  draftPassed: number[];
  draftPicked?: number[];
  draftPending?: {
    round: number;
    player: string;
    rivals: number[];
    stage: "lottery" | "result";
    winner?: number;
  };
  campDone: boolean;
  finalists: number[];
  champion: number | null;
  scoutsLeft: number;
  milestones: string[];
  explanation: string;
  seriesLog: string[];
  draftLog: { team: number; player: string; round: number }[];
  lottery: { player: string; rivals: number[]; winner: number } | null;
  activeDraftDone: boolean;
  activeDraftPool: string[];
  compensations: { player: string; from: number; protected: string[] }[];
  campPlan: CampPlan;
  preseasonDone: boolean;
  preseasonRecord?: { wins: number; losses: number; draws: number };
  preseasonReport: { player: string; rating: number; note: string }[];
};
export type CampPlan = {
  budget: number;
  focuses: Skill[];
  legend: "none" | "batting" | "pitching" | "defense";
  special: {
    id: string;
    kind: "breakout" | "convert" | "pitch";
    position?: Position;
    pitch?: string;
  }[];
};
export type OwnerAction =
  | { type: "advance" }
  | { type: "release"; id: string }
  | { type: "cancelRelease"; id: string }
  | { type: "hire"; id: string }
  | { type: "draft"; id: string }
  | { type: "drawDraftLottery" }
  | { type: "nextDraftRound" }
  | { type: "passDraft" }
  | { type: "camp"; location: number; focus: Skill }
  | { type: "offer"; id: string; salary: number }
  | { type: "sign"; id: string }
  | { type: "renew"; id: string; salary: number }
  | { type: "renewAll" }
  | { type: "scout"; id: string }
  | { type: "policy"; value: Policy }
  | { type: "ticket"; value: number }
  | { type: "marketing"; value: number }
  | { type: "sponsor"; value: number }
  | { type: "invest"; facility: number }
  | { type: "development"; id: string }
  | { type: "promote"; id: string }
  | {
      type: "negotiate";
      id: string;
      salary: number;
      years: number;
      incentive: boolean;
      promise: Player["promise"];
    }
  | { type: "salaryBudget"; value: number }
  | { type: "campPlan"; plan: CampPlan }
  | { type: "activeDraft"; give: string; take: string }
  | { type: "foreign"; id: string }
  | { type: "trade"; give: string; take: string; cash: number }
  | { type: "protect"; id: string }
  | { type: "autoProtect" }
  | { type: "compensate" }
  | { type: "autoActive" }
  | { type: "active"; id: string }
  | { type: "preseason" }
  | { type: "skipSeason" };

export const CLUBS = [
  {
    name: "福岡ソフトにゃんくホークス",
    short: "福岡",
    city: "福岡",
    stadium: "福岡ドーム",
    color: "#d5a329",
    league: "パ",
  },
  {
    name: "北海道日本にゃむファイターズ",
    short: "北海道",
    city: "北広島",
    stadium: "エスコンフィールド",
    color: "#26839f",
    league: "パ",
  },
  {
    name: "東北にゃく天ゴールデンイーグルス",
    short: "東北",
    city: "仙台",
    stadium: "宮城球場",
    color: "#9b3b50",
    league: "パ",
  },
  {
    name: "埼玉西にゃ武ライオンズ",
    short: "埼玉",
    city: "所沢",
    stadium: "西武ドーム",
    color: "#274665",
    league: "パ",
  },
  {
    name: "千葉ロッテにゃリーンズ",
    short: "千葉",
    city: "千葉",
    stadium: "千葉マリン",
    color: "#535b60",
    league: "パ",
  },
  {
    name: "オリにゃックス・バファローズ",
    short: "大阪",
    city: "大阪",
    stadium: "大阪ドーム",
    color: "#746743",
    league: "パ",
  },
  {
    name: "読売にゃイアンツ",
    short: "巨猫",
    city: "東京",
    stadium: "東京ドーム",
    color: "#d77b32",
    league: "セ",
  },
  {
    name: "東京にゃクルトスワローズ",
    short: "東京",
    city: "東京",
    stadium: "明治神宮球場",
    color: "#457758",
    league: "セ",
  },
  {
    name: "横浜DeにゃAベイスターズ",
    short: "横浜",
    city: "横浜",
    stadium: "横浜スタジアム",
    color: "#3b80b7",
    league: "セ",
  },
  {
    name: "中日ドラにゃンズ",
    short: "名古屋",
    city: "名古屋",
    stadium: "ナゴヤドーム",
    color: "#486dab",
    league: "セ",
  },
  {
    name: "阪神にゃイガース",
    short: "阪神",
    city: "西宮",
    stadium: "阪神甲子園球場",
    color: "#bda32a",
    league: "セ",
  },
  {
    name: "広島東洋にゃープ",
    short: "広島",
    city: "広島",
    stadium: "広島市民球場",
    color: "#bd4f53",
    league: "セ",
  },
] as const;
export const PHASE_DATES: Record<Phase, string> = {
  review: "10月上旬",
  release: "10月上旬",
  draft: "10月下旬",
  autumn: "10月下旬",
  release2: "11月上旬",
  tryout: "11月中旬",
  activeDraft: "11月中旬",
  contracts: "11月下旬〜12月",
  fa: "11月下旬〜12月",
  budget: "1月",
  staff: "1月",
  spring: "2月",
  preseason: "3月上旬",
  registration: "3月下旬",
  season: "4月〜9月",
  cs: "10月中旬",
  series: "10月下旬",
  settlement: "11月上旬",
};
export const PHASE_FLOW: Phase[] = [
  "review",
  "release",
  "draft",
  "autumn",
  "release2",
  "tryout",
  "activeDraft",
  "contracts",
  "budget",
  "spring",
  "preseason",
  "registration",
];
export const emptyCampPlan = (): CampPlan => ({
  budget: 0,
  focuses: ["contact"],
  legend: "none",
  special: [],
});
export const SENIOR_LIMIT = 70;
export const ACTIVE_LIMIT = 31;
export const FOREIGN_LIMIT = 4;
export const CAT_BREEDS = [
  "三毛",
  "黒猫",
  "茶トラ",
  "ペルシャ",
  "スコティッシュ",
  "シャム",
  "ベンガル",
  "ロシアンブルー",
  "ハチワレ",
  "アメリカンショートヘア",
  "ラグドール",
  "メインクーン",
  "ソマリ",
  "アビシニアン",
  "ノルウェージャン",
  "マンチカン",
  "サイベリアン",
  "ブリティッシュ",
  "エキゾチック",
  "白猫",
];
export const DOG_BREEDS = [
  "柴犬",
  "秋田犬",
  "コーギー",
  "ハスキー",
  "ゴールデン",
  "ラブラドール",
  "プードル",
  "ダックス",
  "ビーグル",
  "シェパード",
  "チワワ",
  "パグ",
  "ボーダーコリー",
  "シェルティ",
  "ダルメシアン",
  "サモエド",
  "ボクサー",
  "テリア",
  "バーニーズ",
  "ポメラニアン",
];
export const CAMPS = [
  {
    name: "本拠地・地域交流",
    cost: 800,
    gain: 1,
    health: 5,
    fan: 4,
    note: "低費用。ファンとの交流と休養を重視。",
  },
  {
    name: "南島・温暖キャンプ",
    cost: 2500,
    gain: 2,
    health: 12,
    fan: 1,
    note: "温暖な気候。疲労回復と基礎作り。",
  },
  {
    name: "高原・総合トレセン",
    cost: 4500,
    gain: 3,
    health: 5,
    fan: 0,
    note: "充実した練習設備で重点能力を伸ばす。",
  },
  {
    name: "海外・集中合宿",
    cost: 7000,
    gain: 4,
    health: -5,
    fan: 3,
    note: "成長効果は大きいが、移動疲労が残る。",
  },
];
export const FACILITIES = ["練習設備", "医療設備", "スカウト網", "球場拡張"];
export const money = (n: number) =>
  Math.abs(n) >= 10000
    ? `${(n / 10000).toFixed(2)}億円`
    : `${Math.round(n).toLocaleString()}万円`;
export const grade = (n: number) =>
  n >= 90
    ? "S"
    : n >= 80
      ? "A"
      : n >= 70
        ? "B"
        : n >= 60
          ? "C"
          : n >= 50
            ? "D"
            : n >= 40
              ? "E"
              : n >= 20
                ? "F"
                : "G";
export const blankRecord = (year: number, team: number): RecordLine => ({
  year,
  team,
  games: 0,
  pa: 0,
  ab: 0,
  hits: 0,
  doubles: 0,
  triples: 0,
  hr: 0,
  rbi: 0,
  runs: 0,
  walks: 0,
  steals: 0,
  errors: 0,
  starts: 0,
  wins: 0,
  losses: 0,
  outs: 0,
  allowed: 0,
  earned: 0,
  k: 0,
  bb: 0,
  saves: 0,
  holds: 0,
});
