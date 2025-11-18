import { NextRequest, NextResponse } from "next/server";
import { getStatsByWallet } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const stats = await getStatsByWallet(walletAddress);

    // Add contract info from deployment
    const deployment = {
      contractAddress: "020046c9353915fed29118da9dba1cac611c3572c8dae31e05d72aa42abcad08588c",
      network: "testnet",
      deployedAt: "2025-11-17T20:11:00.000Z",
    };

    return NextResponse.json({
      ...stats,
      contractAddress: deployment.contractAddress,
      network: deployment.network,
      deployedAt: deployment.deployedAt,
    });
  } catch (error) {
    console.error("Error fetching wallet stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
