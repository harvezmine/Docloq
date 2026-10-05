require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY || '';
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    amoy: {
      url: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      chainId: 137,
      accounts,
    },
  },
  etherscan: {
    // PolygonScan API key for contract verification (optional)
    apiKey: { polygonAmoy: process.env.POLYGONSCAN_API_KEY || '', polygon: process.env.POLYGONSCAN_API_KEY || '' },
  },
};
