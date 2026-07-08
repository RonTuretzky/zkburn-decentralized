"use client";

import { Wallet } from "@phosphor-icons/react";
import { useBurner, type Role } from "@/lib/wallet";

/** Small footer showing the anonymous session wallet address + live xDAI balance. */
export function WalletFooter({ role }: { role: Role }) {
  const { address, balanceFormatted, hasFunds, balance } = useBurner(role);

  if (!address) return null;

  return (
    <div className="mt-4 rounded-xl border border-paper-2 bg-paper-1 p-3 text-xs text-surface-grey-2">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 shrink-0" weight="bold" />
        <span className="font-medium text-surface-ink">Anonymous session wallet</span>
        <span className="ml-auto tabular-nums">{balanceFormatted} xDAI</span>
      </div>
      <div className="mt-1 break-all font-mono text-surface-grey">{address}</div>
      {balance !== null && !hasFunds && (
        <div className="mt-1 text-system-warning">
          Fund this address with a little xDAI to transact on Gnosis Chain.
        </div>
      )}
    </div>
  );
}
