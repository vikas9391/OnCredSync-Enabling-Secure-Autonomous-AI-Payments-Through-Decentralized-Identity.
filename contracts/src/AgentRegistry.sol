// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal on-chain registry for application agent identifiers.
/// @dev The DID string is a reference only; this contract does not resolve or verify DID documents.
contract AgentRegistry {
    struct AgentIdentity {
        address owner;
        bytes32 didHash;
        bool active;
        uint64 createdAt;
    }

    address public owner;
    mapping(bytes32 => AgentIdentity) private identities;

    event AgentRegistered(bytes32 indexed agentId, address indexed agentOwner, bytes32 didHash);
    event AgentStatusChanged(bytes32 indexed agentId, bool active);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function registerAgent(bytes32 agentId, bytes32 didHash, address agentOwner) external onlyOwner {
        require(agentId != bytes32(0), "empty agent id");
        require(didHash != bytes32(0), "empty DID hash");
        require(agentOwner != address(0), "empty agent owner");
        require(identities[agentId].createdAt == 0, "agent already exists");

        identities[agentId] = AgentIdentity({
            owner: agentOwner,
            didHash: didHash,
            active: true,
            createdAt: uint64(block.timestamp)
        });
        emit AgentRegistered(agentId, agentOwner, didHash);
    }

    function setAgentActive(bytes32 agentId, bool active) external onlyOwner {
        require(identities[agentId].createdAt != 0, "unknown agent");
        identities[agentId].active = active;
        emit AgentStatusChanged(agentId, active);
    }

    function getAgent(bytes32 agentId) external view returns (AgentIdentity memory) {
        return identities[agentId];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "empty owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
