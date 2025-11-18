import { NextRequest, NextResponse } from "next/server";
import { getRecentActivityByWallet } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const activity = await getRecentActivityByWallet(walletAddress, limit);

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Error fetching wallet activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
