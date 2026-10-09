import type { Address } from "viem";
import { monad, monadTestnet } from "viem/chains";

/** OrigoRegistry deployments. Filled in after each deploy and mirrored in docs/origo/PROGRESS.md. */
export const REGISTRY_ADDRESS: Partial<Record<number, Address>> = {
  [monad.id]: undefined,
  [monadTestnet.id]: "0xEe00BC6a082914b5d5455624a3727dEE1B3c78F6",
};
