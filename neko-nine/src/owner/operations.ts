import {
  ability,
  roster,
  payroll,
  desiredSalary,
  random,
  integer,
  newPlayer,
  news,
  spend,
  post,
  acquire,
} from "./engine";
import { renewalSalary } from "./salary";
import {
  ACTIVE_LIMIT,
  FOREIGN_LIMIT,
  SENIOR_LIMIT,
  STAFF_ROLES,
  POSITIONS,
  SKILLS,
  CLUBS,
  money,
  emptyCampPlan,
  type WorldState,
  type Player,
  type OwnerAction,
  type Skill,
  type Phase,
} from "./model";

export const seniorRoster = (w: WorldState, id = 0) =>
  roster(w, id).filter((p) => p.registration === "senior");
export const projectedPayroll = (w: WorldState) =>
  roster(w).reduce(
    (n, p) => n + (p.contractYear >= w.year + 1 ? p.salary : p.ask),
    0,
  ) + w.staff.filter((s) => s.team === 0).reduce((n, s) => n + s.ask, 0);
export function teamStrength(w: WorldState) {
  const groups = [
    { name: "先発", positions: ["投"], count: 6 },
    { name: "リリーフ", positions: ["投"], count: 7 },
    { name: "捕手", positions: ["捕"], count: 2 },
    { name: "内野", positions: ["一", "二", "三", "遊"], count: 6 },
    { name: "外野", positions: ["左", "中", "右"], count: 5 },
  ];
  return groups.map((g) => {
    const list = seniorRoster(w)
      .filter((p) => g.positions.includes(p.position))
      .sort((a, b) => ability(b) - ability(a));
    const selected =
      g.name === "リリーフ" ? list.slice(6, 13) : list.slice(0, g.count);
    const score = selected.reduce((n, p) => n + ability(p), 0) / g.count;
    return {
      name: g.name,
      score,
      count: selected.length,
      need: g.count,
      urgent: score < 45 || selected.length < g.count,
    };
  });
}
export function chooseActive(w: WorldState, id = 0) {
  const list = seniorRoster(w, id)
    .filter((p) => !p.injured)
    .sort((a, b) => activeScore(b) - activeScore(a));
  const selected: Player[] = [];
  const add = (p?: Player) => {
    if (
      p &&
      !selected.includes(p) &&
      (p.species !== "dog" ||
        selected.filter((x) => x.species === "dog").length < FOREIGN_LIMIT)
    )
      selected.push(p);
  };
  for (const position of POSITIONS.slice(1))
    add(
      list.find((p) => p.position === position && p.species === "cat") ??
        list.find((p) => p.position === position),
    );
  for (const p of list.filter((p) => p.position === "捕")) {
    if (selected.filter((p) => p.position === "捕").length >= 2) break;
    add(p);
  }
  for (const p of list.filter((p) => p.position === "投")) {
    if (selected.filter((p) => p.position === "投").length >= 12) break;
    add(p);
  }
  for (const p of list) {
    if (selected.length >= ACTIVE_LIMIT) break;
    add(p);
  }
  w.teams[id].activeIds = selected.map((p) => p.id);
}
const activeScore = (p: Player) =>
  ability(p) + (p.promise !== "none" ? 12 : 0) - p.fatigue * 0.1;
