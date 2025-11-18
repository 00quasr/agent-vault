import { NextResponse } from "next/server";
import { getAgents, createAgent, getAgentById } from "@/lib/db";
import { issueAgentCredential } from "@/lib/midnight";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const walletAddress = searchParams.get("wallet");

    if (id) {
      const agent = await getAgentById(id);
      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(agent);
    }

    // If wallet address provided, filter by wallet
    if (walletAddress) {
      const { getAgentsByWallet } = await import("@/lib/db");
      const agents = await getAgentsByWallet(walletAddress);
      return NextResponse.json(agents);
    }

    // Otherwise return all agents (for admin view)
    const agents = await getAgents();
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      agent_type,
      public_key,
      metadata,
      owner_wallet_address,
      capabilities,
      rate_limit_per_hour,
      credential_expiry_days,
      access_scope,
      midnight_wallet_address,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 }
      );
    }

    if (!owner_wallet_address) {
      return NextResponse.json(
        { error: "Wallet connection required" },
        { status: 401 }
      );
    }

    // Create agent in database
    const agent = await createAgent({
      name,
      description,
      agent_type,
      public_key,
      metadata,
      owner_wallet_address,
      capabilities,
      rate_limit_per_hour,
      credential_expiry_days,
      access_scope,
      midnight_wallet_address,
    });

    // Issue Midnight ZK credential for the agent
    const credential = await issueAgentCredential(agent.id);

    // Return agent with credential info
    return NextResponse.json(
      {
        ...agent,
        midnight_credential: {
          tx_hash: credential.midnightTxHash,
          credential_hash: credential.credentialHash,
          // Note: In production, send agent_secret via secure channel
          // For hackathon/demo purposes, we show it in the UI
          agent_secret: credential.agentSecret
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
