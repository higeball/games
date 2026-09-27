import type { Player } from "./model";

const coats = [
  "#dfad68",
  "#464651",
  "#faf3de",
  "#c88850",
  "#849597",
  "#ae8970",
  "#d5c4b1",
  "#7c5c43",
  "#b5b9c4",
  "#ecd89e",
  "#aa6553",
  "#695a6c",
];
const eyes = ["#719d77", "#bf9444", "#679ab2", "#a67c49", "#88adad", "#a8ab56"];
const shirts = [
  "#203b4c",
  "#345f55",
  "#755951",
  "#597290",
  "#8a635a",
  "#576b4f",
  "#605678",
  "#9b7b48",
];
export function portraitPattern(p: Pick<Player, "id" | "species">) {
  let n = Number(p.id.replace(/\D/g, ""));
  if (!Number.isSafeInteger(n) || n <= 0)
    n = [...p.id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 1);
  const take = (base: number) => {
    const value = n % base;
    n = Math.floor(n / base);
    return value;
  };
  return {
    coat: take(12),
    marking: take(8),
    eyes: take(6),
    ears: take(5),
    muzzle: take(4),
    shirt: take(8),
    collar: take(4),
  };
}

/** Code-native portraits: 368,640 visual combinations per species, stable by ID. */
export function AnimalPortrait({ p }: { p: Player }) {
  const v = portraitPattern(p),
    dog = p.species === "dog",
    fur = coats[v.coat],
    eye = eyes[v.eyes];
  const earTop = 8 + v.ears * 2,
    muzzle = 6 + v.muzzle * 1.5;
  return (
    <div
      className={`animal procedural ${p.species}`}
      role="img"
      aria-label={`${p.name}の${dog ? "犬" : "猫"}ポートレート`}
      data-portrait={`${p.species}:${Object.values(v).join("-")}`}
    >
      <svg viewBox="0 0 100 106" aria-hidden="true">
        <ellipse cx="50" cy="99" rx="43" ry="7" fill="#193c3020" />
        <g stroke="#343433" strokeWidth="2.2" strokeLinejoin="round">
          <path
            d="M12 103 Q14 77 36 73 L64 73 Q86 77 88 103Z"
            fill={shirts[v.shirt]}
          />
          <path
            d={`M34 76 L50 ${88 + v.collar * 2} L66 76 L60 102 H40Z`}
            fill="#fcf1d8"
          />
          <path d="M50 88V104" fill="none" />
          {dog && v.ears % 2 === 0 ? (
            <>
              <path d={`M26 28Q5 ${earTop} 9 56Q14 70 29 52Z`} fill={fur} />
              <path d={`M74 28Q95 ${earTop} 91 56Q86 70 71 52Z`} fill={fur} />
            </>
          ) : (
            <>
              <path d={`M20 40L17 ${earTop}Q29 8 41 32Z`} fill={fur} />
              <path d={`M59 32Q71 8 83 ${earTop}L80 40Z`} fill={fur} />
              <path
                d={`M24 30L23 ${earTop + 8}L33 29 M67 29L77 ${earTop + 8}L76 30`}
                fill="#cf9389"
                stroke="none"
              />
            </>
          )}
          <path
            d="M20 38Q23 22 50 23Q77 22 80 38L83 53Q81 79 50 82Q19 79 17 53Z"
            fill={fur}
          />
        </g>
        <g fill={v.coat % 2 ? "#fcf1dd" : "#54443bcc"}>
          {v.marking === 1 && (
            <path d="M24 36Q34 25 48 26L40 52Q21 57 23 41Z" />
          )}
          {v.marking === 2 && (
            <path d="M52 26Q68 25 77 37L77 48Q62 58 57 46Z" />
          )}
          {v.marking === 3 && <path d="M41 25L59 25L54 53L46 53Z" />}
          {v.marking === 4 && (
            <>
              <path d="M22 39L34 44L22 47M20 53L32 56L23 61M78 39L66 44L78 47M80 53L68 56L77 61M37 26L40 37L45 25M54 25L60 37L63 26" />
            </>
          )}
          {v.marking === 5 && (
            <>
              <ellipse cx="34" cy="38" rx="10" ry="8" />
              <ellipse cx="70" cy="61" rx="10" ry="6" />
              <ellipse cx="53" cy="29" rx="5" ry="4" />
            </>
          )}
          {v.marking === 6 && (
            <path d="M24 34Q50 15 76 34L70 52L59 45L50 50L41 45L30 52Z" />
          )}
          {v.marking === 7 && (
            <>
              <path d="M25 61Q50 53 75 61Q69 77 50 80Q31 77 25 61Z" />
              <circle cx="67" cy="32" r="6" />
            </>
          )}
        </g>
        <g stroke="#343433" strokeWidth="2">
          <ellipse cx="35" cy="49" rx="8" ry="9" fill={eye} />
          <ellipse cx="65" cy="49" rx="8" ry="9" fill={eye} />
          <ellipse cx="35" cy="50" rx={dog ? 4 : 2.4} ry="6" fill="#242927" />
          <ellipse cx="65" cy="50" rx={dog ? 4 : 2.4} ry="6" fill="#242927" />
        </g>
        <g fill="#fff">
          <circle cx="33" cy="46" r="2" />
          <circle cx="63" cy="46" r="2" />
        </g>
        <ellipse cx="42" cy="65" rx={muzzle} ry="7" fill="#fbefdd" />
        <ellipse cx="58" cy="65" rx={muzzle} ry="7" fill="#fbefdd" />
        <path
          d={dog ? "M43 60Q50 56 57 60L54 66H46Z" : "M44 60Q50 58 56 60L50 65Z"}
          fill={dog ? "#343433" : "#bb7f79"}
        />
        <g fill="none" stroke="#343433" strokeWidth="1.5" strokeLinecap="round">
          <path d="M50 65V68Q44 73 40 68M50 68Q56 73 60 68" />
          {!dog && (
            <path d="M31 62L12 59M31 67L12 70M69 62L88 59M69 67L88 70" />
          )}
        </g>
        <circle cx="72" cy="91" r="5" fill="#ead4a5" />
        <path d="M70 91L72 89L74 91L72 93Z" fill={shirts[v.shirt]} />
      </svg>
      <span>{dog ? "犬" : "猫"}</span>
    </div>
  );
}