export function activeError(w: WorldState) {
  const list = w.teams[0].activeIds
    .map((id) => w.players.find((p) => p.id === id))
    .filter(
      (p): p is Player =>
        !!p &&
        p.team === 0 &&
        p.registration === "senior" &&
        p.market === "roster",
    );
  if (
    new Set(w.teams[0].activeIds).size !== w.teams[0].activeIds.length ||
    list.length !== w.teams[0].activeIds.length
  )
    return "一軍登録に無効な選手が含まれています。";
  if (list.length < 28 || list.length > ACTIVE_LIMIT)
    return "開幕一軍は28〜31人を選んでください。";
  if (list.filter((p) => p.species === "dog").length > FOREIGN_LIMIT)
    return "外国人の一軍枠は4人までです。";
  if (list.filter((p) => p.position === "投").length < 10)
    return "一軍に投手10人以上が必要です。";
  if (list.filter((p) => p.position === "捕").length < 2)
    return "一軍に捕手2人以上が必要です。";
  for (const pos of POSITIONS.slice(2))
    if (!list.some((p) => p.position === pos))
      return `一軍に${pos}の担当選手が必要です。`;
  return null;
}
export function phaseBlockers(w: WorldState) {
  const tasks: string[] = [];
  if (seniorRoster(w).length > SENIOR_LIMIT)
    tasks.push("支配下70人枠を超えています。");
  if (w.phase === "draft" && (w.draftRound < 6 || w.draftPending))
    tasks.push(
      w.draftPending?.stage === "lottery"
        ? "くじを引いて交渉権の抽選を行ってください。"
        : w.draftPending?.stage === "result"
          ? "指名結果を確認し、次の指名へ進んでください。"
          : "ドラフト指名、または指名終了を選んでください。",
    );
  if (["autumn", "spring"].includes(w.phase) && !w.campDone)
    tasks.push("キャンプ計画を実施してください。");
  if (w.phase === "activeDraft" && !w.activeDraftDone)
    tasks.push("現役ドラフトの放出候補と獲得選手を選んでください。");
  if (w.phase === "contracts") {
    const count = roster(w).filter((p) => p.contractYear < w.year + 1).length;
    if (count) tasks.push(`契約未確定 ${count}人（一括提示・要面談）。`);
    if (w.compensations.length)
      tasks.push(
        `人的補償 ${w.compensations.length}件のプロテクトを確定してください。`,
      );
    if (projectedPayroll(w) > w.teams[0].finance.salaryBudget)
      tasks.push(
        "来季年俸が予算を超えています。予算か契約条件を見直してください。",
      );
  }
  if (
    w.phase === "budget" &&
    STAFF_ROLES.some(
      (role) =>
        !w.staff.some(
          (s) =>
            s.team === 0 && s.role === role && s.contractYear >= w.year + 1,
        ),
    )
  )
    tasks.push("監督・コーチ6職種の来季契約を更新してください。");
  if (w.phase === "preseason" && !w.preseasonDone)
    tasks.push("オープン戦を実施してください。");
  if (w.phase === "registration") {
    const e = activeError(w);
    if (e) tasks.push(e);
  }
  return tasks;
}
export function contractAssessment(w: WorldState) {
  const list = roster(w).filter((p) => p.contractYear < w.year + 1);
  list.forEach((p) => {
    p.ask = renewalSalary(p);
    p.negotiation = "pending";
    p.meetingReason = "";
  });
  const difficult = list
    .filter((p) => p.registration === "senior")
    .sort(
      (a, b) =>
        b.ask +
        (b.age >= 32 ? 2000 : 0) +
        (b.reports[w.year]?.hr ?? 0) * 100 -
        (a.ask + (a.age >= 32 ? 2000 : 0) + (a.reports[w.year]?.hr ?? 0) * 100),
    )
    .slice(0, Math.max(1, Math.round(list.length * 0.13)));
  for (const p of difficult) {
    p.negotiation = "meeting";
    p.meetingReason =
      p.age >= 32
        ? "ベテラン：契約期間の安心感を希望"
        : p.preference === "出場"
          ? "主力：守備位置や打順の確約を希望"
          : "主力・好成績：査定と待遇を再確認したい";
    p.ask = Math.round((p.ask * 1.1) / 100) * 100;
  }
}
export function announceFa(w: WorldState) {
  w.players
    .filter((p) => p.market === "foreign")
    .forEach((p) => {
      p.market = "retired";
    });
  for (const team of w.teams) {
    const list = seniorRoster(w, team.id)
      .filter((p) => p.species === "cat")
      .sort((a, b) => b.salary - a.salary);
    for (const [i, p] of list.entries()) {
      if (p.pro < 8 || p.contractYear > w.year || random(w) > 0.09) continue;
      p.formerTeam = team.id;
      p.faRank = i < 3 ? "A" : i < 10 ? "B" : "C";
      p.team = null;
      p.market = "fa";
      news(
        w,
        `${p.name}がFA宣言`,
        `${team.short}から${p.faRank}ランクで公示。${p.faRank === "C" ? "補償なし" : "人的補償の対象"}。`,
      );
    }
  }
  for (let i = 0; i < 18; i++) {
    const p = newPlayer(
      w,
      null,
      i < 9 ? "投" : POSITIONS[1 + (i % 8)],
      "foreign",
      "dog",
    );
    p.age = integer(w, 24, 32);
    p.pro = Math.min(p.pro, p.age - 18);
    p.ask = Math.round((desiredSalary(p) * 1.25) / 100) * 100;
  }
}
export function makeActiveDraftPool(w: WorldState) {
  w.activeDraftPool = [];
  for (const t of w.teams.slice(1)) {
    const list = seniorRoster(w, t.id)
      .filter(
        (p) =>
          p.species === "cat" &&
          p.pro >= 1 &&
          p.salary < 7000 &&
          p.age < 33 &&
          p.contractYear <= w.year &&
          p.draftYear !== w.year + 1,
      )
      .sort((a, b) => b.potential - ability(b) - (a.potential - ability(a)))
      .slice(0, 2);
    w.activeDraftPool.push(...list.map((p) => p.id));
  }
  if (
    !seniorRoster(w).some(
      (p) =>
        p.species === "cat" &&
        p.pro >= 1 &&
        p.salary < 7000 &&
        p.contractYear <= w.year &&
        p.draftYear !== w.year + 1,
    )
  ) {
    w.activeDraftDone = true;
    news(
      w,
      "現役ドラフト対象なし",
      "複数年契約などにより対象選手がいないため、今季の参加は見送ります。",
    );
  }
}
export function protectionCandidates(w: WorldState) {
  return seniorRoster(w).filter(
    (p) =>
      p.species === "cat" &&
      p.draftYear !== w.year + 1 &&
      !w.compensations.some((c) => c.player === p.id),
  );
}
export function queueCompensation(w: WorldState, p: Player, to: number) {
  if (p.formerTeam === null || p.formerTeam === to || p.faRank === "C") return;
  if (to === 0) {
    const fee = Math.round(p.salary * (p.faRank === "A" ? 0.3 : 0.2));
    const committed = w.compensations.reduce((n, c) => {
      const x = w.players.find((x) => x.id === c.player)!;
      return n + Math.round(x.salary * (x.faRank === "A" ? 0.3 : 0.2));
    }, 0);
    if (w.teams[0].finance.cash < fee + committed + 800)
      throw Error("人的補償金と春季キャンプ費を含めると資金が足りません。");
    w.compensations.push({ player: p.id, from: p.formerTeam, protected: [] });
    return;
  }
  const list = seniorRoster(w, to)
    .filter(
      (x) => x.species === "cat" && x.id !== p.id && x.draftYear !== w.year + 1,
    )
    .sort((a, b) => ability(b) - ability(a));
  const choice = list
    .slice(28)
    .sort((a, b) => tradeValue(b) - tradeValue(a))[0];
  if (choice && seniorRoster(w, p.formerTeam).length < SENIOR_LIMIT) {
    choice.team = p.formerTeam;
    news(
      w,
      "人的補償の移籍",
      `${choice.name}が${w.teams[p.formerTeam].short}へ。`,
    );
  }
  const fee = Math.round(p.salary * (p.faRank === "A" ? 0.3 : 0.2));
  post(w, to, "FA補償金", -fee);
  post(w, p.formerTeam, "FA補償金", fee);
}
const offerScore = (w: WorldState, p: Player, o: Player["offers"][number]) =>
  (o.salary / p.ask) * (p.preference === "年俸" ? 1.5 : 1) +
  (p.preference === "優勝" ? (7 - w.teams[o.team].previousRank) * 0.1 : 0) +
  (p.preference === "出場"
    ? Math.max(0, 70 - seniorRoster(w, o.team).length) * 0.025
    : 0);
