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
import * as readline from "readline/promises";
import * as Rx from "rxjs";
import { type Wallet } from "@midnight-ntwrk/wallet-api";

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

// Load deployment info
const deploymentPath = path.join(process.cwd(), "deployment.json");
if (!fs.existsSync(deploymentPath)) {
  console.error("❌ No deployment found! Run: npm run deploy");
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
const CONTRACT_ADDRESS = deployment.contractAddress;

async function main() {
  console.log("🔒 Agent Vault CLI\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // Ask for wallet seed
    const walletSeed = await rl.question("Enter your wallet seed: ");

    // Build wallet
    console.log("\n⚙️  Building wallet...");
    const wallet = await WalletBuilder.buildFromSeed(
      TESTNET_CONFIG.indexer,
      TESTNET_CONFIG.indexerWS,
      TESTNET_CONFIG.proofServer,
      TESTNET_CONFIG.node,
      walletSeed,
      getZswapNetworkId(),
      "info"
    );

    wallet.start();
    const state = await Rx.firstValueFrom(wallet.state());
    console.log(`✅ Wallet: ${state.address}`);

    // Load contract
    console.log("\n📦 Loading contract...");
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
    const walletState = await Rx.firstValueFrom(wallet.state());
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
          .then((tx) => wallet.proveTransaction(tx))
          .then((zswapTx) =>
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
        privateStateStoreName: "agent-vault-state"
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
    console.log(`\n🔍 Connecting to contract: ${CONTRACT_ADDRESS}`);
    const contract = await findDeployedContract(providers, {
      contract: contractInstance,
      contractAddress: CONTRACT_ADDRESS,
      privateStateId: "agentVaultState",
      initialPrivateState: {}
    });

    console.log("✅ Connected to contract!\n");

    // Show menu
    while (true) {
      console.log("\n📋 Available Commands:");
      console.log("  1. Issue credential");
      console.log("  2. Prove authorization");
      console.log("  3. Simulate attack");
      console.log("  4. View stats");
      console.log("  5. Exit\n");

      const choice = await rl.question("Choose command (1-5): ");

      switch (choice) {
        case "1":
          await issueCredential(contract, rl);
          break;
        case "2":
          await proveAuthorization(contract, rl);
          break;
        case "3":
          await simulateAttack(contract);
          break;
        case "4":
          await viewStats(contract);
          break;
        case "5":
          console.log("\n👋 Goodbye!");
          await wallet.close();
          process.exit(0);
        default:
          console.log("❌ Invalid choice");
      }
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function issueCredential(contract: any, rl: readline.Interface) {
  console.log("\n🔑 Issue Credential");
  const secret = await rl.question("Enter agent secret: ");

  console.log("⏳ Issuing credential...");
  await contract.callTx.issueCredential(secret);
  console.log("✅ Credential issued!");
}

async function proveAuthorization(contract: any, rl: readline.Interface) {
  console.log("\n✓ Prove Authorization");
  const secret = await rl.question("Enter agent secret: ");

  console.log("⏳ Verifying credential...");
  await contract.callTx.proveAuthorization(secret);
  console.log("✅ Authorization successful!");
}

async function simulateAttack(contract: any) {
  console.log("\n🛡️  Simulating Attack");
  console.log("⏳ Recording blocked attempt...");
  await contract.callTx.simulateAttack();
  console.log("✅ Attack blocked and logged!");
}

async function viewStats(contract: any) {
  console.log("\n📊 Contract Statistics\n");

  const state: any = await Rx.firstValueFrom(contract.state());

  console.log(`Total Credentials:    ${state.totalCredentials || 0}`);
  console.log(`Successful Auth:      ${state.successfulAuth || 0}`);
  console.log(`Blocked Attempts:     ${state.blockedAttempts || 0}`);
  console.log(`Current Credential:   ${state.currentCredential || "none"}`);
}

main().catch(console.error);
