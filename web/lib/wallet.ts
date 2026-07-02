"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, formatEther, http, type WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { gnosis } from "viem/chains";
import { publicClient, RPC_URL } from "./chain";

export type Role = "john" | "worker";

const storageKey = (role: Role) => `zkburn.${role}.pk`;

/** Lazily creates (and persists) a burner account for the given role. */
export function getBurnerAccount(role: Role): PrivateKeyAccount {
  if (typeof window === "undefined") {
    throw new Error("Burner wallets are only available in the browser");
  }
  let pk = window.localStorage.getItem(storageKey(role)) as `0x${string}` | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    window.localStorage.setItem(storageKey(role), pk);
  }
  return privateKeyToAccount(pk);
}

export function getWalletClient(account: PrivateKeyAccount): WalletClient {
  return createWalletClient({ account, chain: gnosis, transport: http(RPC_URL) });
}

/** Burner wallet hook: account, address, live balance (polled every 10s). */
export function useBurner(role: Role) {
  const [account, setAccount] = useState<PrivateKeyAccount | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    setAccount(getBurnerAccount(role));
  }, [role]);

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    try {
      setBalance(await publicClient.getBalance({ address: account.address }));
    } catch {
      // keep the previous value on transient RPC errors
    }
  }, [account]);

  useEffect(() => {
    if (!account) return;
    refreshBalance();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshBalance();
    }, 10_000);
    return () => clearInterval(id);
  }, [account, refreshBalance]);

  const walletClient = useMemo(() => (account ? getWalletClient(account) : null), [account]);

  return {
    account,
    address: account?.address,
    walletClient,
    balance,
    balanceFormatted: balance === null ? "…" : Number(formatEther(balance)).toFixed(4),
    hasFunds: balance !== null && balance > 0n,
    refreshBalance,
  };
}
