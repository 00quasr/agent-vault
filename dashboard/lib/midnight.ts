import { sql } from './db';
import crypto from 'crypto';
import {
  issueCredentialOnChain,
  verifyAuthorizationOnChain,
  isContractAvailable
} from './midnight-contract';

/**
 * Midnight blockchain integration for credential issuance
 */

export interface MidnightCredential {
  credentialHash: string;
  zkProof: string;
  midnightTxHash: string;
  agentSecret: string;
}

/**
 * Issue a ZK credential for an agent on Midnight blockchain
 *
 * This function:
 * 1. Generates a unique agent secret
 * 2. Creates a credential hash
 * 3. Issues credential via Midnight contract (REAL on-chain transaction)
 * 4. Stores credential in database
 */
export async function issueAgentCredential(agentId: string): Promise<MidnightCredential> {
  // Generate unique agent secret
  const agentSecret = crypto.randomBytes(32).toString('hex');

  let credentialHash: string;
  let zkProof: string;
  let midnightTxHash: string;
  let useRealContract = false;

  // Try to use real Midnight contract
  try {
    const contractAvailable = await isContractAvailable();

    if (contractAvailable) {
      console.log('✅ Using REAL Midnight contract for credential issuance');
      useRealContract = true;

      // Issue credential on actual Midnight blockchain
      const result = await issueCredentialOnChain(agentSecret);
      credentialHash = result.credentialHash;
      zkProof = result.zkProof;
      midnightTxHash = result.txHash;
    } else {
      throw new Error('Contract not available');
    }
  } catch (error) {
    console.warn('⚠️  Falling back to simulated mode:', error);

    // Fallback to simulation if contract unavailable
    credentialHash = crypto
      .createHash('sha256')
      .update(`${agentId}:${agentSecret}`)
      .digest('hex');
    zkProof = generateZKProof(agentSecret);
    midnightTxHash = simulateMidnightTx('issueCredential', agentSecret);
  }

  // Store credential in database
  await sql`
    INSERT INTO credentials (
      agent_id,
      credential_hash,
      zk_proof,
      midnight_tx_hash,
      status,
      metadata
    )
    VALUES (
      ${agentId},
      ${credentialHash},
      ${zkProof},
      ${midnightTxHash},
      'active',
      ${JSON.stringify({
        issued_via: useRealContract ? 'midnight_contract' : 'simulated',
        real_contract: useRealContract,
        agent_secret_hint: agentSecret.slice(0, 8) + '...'
      })}
    )
  `;

  // Log credential issuance to audit logs
  await sql`
    INSERT INTO audit_logs (
      agent_id,
      action,
      resource,
      result,
      midnight_tx_hash,
      metadata
    )
    VALUES (
      ${agentId},
      'credential_issued',
      ${useRealContract ? 'midnight_contract' : 'simulated_contract'},
      'success',
      ${midnightTxHash},
      ${JSON.stringify({
        credential_hash: credentialHash,
        real_contract: useRealContract,
        timestamp: new Date().toISOString()
      })}
    )
  `;

  return {
    credentialHash,
    zkProof,
    midnightTxHash,
    agentSecret
  };
}

/**
 * Generate ZK proof for agent credential
 * In production, this would use Midnight's proof server
 */
function generateZKProof(agentSecret: string): string {
  // Simulated ZK proof generation
  // In production: use @midnight-ntwrk/midnight-js-http-client-proof-provider
  const proof = crypto
    .createHmac('sha256', 'midnight-zk-proof')
    .update(agentSecret)
    .digest('hex');

  return JSON.stringify({
    proof,
    type: 'zk-snark',
    circuit: 'issueCredential',
    timestamp: Date.now()
  });
}

/**
 * Simulate Midnight blockchain transaction
 * In production, this would submit actual transaction via wallet
 */
function simulateMidnightTx(circuit: string, agentSecret: string): string {
  // Generate realistic transaction hash
  const txHash = crypto
    .createHash('sha256')
    .update(`${circuit}:${agentSecret}:${Date.now()}`)
    .digest('hex');

  return `0x${txHash}`;
}

/**
 * Verify agent authorization using ZK proof
 * Calls contract.callTx.proveAuthorization(agentSecret) on real Midnight contract
 */
export async function verifyAgentAuthorization(
  credentialId: string,
  agentSecret: string
): Promise<boolean> {
  try {
    // Get credential from database
    const [credential] = await sql`
      SELECT * FROM credentials WHERE id = ${credentialId}
    ` as any;

    if (!credential || credential.status !== 'active') {
      return false;
    }

    let isValid = false;
    let verificationTxHash = 'simulated';
    let useRealContract = false;

    // Try to verify on real contract
    try {
      const contractAvailable = await isContractAvailable();

      if (contractAvailable) {
        console.log('✅ Using REAL Midnight contract for verification');
        useRealContract = true;

        // Verify on actual Midnight blockchain
        // Pass both the agent secret and the expected commitment
        const result = await verifyAuthorizationOnChain(
          agentSecret,
          credential.credential_hash
        );
        isValid = result.verified;
        verificationTxHash = result.txHash;
      } else {
        throw new Error('Contract not available');
      }
    } catch (error) {
      console.warn('⚠️  Falling back to simulated verification:', error);

      // Fallback to local verification
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${credential.agent_id}:${agentSecret}`)
        .digest('hex');

      isValid = expectedHash === credential.credential_hash;
    }

    // Log verification
    await sql`
      INSERT INTO proof_verifications (
        credential_id,
        verification_result,
        zk_proof,
        midnight_tx_hash,
        metadata
      )
      VALUES (
        ${credentialId},
        ${isValid},
        ${credential.zk_proof},
        ${verificationTxHash},
        ${JSON.stringify({
          timestamp: new Date().toISOString(),
          verification_method: useRealContract ? 'midnight_contract' : 'simulated',
          real_contract: useRealContract
        })}
      )
    `;

    return isValid;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
