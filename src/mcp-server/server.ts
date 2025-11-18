#!/usr/bin/env node

/**
 * Agent Vault MCP Server
 *
 * This MCP server allows AI agents to:
 * 1. Request access to secrets via Midnight ZK proofs
 * 2. Execute actions using secrets without seeing them
 * 3. Get results back with full audit trail
 *
 * Architecture:
 * AI Agent → MCP Tool → Verify ZK Proof → Execute Action → Return Results
 *          ↓
 *    Midnight Contract (verify authorization)
 *          ↓
 *    Encrypted Vault (use secret, never expose)
 */

import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import {
  NetworkId,
  setNetworkId,
  getZswapNetworkId,
  getLedgerNetworkId
} from "@midnight-ntwrk/midnight-js-network-id";
import { createBalancedTx } from "@midnight-ntwrk/midnight-js-types";
import { nativeToken, Transaction } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import { WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as Rx from "rxjs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Fix WebSocket for Node.js
// @ts-ignore
globalThis.WebSocket = WebSocket;

// Configure for Midnight Testnet
setNetworkId(NetworkId.TestNet);

const TESTNET_CONFIG = {
  indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
  node: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300"
};

// Get the project root directory (where this script is located, then go up to project root)
const getProjectRoot = () => {
  // When running as compiled JS, __dirname is not available in ES modules
  // Use import.meta.url to get the current file's directory
  const currentFileUrl = new URL(import.meta.url);
  const currentFilePath = currentFileUrl.pathname;
  // Go up from dist/src/mcp-server/server.js to project root
  return path.join(path.dirname(currentFilePath), '..', '..', '..');
};

const PROJECT_ROOT = getProjectRoot();

// Vault configuration
const VAULT_SECRETS_PATH = path.join(PROJECT_ROOT, ".vault-secrets.json");
const DEPLOYMENT_PATH = path.join(PROJECT_ROOT, "deployment.json");

interface VaultSecret {
  id: string;
  name: string;
  encryptedValue: string;
  iv: string;
  provider: string;
  createdAt: string;
}

interface VaultStorage {
  secrets: VaultSecret[];
  masterKey: string;
}

/**
 * MCP Server for Agent Vault
 */
class AgentVaultMCPServer {
  private vault: VaultStorage | null = null;
  private contract: any = null;
  private wallet: any = null;
  private CryptoJS: any = null;

  async initialize(walletSeed: string) {
    console.error("🔒 Initializing Agent Vault MCP Server\n");

    // Load CryptoJS dynamically (CommonJS module) - MUST be before loadVault()
    this.CryptoJS = (await import("crypto-js")).default;

    // Change to project directory so wallet creates DB in correct location
    const originalCwd = process.cwd();
    process.chdir(PROJECT_ROOT);
    console.error(`📁 Working directory: ${process.cwd()}`);

    // Load vault
    this.loadVault();

    // Load deployment info
    if (!fs.existsSync(DEPLOYMENT_PATH)) {
      throw new Error("No deployment found! Run: npm run deploy");
    }

    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf-8"));
    const contractAddress = deployment.contractAddress;

    // Build wallet
    console.error("⚙️  Building wallet...");
    this.wallet = await WalletBuilder.buildFromSeed(
      TESTNET_CONFIG.indexer,
      TESTNET_CONFIG.indexerWS,
      TESTNET_CONFIG.proofServer,
      TESTNET_CONFIG.node,
      walletSeed,
      getZswapNetworkId(),
      "error"
    );

    this.wallet.start();
    const state: any = await Rx.firstValueFrom(this.wallet.state());
    console.error(`✅ Wallet: ${state.address}`);

    // Load contract
    console.error("📦 Loading contract...");
    const contractPath = path.join(PROJECT_ROOT, "contracts");
    const contractModulePath = path.join(
      contractPath,
      "managed",
      "agent-credentials",
      "contract",
      "index.cjs"
    );

    const AgentCredentialsModule = await import(contractModulePath);
    const contractInstance = new AgentCredentialsModule.Contract({});

    // Setup providers
    const walletState: any = await Rx.firstValueFrom(this.wallet.state());
    const wallet = this.wallet; // Capture for closure
    const walletProvider = {
      coinPublicKey: walletState.coinPublicKey,
      encryptionPublicKey: walletState.encryptionPublicKey,
      balanceTx(tx: any, newCoins: any) {
        return wallet
          .balanceTransaction(
            ZswapTransaction.deserialize(
              tx.serialize(getLedgerNetworkId()),
              getZswapNetworkId()
            ),
            newCoins
          )
          .then((tx: any) => wallet.proveTransaction(tx))
          .then((zswapTx: any) =>
            Transaction.deserialize(
              zswapTx.serialize(getZswapNetworkId()),
              getLedgerNetworkId()
            )
          )
          .then(createBalancedTx);
      },
      submitTx(tx: any) {
        return wallet.submitTransaction(tx);
      }
    };

    const zkConfigPath = path.join(PROJECT_ROOT, "contracts", "managed", "agent-credentials");
    const levelDbPath = path.join(PROJECT_ROOT, "agent-vault-mcp-state");
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: levelDbPath
      }),
      publicDataProvider: indexerPublicDataProvider(
        TESTNET_CONFIG.indexer,
        TESTNET_CONFIG.indexerWS
      ),
      zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
      proofProvider: httpClientProofProvider(TESTNET_CONFIG.proofServer),
      walletProvider: walletProvider,
      midnightProvider: walletProvider
    };

    // Find deployed contract
    console.error(`🔍 Connecting to contract: ${contractAddress}`);
    this.contract = await findDeployedContract(providers, {
      contract: contractInstance,
      contractAddress: contractAddress,
      privateStateId: "agentVaultMCPState",
      initialPrivateState: {}
    });

    console.error("✅ Contract connected!\n");
  }

  /**
   * Load encrypted vault from disk
   */
  private loadVault() {
    if (!fs.existsSync(VAULT_SECRETS_PATH)) {
      // Create empty vault
      this.vault = {
        secrets: [],
        masterKey: this.generateMasterKey()
      };
      this.saveVault();
    } else {
      this.vault = JSON.parse(fs.readFileSync(VAULT_SECRETS_PATH, "utf-8"));
    }
    console.error(`📂 Loaded vault with ${this.vault?.secrets.length || 0} secrets`);
  }

  /**
   * Save vault to disk
   */
  private saveVault() {
    if (this.vault) {
      fs.writeFileSync(VAULT_SECRETS_PATH, JSON.stringify(this.vault, null, 2));
    }
  }

  /**
   * Generate a master encryption key
   */
  private generateMasterKey(): string {
    return this.CryptoJS.lib.WordArray.random(256 / 8).toString();
  }

  /**
   * Encrypt a secret
   */
  private encryptSecret(value: string): { encrypted: string; iv: string } {
    const iv = this.CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = this.CryptoJS.AES.encrypt(value, this.vault!.masterKey, {
      iv: iv,
      mode: this.CryptoJS.mode.CBC,
      padding: this.CryptoJS.pad.Pkcs7
    });

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString()
    };
  }

  /**
   * Decrypt a secret
   */
  private decryptSecret(encryptedValue: string, iv: string): string {
    const decrypted = this.CryptoJS.AES.decrypt(encryptedValue, this.vault!.masterKey, {
      iv: this.CryptoJS.enc.Hex.parse(iv),
      mode: this.CryptoJS.mode.CBC,
      padding: this.CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(this.CryptoJS.enc.Utf8);
  }

  /**
   * MCP Tool: Store a secret in the vault
   */
  async storeSecret(params: {
    name: string;
    value: string;
    provider: string;
  }): Promise<{ success: boolean; secretId: string }> {
    console.error(`📥 Storing secret: ${params.name}`);

    const { encrypted, iv } = this.encryptSecret(params.value);
    const secretId = `secret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const secret: VaultSecret = {
      id: secretId,
      name: params.name,
      encryptedValue: encrypted,
      iv: iv,
      provider: params.provider,
      createdAt: new Date().toISOString()
    };

    this.vault!.secrets.push(secret);
    this.saveVault();

    console.error(`✅ Secret stored with ID: ${secretId}`);

    return {
      success: true,
      secretId: secretId
    };
  }

  /**
   * MCP Tool: Request access to a secret (with ZK proof verification)
   */
  async requestSecretAccess(params: {
    secretName: string;
    agentProof: string;
    action: string;
  }): Promise<{ success: boolean; actionResult?: any; error?: string }> {
    console.error(`🔐 Agent requesting access to: ${params.secretName}`);
    console.error(`📋 Action: ${params.action}`);

    try {
      // 1. Verify ZK proof on Midnight contract
      console.error("⏳ Verifying ZK proof on Midnight contract...");
      await this.contract.callTx.proveAuthorization(params.agentProof);
      console.error("✅ ZK proof verified!");

      // 2. Find the secret
      const secret = this.vault!.secrets.find((s) => s.name === params.secretName);
      if (!secret) {
        throw new Error(`Secret '${params.secretName}' not found in vault`);
      }

      // 3. Decrypt the secret (agent NEVER sees this!)
      const decryptedValue = this.decryptSecret(secret.encryptedValue, secret.iv);

      // 4. Execute the action using the secret
      let actionResult;
      if (params.action === "github_get_user") {
        actionResult = await this.executeGitHubAction(decryptedValue, "GET", "/user");
      } else if (params.action === "github_list_repos") {
        actionResult = await this.executeGitHubAction(
          decryptedValue,
          "GET",
          "/user/repos"
        );
      } else {
        throw new Error(`Unknown action: ${params.action}`);
      }

      console.error("✅ Action executed successfully!");

      // 5. Return results (NOT the secret!)
      return {
        success: true,
        actionResult: actionResult
      };
    } catch (error: any) {
      console.error("❌ Access denied:", error.message);

      // Log blocked attempt on blockchain
      try {
        await this.contract.callTx.simulateAttack();
      } catch (e) {
        // Ignore logging errors
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a GitHub API action
   */
  private async executeGitHubAction(
    apiToken: string,
    method: string,
    endpoint: string
  ): Promise<any> {
    console.error(`🌐 Calling GitHub API: ${method} ${endpoint}`);

    const response = await fetch(`https://api.github.com${endpoint}`, {
      method: method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Agent-Vault/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.error("✅ GitHub API call successful");

    return data;
  }

  /**
   * MCP Tool: List available secrets (names only, not values!)
   */
  async listSecrets(): Promise<{ secrets: Array<{ id: string; name: string; provider: string }> }> {
    return {
      secrets: this.vault!.secrets.map((s) => ({
        id: s.id,
        name: s.name,
        provider: s.provider
      }))
    };
  }

  /**
   * MCP Tool: Get contract statistics
   */
  async getStats(): Promise<any> {
    try {
      const state: any = await Rx.firstValueFrom(this.contract.state);

      return {
        totalCredentials: state.totalCredentials || 0,
        successfulAuth: state.successfulAuth || 0,
        blockedAttempts: state.blockedAttempts || 0,
        lastCredentialCommitment: state.lastCredentialCommitment || "none"
      };
    } catch (error) {
      console.error("Error getting contract state:", error);
      return {
        totalCredentials: 0,
        successfulAuth: 0,
        blockedAttempts: 0,
        lastCredentialCommitment: "none",
        error: "Failed to fetch contract state"
      };
    }
  }

  /**
   * Start the MCP server (stdio mode)
   */
  async start() {
    console.error("🚀 Agent Vault MCP Server running!\n");
    console.error("Available Tools:");
    console.error("  - store_secret: Store a new secret in the vault");
    console.error("  - request_secret_access: Request access to a secret (requires ZK proof)");
    console.error("  - list_secrets: List available secrets (names only)");
    console.error("  - get_stats: Get contract statistics\n");
    console.error("Listening for MCP requests on stdio...\n");

    const server = new Server(
      {
        name: "agent-vault",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Define available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "store_secret",
            description: "Store a new secret in the encrypted vault",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Secret name" },
                value: { type: "string", description: "Secret value (will be encrypted)" },
                provider: { type: "string", description: "Provider name (e.g., 'github', 'twitter')" },
              },
              required: ["name", "value", "provider"],
            },
          },
          {
            name: "request_secret_access",
            description: "Request access to a secret with ZK proof verification",
            inputSchema: {
              type: "object",
              properties: {
                secretName: { type: "string", description: "Name of the secret to access" },
                agentProof: { type: "string", description: "Agent's ZK proof credential" },
                action: { type: "string", description: "Action to perform (e.g., 'github_get_user', 'github_list_repos')" },
              },
              required: ["secretName", "agentProof", "action"],
            },
          },
          {
            name: "list_secrets",
            description: "List all available secrets (names only, not values)",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_stats",
            description: "Get contract statistics from Midnight blockchain",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          case "store_secret":
            result = await this.storeSecret(args as any);
            break;
          case "request_secret_access":
            result = await this.requestSecretAccess(args as any);
            break;
          case "list_secrets":
            result = await this.listSecrets();
            break;
          case "get_stats":
            result = await this.getStats();
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ MCP Server connected via stdio\n");
  }

  async close() {
    if (this.wallet) {
      await this.wallet.close();
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const server = new AgentVaultMCPServer();

  // Get wallet seed from environment or prompt
  const walletSeed = process.env.WALLET_SEED || process.argv[2];

  if (!walletSeed) {
    console.error("❌ Error: Wallet seed required!");
    console.error("\nUsage:");
    console.error("  WALLET_SEED=<your-seed> npm run mcp:server");
    console.error("  OR");
    console.error("  npm run mcp:server <your-seed>");
    process.exit(1);
  }

  try {
    await server.initialize(walletSeed);
    await server.start();

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.error("\n👋 Shutting down...");
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Server failed:", error);
    process.exit(1);
  }
}

export { AgentVaultMCPServer };

// Run if called directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
