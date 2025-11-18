import { WalletBuilder } from "@midnight-ntwrk/wallet";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
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

// Fix WebSocket for Node.js environment
// @ts-ignore
globalThis.WebSocket = WebSocket;

// Configure for Midnight Testnet
setNetworkId(NetworkId.TestNet);

// Testnet connection endpoints
const TESTNET_CONFIG = {
  indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
  node: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300"
};

const waitForFunds = (wallet: Wallet) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state) => {
        if (state.syncProgress) {
          console.log(
            `Sync progress: synced=${state.syncProgress.synced}, sourceGap=${state.syncProgress.lag.sourceGap}, applyGap=${state.syncProgress.lag.applyGap}`
          );
        }
      }),
      Rx.filter((state) => state.syncProgress?.synced === true),
      Rx.map((s) => s.balances[nativeToken()] ?? 0n),
      Rx.filter((balance) => balance > 0n),
      Rx.tap((balance) => console.log(`Wallet funded with balance: ${balance}`))
    )
  );

async function main() {
  console.log("🔒 Agent Vault - Contract Deployment\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // Ask user if they have an existing wallet seed
    const choice = await rl.question("Do you have a wallet seed? (y/n): ");

    let walletSeed: string;
    if (choice.toLowerCase() === "y" || choice.toLowerCase() === "yes") {
      // Use existing seed
      walletSeed = await rl.question("Enter your 64-character seed: ");
    } else {
      // Generate new wallet seed
      const bytes = new Uint8Array(32);
      // @ts-ignore
      crypto.getRandomValues(bytes);
      walletSeed = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
      console.log(`\n⚠️  SAVE THIS SEED: ${walletSeed}\n`);
    }

    // Build wallet from seed
    console.log("Building wallet...");
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

    console.log(`✅ Your wallet address: ${state.address}`);

    let balance = state.balances[nativeToken()] || 0n;

    if (balance === 0n) {
      console.log(`\n💰 Your wallet balance: 0 tDUST`);
      console.log("📍 Visit: https://midnight.network/test-faucet");
      console.log("⏳ Waiting to receive tokens...");
      balance = await waitForFunds(wallet);
    }

    console.log(`✅ Balance: ${balance} tDUST`);

    // Load compiled contract files
    console.log("\n📦 Loading agent-credentials contract...");
    const contractPath = path.join(process.cwd(), "contracts");
    const contractModulePath = path.join(
      contractPath,
      "managed",
      "agent-credentials",
      "contract",
      "index.cjs"
    );

    if (!fs.existsSync(contractModulePath)) {
      console.error("❌ Contract not found! Run: npm run compile");
      process.exit(1);
    }

    const AgentCredentialsModule = await import(contractModulePath);
    const contractInstance = new AgentCredentialsModule.Contract({});

    // Create wallet provider for transactions
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

    // Configure all required providers
    console.log("⚙️  Setting up providers...");
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

    // Deploy contract to blockchain
    console.log("\n🚀 Deploying contract to Midnight testnet...");
    console.log("⏱️  This takes 30-60 seconds...\n");

    const deployed = await deployContract(providers, {
      contract: contractInstance,
      privateStateId: "agentVaultState",
      initialPrivateState: {}
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;

    // Save deployment information
    console.log("\n🎉 DEPLOYMENT SUCCESSFUL!\n");
    console.log(`📋 Contract Address: ${contractAddress}`);

    const info = {
      contractAddress,
      deployedAt: new Date().toISOString(),
      network: "testnet",
      contractName: "agent-credentials"
    };

    fs.writeFileSync("deployment.json", JSON.stringify(info, null, 2));
    console.log("💾 Saved to deployment.json");

    console.log("\n✅ Agent Vault deployed and ready!");
    console.log("\nNext steps:");
    console.log("  1. Test contract: npm run test");
    console.log("  2. Run demo: npm run demo:attack");
    console.log("  3. Start MCP server: npm run mcp:server\n");

    // Close wallet connection
    await wallet.close();
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