export function finalizeFa(w: WorldState) {
  for (const p of w.players.filter((p) => p.market === "fa")) {
    const offers = p.offers.filter(
      (o) => seniorRoster(w, o.team).length < SENIOR_LIMIT,
    );
    if (!offers.length) {
      const team = w.teams
        .slice(1)
        .filter(
          (t) => seniorRoster(w, t.id).length < 70 && t.finance.cash > p.ask,
        )
        .sort((a, b) => a.previousRank - b.previousRank)[0];
      if (team) offers.push({ team: team.id, salary: p.ask });
    }
    const best = offers.sort(
      (a, b) => offerScore(w, p, b) - offerScore(w, p, a),
    )[0];
    if (best) {
      acquire(w, p, best.team, best.salary);
      queueCompensation(w, p, best.team);
    } else {
      p.market = "tryout";
      p.ask = Math.min(1500, p.ask);
    }
  }
  for (const team of w.teams.slice(1)) {
    if (
      seniorRoster(w, team.id).length >= 70 ||
      seniorRoster(w, team.id).filter((p) => p.species === "dog").length >= 4 ||
      team.finance.debt > 0
    )
      continue;
    const p = w.players
      .filter((p) => p.market === "foreign")
      .sort((a, b) => ability(b) - ability(a))
      .find((p) => p.ask * 0.2 + 800 < team.finance.cash);
    if (p) {
      spend(w, team.id, "外国人契約金", Math.round(p.ask * 0.2));
      acquire(w, p, team.id, p.ask);
    }
  }
}
export function campTraining(w: WorldState, location: number, fallback: Skill) {
  const plan = w.campPlan;
  const camp = [1, 2, 3, 4][location];
  const focuses = plan.focuses.length ? plan.focuses : [fallback];
  const cost = plan.budget + (plan.legend !== "none" ? 4000 : 0);
  if (cost) spend(w, 0, "キャンプ追加予算・OB", cost);
  for (const p of roster(w)) {
    const teacher = w.staff.find(
      (s) =>
        s.team === 0 &&
        s.role === (p.position === "投" ? "投手コーチ" : "打撃コーチ"),
    );
    const positionLegend =
      (plan.legend === "pitching" && p.position === "投") ||
      (plan.legend === "batting" && p.position !== "投");
    const special = plan.special.find((s) => s.id === p.id);
    for (const skill of focuses) {
      const legend =
        positionLegend ||
        (plan.legend === "defense" &&
          ["fielding", "catching", "arm", "speed"].includes(skill));
      const before = p.skills[skill];
      const gain = Math.max(
        0,
        Math.round(
          ((camp + plan.budget / 3500) *
            (0.45 + (teacher?.teaching ?? 40) / 100) *
            (p.age <= p.peak ? 1 : 0.22) *
            (legend ? 1.6 : 1) *
            (special?.kind === "breakout" ? 1.8 : 1)) /
            Math.sqrt(focuses.length),
        ),
      );
      p.skills[skill] = Math.min(
        100,
        Math.max(before, Math.min(p.potential, before + gain)),
      );
      p.growth.unshift(
        `${w.year + 1}年キャンプ：${SKILLS[skill]} +${p.skills[skill] - before}${special ? " 集中指導" : ""}${legend ? " OB指導" : ""}`,
      );
    }
    if (
      special?.kind === "convert" &&
      special.position &&
      special.position !== "投" &&
      p.position !== "投"
    ) {
      const old = p.position;
      p.position = special.position;
      p.skills.fielding = Math.max(1, p.skills.fielding - 5);
      p.growth.unshift(
        `${old}→${p.position} コンバート（守備−5、適応は継続育成）`,
      );
    }
    if (special?.kind === "pitch" && p.position === "投") {
      const name = special.pitch ?? "シュート";
      const current = p.pitches.find((x) => x.name === name);
      if (current) current.level = Math.min(7, current.level + 1);
      else p.pitches.push({ name, level: 1 });
      p.growth.unshift(`${name}を${current ? "強化" : "習得"}（集中指導）`);
    }
    p.fatigue = Math.max(0, p.fatigue - 8);
    p.injured = 0;
    p.morale = Math.min(100, p.morale + 4);
    p.growth = p.growth.slice(0, 12);
  }
  news(
    w,
    "キャンプ集中指導の成果",
    `重点${focuses.map((k) => SKILLS[k]).join("・")}。特別指定${plan.special.length}人／OB${plan.legend === "none" ? "なし" : "招聘"}。`,
  );
}
const tradeValue = (p: Player) =>
  ability(p) +
  Math.max(0, p.potential - ability(p)) * 0.2 +
  Math.max(0, 28 - p.age) * 0.6 -
  p.salary / 5000;

