/**
 * Minimal Code 39 ( symbology ) barcode rendered as SVG.
 *
 * Code 39 covers 0-9, A-Z, space and - . $ / + %, encodes every character as
 * 9 elements (5 bars / 4 spaces) of which 3 are wide, and is self-checking via
 * a mandatory leading and trailing `*`. Barcode scanners at clinic reception
 * read it reliably, which is why it is preferred over a decorative mock.
 */
const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

const NARROW_UNITS = 2;
const WIDE_UNITS = 5;
const QUIET_ZONE_UNITS = 10;

/** `#` has no Code 39 representation; `%` is the conventional stand-in. */
function normalize(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .map((char) => (char === "#" ? "%" : CODE39_PATTERNS[char] ? char : "-"))
    .join("");
}

interface BarSegment {
  x: number;
  width: number;
}

function buildSegments(normalized: string): {
  bars: BarSegment[];
  spaces: BarSegment[];
  totalUnits: number;
} {
  const modules: { wide: boolean; isBar: boolean }[] = [];

  for (const char of normalized) {
    const pattern = CODE39_PATTERNS[char];
    pattern.split("").forEach((token, index) => {
      modules.push({ wide: token === "w", isBar: index % 2 === 0 });
    });
    // Inter-character gap: one narrow space (element index 9).
    modules.push({ wide: false, isBar: false });
  }

  const bars: BarSegment[] = [];
  const spaces: BarSegment[] = [];
  let cursor = 0;
  for (const module of modules) {
    const width = module.wide ? WIDE_UNITS : NARROW_UNITS;
    const segment = { x: cursor, width };
    if (module.isBar) bars.push(segment);
    else spaces.push(segment);
    cursor += width;
  }

  return { bars, spaces, totalUnits: cursor };
}

interface ThermalBarcodeProps {
  value: string;
  height?: number;
  className?: string;
}

export default function ThermalBarcode({
  value,
  height = 44,
  className = "",
}: ThermalBarcodeProps) {
  const normalized = normalize(value);
  const { bars, spaces, totalUnits } = buildSegments(`*${normalized}*`);
  const viewBoxWidth = totalUnits + QUIET_ZONE_UNITS * 2;

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} 10`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Mã vạch phiếu ${value}`}
      className={`w-full ${className}`}
      style={{ height }}
    >
      <rect x="0" y="0" width={viewBoxWidth} height="10" fill="#ffffff" />
      {/* Pure black: thermal heads are monochrome, so anything lighter than
          #000000 risks a scanner missing a 2-unit bar. */}
      <g transform={`translate(${QUIET_ZONE_UNITS}, 0)`} fill="#000000">
        {spaces.map((segment) => (
          <rect
            key={`s-${segment.x}`}
            x={segment.x}
            y="0"
            width={segment.width}
            height="10"
            fill="#ffffff"
          />
        ))}
        {bars.map((segment) => (
          <rect
            key={`b-${segment.x}`}
            x={segment.x}
            y="0"
            width={segment.width}
            height="10"
          />
        ))}
      </g>
    </svg>
  );
}
