import { NextResponse } from "next/server";
import { getStats } from "@/lib/db";

/**
 * Dashboard Stats API
 *
 * Fetches real-time statistics from:
 * 1. Neon Database (agent/credential/verification data)
 * 2. Midnight GraphQL indexer (blockchain state)
 */

const TESTNET_INDEXER = "https://indexer.testnet-02.midnight.network/api/v1/graphql";

// Cache stats for 10 seconds to reduce indexer load
let cachedStats: any = null;
let cacheTime = 0;
const CACHE_DURATION = 10000; // 10 seconds

export async function GET() {
  try {
    // Return cached stats if fresh
    const now = Date.now();
    if (cachedStats && now - cacheTime < CACHE_DURATION) {
      return NextResponse.json(cachedStats);
    }

    // Get stats from Neon database
    const dbStats = await getStats();

    // Read deployment info
    const deployment = {
      contractAddress: process.env.MIDNIGHT_CONTRACT_ADDRESS || "02009ab82d5427c0f19872e5571f7b647ac0f75e3786027b8edfb0c629882bea1b5e",
      network: process.env.MIDNIGHT_NETWORK || "testnet",
      deployedAt: "2025-11-17T09:00:00Z"
    };

    const contractAddress = deployment.contractAddress;

    // Query Midnight indexer for public ledger state
    // This query fetches the contract's public ledger state without needing a wallet
    const query = `
      query GetContractState($contractAddress: String!) {
        contract(address: $contractAddress) {
          address
          ledgerState {
            totalCredentials
            successfulAuth
            blockedAttempts
            currentCredential
          }
        }
      }
    `;

    // Note: This is a simplified query. The actual Midnight GraphQL schema
    // may differ. For the hackathon, we'll use a hybrid approach:
    // Try to fetch real data, fall back to mock data if query fails

    try {
      const response = await fetch(TESTNET_INDEXER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { contractAddress }
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const result = await response.json();

        // If we got valid data from the indexer, use it
        if (result.data?.contract?.ledgerState) {
          const ledgerState = result.data.contract.ledgerState;

          const stats = {
            contractAddress: deployment.contractAddress,
            totalCredentials: parseInt(ledgerState.totalCredentials) || 0,
            successfulAuth: parseInt(ledgerState.successfulAuth) || 0,
            blockedAttempts: parseInt(ledgerState.blockedAttempts) || 0,
            activeAgents: Math.ceil((parseInt(ledgerState.totalCredentials) || 0) * 0.6), // Estimate
            network: deployment.network,
            deployedAt: deployment.deployedAt,
            dataSource: "indexer" // Mark as real data
          };

          cachedStats = stats;
          cacheTime = now;
          return NextResponse.json(stats);
        }
      }
    } catch (indexerError) {
      console.warn("Indexer query failed, using simulation:", indexerError);
    }

    // Use real database stats
    const stats = {
      contractAddress: deployment.contractAddress,
      totalCredentials: dbStats.totalCredentials,
      successfulAuth: dbStats.successfulVerifications,
      blockedAttempts: dbStats.blockedAttempts,
      activeAgents: dbStats.activeAgents,
      network: deployment.network,
      deployedAt: deployment.deployedAt,
      dataSource: "database" // Real data from Neon
    };

    cachedStats = stats;
    cacheTime = now;
    return NextResponse.json(stats);

  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

// Disable static optimization for this route
export const dynamic = "force-dynamic";
export const revalidate = 0;
