import type { Player } from "./model";
import { isCorePlayer } from "./release";
import { portraitPattern } from "./portraitPattern";

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
function shade(hex: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + amount))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Grid-aligned pixel sprites with stable, independently visible ID variations. */
export function PixelAnimalPortrait({
  p,
  core,
}: {
  p: Player;
  core?: boolean;
}) {
  const featured =
    core ??
    (p.team === 0 &&
      isCorePlayer(p, Math.max(...Object.keys(p.reports).map(Number))));
  const v = portraitPattern(p),
    dog = p.species === "dog";
  const fur = coats[v.coat],
    dark = shade(fur, -35),
    light = shade(fur, 23);
  const shirt = shirts[v.shirt],
    ink = "#182032",
    cream = "#fff1d6";
  const ear = 3 + v.ears,
    muzzle = 3 + v.muzzle;
  return (
    <div
      className={`animal procedural pixel-portrait ${p.species}${featured ? " core-portrait" : ""}`}
      data-core={featured}
      role="img"
      aria-label={`${p.name}の${dog ? "犬" : "猫"}ドット絵ポートレート`}
      data-style="pixel"
      data-portrait={`${p.species}:${Object.values(v).join("-")}`}
    >
      <svg viewBox="0 0 48 54" aria-hidden="true" shapeRendering="crispEdges">
        <path
          d="M15 36H33V38H39V41H43V45H45V54H3V45H5V41H9V38H15Z"
          fill={ink}
        />
        <path
          d="M15 38H33V40H38V43H41V47H43V54H5V47H7V43H10V40H15Z"
          fill={shirt}
        />
        <path
          d="M9 44H12V54H7V47H9ZM36 44H39V47H41V54H36Z"
          fill={shade(shirt, -21)}
        />
        <path d="M17 38H31V41H29V44H27V54H21V44H19V41H17Z" fill={cream} />
        <path
          d={`M14 39H19V41H21V${44 + v.collar}H19V44H17V42H14ZM29 39H34V42H31V44H29V${44 + v.collar}H27V41H29Z`}
          fill={shade(shirt, 37)}
        />
        <path d="M23 44H24V54H23ZM24 47H25V48H24ZM24 51H25V52H24Z" fill={ink} />
        {dog && v.ears % 2 === 0 ? (
          <>
            <path
              d={`M8 ${ear + 7}H16V29H12V34H6V31H4V17H8ZM32 ${ear + 7}H40V17H44V31H42V34H36V29H32Z`}
              fill={ink}
            />
            <path
              d={`M8 ${ear + 9}H13V28H10V31H7V27H6V18H8ZM35 ${ear + 9}H40V18H42V27H41V31H38V28H35Z`}
              fill={dark}
            />
          </>
        ) : (
          <>
            <path
              d={`M9 ${ear}H13V${ear + 2}H16V${ear + 5}H19V18H8V${ear + 4}H9ZM35 ${ear}H39V${ear + 4}H40V18H29V${ear + 5}H32V${ear + 2}H35Z`}
              fill={ink}
            />
            <path
              d={`M11 ${ear + 2}H13V${ear + 5}H16V17H10V${ear + 5}H11ZM35 ${ear + 2}H37V${ear + 5}H38V17H32V${ear + 5}H35Z`}
              fill={fur}
            />
            <path
              d={`M12 ${ear + 6}H14V17H12ZM34 ${ear + 6}H36V17H34Z`}
              fill="#d7958d"
            />
          </>
        )}
        <path
          d="M16 10H32V12H37V15H40V18H42V31H40V35H37V38H32V40H16V38H11V35H8V31H6V18H8V15H11V12H16Z"
          fill={ink}
        />
        <path
          d="M16 12H32V14H37V18H40V31H38V35H34V38H14V35H10V31H8V18H11V14H16Z"
          fill={fur}
        />
        <path d="M11 16H16V14H29V16H15V18H11ZM10 18H12V25H10Z" fill={light} />
        <path
          d="M37 18H40V31H38V35H34V38H14V35H11V32H16V35H31V33H35V29H37Z"
          fill={dark}
        />
        <g fill={v.coat % 2 ? cream : shade(fur, -57)}>
          {v.marking === 1 && <path d="M11 15H21V18H19V23H17V27H10V18H11Z" />}
          {v.marking === 2 && (
            <path d="M27 14H35V16H37V19H40V27H31V23H29V19H27Z" />
          )}
          {v.marking === 3 && <path d="M21 12H27V17H26V23H22V17H21Z" />}
          {v.marking === 4 && (
            <path d="M16 12H18V19H16ZM22 12H24V17H22ZM28 12H30V19H28ZM8 23H13V25H8ZM8 28H14V30H8ZM35 23H40V25H35ZM34 28H40V30H34Z" />
          )}
          {v.marking === 5 && (
            <path d="M12 15H18V17H20V20H13V18H12ZM32 28H38V32H34V34H30V31H32ZM26 12H29V15H26Z" />
          )}
          {v.marking === 6 && (
            <path d="M11 14H37V17H39V23H34V21H29V24H19V21H14V23H9V17H11Z" />
          )}
          {v.marking === 7 && (
            <path d="M10 31H15V29H33V31H38V35H33V38H15V35H10ZM32 14H36V18H32Z" />
          )}
        </g>
        <path
          d="M13 21H21V23H13ZM27 21H35V23H27ZM12 24H14V23H20V24H22V30H20V32H14V30H12ZM26 24H28V23H34V24H36V30H34V32H28V30H26Z"
          fill={ink}
        />
        <rect x="14" y="24" width="6" height="6" fill={cream} />
        <rect x="28" y="24" width="6" height="6" fill={cream} />
        <rect x="16" y="25" width="4" height="5" fill={eyes[v.eyes]} />
        <rect x="28" y="25" width="4" height="5" fill={eyes[v.eyes]} />
        <rect x="17" y="26" width={dog ? 2 : 1} height="4" fill={ink} />
        <rect x="29" y="26" width={dog ? 2 : 1} height="4" fill={ink} />
        <rect x="16" y="24" width="2" height="2" fill="#fff" />
        <rect x="28" y="24" width="2" height="2" fill="#fff" />
        <rect
          x={23 - muzzle}
          y="31"
          width={muzzle * 2 + 2}
          height="5"
          fill={cream}
        />
        <path
          d={
            dog
              ? "M21 30H27V33H25V34H23V33H21Z"
              : "M22 30H26V32H25V33H23V32H22Z"
          }
          fill={dog ? ink : "#bd7c76"}
        />
        <path d="M23 34H25V35H23ZM20 35H23V36H20ZM25 35H28V36H25Z" fill={ink} />
        {!dog && (
          <path
            d="M9 31H15V32H9ZM8 34H15V35H8ZM33 31H39V32H33ZM33 34H40V35H33Z"
            fill={ink}
          />
        )}
        <rect x="32" y="46" width="5" height="5" fill="#e9cea0" />
        <rect x="34" y="47" width="1" height="3" fill={shirt} />
      </svg>
      <span>{dog ? "犬" : "猫"}</span>
    </div>
  );
}
