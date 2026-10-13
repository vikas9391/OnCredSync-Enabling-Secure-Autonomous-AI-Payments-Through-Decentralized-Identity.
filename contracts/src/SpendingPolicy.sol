// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Enforces per-transaction, daily-budget, expiry, and merchant rules.
/// @dev This contract records policy authorization only; it does not transfer tokens or settle x402.
contract SpendingPolicy {
    struct Policy {
        uint128 transactionLimit;
        uint128 dailyLimit;
        uint64 validUntil;
        bool active;
    }

    address public owner;
    address public paymentExecutor;
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => mapping(bytes32 => bool)) public approvedMerchant;
    mapping(bytes32 => uint256) public spentToday;
    mapping(bytes32 => uint64) public spendDay;

    event PolicyConfigured(bytes32 indexed agentId, uint128 transactionLimit, uint128 dailyLimit, uint64 validUntil);
    event MerchantApprovalChanged(bytes32 indexed agentId, bytes32 indexed merchantHash, bool approved);
    event PolicyRevoked(bytes32 indexed agentId);
    event PaymentAuthorized(bytes32 indexed agentId, bytes32 indexed merchantHash, uint256 amount, uint64 day);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == owner || msg.sender == paymentExecutor, "not executor");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setPaymentExecutor(address executor) external onlyOwner {
        paymentExecutor = executor;
    }

    function configurePolicy(
        bytes32 agentId,
        uint128 transactionLimit,
        uint128 dailyLimit,
        uint64 validUntil
    ) external onlyOwner {
        require(agentId != bytes32(0), "empty agent id");
        require(transactionLimit > 0 && dailyLimit >= transactionLimit, "invalid limits");
        require(validUntil == 0 || validUntil > block.timestamp, "already expired");

        policies[agentId] = Policy({
            transactionLimit: transactionLimit,
            dailyLimit: dailyLimit,
            validUntil: validUntil,
            active: true
        });
        emit PolicyConfigured(agentId, transactionLimit, dailyLimit, validUntil);
    }

    function setMerchantApproved(bytes32 agentId, bytes32 merchantHash, bool approved) external onlyOwner {
        require(agentId != bytes32(0) && merchantHash != bytes32(0), "empty identifier");
        approvedMerchant[agentId][merchantHash] = approved;
        emit MerchantApprovalChanged(agentId, merchantHash, approved);
    }

    function revokePolicy(bytes32 agentId) external onlyOwner {
        policies[agentId].active = false;
        emit PolicyRevoked(agentId);
    }

    function checkPayment(bytes32 agentId, bytes32 merchantHash, uint256 amount)
        public
        view
        returns (bool allowed, uint8 reason)
    {
        Policy memory policy = policies[agentId];
        if (!policy.active) return (false, 1);
        if (policy.validUntil != 0 && block.timestamp > policy.validUntil) return (false, 2);
        if (!approvedMerchant[agentId][merchantHash]) return (false, 3);
        if (amount == 0 || amount > policy.transactionLimit) return (false, 4);

        uint64 today = uint64(block.timestamp / 1 days);
        uint256 currentSpend = spendDay[agentId] == today ? spentToday[agentId] : 0;
        if (currentSpend + amount > policy.dailyLimit) return (false, 5);
        return (true, 0);
    }

    /// @notice Records authorization after a trusted executor has verified the payment request.
    /// @dev The caller must only invoke this after its own payment verification flow succeeds.
    function authorizeAndRecord(bytes32 agentId, bytes32 merchantHash, uint256 amount)
        external
        onlyExecutor
    {
        (bool allowed, uint8 reason) = checkPayment(agentId, merchantHash, amount);
        require(allowed, _reasonText(reason));

        uint64 today = uint64(block.timestamp / 1 days);
        if (spendDay[agentId] != today) {
            spendDay[agentId] = today;
            spentToday[agentId] = 0;
        }
        spentToday[agentId] += amount;
        emit PaymentAuthorized(agentId, merchantHash, amount, today);
    }

    function _reasonText(uint8 reason) private pure returns (string memory) {
        if (reason == 1) return "policy inactive";
        if (reason == 2) return "policy expired";
        if (reason == 3) return "merchant not approved";
        if (reason == 4) return "transaction limit exceeded";
        if (reason == 5) return "daily limit exceeded";
        return "payment rejected";
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "empty owner");
        owner = newOwner;
    }
}
