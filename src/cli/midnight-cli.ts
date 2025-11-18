#!/usr/bin/env node

/**
 * Agent Vault CLI - Interactive Midnight Contract Testing Tool
 *
 * This CLI allows you to:
 * - Issue credentials on Midnight blockchain
 * - Verify authorization with ZK proofs
 * - Test capability-based authorization (read/write/execute)
 * - View live contract statistics
 * - Test multi-party authorization
 * - Revoke credentials
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
import * as Rx from "rxjs";
import * as readline from "readline";

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

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m"
};

class MidnightCLI {
  private wallet: any = null;
  private contract: any = null;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log(`${colors.cyan}${colors.bright}`);
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║           🌙 Agent Vault - Midnight CLI Tool 🔐              ║");
    console.log("║         Zero-Knowledge Credential Testing Platform           ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    console.log(colors.reset);

    // Get wallet seed
    const walletSeed = process.env.WALLET_SEED || process.argv[2];

    if (!walletSeed) {
      console.error(`${colors.red}❌ Error: Wallet seed required!${colors.reset}`);
      console.error("\nUsage:");
      console.error("  WALLET_SEED=<your-seed> npm run cli");
      process.exit(1);
    }

    // Load deployment
    const deploymentPath = path.join(process.cwd(), "deployment.json");
    if (!fs.existsSync(deploymentPath)) {
      console.error(`${colors.red}❌ Error: No deployment found!${colors.reset}`);
      console.error("Run: npm run deploy");
      process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    const contractAddress = deployment.contractAddress;

    console.log(`${colors.blue}⚙️  Initializing Midnight connection...${colors.reset}\n`);

    // Build wallet
    console.log(`${colors.blue}📱 Building wallet...${colors.reset}`);
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
    console.log(`${colors.green}✅ Wallet: ${state.address}${colors.reset}\n`);

    // Load contract
    console.log(`${colors.blue}📦 Loading contract...${colors.reset}`);
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
    const walletState: any = await Rx.firstValueFrom(this.wallet.state());
    const wallet = this.wallet;
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

    const zkConfigPath = path.join(contractPath, "managed", "agent-credentials");
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: path.join(process.cwd(), "cli-midnight-state")
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
    console.log(`${colors.blue}🔍 Connecting to contract: ${contractAddress}${colors.reset}`);
    this.contract = await findDeployedContract(providers, {
      contract: contractInstance,
      contractAddress: contractAddress,
      privateStateId: "cliState",
      initialPrivateState: {}
    });

    console.log(`${colors.green}✅ Contract connected!${colors.reset}\n`);
  }

  async showMenu() {
    console.log(`${colors.cyan}${colors.bright}═══════════════ MAIN MENU ═══════════════${colors.reset}`);
    console.log(`${colors.yellow}1.${colors.reset} Issue Credential (ZK Proof)`);
    console.log(`${colors.yellow}2.${colors.reset} Verify Authorization (ZK Proof)`);
    console.log(`${colors.yellow}3.${colors.reset} Test Read Capability (Selective Disclosure)`);
    console.log(`${colors.yellow}4.${colors.reset} Test Write Capability (Selective Disclosure)`);
    console.log(`${colors.yellow}5.${colors.reset} Test Execute Capability (Selective Disclosure)`);
    console.log(`${colors.yellow}6.${colors.reset} Test Multi-Party Authorization`);
    console.log(`${colors.yellow}7.${colors.reset} Revoke Credential`);
    console.log(`${colors.yellow}8.${colors.reset} View Contract Statistics`);
    console.log(`${colors.yellow}9.${colors.reset} Report Blocked Attempt`);
    console.log(`${colors.yellow}0.${colors.reset} Exit`);
    console.log(`${colors.cyan}═════════════════════════════════════════${colors.reset}\n`);
  }

  async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  async issueCredential() {
    console.log(`\n${colors.magenta}${colors.bright}🎫 ISSUE CREDENTIAL${colors.reset}`);
    console.log("This will create a ZK proof and submit a transaction to Midnight blockchain\n");

    const secret = await this.prompt("Enter agent secret (or press Enter for random): ");
    const agentSecret = secret || Math.random().toString(36).substring(7);

    console.log(`\n${colors.blue}📝 Issuing credential with secret: ${agentSecret}${colors.reset}`);
    console.log(`${colors.blue}⏳ Creating ZK proof...${colors.reset}`);

    try {
      const tx = await this.contract.callTx.issueCredential(agentSecret);

      console.log(`${colors.green}${colors.bright}✅ CREDENTIAL ISSUED!${colors.reset}`);
      console.log(`   Secret: ${colors.cyan}${agentSecret}${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}`);
      console.log(`   ${colors.yellow}⚠️  Save this secret! You'll need it to prove authorization${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async verifyAuthorization() {
    console.log(`\n${colors.magenta}${colors.bright}🔐 VERIFY AUTHORIZATION${colors.reset}`);
    console.log("This will prove you know the secret WITHOUT revealing it (Zero-Knowledge!)\n");

    const secret = await this.prompt("Enter agent secret: ");
    const commitment = await this.prompt("Enter expected commitment (same as secret for this demo): ");

    console.log(`\n${colors.blue}🔍 Verifying authorization...${colors.reset}`);
    console.log(`${colors.blue}⏳ Creating ZK proof...${colors.reset}`);

    try {
      const tx = await this.contract.callTx.proveAuthorization(
        secret,
        commitment || secret
      );

      console.log(`${colors.green}${colors.bright}✅ AUTHORIZATION VERIFIED!${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}`);
      console.log(`   ${colors.green}🎉 ZK Proof succeeded - secret matched without being revealed!${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Verification failed: ${error.message}${colors.reset}\n`);
    }
  }

  async testCapability(capability: 'read' | 'write' | 'execute') {
    const icons = { read: '📖', write: '✍️', execute: '⚡' };
    const colors_map = { read: colors.blue, write: colors.magenta, execute: colors.yellow };

    console.log(`\n${colors_map[capability]}${colors.bright}${icons[capability]} TEST ${capability.toUpperCase()} CAPABILITY${colors.reset}`);
    console.log(`This demonstrates SELECTIVE DISCLOSURE - proving ${capability} capability`);
    console.log(`without revealing other capabilities!\n`);

    const secret = await this.prompt("Enter agent secret: ");
    const commitment = await this.prompt("Enter expected commitment: ");

    console.log(`\n${colors.blue}🔍 Proving ${capability} capability...${colors.reset}`);
    console.log(`${colors.blue}⏳ Creating ZK proof...${colors.reset}`);

    try {
      const methodName = `prove${capability.charAt(0).toUpperCase() + capability.slice(1)}Auth`;
      const tx = await (this.contract.callTx as any)[methodName](
        secret,
        commitment || secret
      );

      console.log(`${colors.green}${colors.bright}✅ ${capability.toUpperCase()} CAPABILITY VERIFIED!${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}`);
      console.log(`   ${colors.green}🎉 Agent proved ${capability} access without revealing write/execute capabilities!${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async testMultiParty() {
    console.log(`\n${colors.magenta}${colors.bright}👥 TEST MULTI-PARTY AUTHORIZATION${colors.reset}`);
    console.log("This requires TWO agents to collectively authorize an action\n");

    const secret1 = await this.prompt("Enter agent 1 secret: ");
    const commitment1 = await this.prompt("Enter agent 1 commitment: ");
    const secret2 = await this.prompt("Enter agent 2 secret: ");
    const commitment2 = await this.prompt("Enter agent 2 commitment: ");

    console.log(`\n${colors.blue}👥 Verifying multi-party authorization...${colors.reset}`);
    console.log(`${colors.blue}⏳ Creating ZK proofs for both agents...${colors.reset}`);

    try {
      const tx = await this.contract.callTx.proveMultiPartyAuth(
        secret1,
        commitment1 || secret1,
        secret2,
        commitment2 || secret2
      );

      console.log(`${colors.green}${colors.bright}✅ MULTI-PARTY AUTHORIZATION VERIFIED!${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}`);
      console.log(`   ${colors.green}🎉 Both agents authorized successfully!${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async revokeCredential() {
    console.log(`\n${colors.red}${colors.bright}⚠️  REVOKE CREDENTIAL${colors.reset}`);
    console.log("This will record a credential revocation on the blockchain\n");

    const confirm = await this.prompt("Are you sure you want to revoke? (yes/no): ");

    if (confirm.toLowerCase() !== 'yes') {
      console.log(`${colors.yellow}Revocation cancelled${colors.reset}\n`);
      return;
    }

    console.log(`\n${colors.blue}🔍 Recording revocation...${colors.reset}`);

    try {
      const tx = await this.contract.callTx.revokeCredential();

      console.log(`${colors.green}${colors.bright}✅ CREDENTIAL REVOKED!${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async viewStats() {
    console.log(`\n${colors.cyan}${colors.bright}📊 CONTRACT STATISTICS${colors.reset}`);
    console.log("Live data from Midnight blockchain\n");

    try {
      const state: any = await Rx.firstValueFrom(this.contract.state);

      console.log(`${colors.green}╔═══════════════════════════════════════════╗${colors.reset}`);
      console.log(`${colors.green}║  ${colors.bright}Midnight Blockchain Stats${colors.reset}${colors.green}            ║${colors.reset}`);
      console.log(`${colors.green}╠═══════════════════════════════════════════╣${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  🎫 Credentials Issued:        ${colors.bright}${state.totalCredentials?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  ✅ Successful Auth:           ${colors.bright}${state.successfulAuth?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  🚫 Blocked Attempts:          ${colors.bright}${state.blockedAttempts?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  ⚠️  Revocations:              ${colors.bright}${state.totalRevocations?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}╠═══════════════════════════════════════════╣${colors.reset}`);
      console.log(`${colors.green}║  ${colors.bright}Selective Disclosure Stats${colors.reset}${colors.green}            ║${colors.reset}`);
      console.log(`${colors.green}╠═══════════════════════════════════════════╣${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  📖 Read Auth:                 ${colors.bright}${state.totalReadAuth?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  ✍️  Write Auth:                ${colors.bright}${state.totalWriteAuth?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}║${colors.reset}  ⚡ Execute Auth:              ${colors.bright}${state.totalExecuteAuth?.value || 0}${colors.reset}${colors.green}      ║${colors.reset}`);
      console.log(`${colors.green}╚═══════════════════════════════════════════╝${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async reportBlocked() {
    console.log(`\n${colors.red}${colors.bright}🚫 REPORT BLOCKED ATTEMPT${colors.reset}`);
    console.log("This will increment the blocked attempts counter\n");

    try {
      const tx = await this.contract.callTx.reportBlocked();

      console.log(`${colors.green}${colors.bright}✅ BLOCKED ATTEMPT RECORDED!${colors.reset}`);
      console.log(`   TX Hash: ${colors.cyan}${tx.txHash || 'pending'}${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.red}❌ Failed: ${error.message}${colors.reset}\n`);
    }
  }

  async run() {
    while (true) {
      await this.showMenu();
      const choice = await this.prompt(`${colors.bright}Select an option: ${colors.reset}`);

      switch (choice.trim()) {
        case "1":
          await this.issueCredential();
          break;
        case "2":
          await this.verifyAuthorization();
          break;
        case "3":
          await this.testCapability('read');
          break;
        case "4":
          await this.testCapability('write');
          break;
        case "5":
          await this.testCapability('execute');
          break;
        case "6":
          await this.testMultiParty();
          break;
        case "7":
          await this.revokeCredential();
          break;
        case "8":
          await this.viewStats();
          break;
        case "9":
          await this.reportBlocked();
          break;
        case "0":
          console.log(`\n${colors.cyan}👋 Goodbye!${colors.reset}\n`);
          await this.cleanup();
          process.exit(0);
        default:
          console.log(`${colors.red}Invalid option. Please try again.${colors.reset}\n`);
      }
    }
  }

  async cleanup() {
    if (this.wallet) {
      await this.wallet.close();
    }
    this.rl.close();
  }
}

// Main entry point
async function main() {
  const cli = new MidnightCLI();

  try {
    await cli.initialize();
    await cli.run();
  } catch (error: any) {
    console.error(`${colors.red}❌ CLI Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MidnightCLI };
