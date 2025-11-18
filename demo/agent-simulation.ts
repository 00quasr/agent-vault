/**
 * Agent Vault - Agent Simulation Demo
 *
 * This simulates a real AI agent workflow:
 * 1. Agent needs to access an external API (GitHub)
 * 2. Agent has a ZK credential from Midnight
 * 3. Agent requests access through Agent Vault
 * 4. Vault verifies credential and makes API call
 * 5. Agent gets results WITHOUT seeing the API key
 */

import * as readline from "readline/promises";
import * as fs from "fs";
import * as path from "path";

// Simulated vault storage (in production, this would be Neon PostgreSQL)
interface VaultSecret {
  name: string;
  encryptedValue: string; // In production: AES-256 encrypted
  serviceUrl: string;
}

const VAULT_STORAGE: Record<string, VaultSecret> = {
  "github-api": {
    name: "GitHub API Token",
    encryptedValue: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Mock token
    serviceUrl: "https://api.github.com"
  },
  "openai-api": {
    name: "OpenAI API Key",
    encryptedValue: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Mock key
    serviceUrl: "https://api.openai.com"
  }
};

// Simulated authorized credentials (in production: verified via Midnight ZK proofs)
const AUTHORIZED_CREDENTIALS = new Set([
  "sadads", // The credential we just issued via CLI
  "agent-001",
  "agent-002"
]);

interface AgentRequest {
  credential: string;
  secretName: string;
  operation: string;
  params?: Record<string, any>;
}

interface VaultResponse {
  success: boolean;
  result?: any;
  error?: string;
  message: string;
}

/**
 * Agent Vault - The core security layer
 * This is what prevents agents from accessing raw secrets
 */
class AgentVaultService {

  /**
   * Verify ZK credential (in production: calls Midnight contract)
   */
  private verifyCredential(credential: string): boolean {
    console.log(`🔍 Verifying credential with Midnight contract...`);

    // In production: Call Midnight contract's proveAuthorization circuit
    const isValid = AUTHORIZED_CREDENTIALS.has(credential);

    if (isValid) {
      console.log(`✅ Credential verified via ZK proof`);
    } else {
      console.log(`❌ Invalid credential - ZK proof failed`);
    }

    return isValid;
  }

  /**
   * Retrieve secret from vault (in production: from Neon with AES-256 decryption)
   */
  private getSecret(secretName: string): VaultSecret | null {
    console.log(`🔐 Retrieving secret from vault...`);
    return VAULT_STORAGE[secretName] || null;
  }

  /**
   * Execute API call on behalf of agent
   * Agent NEVER sees the actual secret!
   */
  private async executeOperation(
    secret: VaultSecret,
    operation: string,
    params?: Record<string, any>
  ): Promise<any> {
    console.log(`🚀 Executing operation: ${operation}`);
    console.log(`📍 Target API: ${secret.serviceUrl}`);

    // Simulate API call (in production: actual HTTP request with secret)
    switch (operation) {
      case "github-list-repos":
        return {
          repos: [
            { name: "agent-vault", stars: 142, private: false },
            { name: "midnight-contracts", stars: 89, private: true },
            { name: "zk-credentials", stars: 234, private: false }
          ],
          message: "Successfully fetched repositories using API token"
        };

      case "openai-completion":
        return {
          completion: "Hello! I'm an AI assistant...",
          tokens: 245,
          message: "Successfully generated completion using API key"
        };

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Main entry point - Agent requests access
   */
  async handleAgentRequest(request: AgentRequest): Promise<VaultResponse> {
    console.log(`\n🤖 Agent Request Received`);
    console.log(`   Secret: ${request.secretName}`);
    console.log(`   Operation: ${request.operation}`);

    // Step 1: Verify ZK credential
    if (!this.verifyCredential(request.credential)) {
      return {
        success: false,
        error: "UNAUTHORIZED",
        message: "❌ Access denied - Invalid credential"
      };
    }

    // Step 2: Retrieve secret from vault
    const secret = this.getSecret(request.secretName);
    if (!secret) {
      return {
        success: false,
        error: "SECRET_NOT_FOUND",
        message: `❌ Secret '${request.secretName}' not found in vault`
      };
    }

    console.log(`✅ Secret retrieved: ${secret.name}`);
    console.log(`🔒 API key remains encrypted - agent will never see it`);

    // Step 3: Execute operation using the secret
    try {
      const result = await this.executeOperation(
        secret,
        request.operation,
        request.params
      );

      console.log(`✅ Operation successful`);

      return {
        success: true,
        result,
        message: "✅ Request completed - Agent received results (not secret)"
      };
    } catch (error) {
      return {
        success: false,
        error: "OPERATION_FAILED",
        message: `❌ Operation failed: ${error}`
      };
    }
  }
}

/**
 * Simulated AI Agent
 * This represents Claude, ChatGPT, or any other AI agent
 */
class AIAgent {
  private credential: string;
  private vault: AgentVaultService;

  constructor(credential: string, vault: AgentVaultService) {
    this.credential = credential;
    this.vault = vault;
  }

  /**
   * Agent wants to list GitHub repos
   * It CANNOT access the API key directly!
   */
  async listGitHubRepos(): Promise<void> {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🤖 AI Agent: "I need to list GitHub repositories"`);
    console.log(`${"=".repeat(70)}`);

    const response = await this.vault.handleAgentRequest({
      credential: this.credential,
      secretName: "github-api",
      operation: "github-list-repos"
    });

    console.log(`\n📬 Agent received response:`);
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
      console.log(`\n✅ SUCCESS: Agent got the data it needed`);
      console.log(`🔒 SECURITY: Agent NEVER saw the GitHub API token`);
    } else {
      console.log(`\n❌ FAILURE: ${response.message}`);
    }
  }

  /**
   * Agent wants to call OpenAI API
   */
  async generateCompletion(prompt: string): Promise<void> {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🤖 AI Agent: "I need to generate text with OpenAI"`);
    console.log(`${"=".repeat(70)}`);

    const response = await this.vault.handleAgentRequest({
      credential: this.credential,
      secretName: "openai-api",
      operation: "openai-completion",
      params: { prompt }
    });

    console.log(`\n📬 Agent received response:`);
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
      console.log(`\n✅ SUCCESS: Agent got the completion`);
      console.log(`🔒 SECURITY: Agent NEVER saw the OpenAI API key`);
    } else {
      console.log(`\n❌ FAILURE: ${response.message}`);
    }
  }
}

