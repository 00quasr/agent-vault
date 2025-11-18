import { NextResponse } from "next/server";
import { getContractStats } from "@/lib/midnight-contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/midnight/stats
 * Returns live statistics from the Midnight blockchain contract
 */
export async function GET() {
  try {
    const stats = await getContractStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
      // Calculate some derived metrics
      metrics: {
        totalAuth: stats.successfulAuth + stats.blockedAttempts,
        successRate:
          stats.successfulAuth + stats.blockedAttempts > 0
            ? (
                (stats.successfulAuth /
                  (stats.successfulAuth + stats.blockedAttempts)) *
                100
              ).toFixed(1)
            : "0.0",
        capabilityBreakdown: {
          read: stats.totalReadAuth,
          write: stats.totalWriteAuth,
          execute: stats.totalExecuteAuth,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Midnight stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch contract statistics",
      },
      { status: 500 }
    );
  }
}
