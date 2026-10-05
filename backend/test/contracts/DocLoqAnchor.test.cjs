const { expect } = require('chai');
const { ethers } = require('hardhat');

// Mirror of computeMerkleRoot in src/services/blockchain.service.js — sorted-pair, duplicate-last.
function computeMerkleRoot(leaves) {
  if (leaves.length === 0) return ethers.ZeroHash;
  if (leaves.length === 1) return leaves[0];
  let layer = [...leaves];
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      const [a, b] = left < right ? [left, right] : [right, left];
      next.push(ethers.keccak256(ethers.concat([a, b])));
    }
    layer = next;
  }
  return layer[0];
}

const id = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
const hash = (s) => ethers.zeroPadValue('0x' + Buffer.from(s).toString('hex').padStart(64, '0').slice(0, 64), 32);

describe('DocLoqAnchor', function () {
  let contract, owner, backend, outsider;

  beforeEach(async function () {
    [owner, backend, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('DocLoqAnchor');
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    await (await contract.authorizeAnchor(backend.address)).wait();
  });

  describe('access control', function () {
    it('owner is deployer', async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('rejects anchoring from an unauthorized wallet', async function () {
      await expect(
        contract.connect(outsider).anchorDocument(id('doc1'), hash('h1'), id('org1'), 1)
      ).to.be.revertedWith('DocLoqAnchor: caller is not authorized');
    });

    it('allows an authorized backend wallet to anchor', async function () {
      await expect(
        contract.connect(backend).anchorDocument(id('doc1'), hash('h1'), id('org1'), 1)
      ).to.emit(contract, 'DocumentAnchored');
    });
  });

  describe('single anchor + verify', function () {
    it('anchors and verifies a matching hash', async function () {
      const anchorId = id('doc1');
      const docHash = hash('h1');
      await (await contract.connect(backend).anchorDocument(anchorId, docHash, id('org1'), 1)).wait();

      const [isValid, ts] = await contract.verifyDocument(anchorId, docHash);
      expect(isValid).to.equal(true);
      expect(ts).to.be.greaterThan(0n);
    });

    it('fails verification for a tampered hash', async function () {
      const anchorId = id('doc1');
      await (await contract.connect(backend).anchorDocument(anchorId, hash('h1'), id('org1'), 1)).wait();

      const [isValid] = await contract.verifyDocument(anchorId, hash('TAMPERED'));
      expect(isValid).to.equal(false);
    });

    it('reverts on double-anchor of the same document', async function () {
      const anchorId = id('doc1');
      await (await contract.connect(backend).anchorDocument(anchorId, hash('h1'), id('org1'), 1)).wait();
      await expect(
        contract.connect(backend).anchorDocument(anchorId, hash('h1'), id('org1'), 1)
      ).to.be.revertedWith('DocLoqAnchor: already anchored');
    });

    it('reverts on empty hash', async function () {
      await expect(
        contract.connect(backend).anchorDocument(id('doc1'), ethers.ZeroHash, id('org1'), 1)
      ).to.be.revertedWith('DocLoqAnchor: empty hash');
    });
  });

  describe('update anchor', function () {
    it('updates hash + version and bumps timestamp', async function () {
      const anchorId = id('doc1');
      await (await contract.connect(backend).anchorDocument(anchorId, hash('v1'), id('org1'), 1)).wait();
      const before = await contract.getAnchor(anchorId);

      await (await contract.connect(backend).updateAnchor(anchorId, hash('v2'), 2)).wait();
      const after = await contract.getAnchor(anchorId);

      expect(after.documentHash).to.equal(hash('v2'));
      expect(after.versionNumber).to.equal(2);
      expect(after.timestamp).to.be.greaterThanOrEqual(before.timestamp);

      const [validOld] = await contract.verifyDocument(anchorId, hash('v1'));
      const [validNew] = await contract.verifyDocument(anchorId, hash('v2'));
      expect(validOld).to.equal(false);
      expect(validNew).to.equal(true);
    });

    it('reverts when updating a non-existent anchor', async function () {
      await expect(
        contract.connect(backend).updateAnchor(id('ghost'), hash('x'), 2)
      ).to.be.revertedWith('DocLoqAnchor: anchor not found');
    });
  });

  describe('batch anchor (Merkle root)', function () {
    it('anchors a batch and verifies the root', async function () {
      const leaves = [hash('a'), hash('b'), hash('c')]; // odd count
      const root = computeMerkleRoot(leaves);
      await expect(
        contract.connect(backend).anchorBatch(root, leaves.length)
      ).to.emit(contract, 'BatchAnchored');

      const [docCount, ts, exists] = await contract.verifyBatch(root);
      expect(exists).to.equal(true);
      expect(docCount).to.equal(3);
      expect(ts).to.be.greaterThan(0n);
    });

    it('reverts on duplicate Merkle root', async function () {
      const root = computeMerkleRoot([hash('a'), hash('b')]);
      await (await contract.connect(backend).anchorBatch(root, 2)).wait();
      await expect(
        contract.connect(backend).anchorBatch(root, 2)
      ).to.be.revertedWith('DocLoqAnchor: merkle root exists');
    });

    it('reverts on zero documents', async function () {
      const root = computeMerkleRoot([hash('a')]);
      await expect(
        contract.connect(backend).anchorBatch(root, 0)
      ).to.be.revertedWith('DocLoqAnchor: zero documents');
    });
  });

  describe('merkle root edge cases (JS helper parity)', function () {
    it('single leaf root equals the leaf', function () {
      const leaf = hash('only');
      expect(computeMerkleRoot([leaf])).to.equal(leaf);
    });

    it('is order-independent for a sorted pair', function () {
      const a = hash('a');
      const b = hash('b');
      expect(computeMerkleRoot([a, b])).to.equal(computeMerkleRoot([b, a]));
    });

    it('handles 1, 2, 3, 4 leaves without throwing', function () {
      for (let n = 1; n <= 4; n++) {
        const leaves = Array.from({ length: n }, (_, i) => hash('leaf' + i));
        expect(computeMerkleRoot(leaves)).to.match(/^0x[0-9a-fA-F]{64}$/);
      }
    });
  });
});
