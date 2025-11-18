"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { hexToMidnightAddress } from "./midnight-address";

// Extend Window type for wallet extensions
declare global {
  interface Window {
    midnight?: any;
    cardano?: any;
  }
}

interface WalletContextType {
  connected: boolean;
  walletAddress: string | null;
  network: string;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState("testnet");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          if (data.walletAddress) {
            setWalletAddress(data.walletAddress);
            setNetwork(data.network || "testnet");
            setConnected(true);
          }
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    checkSession();
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError(null); // Clear any previous errors

    try {
      // Check if window is available
      if (typeof window === "undefined") {
        throw new Error("Window not available");
      }

      // @ts-ignore - Check for Midnight Lace wallet
      const midnightLace = window.midnight?.lace;
      // @ts-ignore - Fallback to regular Cardano Lace
      const cardanoLace = window.cardano?.lace;

      const lace = midnightLace || cardanoLace;

      console.log("Wallet detection:", {
        hasMidnight: !!window.midnight,
        hasCardano: !!window.cardano,
        midnightLace: !!midnightLace,
        cardanoLace: !!cardanoLace,
        selectedLace: !!lace
      });

      if (!lace) {
        throw new Error(
          "Midnight Lace wallet not detected. Please install the Midnight Lace browser extension from https://www.lace.io/"
        );
      }

      // Real Lace wallet connection
      console.log("Enabling wallet...");
      const enabled = await lace.enable();

      if (!enabled) {
        throw new Error("Wallet connection was cancelled");
      }

      console.log("Wallet enabled, getting addresses...");
      console.log("Available methods:", Object.keys(enabled));

      // Check experimental API
      if (enabled.experimental) {
        console.log("Experimental API available:", Object.keys(enabled.experimental));
      }

      // Get Midnight wallet address
      let address = null;

      console.log("Available methods on enabled wallet:", Object.keys(enabled));

      // For Midnight Lace, try getting addresses in order of preference
      const methods = [
        // Try Midnight-specific methods first
        { name: 'getUnusedAddresses', call: () => enabled.getUnusedAddresses() },
        { name: 'getUsedAddresses', call: () => enabled.getUsedAddresses() },
        { name: 'getChangeAddress', call: () => enabled.getChangeAddress() },
        { name: 'getRewardAddresses', call: () => enabled.getRewardAddresses() },
      ];

      for (const method of methods) {
        if (typeof enabled[method.name] === 'function' || typeof method.call === 'function') {
          try {
            const result = await method.call();
            console.log(`${method.name} result:`, result);

            if (Array.isArray(result) && result.length > 0) {
              // Look for Midnight address format (mn_shield or mn_)
              address = result.find((addr: string) =>
                typeof addr === 'string' && addr.startsWith('mn_')
              ) || result[0];

              if (address) {
                console.log(`✅ Got address from ${method.name}:`, address);
                break;
              }
            } else if (typeof result === 'string') {
              address = result;
              console.log(`✅ Got address from ${method.name}:`, address);
              break;
            }
          } catch (e) {
            console.log(`${method.name} failed:`, e);
          }
        }
      }

      if (!address) {
        throw new Error("No addresses found in wallet. Please make sure your Midnight Lace wallet has at least one shielded address.");
      }

      console.log("Raw address from wallet:", address);

      // Get network first
      let networkName: 'testnet' | 'mainnet' = "testnet";
      try {
        const networkId = await enabled.getNetworkId();
        networkName = networkId === 0 ? "testnet" : "mainnet";
        console.log("Network:", networkName);
      } catch (e) {
        console.log("Failed to get network, defaulting to testnet:", e);
      }

      // Convert hex address to Bech32 Midnight format if needed
      let midnightAddress = address;
      if (!address.startsWith('mn_')) {
        console.log("Converting hex address to Midnight Bech32 format...");
        midnightAddress = hexToMidnightAddress(address, networkName);
        console.log("Converted Midnight address:", midnightAddress);
      }

      // Create session on backend
      const response = await fetch("/api/auth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: midnightAddress,
          network: networkName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      setWalletAddress(data.walletAddress);
      setNetwork(data.network);
      setConnected(true);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);

      // User-friendly error messages
      let errorMessage = "Failed to connect wallet";
      if (err.message?.includes("cancelled") || err.message?.includes("cancel")) {
        errorMessage = "Connection cancelled. Click to try again.";
      } else if (err.message?.includes("addresses")) {
        errorMessage = "No wallet addresses found. Make sure your wallet is set up.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      setWalletAddress(null);
      setConnected(false);
      setNetwork("testnet");
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        walletAddress,
        network,
        connecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
