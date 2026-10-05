
import { ethers } from 'ethers';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { blockchainAnchors, documents, documentVersions } from '../db/schema.js';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import uploadConfig from '../config/upload.config.js';
import { computeMerkleRoot, computeMerkleProof, verifyMerkleProof, hashLeaf, hashNode } from './merkle.util.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { blockchain: bcConfig } = uploadConfig;

let provider = null;
let wallet = null;
let contract = null;
let initialized = false;

export const initBlockchain = () => {
  if (!bcConfig.enabled) {
    console.log('[Blockchain] Disabled (BLOCKCHAIN_ENABLED !== true)');
    return false;
  }

  if (!bcConfig.privateKey || !bcConfig.contractAddress) {
    console.warn('[Blockchain] Enabled but missing POLYGON_PRIVATE_KEY or POLYGON_CONTRACT_ADDRESS');
    return false;
  }

  try {
    const abiPath = path.join(__dirname, '../../contracts/DocLoqAnchor.json');
    const contractABI = JSON.parse(readFileSync(abiPath, 'utf-8'));
    provider = new ethers.JsonRpcProvider(bcConfig.rpcUrl, bcConfig.chainId);
    wallet = new ethers.Wallet(bcConfig.privateKey, provider);
    contract = new ethers.Contract(bcConfig.contractAddress, contractABI.abi, wallet);
    initialized = true;
    console.log(`[Blockchain] Connected to chain ${bcConfig.chainId}, wallet: ${wallet.address}`);
    return true;
  } catch (error) {
    console.error('[Blockchain] Initialization failed:', error.message);
    return false;
  }
};

export const isReady = () => initialized && contract !== null;

const toAnchorId = (documentId) => {
  return ethers.keccak256(ethers.toUtf8Bytes(documentId));
};

const pseudonymizeOrgId = (organizationId) => {
  return ethers.keccak256(ethers.toUtf8Bytes(organizationId));
};

const HEX64 = /^(?:0x)?[0-9a-fA-F]{64}$/;

// reject truncated/corrupt hashes
const hashToBytes32 = (sha256Hex) => {
  if (typeof sha256Hex !== 'string' || !HEX64.test(sha256Hex)) {
    const shown = sha256Hex === null ? 'null'
      : sha256Hex === undefined ? 'undefined'
      : typeof sha256Hex === 'string' ? `"${sha256Hex.slice(0, 20)}" (${sha256Hex.length} chars)`
      : typeof sha256Hex;
    throw new Error(`Invalid hash: expected 64 hex chars, got ${shown}`);
  }
  const clean = sha256Hex.startsWith('0x') ? sha256Hex : `0x${sha256Hex}`;
  return ethers.zeroPadValue(clean, 32);
};

export const anchorDocument = async (documentId, versionId, contentHash, organizationId, versionNumber = 1) => {
  if (!isReady()) {
    return { success: false, message: 'Blockchain not initialized' };
  }

  const anchorId = toAnchorId(documentId);
  const docHash = hashToBytes32(contentHash);
  const pseudoOrg = pseudonymizeOrgId(organizationId);

  try {
    const tx = await contract.anchorDocument(anchorId, docHash, pseudoOrg, versionNumber, {
      gasLimit: bcConfig.gasLimitSingle,
    });

    console.log(`[Blockchain] Anchoring tx submitted: ${tx.hash}`);

    const [anchorRecord] = await db.insert(blockchainAnchors).values({
      documentId,
      versionId,
      blockchainNetwork: bcConfig.chainId === 137 ? 'polygon' : 'polygon-amoy',
      transactionHash: tx.hash,
      anchoredHash: contentHash,
      pseudonymizedOrgId: pseudoOrg,
      status: 'pending',
    }).returning();

    await db.update(documents).set({
      blockchainAnchored: true,
      blockchainAnchorId: anchorRecord.id,
    }).where(eq(documents.id, documentId));

    confirmTransaction(tx, anchorRecord.id).catch(err =>
      console.error('[Blockchain] Confirmation tracking failed:', err.message)
    );

    return {
      success: true,
      txHash: tx.hash,
      anchorRecordId: anchorRecord.id,
      anchorId,
      status: 'pending',
    };
  } catch (error) {
    console.error('[Blockchain] Anchor failed:', error.message);
    return { success: false, message: error.message };
  }
};

