/** Origo's mark: the mascot's head, its right eye behind a magnifying glass. Same drawing as public/favicon.svg. */
export function OwlMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M22 40 L14 8 L46 26 Z" fill="var(--owl-2)" />
        <path d="M92 36 L104 6 L76 24 Z" fill="var(--owl-2)" />
        <path d="M60 18 C92 18 108 40 108 68 C108 98 88 114 60 114 C32 114 12 98 12 68 C12 40 28 18 60 18 Z" fill="var(--owl)" />
        <circle cx="38" cy="62" r="17" fill="var(--white)" />
        <circle cx="42" cy="66" r="7" fill="var(--ink)" stroke="none" />
        <path d="M21 58 C26 44 50 42 55 56 C44 53 31 53 21 58 Z" fill="var(--owl-lid)" />
        <path d="M54 80 L66 80 L60 92 Z" fill="var(--beak)" strokeWidth="5" />
        <g transform="translate(97 84) rotate(-40)">
          <rect x="-7" y="0" width="14" height="30" rx="6" fill="var(--wood)" strokeWidth="5" />
        </g>
        <circle cx="80" cy="62" r="22" fill="var(--lens-glass)" />
        <circle cx="84" cy="66" r="10" fill="var(--ink)" stroke="none" />
        <circle cx="88" cy="61" r="3.5" fill="var(--white)" stroke="none" />
        <circle cx="80" cy="62" r="22" fill="none" strokeWidth="10" />
        <circle cx="80" cy="62" r="22" fill="none" stroke="var(--metal)" strokeWidth="4" />
      </g>
    </svg>
  );
}
