// Deploy DocLoqAnchor + authorize the backend wallet as an anchor.
// Run: npx hardhat run scripts/deploy.cjs --network amoy
// After deploy, copy the printed address into backend/.env as POLYGON_CONTRACT_ADDRESS.

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const net = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error('No signer found. Set POLYGON_PRIVATE_KEY in backend/.env');
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${net} (chainId ${hre.network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ${net === 'polygon' ? 'POL' : 'POL(test)'}`);

  if (balance === 0n) {
    throw new Error('Deployer balance is 0. Fund the wallet from a faucet (Amoy) before deploying.');
  }

  console.log('\nDeploying DocLoqAnchor...');
  const Factory = await hre.ethers.getContractFactory('DocLoqAnchor');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`Deployed at: ${address}`);

  // Backend anchoring wallet defaults to the deployer, so authorize it here.
  console.log('\nAuthorizing deployer wallet as an anchor...');
  const tx = await contract.authorizeAnchor(deployer.address);
  await tx.wait();
  console.log(`Authorized: ${deployer.address} (tx ${tx.hash})`);

  // Sync the ABI consumed by the backend service (it reads contracts/DocLoqAnchor.json -> .abi).
  const artifact = require('../artifacts/contracts/DocLoqAnchor.sol/DocLoqAnchor.json');
  const outPath = path.join(__dirname, '../contracts/DocLoqAnchor.json');
  fs.writeFileSync(outPath, JSON.stringify({
    contractName: artifact.contractName,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    deployedNetwork: net,
    chainId: hre.network.config.chainId,
    address,
  }, null, 2));
  console.log(`\nABI synced -> contracts/DocLoqAnchor.json`);

  console.log('\n──────────────────────────────────────────────');
  console.log('NEXT STEPS — add to backend/.env:');
  console.log(`  BLOCKCHAIN_ENABLED=true`);
  console.log(`  POLYGON_CHAIN_ID=${hre.network.config.chainId}`);
  console.log(`  POLYGON_RPC_URL=${hre.network.config.url}`);
  console.log(`  POLYGON_CONTRACT_ADDRESS=${address}`);
  console.log('──────────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