/**
 * Malicious Agent - Tries to attack
 */
class MaliciousAgent {
  private vault: AgentVaultService;

  constructor(vault: AgentVaultService) {
    this.vault = vault;
  }

  async attemptAttack(): Promise<void> {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`💀 MALICIOUS AGENT: Attempting to steal API keys...`);
    console.log(`${"=".repeat(70)}`);

    const attacks = [
      { name: "SQL Injection", credential: "' OR 1=1 --" },
      { name: "Brute Force", credential: "admin123" },
      { name: "Token Extraction", credential: "extract_secrets" },
      { name: "Path Traversal", credential: "../../secrets" }
    ];

    for (const attack of attacks) {
      console.log(`\n🎯 Attack: ${attack.name}`);
      console.log(`   Credential: ${attack.credential}`);

      const response = await this.vault.handleAgentRequest({
        credential: attack.credential,
        secretName: "github-api",
        operation: "github-list-repos"
      });

      if (response.success) {
        console.log(`💥 BREACH: Attack succeeded!`);
      } else {
        console.log(`🛡️  BLOCKED: Attack prevented by ZK credential verification`);
      }
    }
  }
}

/**
 * Main Demo
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                    🔒 AGENT VAULT DEMO 🔒                        ║
║                                                                   ║
║         Zero-Knowledge Credential Management for AI Agents        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log(`\n📋 Demo Scenarios:`);
    console.log(`  1. Authorized Agent (GitHub API)`);
    console.log(`  2. Authorized Agent (OpenAI API)`);
    console.log(`  3. Malicious Agent (Attack Simulation)`);
    console.log(`  4. Run All Scenarios`);
    console.log(`  5. Exit\n`);

    const choice = await rl.question("Choose scenario (1-5): ");

    const vault = new AgentVaultService();

    switch (choice) {
      case "1": {
        const agent = new AIAgent("sadads", vault); // Using credential from CLI
        await agent.listGitHubRepos();
        break;
      }

      case "2": {
        const agent = new AIAgent("sadads", vault);
        await agent.generateCompletion("Hello, world!");
        break;
      }

      case "3": {
        const maliciousAgent = new MaliciousAgent(vault);
        await maliciousAgent.attemptAttack();
        break;
      }

      case "4": {
        // Run all scenarios
        console.log(`\n${"#".repeat(70)}`);
        console.log(`#  SCENARIO 1: Authorized Agent - GitHub API`);
        console.log(`${"#".repeat(70)}`);
        const agent1 = new AIAgent("sadads", vault);
        await agent1.listGitHubRepos();

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`\n${"#".repeat(70)}`);
        console.log(`#  SCENARIO 2: Authorized Agent - OpenAI API`);
        console.log(`${"#".repeat(70)}`);
        const agent2 = new AIAgent("sadads", vault);
        await agent2.generateCompletion("Hello, world!");

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`\n${"#".repeat(70)}`);
        console.log(`#  SCENARIO 3: Malicious Agent - Attack Simulation`);
        console.log(`${"#".repeat(70)}`);
        const maliciousAgent = new MaliciousAgent(vault);
        await maliciousAgent.attemptAttack();

        console.log(`\n\n╔═══════════════════════════════════════════════════════════════════╗`);
        console.log(`║                      📊 DEMO SUMMARY                              ║`);
        console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
        console.log(`\n✅ Authorized agents: Successfully accessed APIs`);
        console.log(`🔒 API keys: Never exposed to agents`);
        console.log(`🛡️  Attacks: All blocked by ZK credential verification`);
        console.log(`\n💡 This is the power of Agent Vault!\n`);
        break;
      }

      case "5":
        console.log(`\n👋 Goodbye!`);
        break;

      default:
        console.log(`❌ Invalid choice`);
    }
  } catch (error) {
    console.error(`\n❌ Error:`, error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
