import { NextResponse } from "next/server";
import { getRecentAuditLogs, getRecentVerifications } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get recent audit logs and verifications
    const [auditLogs, verifications] = await Promise.all([
      getRecentAuditLogs(limit),
      getRecentVerifications(limit),
    ]);

    // Combine and sort by timestamp
    const activities = [
      ...auditLogs.map((log) => ({
        id: log.id,
        type: log.result === "success" ? "auth_success" : log.result === "blocked" ? "blocked" : "action",
        agentName: log.agent_name || "Unknown Agent",
        action: log.action,
        result: log.result,
        timestamp: log.created_at,
        metadata: log.metadata,
      })),
      ...verifications.map((v) => ({
        id: v.id,
        type: v.verification_result ? "verification_success" : "verification_failed",
        agentName: v.agent_name,
        action: "ZK Proof Verification",
        result: v.verification_result ? "success" : "failed",
        timestamp: v.verified_at,
        metadata: v.metadata,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
