import type { Address } from "viem";
import { monad, monadTestnet } from "viem/chains";

/** OrigoRegistry deployments. Filled in after each deploy and mirrored in docs/origo/PROGRESS.md. */
export const REGISTRY_ADDRESS: Partial<Record<number, Address>> = {
  [monad.id]: undefined,
  [monadTestnet.id]: "0xf9C32b380540F0E66104687224296224B794b21F",
};
