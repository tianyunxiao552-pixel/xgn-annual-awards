import { useId } from "react";

const LETTERS = [
  "M1 2h6.8L27 28h-6.8L1 2Zm21.2 0H28l-9.2 12.3-2.9-3.9L22.2 2ZM10.8 17.3l2.9 3.9L8.6 28H2.8l8-10.7Z",
  "M64 5.7 60.5 9A11.4 11.4 0 0 0 52 5.6C46.3 5.6 42.6 9.4 42.6 15s3.8 9.4 9.4 9.4c2.6 0 4.9-.6 6.6-1.8v-5.2h-7.7l3.2-4.2h9.3v11.7C60.4 27.5 56.5 29 52 29c-8.5 0-14.6-5.5-14.6-14S43.5 1 52 1c4.9 0 9.1 1.7 12 4.7Z",
  "M75 2h5.1l19.2 25.9H94L75 2Zm0 8.7 4.8 6.5V28H75V10.7ZM99.2 2h4.8v26h-4.8V2Z",
];
const SEAMS = "M3 29h25M43 29h18M80 1h20";
const letterPaths = () => LETTERS.map((d) => <path key={d} d={d} />);

/** XGN wordmark. `prism` renders the cover's chrome + iridescent-film variant. */
export function Wordmark({ prism = false }) {
  return prism ? <PrismWordmark /> : <PlainWordmark />;
}

function PlainWordmark() {
  const ink = useId();
  return (
    <svg
      className="xgn-mark"
      viewBox="0 0 106 30"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={ink} x1="0.08" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor="#fffdf8" />
          <stop
            offset=".44"
            stopColor="color-mix(in srgb, var(--accent), #ebe7df 78%)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in srgb, var(--accent), #858992 62%)"
          />
        </linearGradient>
      </defs>
      <g fill={`url(#${ink})`}>{letterPaths()}</g>
      <path
        className="xgn-seam"
        d={SEAMS}
        fill="none"
        stroke="currentColor"
        strokeWidth=".55"
      />
    </svg>
  );
}

/**
 * Layers, bottom to top:
 * 1. metal  – vertical chrome ramp (light/dark comes only from here)
 * 2. iris   – drifting palette film, overlay-blended so it tints the metal
 * 3. sheen  – narrow highlight that sweeps across occasionally
 * 4. bevel  – hairline top-lit edge
 * Colours come from CSS vars --logo-film-1..4 (see cover.css).
 */
/**
 * Cover prism wordmark:
 * - Separate under-strokes (recessed wings/stems) and over-strokes (main bars)
 *   so intersections have true 3D depth like machined titanium.
 * - Multi-color prismatic light pools (--logo-c1..c4) reflect across the crowns,
 *   facets, and lower bevel rims without washing out the metallic body.
 * - Razor-thin bevel highlight + slow diagonal specular sweep.
 */
