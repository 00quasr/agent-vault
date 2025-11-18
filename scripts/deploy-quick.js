#!/usr/bin/env node

/**
 * Quick deployment script for hackathon - no prompts!
 */

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
import { Transaction } from "@midnight-ntwrk/ledger";
import { Transaction as ZswapTransaction } from "@midnight-ntwrk/zswap";
import { WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as Rx from "rxjs";

// @ts-ignore
globalThis.WebSocket = WebSocket;

setNetworkId(NetworkId.TestNet);

const TESTNET_CONFIG = {
  indexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  indexerWS: "wss://indexer.testnet-02.midnight.network/api/v1/graphql/ws",
  node: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300"
};

async function deployQuick() {
  const walletSeed = process.env.WALLET_SEED || process.argv[2];

  if (!walletSeed) {
    console.error("❌ WALLET_SEED required!");
    process.exit(1);
  }

  console.log("🚀 Quick Deploy - All 8 Circuits\n");

  // Build wallet
  console.log("📱 Building wallet...");
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
  const state = await Rx.firstValueFrom(wallet.state());
  console.log(`✅ Wallet: ${state.address}\n`);

  // Load contract
  console.log("📦 Loading contract...");
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
    balanceTx(tx, newCoins) {
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
    submitTx(tx) {
      return wallet.submitTransaction(tx);
    }
  };

  const zkConfigPath = path.join(contractPath, "managed", "agent-credentials");
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "deploy-state"
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

  // Deploy
  console.log("🚀 Deploying contract to Midnight testnet...");
  const deployment = await deployContract(providers, {
    contract: contractInstance,
    initialPrivateState: {}
  });

  console.log("\n✅ CONTRACT DEPLOYED!");
  console.log(`   Address: ${deployment.deployTxData.public.contractAddress}`);
  console.log(`   TX Hash: ${deployment.deployTxHash}\n`);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: deployment.deployTxData.public.contractAddress,
    deployTxHash: deployment.deployTxHash,
    network: "testnet",
    deployedAt: new Date().toISOString(),
    walletAddress: state.address,
    circuits: [
      "issueCredential",
      "proveAuthorization",
      "reportBlocked",
      "proveReadAuth",
      "proveWriteAuth",
      "proveExecuteAuth",
      "revokeCredential",
      "proveMultiPartyAuth"
    ]
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Saved to deployment.json\n");

  await wallet.close();
  process.exit(0);
}

deployQuick().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
