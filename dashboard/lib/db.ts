import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create Neon serverless client
export const sql = neon(process.env.DATABASE_URL);

// Database types
export interface Wallet {
  id: string;
  wallet_address: string;
  network: string;
  display_name: string | null;
  created_at: Date;
  last_login_at: Date;
  metadata: any;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
  status: string;
  public_key: string | null;
  metadata: any;
  owner_wallet_address: string | null;
  capabilities: string[];
  rate_limit_per_hour: number;
  credential_expiry_days: number;
  access_scope: {
    secrets: string[];
    resources: string[];
  };
  midnight_wallet_address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Credential {
  id: string;
  agent_id: string;
  credential_hash: string;
  zk_proof: string | null;
  issued_at: Date;
  expires_at: Date | null;
  status: string;
  midnight_tx_hash: string | null;
  metadata: any;
}

export interface ProofVerification {
  id: string;
  credential_id: string;
  verified_at: Date;
  verification_result: boolean;
  zk_proof: string;
  midnight_block_height: number | null;
  midnight_tx_hash: string | null;
  verifier_address: string | null;
  error_message: string | null;
  metadata: any;
}

export interface AuditLog {
  id: string;
  agent_id: string | null;
  action: string;
  resource: string | null;
  result: string;
  ip_address: string | null;
  user_agent: string | null;
  midnight_tx_hash: string | null;
  metadata: any;
  created_at: Date;
}

export interface Secret {
  id: string;
  agent_id: string;
  secret_name: string;
  encrypted_value: string;
  encryption_algorithm: string;
  access_count: number;
  last_accessed_at: Date | null;
  created_at: Date;
  metadata: any;
}

// Helper functions
export async function getAgents() {
  return await sql`
    SELECT
      a.*,
      COUNT(c.id)::int as credentials_count
    FROM agents a
    LEFT JOIN credentials c ON a.id = c.agent_id AND c.status = 'active'
    GROUP BY a.id
    ORDER BY a.created_at DESC
  ` as any as (Agent & { credentials_count: number })[];
}

export async function getAgentById(id: string) {
  const result = await sql`SELECT * FROM agents WHERE id = ${id}` as any as Agent[];
  return result[0] || null;
}

export async function createAgent(data: {
  name: string;
  description?: string;
  agent_type?: string;
  public_key?: string;
  metadata?: any;
  owner_wallet_address?: string;
  capabilities?: string[];
  rate_limit_per_hour?: number;
  credential_expiry_days?: number;
  access_scope?: { secrets: string[]; resources: string[] };
  midnight_wallet_address?: string;
}) {
  const result = await sql`
    INSERT INTO agents (
      name, description, agent_type, public_key, metadata,
      owner_wallet_address, capabilities, rate_limit_per_hour,
      credential_expiry_days, access_scope, midnight_wallet_address
    )
    VALUES (
      ${data.name},
      ${data.description || null},
      ${data.agent_type || 'autonomous'},
      ${data.public_key || null},
      ${JSON.stringify(data.metadata || {})},
      ${data.owner_wallet_address || null},
      ${JSON.stringify(data.capabilities || [])},
      ${data.rate_limit_per_hour || 100},
      ${data.credential_expiry_days || 365},
      ${JSON.stringify(data.access_scope || { secrets: [], resources: [] })},
      ${data.midnight_wallet_address || null}
    )
    RETURNING *
  ` as any as Agent[];
  return result[0];
}

export async function getCredentialsByAgent(agentId: string) {
  return await sql`
    SELECT * FROM credentials
    WHERE agent_id = ${agentId}
    ORDER BY issued_at DESC
  ` as any as Credential[];
}

export async function getRecentVerifications(limit: number = 10) {
  return await sql`
    SELECT pv.*, a.name as agent_name
    FROM proof_verifications pv
    JOIN credentials c ON pv.credential_id = c.id
    JOIN agents a ON c.agent_id = a.id
    ORDER BY pv.verified_at DESC
    LIMIT ${limit}
  ` as any as (ProofVerification & { agent_name: string })[];
}

export async function getRecentAuditLogs(limit: number = 10) {
  return await sql`
    SELECT al.*, a.name as agent_name
    FROM audit_logs al
    LEFT JOIN agents a ON al.agent_id = a.id
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  ` as any as (AuditLog & { agent_name: string | null })[];
}

export async function getStats() {
  const [agentStats] = await sql`
    SELECT
      COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_agents,
      COUNT(*) as total_agents
    FROM agents
  `;

  const [credentialStats] = await sql`
    SELECT
      COUNT(*) as total_credentials,
      COUNT(DISTINCT agent_id) as agents_with_credentials
    FROM credentials
    WHERE status = 'active'
  `;

  const [verificationStats] = await sql`
    SELECT
      COUNT(CASE WHEN verification_result = true THEN 1 END) as successful_verifications,
      COUNT(CASE WHEN verification_result = false THEN 1 END) as failed_verifications,
      COUNT(*) as total_verifications
    FROM proof_verifications
  `;

  const [auditStats] = await sql`
    SELECT
      COUNT(CASE WHEN result = 'blocked' THEN 1 END) as blocked_attempts,
      COUNT(CASE WHEN result = 'success' THEN 1 END) as successful_actions
    FROM audit_logs
  `;

  return {
    activeAgents: Number(agentStats.active_agents) || 0,
    totalAgents: Number(agentStats.total_agents) || 0,
    totalCredentials: Number(credentialStats.total_credentials) || 0,
    successfulVerifications: Number(verificationStats.successful_verifications) || 0,
    failedVerifications: Number(verificationStats.failed_verifications) || 0,
    blockedAttempts: Number(auditStats.blocked_attempts) || 0,
    successfulActions: Number(auditStats.successful_actions) || 0,
  };
}

// Wallet-specific stats
export async function getStatsByWallet(walletAddress: string) {
  const [agentStats] = await sql`
    SELECT
      COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_agents,
      COUNT(*) as total_agents
    FROM agents
    WHERE owner_wallet_address = ${walletAddress}
  `;

  const [credentialStats] = await sql`
    SELECT
      COUNT(*) as total_credentials,
      COUNT(DISTINCT c.agent_id) as agents_with_credentials
    FROM credentials c
    JOIN agents a ON c.agent_id = a.id
    WHERE c.status = 'active'
      AND a.owner_wallet_address = ${walletAddress}
  `;

  const [verificationStats] = await sql`
    SELECT
      COUNT(CASE WHEN pv.verification_result = true THEN 1 END) as successful_verifications,
      COUNT(CASE WHEN pv.verification_result = false THEN 1 END) as failed_verifications,
      COUNT(*) as total_verifications
    FROM proof_verifications pv
    JOIN credentials c ON pv.credential_id = c.id
    JOIN agents a ON c.agent_id = a.id
    WHERE a.owner_wallet_address = ${walletAddress}
  `;

  const [auditStats] = await sql`
    SELECT
      COUNT(CASE WHEN result = 'blocked' THEN 1 END) as blocked_attempts,
      COUNT(CASE WHEN result = 'success' THEN 1 END) as successful_actions
    FROM audit_logs al
    JOIN agents a ON al.agent_id = a.id
    WHERE a.owner_wallet_address = ${walletAddress}
  `;

  return {
    activeAgents: Number(agentStats.active_agents) || 0,
    totalAgents: Number(agentStats.total_agents) || 0,
    totalCredentials: Number(credentialStats.total_credentials) || 0,
    successfulVerifications: Number(verificationStats.successful_verifications) || 0,
    failedVerifications: Number(verificationStats.failed_verifications) || 0,
    blockedAttempts: Number(auditStats.blocked_attempts) || 0,
    successfulActions: Number(auditStats.successful_actions) || 0,
  };
}

export async function getRecentActivityByWallet(walletAddress: string, limit: number = 10) {
  return await sql`
    SELECT al.*, a.name as agent_name
    FROM audit_logs al
    JOIN agents a ON al.agent_id = a.id
    WHERE a.owner_wallet_address = ${walletAddress}
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  ` as any as (AuditLog & { agent_name: string })[];
}

// Wallet functions
export async function getWalletByAddress(walletAddress: string) {
  const result = await sql`
    SELECT * FROM wallets WHERE wallet_address = ${walletAddress}
  ` as any as Wallet[];
  return result[0] || null;
}

export async function createOrUpdateWallet(data: {
  wallet_address: string;
  network?: string;
  display_name?: string;
  metadata?: any;
}) {
  const existing = await getWalletByAddress(data.wallet_address);

  if (existing) {
    // Update last login
    const result = await sql`
      UPDATE wallets
      SET last_login_at = now(),
          display_name = ${data.display_name || existing.display_name},
          metadata = ${JSON.stringify(data.metadata || existing.metadata)}
      WHERE wallet_address = ${data.wallet_address}
      RETURNING *
    ` as any as Wallet[];
    return result[0];
  } else {
    // Create new wallet
    const result = await sql`
      INSERT INTO wallets (wallet_address, network, display_name, metadata)
      VALUES (
        ${data.wallet_address},
        ${data.network || 'testnet'},
        ${data.display_name || null},
        ${JSON.stringify(data.metadata || {})}
      )
      RETURNING *
    ` as any as Wallet[];
    return result[0];
  }
}

export async function getAgentsByWallet(walletAddress: string) {
  return await sql`
    SELECT
      a.*,
      COUNT(c.id)::int as credentials_count
    FROM agents a
    LEFT JOIN credentials c ON a.id = c.agent_id AND c.status = 'active'
    WHERE a.owner_wallet_address = ${walletAddress}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  ` as any as (Agent & { credentials_count: number })[];
}
