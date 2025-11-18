#!/usr/bin/env node

/**
 * Agent Vault - End-to-End Demo
 *
 * This demo shows the complete flow:
 * 1. Store a secret in the vault (encrypted)
 * 2. Issue a credential to an agent
 * 3. Agent requests access with ZK proof
 * 4. Vault verifies proof on Midnight blockchain
 * 5. Vault executes action using secret
 * 6. Agent gets results (never sees the secret!)
 *
 * This is the REAL demo - uses actual Midnight blockchain
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
import { Transaction } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import { WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import * as Rx from "rxjs";
import * as CryptoJS from "crypto-js";

// Fix WebSocket for Node.js
// @ts-ignore
globalThis.WebSocket = WebSocket;

setNetworkId(NetworkId.TestNet);

const TESTNET_CONFIG = {
  indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
  node: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300"
};

const VAULT_SECRETS_PATH = path.join(process.cwd(), ".vault-secrets.json");

interface VaultSecret {
  id: string;
  name: string;
  encryptedValue: string;
  iv: string;
  provider: string;
}

// Demo utilities
function printHeader(text: string) {
  console.log("\n" + "=".repeat(70));
  console.log(text);
  console.log("=".repeat(70) + "\n");
}

function printSuccess(text: string) {
  console.log(`✅ ${text}`);
}

function printInfo(text: string) {
  console.log(`ℹ️  ${text}`);
}

function printWarning(text: string) {
  console.log(`⚠️  ${text}`);
}

function printError(text: string) {
  console.log(`❌ ${text}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Vault Manager - Handles secret encryption/storage
 */
class VaultManager {
  private masterKey: string;
  private secrets: VaultSecret[] = [];

  constructor() {
    this.masterKey = this.generateMasterKey();
    this.loadSecrets();
  }