export const updateAnchor = async (documentId, newContentHash, newVersionNumber, organizationId) => {
  if (!isReady()) {
    return { success: false, message: 'Blockchain not initialized' };
  }

  const anchorId = toAnchorId(documentId);
  const docHash = hashToBytes32(newContentHash);

  try {
    const whereClause = organizationId
      ? and(eq(documents.id, documentId), eq(documents.organizationId, organizationId))
      : eq(documents.id, documentId);
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc || !doc.blockchainAnchored) {
      return { success: false, message: 'Document not anchored yet' };
    }

    const tx = await contract.updateAnchor(anchorId, docHash, newVersionNumber, {
      gasLimit: bcConfig.gasLimitSingle,
    });

    console.log(`[Blockchain] Update anchor tx submitted: ${tx.hash}`);

    const [anchorRecord] = await db.insert(blockchainAnchors).values({
      documentId,
      versionId: doc.currentVersionId,
      blockchainNetwork: bcConfig.chainId === 137 ? 'polygon' : 'polygon-amoy',
      transactionHash: tx.hash,
      anchoredHash: newContentHash,
      pseudonymizedOrgId: pseudonymizeOrgId(doc.organizationId),
      status: 'pending',
    }).returning();

    await db.update(documents).set({
      blockchainAnchorId: anchorRecord.id,
    }).where(eq(documents.id, documentId));

    confirmTransaction(tx, anchorRecord.id).catch(err =>
      console.error('[Blockchain] Confirmation tracking failed:', err.message)
    );

    return {
      success: true,
      txHash: tx.hash,
      anchorRecordId: anchorRecord.id,
      status: 'pending',
    };
  } catch (error) {
    console.error('[Blockchain] Update anchor failed:', error.message);
    return { success: false, message: error.message };
  }
};

export const verifyDocument = async (documentId, contentHash) => {
  if (!isReady()) {
    return { verified: false, message: 'Blockchain not initialized' };
  }

  const anchorId = toAnchorId(documentId);
  const docHash = hashToBytes32(contentHash);

  try {
    const [isValid, timestamp] = await contract.verifyDocument(anchorId, docHash);
    const anchoredAt = timestamp > 0n ? new Date(Number(timestamp) * 1000).toISOString() : null;

    const [onChainHash, , versionNumber, , exists] = await contract.getAnchor(anchorId);

    return {
      verified: isValid,
      exists,
      onChainHash: exists ? onChainHash : null,
      currentHash: `0x${contentHash}`,
      hashMatch: isValid,
      anchoredAt,
      versionNumber: exists ? Number(versionNumber) : null,
    };
  } catch (error) {
    console.error('[Blockchain] Verify failed:', error.message);
    return { verified: false, message: error.message };
  }
};

export const anchorBatch = async (docs) => {
  if (!isReady()) {
    return { success: false, message: 'Blockchain not initialized' };
  }

  if (!docs || docs.length === 0) {
    return { success: false, message: 'No documents to anchor' };
  }

  try {
    const leaves = docs.map(d => hashToBytes32(d.contentHash));
    const merkleRoot = computeMerkleRoot(leaves);

    const tx = await contract.anchorBatch(merkleRoot, docs.length, {
      gasLimit: bcConfig.gasLimitBatch,
    });

    console.log(`[Blockchain] Batch anchor tx submitted: ${tx.hash} (${docs.length} docs)`);

    for (let i = 0; i < docs.length; i++) {
      const proof = computeMerkleProof(leaves, i);
      const [anchorRecord] = await db.insert(blockchainAnchors).values({
        documentId: docs[i].documentId,
        versionId: docs[i].versionId,
        blockchainNetwork: bcConfig.chainId === 137 ? 'polygon' : 'polygon-amoy',
        transactionHash: tx.hash,
        anchoredHash: docs[i].contentHash,
        pseudonymizedOrgId: pseudonymizeOrgId(docs[i].organizationId),
        merkleRoot,
        merkleProof: proof,
        status: 'pending',
      }).returning();

      await db.update(documents).set({
        blockchainAnchored: true,
        blockchainAnchorId: anchorRecord.id,
      }).where(eq(documents.id, docs[i].documentId));
    }

    confirmTransaction(tx, null).catch(err =>
      console.error('[Blockchain] Batch confirmation failed:', err.message)
    );

    return {
      success: true,
      txHash: tx.hash,
      merkleRoot,
      documentCount: docs.length,
      status: 'pending',
    };
  } catch (error) {
    console.error('[Blockchain] Batch anchor failed:', error.message);
    return { success: false, message: error.message };
  }
};

