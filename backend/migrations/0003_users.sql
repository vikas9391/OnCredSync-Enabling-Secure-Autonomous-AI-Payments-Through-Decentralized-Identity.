CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('super_admin','workspace_admin','finance_manager','agent_operator','viewer') NOT NULL DEFAULT 'viewer',
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT chk_users_name CHECK (CHAR_LENGTH(TRIM(full_name)) BETWEEN 1 AND 120),
    INDEX idx_users_role_status (role, status)
) ENGINE=InnoDB;