function PrismWordmark() {
  const uid = useId();
  const id = (name) => `${uid}-${name}`;
  const url = (name) => `url(#${id(name)})`;
  return (
    <svg
      className="xgn-mark xgn-mark--prism"
      viewBox="0 0 106 30"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Main foreground metal body: warm ivory crown -> brushed titanium -> cool slate */}
        <linearGradient
          id={id("body")}
          gradientUnits="userSpaceOnUse"
          x1="8"
          y1="1"
          x2="96"
          y2="29"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c1) 24%, #faf6ee)"
          />
          <stop
            offset=".28"
            stopColor="color-mix(in oklab, var(--logo-c1) 16%, #dde1e4)"
          />
          <stop
            offset=".55"
            stopColor="color-mix(in oklab, var(--logo-c2) 22%, #a2b0b8)"
          />
          <stop
            offset=".8"
            stopColor="color-mix(in oklab, var(--logo-c3) 20%, #8d9aa4)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c2) 48%, #bce6ee)"
          />
        </linearGradient>

        {/* Recessed under-strokes of X: shaded near the central intersection, luminous at outer tips */}
        <linearGradient
          id={id("x-upper")}
          gradientUnits="userSpaceOnUse"
          x1="16"
          y1="14"
          x2="27"
          y2="2"
        >
          <stop offset="0" stopColor="#46525a" />
          <stop
            offset=".28"
            stopColor="color-mix(in oklab, var(--logo-c2) 28%, #8d9ca6)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c1) 24%, #ece9e0)"
          />
        </linearGradient>
        <linearGradient
          id={id("x-lower")}
          gradientUnits="userSpaceOnUse"
          x1="13"
          y1="17"
          x2="4"
          y2="28"
        >
          <stop offset="0" stopColor="#3f4952" />
          <stop
            offset=".32"
            stopColor="color-mix(in oklab, var(--logo-c1) 26%, #8c9298)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c1) 36%, #d8cfc2)"
          />
        </linearGradient>

        {/* Recessed stems of N: shadowed near the diagonal cut, catching warm/cyan light on the stems */}
        <linearGradient
          id={id("n-left")}
          gradientUnits="userSpaceOnUse"
          x1="77"
          y1="11"
          x2="77"
          y2="28"
        >
          <stop offset="0" stopColor="#525a62" />
          <stop
            offset=".35"
            stopColor="color-mix(in oklab, var(--logo-c3) 26%, #b8b6bc)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c1) 34%, #cbbeb2)"
          />
        </linearGradient>
        <linearGradient
          id={id("n-right")}
          gradientUnits="userSpaceOnUse"
          x1="101.6"
          y1="2"
          x2="101.6"
          y2="28"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c1) 20%, #f0ede6)"
          />
          <stop
            offset=".58"
            stopColor="color-mix(in oklab, var(--logo-c3) 22%, #98a4ae)"
          />
          <stop
            offset=".86"
            stopColor="color-mix(in oklab, var(--logo-c2) 46%, #749eab)"
          />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c2) 68%, #9be4f0)"
          />
        </linearGradient>

        {/* Multi-color prismatic rim & aurora light pools */}
        <radialGradient
          id={id("rim-x")}
          gradientUnits="userSpaceOnUse"
          cx="24.5"
          cy="27.5"
          r="13"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c2) 78%, #ffffff)"
            stopOpacity=".92"
          />
          <stop
            offset=".45"
            stopColor="color-mix(in oklab, var(--logo-c2) 65%, #b0e8f0)"
            stopOpacity=".42"
          />
          <stop offset="1" stopColor="var(--logo-c2)" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={id("rim-g")}
          gradientUnits="userSpaceOnUse"
          cx="52"
          cy="28.5"
          r="15"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c2) 72%, #ffffff)"
            stopOpacity=".88"
          />
          <stop
            offset=".5"
            stopColor="color-mix(in oklab, var(--logo-c3) 55%, var(--logo-c2))"
            stopOpacity=".35"
          />
          <stop offset="1" stopColor="var(--logo-c3)" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={id("rim-n")}
          gradientUnits="userSpaceOnUse"
          cx="97.5"
          cy="27.5"
          r="13"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c2) 76%, #ffffff)"
            stopOpacity=".9"
          />
          <stop
            offset=".48"
            stopColor="color-mix(in oklab, var(--logo-c4) 40%, var(--logo-c2))"
            stopOpacity=".36"
          />
          <stop offset="1" stopColor="var(--logo-c2)" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={id("warm-crown")}
          gradientUnits="userSpaceOnUse"
          cx="32"
          cy="2"
          r="38"
        >
          <stop
            offset="0"
            stopColor="color-mix(in oklab, var(--logo-c1) 62%, #fffdf8)"
            stopOpacity=".55"
          />
          <stop
            offset=".6"
            stopColor="color-mix(in oklab, var(--logo-c3) 42%, transparent)"
            stopOpacity=".18"
          />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Subtle drifting iridescent film */}
        <linearGradient
          id={id("film")}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="106"
          y2="14"
          spreadMethod="repeat"
        >
          <stop offset="0" stopColor="var(--logo-film-1)" />
          <stop offset=".28" stopColor="var(--logo-film-2)" />
          <stop offset=".56" stopColor="var(--logo-film-3)" />
          <stop offset=".8" stopColor="var(--logo-film-4)" />
          <stop offset="1" stopColor="var(--logo-film-1)" />
        </linearGradient>

        <linearGradient id={id("sheen")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <linearGradient
          id={id("bevel")}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="1"
          x2="0"
          y2="29"
        >
          <stop offset="0" stopColor="#fffdf9" stopOpacity=".92" />
          <stop offset=".32" stopColor="#ffffff" stopOpacity=".18" />
          <stop offset=".75" stopColor="#a8dce6" stopOpacity=".15" />
          <stop
            offset="1"
            stopColor="color-mix(in oklab, var(--logo-c2) 70%, #ffffff)"
            stopOpacity=".85"
          />
        </linearGradient>

        <clipPath id={id("clip")}>{letterPaths()}</clipPath>
      </defs>

      {/* 1. Recessed under-strokes with intersection depth */}
      <g className="xgn-under">
        <path d="M22.2 2H28l-9.2 12.3-2.9-3.9L22.2 2Z" fill={url("x-upper")} />
        <path d="M10.8 17.3l2.9 3.9L8.6 28H2.8l8-10.7Z" fill={url("x-lower")} />
        <path d="M75 10.7l4.8 6.5V28H75V10.7Z" fill={url("n-left")} />
        <path d="M99.2 2h4.8v26h-4.8V2Z" fill={url("n-right")} />
      </g>

      {/* 2. Primary foreground bars & G */}
      <g className="xgn-over" fill={url("body")}>
        <path d="M1 2h6.8L27 28h-6.8L1 2Z" />
        <path d={LETTERS[1]} />
        <path d="M75 2h5.1l19.2 25.9H94L75 2Z" />
      </g>

      {/* 3. Subtle drifting multi-color iridescent film */}
      <g className="xgn-iris" clipPath={url("clip")}>
        <rect
          className="xgn-film"
          x="-106"
          y="-2"
          width="318"
          height="34"
          fill={url("film")}
        />
      </g>

      {/* 4. Directional prismatic light pools (crown warmth + lower cyan/aurora rim glow) */}
      <g className="xgn-rim-lights" clipPath={url("clip")}>
        <rect x="0" y="0" width="106" height="30" fill={url("warm-crown")} />
        <circle cx="24.5" cy="27.5" r="13" fill={url("rim-x")} />
        <circle cx="52" cy="28.5" r="15" fill={url("rim-g")} />
        <circle cx="97.5" cy="27.5" r="13" fill={url("rim-n")} />
      </g>

      {/* 5. Occasional specular light sweep */}
      <g className="xgn-sheen" clipPath={url("clip")}>
        <rect
          className="xgn-sheen-bar"
          x="-14"
          y="-4"
          width="12"
          height="38"
          fill={url("sheen")}
        />
      </g>

      {/* 6. Crisp machined bevel edge along the letter contours */}
      <g
        className="xgn-bevel"
        fill="none"
        stroke={url("bevel")}
        strokeWidth=".22"
      >
        {letterPaths()}
      </g>
    </svg>
  );
}

const AWARD_KINDS = {
  最佳剧情: "story",
  最上瘾: "addictive",
  最失望: "disappointment",
  出乎意料: "surprise",
  最爱: "favorite",
  最难释怀: "lingering",
  最佳角色: "character",
  最佳关系: "relationship",
  最佳瞬间: "moment",
  最佳氛围: "atmosphere",
  声音记忆: "sound",
  遗珠: "pearl",
};

export function awardKind(name = "") {
  return AWARD_KINDS[name.replace(/^年度/, "")] || "custom";
}

export function AwardLabel({
  name = "年度评选",
  compact = false,
  context = "hero",
}) {
  const kind = awardKind(name);
  const hasPrefix = name.startsWith("年度");
  const core = hasPrefix ? name.slice(2) : name;
  return (
    <span
      className={`award-label award-label--${context} award-label--${kind}`}
    >
      <span className="sr-only">{compact ? core : name}</span>
      {!compact && hasPrefix ? (
        <span className="award-prefix" aria-hidden="true">
          年度
        </span>
      ) : null}
      <span className="award-name" aria-hidden="true">
        {Array.from(core).map((letter, i) => (
          <span className="award-letter" key={i}>
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
