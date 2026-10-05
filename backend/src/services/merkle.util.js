// Merkle helpers. Leaves/nodes get distinct 0x00/0x01 prefixes (second-preimage resistance)
// and a lone node carries up unchanged, avoiding CVE-2012-2459-style duplication malleability.

import { ethers } from 'ethers';

const LEAF_PREFIX = '0x00';
const NODE_PREFIX = '0x01';

/** Domain-separated leaf hash: keccak256(0x00 || leaf). */
export const hashLeaf = (leafHex) => ethers.keccak256(ethers.concat([LEAF_PREFIX, leafHex]));

/** Domain-separated, order-independent node hash: keccak256(0x01 || sort(a,b)). */
export const hashNode = (a, b) => {
  const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([NODE_PREFIX, lo, hi]));
};

const buildNextLayer = (layer) => {
  const next = [];
  for (let i = 0; i < layer.length; i += 2) {
    if (i + 1 < layer.length) next.push(hashNode(layer[i], layer[i + 1]));
    else next.push(layer[i]); // lone node carried up unchanged (no duplication)
  }
  return next;
};

// Root from RAW bytes32 leaves (tagged internally).
export const computeMerkleRoot = (rawLeaves) => {
  if (!rawLeaves || rawLeaves.length === 0) return ethers.ZeroHash;
  let layer = rawLeaves.map(hashLeaf);
  while (layer.length > 1) layer = buildNextLayer(layer);
  return layer[0];
};

// Sibling hashes leaf→root for the leaf at `index`.
export const computeMerkleProof = (rawLeaves, index) => {
  let layer = rawLeaves.map(hashLeaf);
  let idx = index;
  const proof = [];
  while (layer.length > 1) {
    if (idx % 2 === 0) {
      if (idx + 1 < layer.length) proof.push(layer[idx + 1]); // right sibling
      // else lone node carried up — no sibling at this level
    } else {
      proof.push(layer[idx - 1]); // left sibling
    }
    idx = Math.floor(idx / 2);
    layer = buildNextLayer(layer);
  }
  return proof;
};

// Recompute the root from the untagged leaf + sibling proof.
export const verifyMerkleProof = (rawLeaf, proof, root) => {
  if (!root) return false;
  let computed = hashLeaf(rawLeaf);
  for (const sibling of proof || []) {
    computed = hashNode(computed, sibling);
  }
  return computed.toLowerCase() === root.toLowerCase();
};

export default { hashLeaf, hashNode, computeMerkleRoot, computeMerkleProof, verifyMerkleProof };