export function handleOperation(w: WorldState, a: OwnerAction): boolean {
  const phase = (allowed: string[]) => {
    if (!allowed.includes(w.phase)) throw Error("この時期には実行できません。");
  };
  const player = (id: string) => {
    const p = w.players.find((p) => p.id === id);
    if (!p) throw Error("選手が見つかりません。");
    return p;
  };
  const target = w.year + 1;
  switch (a.type) {
    case "development": {
      phase(["release", "release2"]);
      const p = player(a.id);
      if (
        p.team !== 0 ||
        p.registration !== "senior" ||
        p.species === "dog" ||
        p.contractYear > w.year
      )
        throw Error("育成打診の対象ではありません。");
      const chance = p.age < 27 ? 0.85 : p.age < 32 ? 0.55 : 0.25;
      if (random(w) > chance) {
        p.team = null;
        p.market = "tryout";
        news(
          w,
          "育成打診を拒否",
          `${p.name}は支配下契約を求め退団。別球団での再起を目指します。`,
        );
      } else {
        p.registration = "development";
        p.salary = 300;
        p.ask = 300;
        p.negotiation = "pending";
        news(
          w,
          "育成契約に合意",
          `${p.name}が育成へ。支配下枠が1つ空きました。`,
        );
      }
      return true;
    }
    case "promote": {
      phase(["spring", "registration"]);
      const p = player(a.id);
      if (p.team !== 0 || p.registration !== "development")
        throw Error("育成選手ではありません。");
      if (seniorRoster(w).length >= 70)
        throw Error("支配下70人枠に空きがありません。");
      p.registration = "senior";
      p.salary = Math.max(600, p.salary);
      p.ask = p.salary;
      p.contractYear = Math.max(target, p.contractYear);
      return true;
    }
    case "salaryBudget": {
      phase(["contracts", "budget"]);
      if (!Number.isFinite(a.value) || a.value < 50000 || a.value > 800000)
        throw Error("年俸予算は5〜80億円で設定してください。");
      w.teams[0].finance.salaryBudget = Math.round(a.value);
      return true;
    }
    case "negotiate": {
      phase(["contracts"]);
      const p = player(a.id);
      if (p.team !== 0 || p.contractYear >= target)
        throw Error("契約更新の対象ではありません。");
      if (
        !Number.isFinite(a.salary) ||
        a.salary < 300 ||
        !Number.isInteger(a.years) ||
        a.years < 1 ||
        a.years > 3 ||
        !["none", "position", "order"].includes(a.promise)
      )
        throw Error("契約条件が不正です。");
      const points =
        a.salary / p.ask +
        (a.years - 1) * (p.age >= 32 ? 0.11 : 0.06) +
        (a.incentive ? 0.12 : 0) +
        (a.promise !== "none" ? (p.preference === "出場" ? 0.18 : 0.07) : 0);
      if (points < 1.06) {
        p.morale = Math.max(1, p.morale - 3);
        news(
          w,
          "契約更改・保留",
          `${p.name}は条件不足。昇給、複数年、出来高、起用確約を組み合わせてください。`,
        );
        return true;
      }
      p.salary = Math.round(a.salary);
      p.contractYear = target + a.years - 1;
      p.negotiation = "accepted";
      p.incentive = a.incentive ? Math.round(p.salary * 0.18) : 0;
      p.promise = a.promise;
      news(
        w,
        "要面談選手が合意",
        `${p.name}：${money(p.salary)}、${a.years}年契約${p.incentive ? "＋出来高" : ""}${p.promise !== "none" ? "＋起用確約" : ""}。`,
      );
      return true;
    }
    case "campPlan": {
      phase(["autumn", "spring"]);
      if (w.campDone) throw Error("キャンプは実施済みです。");
      const p = a.plan;
      if (
        (p.location !== undefined &&
          (!Number.isInteger(p.location) ||
            p.location < 0 ||
            p.location > 3)) ||
        ![0, 2500, 6000, 10000].includes(p.budget) ||
        !p.focuses.length ||
        p.focuses.length > 2 ||
        new Set(p.focuses).size !== p.focuses.length ||
        p.focuses.some((k) => !Object.hasOwn(SKILLS, k)) ||
        !["none", "batting", "pitching", "defense"].includes(p.legend) ||
        p.special.length > 5 ||
        new Set(p.special.map((s) => s.id)).size !== p.special.length
      )
        throw Error("重点2枠・特別指定5人までで設定してください。");
      for (const s of p.special) {
        const x = player(s.id);
        if (x.team !== 0 || !["breakout", "convert", "pitch"].includes(s.kind))
          throw Error("集中指導対象が不正です。");
        if (
          s.kind === "convert" &&
          (!s.position ||
            s.position === "投" ||
            x.position === "投" ||
            !POSITIONS.includes(s.position))
        )
          throw Error("投手以外の守備位置を選んでください。");
        if (
          s.kind === "pitch" &&
          (x.position !== "投" ||
            ![
              "シュート",
              "フォーク",
              "カーブ",
              "スライダー",
              "チェンジアップ",
            ].includes(s.pitch ?? ""))
        )
          throw Error("投手と新球種を選んでください。");
      }
      w.campPlan = structuredClone(p);
      return true;
    }
    case "activeDraft": {
      phase(["activeDraft"]);
      if (w.activeDraftDone) throw Error("現役ドラフトは実施済みです。");
      const give = player(a.give),
        take = player(a.take);
      if (
        give.team !== 0 ||
        give.registration !== "senior" ||
        give.species !== "cat" ||
        give.contractYear > w.year ||
        give.draftYear === target ||
        give.salary >= 7000 ||
        give.pro < 1
      )
        throw Error(
          "候補は単年契約・年俸7,000万円未満の猫選手から選んでください。",
        );
      if (!w.activeDraftPool.includes(take.id) || take.team === null)
        throw Error("現役ドラフト候補ではありません。");
      const team = take.team;
      give.team = team;
      take.team = 0;
      w.activeDraftDone = true;
      const others = w.teams
        .slice(1)
        .filter((t) => t.id !== team)
        .map((t) =>
          w.players.find(
            (p) => w.activeDraftPool.includes(p.id) && p.team === t.id,
          ),
        )
        .filter((p): p is Player => !!p);
      const teams = others.map((p) => p.team!);
      others.forEach((p, i) => {
        p.team = teams[(i + 1) % teams.length];
      });
      news(
        w,
        "現役ドラフト成立",
        `${give.name}が${w.teams[team].short}へ。${take.name}を獲得。新しい出場機会が成長を後押しします。`,
      );
      take.morale = 80;
      return true;
    }
    case "foreign": {
      phase(["contracts"]);
      const p = player(a.id);
      if (p.market !== "foreign" || p.species !== "dog")
        throw Error("外国人候補ではありません。");
      spend(w, 0, "外国人契約金", Math.round(p.ask * 0.2));
      acquire(w, p, 0, p.ask);
      news(w, "外国人補強", `${p.name}が福岡へ。開幕一軍の外国人枠は4人です。`);
      return true;
    }
    case "trade": {
      phase(["contracts"]);
      const give = player(a.give),
        take = player(a.take);
      if (
        give.team !== 0 ||
        take.team === null ||
        take.team === 0 ||
        give.registration !== "senior" ||
        take.registration !== "senior" ||
        give.market !== "roster" ||
        take.market !== "roster" ||
        give.draftYear === target ||
        take.draftYear === target
      )
        throw Error("支配下選手同士で、今季の新人以外を選んでください。");
      if (!Number.isFinite(a.cash) || a.cash < 0 || a.cash > 10000)
        throw Error("金銭条件は0〜1億円で指定してください。");
      if (tradeValue(give) + a.cash / 1000 < tradeValue(take) + 2)
        throw Error(
          "相手球団が拒否しました。若手の価値や金銭条件を見直してください。",
        );
      const other = take.team;
      if (a.cash) {
        spend(w, 0, "トレード金銭", a.cash);
        post(w, other, "トレード金銭", a.cash);
      }
      give.team = other;
      take.team = 0;
      take.contractYear = Math.max(target, take.contractYear);
      news(
        w,
        "トレード成立",
        `${give.name}と${take.name}の交換${a.cash ? `＋${money(a.cash)}` : ""}。戦力と年俸が変わりました。`,
      );
      return true;
    }
    case "protect": {
      phase(["contracts"]);
      const c = w.compensations[0];
      if (!c) throw Error("人的補償はありません。");
      if (!protectionCandidates(w).some((p) => p.id === a.id))
        throw Error("保護対象ではありません。");
      if (c.protected.includes(a.id))
        c.protected = c.protected.filter((id) => id !== a.id);
      else {
        if (c.protected.length >= 28) throw Error("プロテクトは28人までです。");
        c.protected.push(a.id);
      }
      return true;
    }
    case "autoProtect": {
      phase(["contracts"]);
      const c = w.compensations[0];
      if (!c) throw Error("人的補償はありません。");
      c.protected = protectionCandidates(w)
        .sort((a, b) => tradeValue(b) - tradeValue(a))
        .slice(0, 28)
        .map((p) => p.id);
      return true;
    }
    case "compensate": {
      phase(["contracts"]);
      const c = w.compensations[0];
      if (!c) throw Error("人的補償はありません。");
      const list = protectionCandidates(w);
      if (
        c.protected.length !== Math.min(28, list.length) ||
        c.protected.some((id) => !list.some((p) => p.id === id))
      )
        throw Error("28人のプロテクトを作成してください。");
      const p = player(c.player),
        chosen = list
          .filter((p) => !c.protected.includes(p.id))
          .sort((a, b) => tradeValue(b) - tradeValue(a))[0];
      const fee = Math.round(p.salary * (p.faRank === "A" ? 0.3 : 0.2));
      spend(w, 0, "FA補償金", fee);
      post(w, c.from, "FA補償金", fee);
      if (chosen && seniorRoster(w, c.from).length < 70) {
        chosen.team = c.from;
        news(
          w,
          "人的補償が確定",
          `${chosen.name}が${w.teams[c.from].short}へ。28人の外から選ばれました。`,
        );
      } else
        news(w, "FA補償を確定", "相手球団の枠により金銭補償のみとなりました。");
      w.compensations.shift();
      return true;
    }
    case "autoActive": {
      phase(["registration"]);
      chooseActive(w);
      return true;
    }
    case "active": {
      phase(["registration"]);
      const p = player(a.id);
      if (p.team !== 0 || p.registration !== "senior")
        throw Error("支配下選手から選んでください。");
      const ids = w.teams[0].activeIds;
      if (ids.includes(p.id))
        w.teams[0].activeIds = ids.filter((id) => id !== p.id);
      else {
        if (ids.length >= 31)
          throw Error("一軍31人枠が満員です。先に登録を外してください。");
        if (
          p.species === "dog" &&
          ids.filter((id) => player(id).species === "dog").length >= 4
        )
          throw Error("外国人一軍枠は4人までです。");
        ids.push(p.id);
      }
      return true;
    }
    case "preseason": {
      phase(["preseason"]);
      if (w.preseasonDone) throw Error("オープン戦は実施済みです。");
      const strength =
        seniorRoster(w)
          .sort((a, b) => ability(b) - ability(a))
          .slice(0, 25)
          .reduce((n, p) => n + ability(p), 0) / 25;
      w.preseasonRecord = { wins: 0, losses: 0, draws: 0 };
      for (let i = 0; i < 12; i++) {
        const opponent =
          seniorRoster(w, 1 + (i % 11))
            .sort((a, b) => ability(b) - ability(a))
            .slice(0, 25)
            .reduce((n, p) => n + ability(p), 0) / 25;
        const roll = random(w);
        if (roll < 0.04) w.preseasonRecord.draws++;
        else if (
          roll <
          Math.max(0.15, Math.min(0.85, 0.5 + (strength - opponent) * 0.013))
        )
          w.preseasonRecord.wins++;
        else w.preseasonRecord.losses++;
      }
      w.preseasonReport = seniorRoster(w)
        .map((p) => ({
          player: p.id,
          rating: Math.round(ability(p) + integer(w, -12, 12)),
          note: p.age < 26 ? "若手の伸びをチェック" : "開幕状態を確認",
        }))
        .sort((a, b) => b.rating - a.rating);
      w.preseasonDone = true;
      chooseActive(w);
      news(
        w,
        "オープン戦の評価",
        `12試合の調整を終了。${player(w.preseasonReport[0].player).name}が好調。一軍候補を確認しましょう。`,
      );
      return true;
    }
    default:
      return false;
  }
}