export const verifyDocumentInBatch = async (contentHash, merkleProof, merkleRoot) => {
  if (!isReady()) return { verified: false, exists: false, message: 'Blockchain not initialized' };
  if (!merkleRoot || !merkleProof) return { verified: false, exists: false, message: 'No merkle proof' };

  const leaf = hashToBytes32(contentHash);
  const proofValid = verifyMerkleProof(leaf, merkleProof, merkleRoot);
  if (!proofValid) return { verified: false, exists: false, message: 'Merkle proof does not match (hash changed?)' };

  try {
    const [documentCount, timestamp, exists] = await contract.verifyBatch(merkleRoot);
    const anchoredAt = timestamp > 0n ? new Date(Number(timestamp) * 1000).toISOString() : null;
    return { verified: exists === true, exists: exists === true, documentCount: Number(documentCount), anchoredAt };
  } catch (error) {
    console.error('[Blockchain] verifyBatch failed:', error.message);
    return { verified: false, exists: false, message: error.message };
  }
};


// names the offending seq
const auditLeaves = (entryHashes, seqs) => (entryHashes || []).map((h, i) => {
  try {
    return hashToBytes32(h);
  } catch (err) {
    const where = seqs?.[i] != null ? `seq ${seqs[i]}` : `entry #${i}`;
    throw new Error(`Cannot build audit Merkle root — ${where}: ${err.message}`);
  }
});

export const computeAuditRoot = (entryHashes, { seqs = null } = {}) =>
  computeMerkleRoot(auditLeaves(entryHashes, seqs));

// inclusion proof
export const computeAuditProof = (entryHashes, index, { seqs = null } = {}) => {
  const leaves = auditLeaves(entryHashes, seqs);
  if (index < 0 || index >= leaves.length) {
    throw new Error(`Leaf index ${index} out of range (0..${leaves.length - 1})`);
  }

  const leaf = leaves[index];
  const proof = computeMerkleProof(leaves, index);
  const root = computeMerkleRoot(leaves);

  let acc = hashLeaf(leaf);
  const steps = proof.map((sibling) => {
    acc = hashNode(acc, sibling);
    return { sibling, result: acc };
  });

  return { leaf, leafHash: hashLeaf(leaf), proof, steps, root, verified: verifyMerkleProof(leaf, proof, root) };
};

// holds the anchor lock
const ANCHOR_WAIT_MS = Math.max(30_000, parseInt(process.env.AUDIT_ANCHOR_WAIT_MS || '600000', 10));