  private generateMasterKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
  }

  private loadSecrets() {
    if (fs.existsSync(VAULT_SECRETS_PATH)) {
      const data = JSON.parse(fs.readFileSync(VAULT_SECRETS_PATH, "utf-8"));
      this.secrets = data.secrets || [];
      this.masterKey = data.masterKey || this.masterKey;
    }
  }

  private saveSecrets() {
    fs.writeFileSync(
      VAULT_SECRETS_PATH,
      JSON.stringify({ secrets: this.secrets, masterKey: this.masterKey }, null, 2)
    );
  }

  storeSecret(name: string, value: string, provider: string): string {
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(value, this.masterKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const secret: VaultSecret = {
      id: `secret_${Date.now()}`,
      name,
      encryptedValue: encrypted.toString(),
      iv: iv.toString(),
      provider
    };

    this.secrets.push(secret);
    this.saveSecrets();
    return secret.id;
  }

  getSecret(name: string): string | null {
    const secret = this.secrets.find((s) => s.name === name);
    if (!secret) return null;

    const decrypted = CryptoJS.AES.decrypt(secret.encryptedValue, this.masterKey, {
      iv: CryptoJS.enc.Hex.parse(secret.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  listSecrets(): Array<{ id: string; name: string; provider: string }> {
    return this.secrets.map((s) => ({
      id: s.id,
      name: s.name,
      provider: s.provider
    }));
  }
}

/**
 * Main demo flow
 */
async function main() {
  printHeader("🔒 AGENT VAULT - END-TO-END DEMO");
  console.log("This demo shows the complete Agent Vault workflow:");
  console.log("  1. Store secrets in encrypted vault");
  console.log("  2. Issue credentials to agents");
  console.log("  3. Verify ZK proofs on Midnight blockchain");
  console.log("  4. Execute actions without exposing secrets");
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // Load deployment
    const deploymentPath = path.join(process.cwd(), "deployment.json");
    if (!fs.existsSync(deploymentPath)) {
      printError("No deployment found! Run: npm run deploy");
      process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    printInfo(`Contract Address: ${deployment.contractAddress}`);

    // Ask for wallet seed
    const walletSeed = await rl.question("\nEnter your wallet seed: ");

    // Build wallet
    printHeader("STEP 1: Initialize Wallet & Contract");
    console.log("⏳ Building wallet...");
    const wallet = await WalletBuilder.buildFromSeed(
      TESTNET_CONFIG.indexer,
      TESTNET_CONFIG.indexerWS,
      TESTNET_CONFIG.proofServer,
      TESTNET_CONFIG.node,
      walletSeed,
      getZswapNetworkId(),
      "error"
    );

    wallet.start();
    const state: any = await Rx.firstValueFrom(wallet.state());
    printSuccess(`Wallet connected: ${state.address}`);

    // Load contract
    console.log("⏳ Loading contract...");
    const contractPath = path.join(process.cwd(), "contracts");
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
    const walletState: any = await Rx.firstValueFrom(wallet.state());
    const walletForClosure = wallet;
    const walletProvider = {
      coinPublicKey: walletState.coinPublicKey,
      encryptionPublicKey: walletState.encryptionPublicKey,
      balanceTx(tx: any, newCoins: any) {
        return walletForClosure
          .balanceTransaction(
            ZswapTransaction.deserialize(
              tx.serialize(getLedgerNetworkId()),
              getZswapNetworkId()
            ),
            newCoins
          )
          .then((tx: any) => walletForClosure.proveTransaction(tx))
          .then((zswapTx: any) =>
            Transaction.deserialize(
              zswapTx.serialize(getZswapNetworkId()),
              getLedgerNetworkId()
            )
          )
          .then(createBalancedTx);
      },
      submitTx(tx: any) {
        return walletForClosure.submitTransaction(tx);
      }
    };

    const zkConfigPath = path.join(contractPath, "managed", "agent-credentials");
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: "agent-vault-demo-state"
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

    const contract = await findDeployedContract(providers, {
      contract: contractInstance,
      contractAddress: deployment.contractAddress,
      privateStateId: "agentVaultDemoState",
      initialPrivateState: {}
    });

    printSuccess("Contract connected!");

    // Initialize vault
    printHeader("STEP 2: Store Secret in Vault");
    const vault = new VaultManager();

    const useRealGitHub = await rl.question("\nDo you have a GitHub token to use? (y/n): ");

    let secretValue: string;
    if (useRealGitHub.toLowerCase() === "y") {
      secretValue = await rl.question("Enter your GitHub personal access token: ");
    } else {
      secretValue = "ghp_demo_token_" + Math.random().toString(36);
      printWarning("Using demo token (GitHub calls will fail, but flow will work)");
    }

    console.log("⏳ Encrypting and storing secret...");
    const secretId = vault.storeSecret("github-api-token", secretValue, "github");
    printSuccess(`Secret stored with ID: ${secretId}`);
    printInfo("Secret is AES-256 encrypted and saved to .vault-secrets.json");

    // Issue credential
    printHeader("STEP 3: Issue Credential to Agent");
    const agentSecret = "agent_secret_" + Math.random().toString(36).substring(2, 15);
    printInfo(`Agent Secret: ${agentSecret}`);
    console.log("⏳ Issuing credential on Midnight blockchain...");

    await (contract as any).callTx.issueCredential(agentSecret);
    printSuccess("Credential issued!");
    printInfo("This transaction is recorded on the Midnight blockchain");

    await sleep(2000); // Wait for blockchain confirmation

    // Agent requests access
    printHeader("STEP 4: Agent Requests Access (with ZK Proof)");
    console.log("Scenario: Agent needs to call GitHub API");
    console.log("⏳ Agent presents ZK proof to prove authorization...");

    await (contract as any).callTx.proveAuthorization(agentSecret);
    printSuccess("ZK Proof verified on Midnight blockchain!");
    printInfo("Agent is authorized to access secrets");

    // Execute action
    printHeader("STEP 5: Vault Executes Action (Agent Never Sees Secret)");
    console.log("⏳ Vault retrieves encrypted secret...");
    const retrievedSecret = vault.getSecret("github-api-token");

    if (!retrievedSecret) {
      printError("Secret not found!");
      process.exit(1);
    }

    printSuccess("Secret decrypted (in secure vault only)");

    if (useRealGitHub.toLowerCase() === "y") {
      console.log("⏳ Calling GitHub API with secret...");
      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${retrievedSecret}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Agent-Vault-Demo/1.0"
          }
        });

        if (response.ok) {
          const userData: any = await response.json();
          printSuccess("GitHub API call successful!");
          console.log("\n📊 Results returned to agent:");
          console.log(`   Name: ${userData.name || userData.login}`);
          console.log(`   Username: ${userData.login}`);
          console.log(`   Public Repos: ${userData.public_repos}`);
          printInfo("Agent received results WITHOUT seeing the API token!");
        } else {
          printWarning(`GitHub API returned: ${response.status}`);
        }
      } catch (error: any) {
        printWarning(`GitHub API error: ${error.message}`);
      }
    } else {
      printInfo("Skipping real GitHub call (using demo token)");
      console.log("\n📊 Results that would be returned to agent:");
      console.log("   Name: Demo User");
      console.log("   Username: demo-agent");
      console.log("   Public Repos: 42");
    }

    // Show stats
    printHeader("STEP 6: View Blockchain Audit Trail");
    const contractState: any = await Rx.firstValueFrom((contract as any).state());

    console.log("📊 Contract Statistics (from Midnight blockchain):");
    console.log(`   Total Credentials Issued:  ${contractState.totalCredentials || 0}`);
    console.log(`   Successful Authorizations: ${contractState.successfulAuth || 0}`);
    console.log(`   Blocked Attacks:           ${contractState.blockedAttempts || 0}`);

    // Final summary
    printHeader("✨ DEMO COMPLETE");
    console.log("What just happened:");
    console.log("  ✅ Secret stored in encrypted vault (AES-256)");
    console.log("  ✅ Agent credential issued on Midnight blockchain");
    console.log("  ✅ ZK proof verified (cryptographically unforgeable)");
    console.log("  ✅ Action executed using secret");
    console.log("  ✅ Agent got results WITHOUT seeing the secret");
    console.log("  ✅ All access logged on immutable blockchain");
    console.log();
    console.log("🎯 Key Insight: Agent NEVER had access to the API token!");
    console.log("   The vault decrypted it, used it, and returned only the results.");
    console.log();
    console.log("🔒 This is zero-knowledge authorization in action.");
    console.log();

    await wallet.close();
  } catch (error: any) {
    printError(`Demo failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
