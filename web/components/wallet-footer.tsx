"use client";

import { Wallet } from "lucide-react";
import { useBurner, type Role } from "@/lib/wallet";

/** Small monospace footer showing the burner wallet address + live xDAI balance. */
export function WalletFooter({ role }: { role: Role }) {
  const { address, balanceFormatted, hasFunds, balance } = useBurner(role);

  if (!address) return null;

  return (
    <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-xs text-gray-400">
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-gray-300 capitalize">{role} burner wallet</span>
        <span className="ml-auto">{balanceFormatted} xDAI</span>
      </div>
      <div className="mt-1 break-all font-mono text-gray-500">{address}</div>
      {balance !== null && !hasFunds && (
        <div className="mt-1 text-yellow-500/80">
          Fund this address with a little xDAI to transact on Gnosis Chain.
        </div>
      )}
    </div>
  );
}
