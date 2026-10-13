CREATE TABLE IF NOT EXISTS agents (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner VARCHAR(120) NOT NULL,
    did VARCHAR(160) NOT NULL UNIQUE,
    wallet_address VARCHAR(255) NULL,
    network VARCHAR(100) NOT NULL DEFAULT 'Base Sepolia',
    status ENUM('active', 'paused', 'revoked') NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT chk_agents_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 100),
    CONSTRAINT chk_agents_owner CHECK (CHAR_LENGTH(TRIM(owner)) BETWEEN 1 AND 120)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spending_policies (
    id CHAR(36) PRIMARY KEY,
    agent_id CHAR(36) NOT NULL,
    name VARCHAR(160) NOT NULL DEFAULT 'Default policy',
    transaction_limit_cents BIGINT NOT NULL,
    daily_limit_cents BIGINT NOT NULL,
    approved_merchants JSON NOT NULL,
    valid_until DATETIME(3) NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT chk_policy_transaction_limit CHECK (transaction_limit_cents > 0),
    CONSTRAINT chk_policy_daily_limit CHECK (daily_limit_cents > 0),
    CONSTRAINT fk_policy_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    INDEX idx_policies_agent_created (agent_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) PRIMARY KEY,
    agent_id CHAR(36) NOT NULL,
    merchant VARCHAR(200) NOT NULL,
    purpose VARCHAR(500) NOT NULL DEFAULT '',
    amount_cents BIGINT NOT NULL,
    status ENUM('settled', 'rejected', 'pending') NOT NULL,
    rejection_reason VARCHAR(500) NULL,
    protocol VARCHAR(80) NOT NULL DEFAULT 'demo',
    tx_hash VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT chk_payment_amount CHECK (amount_cents > 0),
    CONSTRAINT fk_payment_agent FOREIGN KEY (agent_id) REFERENCES agents(id),
    INDEX idx_payments_agent_created (agent_id, created_at),
    INDEX idx_payments_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_events (
    id CHAR(36) PRIMARY KEY,
    actor VARCHAR(120) NOT NULL DEFAULT 'system',
    event_type VARCHAR(120) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(160) NULL,
    details JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
