import type { Address } from "viem";
import { monad, monadTestnet } from "viem/chains";

/** OrigoRegistry deployments. Filled in after each deploy and mirrored in docs/origo/PROGRESS.md. */
export const REGISTRY_ADDRESS: Partial<Record<number, Address>> = {
  [monad.id]: undefined,
  [monadTestnet.id]: "0x3cdFC7B2CF9aCbC0476a72b03b259719aFfBbC7C",
};
