// Stars at fixed positions (percent of the hero), so the sky is the same on every load.
const STARS: ReadonlyArray<[number, number, number]> = [
  [14, 30, 2], [22, 52, 1.5], [31, 18, 1.5], [38, 70, 2], [44, 40, 1], [52, 12, 1.5], [57, 62, 1.5],
  [63, 28, 2], [69, 74, 1], [74, 44, 1.5], [79, 16, 1], [84, 58, 2], [89, 34, 1.5], [93, 70, 1],
  [96, 22, 1.5], [27, 84, 1], [48, 88, 1.5], [66, 90, 1], [8, 64, 1.5], [35, 8, 1], [72, 6, 1.5],
];

export function Stars() {
  return (
    <div className="stars" aria-hidden="true">
      {STARS.map(([x, y, r], i) => (
        <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2 }} />
      ))}
    </div>
  );
}

const ink = { stroke: "var(--ink)", strokeWidth: 5, strokeLinejoin: "round" as const };

/** Lilac planet with craters, top right. */
export function PlanetCraters({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="80" r="72" fill="var(--planet-lilac)" {...ink} />
      <path d="M30 118 A72 72 0 0 0 150 92 A62 62 0 0 1 30 118 Z" fill="var(--planet-lilac-2)" />
      <circle cx="56" cy="56" r="14" fill="var(--planet-lilac-2)" {...ink} strokeWidth={4} />
      <circle cx="104" cy="44" r="8" fill="var(--planet-lilac-2)" {...ink} strokeWidth={4} />
      <circle cx="98" cy="96" r="11" fill="var(--planet-lilac-2)" {...ink} strokeWidth={4} />
    </svg>
  );
}

/** Coral planet, sits behind the hero buttons. */
export function PlanetCoral({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" fill="var(--planet-coral)" {...ink} />
      <path d="M22 70 C70 52 140 58 186 80" fill="none" stroke="var(--planet-coral-2)" strokeWidth="12" strokeLinecap="round" />
      <path d="M14 112 C70 98 128 104 188 122" fill="none" stroke="var(--planet-coral-2)" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

/** Small mustard planet with a ring. */
export function PlanetRing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 100" aria-hidden="true">
      <ellipse cx="70" cy="54" rx="66" ry="16" fill="none" {...ink} strokeWidth={9} transform="rotate(-14 70 54)" />
      <circle cx="70" cy="50" r="34" fill="var(--planet-mustard)" {...ink} />
      <path d="M8 64 C50 52 92 42 132 30" fill="none" stroke="var(--planet-mustard-2)" strokeWidth="5" transform="rotate(-2 70 50)" />
      <ellipse cx="70" cy="54" rx="66" ry="16" fill="none" stroke="var(--planet-mustard-2)" strokeWidth={4}
        strokeDasharray="0 104 120 400" transform="rotate(-14 70 54)" />
    </svg>
  );
}

/** The light surface the hero lands on. */
export function Shore() {
  return (
    <svg className="shore" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 260 L0 236 C380 248 700 190 980 120 C1180 70 1330 46 1440 18 L1440 260 Z" fill="var(--paper)" />
    </svg>
  );
}