export function resetOperations(w: WorldState) {
  delete w.draftPending;
  w.draftLog = [];
  w.lottery = null;
  w.activeDraftDone = false;
  w.activeDraftPool = [];
  w.compensations = [];
  w.campPlan = emptyCampPlan();
  w.preseasonDone = false;
  w.preseasonRecord = undefined;
  w.preseasonReport = [];
}
export function upgradeLegacy(value: unknown): WorldState {
  const old = value as WorldState;
  if (
    (value as { version?: number })?.version !== 2 ||
    !Array.isArray(old.players) ||
    !Array.isArray(old.teams) ||
    old.teams.length !== 12 ||
    !Array.isArray(old.staff)
  )
    throw Error("旧オーナー版セーブの形式が不正です。");
  const w = structuredClone(old);
  w.version = 3;
  resetOperations(w);
  const phases: Record<string, Phase> = {
    staff: "contracts",
    fa: "contracts",
    cs: "review",
    series: "review",
    settlement: "review",
  };
  w.phase = phases[w.phase] ?? w.phase;
  w.nextId = Math.max(
    w.nextId,
    ...[...w.players, ...w.staff].map((p) => Number(p.id.slice(1)) + 1),
  );
  for (const [i, t] of w.teams.entries()) {
    Object.assign(t, {
      name: CLUBS[i].name,
      short: CLUBS[i].short,
      city: CLUBS[i].city,
      league: CLUBS[i].league,
      color: CLUBS[i].color,
      activeIds: [],
    });
    t.finance.salaryBudget = Math.max(280000, payroll(w, i) * 1.3);
    t.finance.attendance ??= 0;
    let foreign = 0;
    for (const p of w.players.filter((p) => p.team === i)) {
      if (p.species === "dog" && foreign++ >= 5) p.species = "cat";
    }
  }
  for (const p of w.players) {
    p.registration = "senior";
    p.negotiation = p.contractYear >= w.year + 1 ? "accepted" : "pending";
    p.meetingReason = "";
    p.incentive = 0;
    p.promise = "none";
    p.draftYear = p.market === "draft" ? w.year + 1 : 0;
    p.formerTeam = null;
    p.faRank = "C";
    if (p.market === "draft") p.species = "cat";
  }
  for (const t of w.teams) {
    while (seniorRoster(w, t.id).length < 66) {
      const i = seniorRoster(w, t.id).length;
      const p = newPlayer(
        w,
        t.id,
        i % 3 === 0 ? "投" : POSITIONS[1 + (i % 8)],
        "roster",
        "cat",
      );
      p.contractYear = w.phase === "season" ? w.year : w.year + 1;
      p.negotiation = "accepted";
    }
    chooseActive(w, t.id);
  }
  for (const a of w.archives)
    for (const f of a.finances) {
      f.attendance ??= 0;
      f.budget ??= 0;
      f.payroll ??= 0;
    }
  if (w.phase === "contracts") contractAssessment(w);
  if (w.phase === "activeDraft") makeActiveDraftPool(w);
  news(
    w,
    "福岡・セパ版へ引き継ぎ",
    "旧セーブを別の保存領域へ引き継ぎました。球団配置と登録枠を更新し、選手能力・年度成績・資金を保持しています。",
  );
  return w;
}
