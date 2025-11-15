// src/config/networkConfig.ts
import { getFullnodeUrl } from '@mysten/sui/client';
import { createNetworkConfig } from '@mysten/dapp-kit';

const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
  mainnet: {
    url: getFullnodeUrl('mainnet'),
    variables: {
      dropforgePackageId: import.meta.env.VITE_DROPFORGE_PACKAGE_ID_MAINNET,
      dropforgeRegistryId: import.meta.env.VITE_DROPFORGE_REGISTRY_ID_MAINNET,
    },
  },
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      dropforgePackageId: '0xaf8cf0e00bf66206133c890873eeaa0cdb0a9c5de1164a4cf6c16e284cb56ead',
      dropforgeRegistryId: '0x22eff8cb628e96baaf4a42fdf986013dfdb4600ef0b17bd5c354e0d789cd1cc7',
    },
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      dropforgePackageId: import.meta.env.VITE_DROPFORGE_PACKAGE_ID_DEVNET,
      dropforgeRegistryId: import.meta.env.VITE_DROPFORGE_REGISTRY_ID_DEVNET,
    },
  },
});

export { useNetworkVariable, useNetworkVariables, networkConfig };