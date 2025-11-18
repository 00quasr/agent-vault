import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getWalletByAddress } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const walletAddress = cookieStore.get("wallet_session")?.value;

    if (!walletAddress) {
      return NextResponse.json({ connected: false });
    }

    // Verify wallet exists in database
    const wallet = await getWalletByAddress(walletAddress);

    if (!wallet) {
      // Cookie exists but wallet not in DB, clear it
      cookieStore.delete("wallet_session");
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      walletAddress: wallet.wallet_address,
      network: wallet.network,
      displayName: wallet.display_name,
    });
  } catch (error: any) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check session" },
      { status: 500 }
    );
  }
}
