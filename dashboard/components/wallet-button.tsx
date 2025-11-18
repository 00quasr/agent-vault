"use client";

import { useWallet } from "@/lib/wallet-context";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { truncateMidnightAddress } from "@/lib/midnight-address";

export function WalletButton() {
  const { connected, walletAddress, network, connecting, error, connect, disconnect } = useWallet();

  if (connecting) {
    return (
      <Button disabled className="bg-gray-900 text-white">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button
          onClick={connect}
          className="bg-gray-900 text-white hover:bg-gray-800 whitespace-nowrap"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Connect Lace Wallet
        </Button>
        {error && (
          <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>
        )}
      </div>
    );
  }

  const shortAddress = walletAddress ? truncateMidnightAddress(walletAddress) : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-green-600 text-white hover:bg-green-700">
          <Wallet className="w-4 h-4 mr-2" />
          {shortAddress}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border-gray-200">
        <DropdownMenuLabel className="text-gray-900">Wallet Info</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />
        <div className="px-2 py-1.5 text-xs space-y-1">
          <div className="text-gray-600">Address</div>
          <div className="font-mono text-gray-900 break-all">{walletAddress}</div>
          <div className="text-gray-600 mt-2">Network</div>
          <div className="text-gray-900 capitalize">{network}</div>
        </div>
        <DropdownMenuSeparator className="bg-gray-200" />
        <DropdownMenuItem
          onClick={disconnect}
          className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
