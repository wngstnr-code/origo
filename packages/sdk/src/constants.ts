/** Version of the perceptual hash algorithm. Any change to the hashing steps requires a new version. */
export const HASH_VERSION = 1;

/** Provisional threshold for "same photo". Frozen after the robustness suite (docs/origo/GAPS.md G16). */
export const MATCH_DISTANCE = 7;

/** Maximum Hamming distance accepted by `linkDerivative` on-chain. */
export const LINK_DISTANCE = 7;

/** Hashes with fewer or more set bits than this range carry too little information and are rejected. */
export const MIN_POPCOUNT = 8;
export const MAX_POPCOUNT = 56;

/** Thumbnail limits for the optional on-chain preview. */
export const THUMBNAIL_MAX_EDGE = 96;
export const THUMBNAIL_MAX_BYTES = 4096;

/** Production domain. It is the passkey relying party id and must never change (G6). */
export const PRODUCTION_RP_ID = "origo-app.vercel.app";
