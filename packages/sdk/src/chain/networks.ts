import { monad, monadTestnet } from "viem/chains";

/** Public RPC endpoints in fallback order (Monad docs, checked 2026-10-09). */
export const RPC_URLS = {
  [monad.id]: [
    "https://rpc.monad.xyz",
    "https://rpc1.monad.xyz",
    "https://rpc3.monad.xyz",
    "https://rpc-mainnet.monadinfra.com",
  ],
  [monadTestnet.id]: [
    "https://testnet-rpc.monad.xyz",
    "https://rpc.ankr.com/monad_testnet",
    "https://rpc-testnet.monadinfra.com",
  ],
} as const;

export const EXPLORERS = {
  [monad.id]: "https://monadvision.com",
  [monadTestnet.id]: "https://testnet.monadvision.com",
} as const;

export const TESTNET_FAUCET = "https://faucet.monad.xyz";

export { monad, monadTestnet };
