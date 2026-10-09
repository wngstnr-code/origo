import { EXPLORERS, REGISTRY_ADDRESS, monadTestnet } from "@origo/sdk";

/** The landing reads the frozen testnet deployment until mainnet is live. */
export const CHAIN = monadTestnet;
export const REGISTRY = REGISTRY_ADDRESS[CHAIN.id]!;
export const EXPLORER = EXPLORERS[CHAIN.id];
