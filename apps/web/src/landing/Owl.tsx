/**
 * Origo's mascot: a skeptical owl checking a photo through a magnifying glass.
 * Drawn by hand as flat shapes with an ink outline, so it scales and themes with CSS variables.
 */
export function Owl({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 760" role="img" aria-label="An owl looking through a magnifying glass">
      <g stroke="var(--ink)" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round">
        {/* ear tufts */}
        <path d="M150 262 C118 200 104 146 96 92 C150 120 204 166 236 222 Z" fill="var(--owl-2)" />
        <path d="M418 220 C452 166 500 122 552 98 C548 152 532 208 504 258 Z" fill="var(--owl-2)" />

        {/* body */}
        <path
          d="M36 790 C8 610 26 430 108 316 C178 220 296 190 378 198 C500 210 592 300 612 432 C632 566 618 690 604 790 Z"
          fill="var(--owl)"
        />

        {/* chest feathers */}
        <g fill="none" stroke="var(--owl-2)" strokeWidth="7">
          <path d="M168 606 q16 20 32 0" />
          <path d="M244 640 q16 20 32 0" />
          <path d="M140 684 q16 20 32 0" />
          <path d="M214 714 q16 20 32 0" />
          <path d="M320 690 q16 20 32 0" />
        </g>

        {/* facial disc */}
        <path
          d="M300 304 C248 252 116 254 108 372 C100 474 202 522 300 502 C400 522 510 472 502 372 C494 254 352 252 300 304 Z"
          fill="var(--owl-face)"
        />

        {/* left eye, half lidded: not convinced yet */}
        <circle cx="205" cy="388" r="62" fill="var(--white)" />
        <circle cx="219" cy="398" r="27" fill="var(--ink)" stroke="none" />
        <circle cx="229" cy="388" r="8" fill="var(--white)" stroke="none" />
        <path d="M141 380 C162 338 248 330 269 372 C232 362 180 364 141 380 Z" fill="var(--owl-lid)" />

        {/* beak */}
        <path d="M278 444 C292 432 318 432 332 444 L306 494 Z" fill="var(--beak)" />

        {/* magnifier handle, held by the wing */}
        <g transform="translate(492 470) rotate(-38)">
          <rect x="-24" y="18" width="48" height="230" rx="20" fill="var(--wood)" />
          <rect x="-30" y="0" width="60" height="34" rx="10" fill="var(--metal)" />
        </g>

        {/* the magnified right eye */}
        <circle cx="410" cy="378" r="94" fill="var(--white)" />
        <circle cx="426" cy="392" r="42" fill="var(--ink)" stroke="none" />
        <circle cx="444" cy="372" r="13" fill="var(--white)" stroke="none" />
        <circle cx="410" cy="378" r="118" fill="var(--lens)" fillOpacity="0.32" stroke="none" />
        <path d="M334 340 A88 88 0 0 1 388 290" fill="none" stroke="var(--white)" strokeWidth="11" strokeOpacity="0.9" />
        <circle cx="410" cy="378" r="118" fill="none" strokeWidth="32" />
        <circle cx="410" cy="378" r="118" fill="none" stroke="var(--metal)" strokeWidth="18" />

        {/* wing */}
        <path
          d="M476 790 C470 676 514 604 574 594 C628 586 652 626 642 666 C632 706 600 726 560 736 C590 744 600 770 596 790 Z"
          fill="var(--owl-2)"
        />
        <g fill="none" strokeWidth="6">
          <path d="M560 640 q18 4 30 18" />
          <path d="M548 674 q20 4 34 18" />
        </g>
      </g>
    </svg>
  );
}
