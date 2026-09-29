import { NETWORKS, type NetworkId } from "./config";
import type { ConnectionMode } from "./wallet";

export function integrationSnippet(
  mode: ConnectionMode,
  network: NetworkId,
): string {
  const enumNetwork = network === "testnet" ? "TESTNET" : "PUBLIC";
  if (mode === "provider")
    return `import {
  requestAccess, getNetwork, signTransaction,
} from '@scopuly/signer-extension-api';

const { address, error } = await requestAccess();
if (error) throw error;

const network = await getNetwork();
if (network.error) throw network.error;
if (network.networkPassphrase !==
    '${NETWORKS[network].passphrase}') {
  throw new Error('Select the matching network');
}

// Build and review the transaction first.
const result = await signTransaction(unsignedXdr, {
  address,
  networkPassphrase: network.networkPassphrase,
});
if (result.error) throw result.error;

// Verify the signature before a separate submit.
// Full implementation: src/stellar.ts
// Submission: src/horizon.ts`;
  return `import { StellarWalletsKit as kit }
  from '@creit.tech/stellar-wallets-kit/sdk';
import { Networks }
  from '@creit.tech/stellar-wallets-kit/types';
${
  mode === "swk"
    ? `import { ScopulyModule }
  from '@creit.tech/stellar-wallets-kit/modules/scopuly';

kit.init({
  modules: [new ScopulyModule()],
  network: Networks.${enumNetwork},
});
kit.setWallet('scopuly');`
    : `import { WalletConnectModule, WalletConnectTargetChain }
  from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';

// See src/wallet.ts for readiness and session checks.
kit.init({
  modules: [new WalletConnectModule({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    metadata: appMetadata,
    allowedChains: [WalletConnectTargetChain.${enumNetwork}],
  })],
  network: Networks.${enumNetwork},
});
kit.setWallet('wallet_connect');`
}

const { address } = await kit.fetchAddress();
const { signedTxXdr } = await kit.signTransaction(
  unsignedXdr,
  { address, networkPassphrase: Networks.${enumNetwork} },
);

// Signing does not submit the transaction.
// Verify, then submit to the matching Horizon.`;
}
