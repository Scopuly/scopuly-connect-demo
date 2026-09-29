export const TESTNET = "Test SDF Network ; September 2015";
export const MAINNET = "Public Global Stellar Network ; September 2015";
export type NetworkId = "testnet" | "mainnet";
export const NETWORKS = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    passphrase: TESTNET,
    horizon: "https://horizon-testnet.stellar.org",
    chain: "stellar:testnet",
    explorer: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    passphrase: MAINNET,
    horizon: "https://horizon.stellar.org",
    chain: "stellar:pubnet",
    explorer: "https://stellar.expert/explorer/public",
  },
} as const;
export const FRIENDBOT = "https://friendbot.stellar.org";
export const PROJECT_ID = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""
).trim();
export const WALLETCONNECT_CONFIGURED = /^[a-f0-9]{32}$/i.test(PROJECT_ID);
export const DOCS = "https://extension.scopuly.com/docs/provider-api/";
export const EXTENSION = "https://extension.scopuly.com/";
