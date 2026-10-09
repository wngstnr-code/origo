import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { publicClient } from "./registry";

export const mon = (wei: bigint) => `${Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 3 })} MON`;

/** Wallet balance, refreshed every few seconds while someone tops up from the faucet in another tab. */
export function useBalance(address: `0x${string}` | undefined, refresh: number) {
  const [balance, setBalance] = useState<bigint | null>(null);
  useEffect(() => {
    if (!address) return;
    let live = true;
    const read = () =>
      publicClient.getBalance({ address }).then(
        (b) => live && setBalance(b),
        () => undefined,
      );
    void read();
    // Keep it fresh while the person tops up from the faucet in another tab.
    const timer = setInterval(read, 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [address, refresh]);
  return address ? balance : null;
}
