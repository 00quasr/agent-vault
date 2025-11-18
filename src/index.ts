// Agent Vault - Main Entry Point
// This file is a placeholder for the TypeScript compiler

export const AGENT_VAULT_VERSION = "0.1.0";

export const config = {
  contractName: "agent-credentials",
  network: "testnet",
  testnetIndexer: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  testnetRPC: "https://rpc.testnet-02.midnight.network",
  proofServer: "http://127.0.0.1:6300"
};

console.log(`Agent Vault v${AGENT_VAULT_VERSION} initialized`);