export const anchorAuditRoot = async (root, entryCount) => {
  if (!isReady()) return { success: false, message: 'Blockchain not initialized' };
  try {
    const tx = await contract.anchorBatch(root, entryCount, { gasLimit: bcConfig.gasLimitBatch });
    console.log(`[Blockchain] Audit anchor tx submitted: ${tx.hash} (${entryCount} entries)`);
    const receipt = await tx.wait(bcConfig.confirmations, ANCHOR_WAIT_MS);
    return {
      success: receipt.status === 1,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('[Blockchain] Audit anchor failed:', error.message);
    return { success: false, message: error.message };
  }
};

export const verifyAuditRoot = async (root) => {
  if (!isReady()) return { onChain: false, message: 'Blockchain not initialized' };
  try {
    const [documentCount, timestamp, exists] = await contract.verifyBatch(root);
    const anchoredAt = timestamp > 0n ? new Date(Number(timestamp) * 1000).toISOString() : null;
    return { onChain: exists === true, count: Number(documentCount), anchoredAt };
  } catch (error) {
    console.error('[Blockchain] verifyAuditRoot failed:', error.message);
    return { onChain: false, message: error.message };
  }
};

async function confirmTransaction(tx, anchorRecordId) {
  try {
    const receipt = await tx.wait(bcConfig.confirmations);

    const updateData = {
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      blockNumber: receipt.blockNumber,
      blockTimestamp: new Date(),
      confirmations: bcConfig.confirmations,
      gasUsed: receipt.gasUsed.toString(),
      gasCost: ethers.formatEther(receipt.gasUsed * receipt.gasPrice) + ' MATIC',
      confirmedAt: new Date(),
    };

    if (anchorRecordId) {
      await db.update(blockchainAnchors).set(updateData).where(eq(blockchainAnchors.id, anchorRecordId));
    } else {
      await db.update(blockchainAnchors).set(updateData).where(eq(blockchainAnchors.transactionHash, tx.hash));
    }

    console.log(`[Blockchain] TX ${tx.hash} confirmed in block ${receipt.blockNumber}`);
  } catch (error) {
    console.error(`[Blockchain] TX ${tx.hash} confirmation failed:`, error.message);
    if (anchorRecordId) {
      await db.update(blockchainAnchors).set({ status: 'failed' }).where(eq(blockchainAnchors.id, anchorRecordId));
    }
  }
}

export const getChainMeta = () => ({
  chainId: bcConfig.chainId,
  network: bcConfig.chainId === 137 ? 'Polygon Mainnet' : 'Polygon Amoy Testnet',
  explorerBase: bcConfig.chainId === 137 ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com',
  contractAddress: bcConfig.contractAddress || null,
  enabled: bcConfig.enabled && isReady(),
});

export const getBlockchainStats = async () => {
  const [totalResult] = await db.select({ count: count() }).from(blockchainAnchors);
  const [confirmedResult] = await db.select({ count: count() }).from(blockchainAnchors).where(eq(blockchainAnchors.status, 'confirmed'));
  const [pendingResult] = await db.select({ count: count() }).from(blockchainAnchors).where(eq(blockchainAnchors.status, 'pending'));

  let walletBalance = '0';
  let walletAddress = '';
  if (isReady()) {
    try {
      const balance = await provider.getBalance(wallet.address);
      walletBalance = ethers.formatEther(balance);
      walletAddress = wallet.address;
    } catch {}
  }

  const gasResult = await db.select({
    totalGas: sql`COALESCE(SUM(CAST(gas_used AS BIGINT)), 0)`,
  }).from(blockchainAnchors).where(eq(blockchainAnchors.status, 'confirmed'));

  const [lastTx] = await db.select().from(blockchainAnchors).orderBy(desc(blockchainAnchors.createdAt)).limit(1);

  return {
    totalTransactions: totalResult.count,
    documentsHashed: confirmedResult.count,
    pendingTransactions: pendingResult.count,
    polygonBalance: walletBalance,
    walletAddress,
    gasUsed: Number(gasResult[0]?.totalGas || 0),
    lastTransactionAt: lastTx?.createdAt?.toISOString() || null,
    chainId: bcConfig.chainId,
    network: bcConfig.chainId === 137 ? 'Polygon Mainnet' : 'Polygon Amoy Testnet',
    contractAddress: bcConfig.contractAddress || null,
    enabled: bcConfig.enabled && isReady(),
  };
};

export const getTransactionHistory = async (limit = 20, offset = 0) => {
  const records = await db
    .select({
      id: blockchainAnchors.id,
      documentId: blockchainAnchors.documentId,
      transactionHash: blockchainAnchors.transactionHash,
      blockNumber: blockchainAnchors.blockNumber,
      anchoredHash: blockchainAnchors.anchoredHash,
      status: blockchainAnchors.status,
      gasUsed: blockchainAnchors.gasUsed,
      gasCost: blockchainAnchors.gasCost,
      merkleRoot: blockchainAnchors.merkleRoot,
      createdAt: blockchainAnchors.createdAt,
      confirmedAt: blockchainAnchors.confirmedAt,
      docName: documents.originalFilename,
    })
    .from(blockchainAnchors)
    .leftJoin(documents, eq(blockchainAnchors.documentId, documents.id))
    .orderBy(desc(blockchainAnchors.createdAt))
    .limit(limit)
    .offset(offset);

  return records;
};

export const getDocumentAnchorDetails = async (documentId) => {
  const records = await db
    .select()
    .from(blockchainAnchors)
    .where(eq(blockchainAnchors.documentId, documentId))
    .orderBy(desc(blockchainAnchors.createdAt));

  return records;
};
