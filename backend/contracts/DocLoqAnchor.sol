// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocLoqAnchor
 * @notice On-chain document authenticity anchoring for DocLoq DMS.
 *         Stores ONLY hashes and pseudonymized identifiers — NO PII.
 *
 * @dev Gas-optimized design:
 *      - All data stored as bytes32 / uint (no strings)
 *      - Struct packing: uint32 + uint64 + bool fit in a single 256-bit slot
 *      - Batch anchoring via Merkle root (1 tx for N documents)
 *      - Events for historical data (cheaper than on-chain storage)
 *
 * Target chain: Polygon (chainId 137 mainnet, 80002 Amoy testnet)
 */
contract DocLoqAnchor {

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public authorizedAnchors;

    /// @notice Per-document anchor record
    struct DocumentAnchor {
        bytes32 documentHash;   // SHA-256 of document content (as bytes32)
        bytes32 pseudoOrgId;    // keccak256(organizationId) — pseudonymized
        uint32  versionNumber;  // Document version (packed with timestamp + exists)
        uint64  timestamp;      // Block timestamp when anchored
        bool    exists;         // Guard against double-anchor
    }

    /// @notice Batch anchor record (Merkle root)
    struct MerkleAnchor {
        bytes32 merkleRoot;
        uint32  documentCount;
        uint64  timestamp;
        bool    exists;
    }

    /// @dev anchorId => DocumentAnchor. anchorId = keccak256(documentUUID)
    mapping(bytes32 => DocumentAnchor) public anchors;

    /// @dev merkleRoot => MerkleAnchor
    mapping(bytes32 => MerkleAnchor) public merkleAnchors;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event DocumentAnchored(
        bytes32 indexed anchorId,
        bytes32 documentHash,
        uint32  versionNumber,
        uint64  timestamp
    );

    event AnchorUpdated(
        bytes32 indexed anchorId,
        bytes32 newDocumentHash,
        uint32  newVersionNumber,
        uint64  timestamp
    );

    event BatchAnchored(
        bytes32 indexed merkleRoot,
        uint32  documentCount,
        uint64  timestamp
    );

    event AnchorAuthorized(address indexed account);
    event AnchorRevoked(address indexed account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "DocLoqAnchor: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedAnchors[msg.sender],
            "DocLoqAnchor: caller is not authorized"
        );
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    // Access Control
    // ──────────────────────────────────────────────

    /// @notice Authorize a backend wallet address to submit anchors.
    function authorizeAnchor(address account) external onlyOwner {
        require(account != address(0), "DocLoqAnchor: zero address");
        authorizedAnchors[account] = true;
        emit AnchorAuthorized(account);
    }

    /// @notice Revoke anchor authorization.
    function revokeAnchor(address account) external onlyOwner {
        authorizedAnchors[account] = false;
        emit AnchorRevoked(account);
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "DocLoqAnchor: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ──────────────────────────────────────────────
    // Single Document Anchoring
    // ──────────────────────────────────────────────

    /**
     * @notice Anchor a single document to the blockchain.
     * @param anchorId      keccak256(documentUUID) — deterministic, unique per document
     * @param documentHash  SHA-256 hash of the document content (as bytes32)
     * @param pseudoOrgId   keccak256(organizationUUID) — pseudonymized org identifier
     * @param versionNumber Document version number at time of anchoring
     */
    function anchorDocument(
        bytes32 anchorId,
        bytes32 documentHash,
        bytes32 pseudoOrgId,
        uint32  versionNumber
    ) external onlyAuthorized {
        require(!anchors[anchorId].exists, "DocLoqAnchor: already anchored");
        require(documentHash != bytes32(0), "DocLoqAnchor: empty hash");

        uint64 ts = uint64(block.timestamp);

        anchors[anchorId] = DocumentAnchor({
            documentHash:  documentHash,
            pseudoOrgId:   pseudoOrgId,
            versionNumber: versionNumber,
            timestamp:     ts,
            exists:        true
        });

        emit DocumentAnchored(anchorId, documentHash, versionNumber, ts);
    }

    /**
     * @notice Update an existing anchor (for auto-anchor-on-edit feature).
     * @param anchorId          Same anchorId used during initial anchoring
     * @param newDocumentHash   SHA-256 of the updated document content
     * @param newVersionNumber  New version number after edit
     */
    function updateAnchor(
        bytes32 anchorId,
        bytes32 newDocumentHash,
        uint32  newVersionNumber
    ) external onlyAuthorized {
        require(anchors[anchorId].exists, "DocLoqAnchor: anchor not found");
        require(newDocumentHash != bytes32(0), "DocLoqAnchor: empty hash");

        uint64 ts = uint64(block.timestamp);

        anchors[anchorId].documentHash  = newDocumentHash;
        anchors[anchorId].versionNumber = newVersionNumber;
        anchors[anchorId].timestamp     = ts;

        emit AnchorUpdated(anchorId, newDocumentHash, newVersionNumber, ts);
    }

    // ──────────────────────────────────────────────
    // Batch Anchoring (Merkle Root)
    // ──────────────────────────────────────────────

    /**
     * @notice Anchor multiple documents in a single transaction via Merkle root.
     *         Individual document hashes are stored off-chain with Merkle proofs.
     * @param merkleRoot    Root of the Merkle tree built from document hashes
     * @param documentCount Number of documents included in this batch
     */
    function anchorBatch(
        bytes32 merkleRoot,
        uint32  documentCount
    ) external onlyAuthorized {
        require(!merkleAnchors[merkleRoot].exists, "DocLoqAnchor: merkle root exists");
        require(merkleRoot != bytes32(0), "DocLoqAnchor: empty root");
        require(documentCount > 0, "DocLoqAnchor: zero documents");

        uint64 ts = uint64(block.timestamp);

        merkleAnchors[merkleRoot] = MerkleAnchor({
            merkleRoot:    merkleRoot,
            documentCount: documentCount,
            timestamp:     ts,
            exists:        true
        });

        emit BatchAnchored(merkleRoot, documentCount, ts);
    }

    // ──────────────────────────────────────────────
    // Verification (View — no gas cost)
    // ──────────────────────────────────────────────

    /**
     * @notice Verify a document hash matches the on-chain anchor.
     * @param anchorId     keccak256(documentUUID)
     * @param documentHash SHA-256 hash to verify against
     * @return isValid     Whether the hash matches
     * @return timestamp   When the anchor was last updated (0 if not found)
     */
    function verifyDocument(
        bytes32 anchorId,
        bytes32 documentHash
    ) external view returns (bool isValid, uint64 timestamp) {
        DocumentAnchor memory a = anchors[anchorId];
        if (!a.exists) return (false, 0);
        return (a.documentHash == documentHash, a.timestamp);
    }

    /**
     * @notice Get full anchor details for a document.
     * @param anchorId keccak256(documentUUID)
     */
    function getAnchor(bytes32 anchorId) external view returns (
        bytes32 documentHash,
        bytes32 pseudoOrgId,
        uint32  versionNumber,
        uint64  timestamp,
        bool    exists
    ) {
        DocumentAnchor memory a = anchors[anchorId];
        return (a.documentHash, a.pseudoOrgId, a.versionNumber, a.timestamp, a.exists);
    }

    /**
     * @notice Verify a Merkle root anchor exists.
     * @param merkleRoot The Merkle root to check
     */
    function verifyBatch(bytes32 merkleRoot) external view returns (
        uint32  documentCount,
        uint64  timestamp,
        bool    exists
    ) {
        MerkleAnchor memory m = merkleAnchors[merkleRoot];
        return (m.documentCount, m.timestamp, m.exists);
    }
}
