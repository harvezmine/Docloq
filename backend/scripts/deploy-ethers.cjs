// Deploys DocLoqAnchor to Polygon using ethers.js only (no hardhat). Run: node scripts/deploy-ethers.cjs
// Only deploys, does NOT compile — recompile DocLoqAnchor.sol first if changed (solc or `npx hardhat compile`).

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { ethers } = require('ethers');

const ARTIFACT_PATH = path.join(__dirname, '../contracts/DocLoqAnchor.json');

async function main() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const chainId = parseInt(process.env.POLYGON_CHAIN_ID || '80002', 10);
  const privateKey = process.env.POLYGON_PRIVATE_KEY;

  if (!rpcUrl) throw new Error('POLYGON_RPC_URL not set in backend/.env');
  if (!privateKey) throw new Error('POLYGON_PRIVATE_KEY not set in backend/.env');

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf-8'));
  if (!Array.isArray(artifact.abi) || typeof artifact.bytecode !== 'string') {
    throw new Error('contracts/DocLoqAnchor.json missing abi/bytecode — recompile the contract first');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  const wallet = new ethers.Wallet(privateKey, provider);

  const net = chainId === 137 ? 'polygon' : 'polygon-amoy';
  const balance = await provider.getBalance(wallet.address);
  console.log(`Network:  ${net} (chainId ${chainId})`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} POL${net === 'polygon' ? '' : '(test)'}`);
  if (balance === 0n) {
    throw new Error('Deployer balance is 0. Fund the wallet (Amoy faucet for testnet) before deploying.');
  }

  console.log('\nDeploying DocLoqAnchor (ethers.js ContractFactory)...');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`Deployed at: ${address}`);

  // The deployer is the owner; authorize it as an anchor (backend uses the same wallet).
  console.log('\nAuthorizing deployer wallet as an anchor...');
  const tx = await contract.authorizeAnchor(wallet.address);
  await tx.wait();
  console.log(`Authorized: ${wallet.address} (tx ${tx.hash})`);

  // Sync the deployed address/network back into the artifact the backend reads.
  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify({
    ...artifact,
    deployedNetwork: net,
    chainId,
    address,
  }, null, 2));
  console.log('\nAddress synced -> contracts/DocLoqAnchor.json');

  console.log('\n──────────────────────────────────────────────');
  console.log('NEXT STEPS — add to backend/.env:');
  console.log('  BLOCKCHAIN_ENABLED=true');
  console.log(`  POLYGON_CHAIN_ID=${chainId}`);
  console.log(`  POLYGON_RPC_URL=${rpcUrl}`);
  console.log(`  POLYGON_CONTRACT_ADDRESS=${address}`);
  console.log('──────────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
