import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateWallet } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, network, displayName } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Create or update wallet in database
    const wallet = await createOrUpdateWallet({
      wallet_address: walletAddress,
      network: network || "testnet",
      display_name: displayName,
    });

    // Create session cookie
    const cookieStore = await cookies();
    cookieStore.set("wallet_session", walletAddress, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({
      success: true,
      walletAddress: wallet.wallet_address,
      network: wallet.network,
    });
  } catch (error: any) {
    console.error("Wallet connection error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect wallet" },
      { status: 500 }
    );
  }
}
