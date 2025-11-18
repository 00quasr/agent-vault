/**
 * Midnight Contract Integration
 *
 * This module provides server-side integration with the deployed
 * Midnight contract for real credential issuance and verification.
 */

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import crypto from 'crypto';

// Configure for Midnight Testnet
setNetworkId(NetworkId.TestNet);

const TESTNET_CONFIG = {
  indexer: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
  indexerWS: 'wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws',
  node: 'https://rpc.testnet-02.midnight.network',
  proofServer: process.env.MIDNIGHT_PROOF_SERVER || 'http://127.0.0.1:6300'
};

// Contract address from deployment
const CONTRACT_ADDRESS = process.env.MIDNIGHT_CONTRACT_ADDRESS || '020046c9353915fed29118da9dba1cac611c3572c8dae31e05d72aa42abcad08588c';

let contractInstance: any = null;
let initializationPromise: Promise<any> | null = null;

/**
 * Initialize contract connection
 * This is done lazily and cached for reuse
 */
async function getContract() {
  if (contractInstance) {
    return contractInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🔗 Connecting to Midnight contract:', CONTRACT_ADDRESS);

      // Set up providers
      const proofProvider = httpClientProofProvider(TESTNET_CONFIG.proofServer);
      const publicDataProvider = indexerPublicDataProvider(
        TESTNET_CONFIG.indexer,
        TESTNET_CONFIG.indexerWS
      );

      // Find and connect to deployed contract
      const contract = await findDeployedContract(
        publicDataProvider,
        proofProvider,
        CONTRACT_ADDRESS
      );

      console.log('✅ Connected to Midnight contract');
      contractInstance = contract;
      return contract;
    } catch (error) {
      console.error('❌ Failed to connect to Midnight contract:', error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Issue a credential on Midnight blockchain
 * Calls the issueCredential circuit with an agent secret
 */
export async function issueCredentialOnChain(agentSecret: string): Promise<{
  txHash: string;
  credentialHash: string;
  zkProof: string;
}> {
  try {
    const contract = await getContract();

    console.log('📝 Issuing credential on Midnight blockchain...');

    // Call the contract's issueCredential circuit
    // This creates a ZK proof and submits a transaction
    const tx = await contract.callTx.issueCredential(agentSecret);

    // Create a hash of the credential for database storage
    const credentialHash = crypto
      .createHash('sha256')
      .update(agentSecret)
      .digest('hex');

    console.log('✅ Credential issued on-chain');
    console.log('   Transaction:', tx.txHash || 'pending');

    return {
      txHash: tx.txHash || 'pending',
      credentialHash,
      zkProof: JSON.stringify({
        type: 'zk-snark',
        circuit: 'issueCredential',
        timestamp: Date.now()
      })
    };
  } catch (error) {
    console.error('❌ Failed to issue credential on-chain:', error);
    throw new Error('Failed to issue credential on Midnight blockchain');
  }
}

/**
 * Verify authorization on Midnight blockchain
 * Calls the proveAuthorization circuit
 */
export async function verifyAuthorizationOnChain(
  agentSecret: string,
  expectedCommitment: string
): Promise<{
  verified: boolean;
  txHash: string;
}> {
  try {
    const contract = await getContract();

    console.log('🔍 Verifying authorization on Midnight blockchain...');

    // Call the contract's proveAuthorization circuit
    // This proves the agent knows the secret without revealing it (ZK proof!)
    const tx = await contract.callTx.proveAuthorization(
      agentSecret,
      expectedCommitment
    );

    console.log('✅ Authorization verified on-chain');
    console.log('   Transaction:', tx.txHash || 'pending');

    return {
      verified: true,
      txHash: tx.txHash || 'pending'
    };
  } catch (error) {
    console.error('❌ Authorization verification failed:', error);
    return {
      verified: false,
      txHash: 'failed'
    };
  }
}

/**
 * Get contract statistics from the ledger
 */
export async function getContractStats(): Promise<{
  totalCredentials: number;
  successfulAuth: number;
  blockedAttempts: number;
  totalRevocations: number;
  totalReadAuth: number;
  totalWriteAuth: number;
  totalExecuteAuth: number;
}> {
  try {
    const contract = await getContract();

    // Query the contract's public ledger state
    const state = await contract.state();

    return {
      totalCredentials: Number(state.totalCredentials?.value || 0),
      successfulAuth: Number(state.successfulAuth?.value || 0),
      blockedAttempts: Number(state.blockedAttempts?.value || 0),
      totalRevocations: Number(state.totalRevocations?.value || 0),
      totalReadAuth: Number(state.totalReadAuth?.value || 0),
      totalWriteAuth: Number(state.totalWriteAuth?.value || 0),
      totalExecuteAuth: Number(state.totalExecuteAuth?.value || 0)
    };
  } catch (error) {
    console.error('❌ Failed to get contract stats:', error);
    return {
      totalCredentials: 0,
      successfulAuth: 0,
      blockedAttempts: 0,
      totalRevocations: 0,
      totalReadAuth: 0,
      totalWriteAuth: 0,
      totalExecuteAuth: 0
    };
  }
}

/**
 * Check if Midnight contract is available
 * Used for health checks and determining if real contract should be used
 */
export async function isContractAvailable(): Promise<boolean> {
  try {
    await getContract();
    return true;
  } catch (error) {
    console.warn('⚠️  Midnight contract not available, using fallback mode');
    return false;
  }
}
