CREATE TABLE IF NOT EXISTS workspaces (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_by CHAR(36) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT chk_workspaces_name CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 120),
    INDEX idx_workspaces_created (created_at)
) ENGINE=InnoDB;

-- Preserve the existing single-workspace demo as one explicit tenant.
INSERT INTO workspaces (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Legacy Demo Workspace')
ON DUPLICATE KEY UPDATE name = VALUES(name);

ALTER TABLE users ADD COLUMN workspace_id CHAR(36) NULL AFTER email;
ALTER TABLE users ADD CONSTRAINT fk_users_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
CREATE INDEX idx_users_workspace_role ON users(workspace_id, role, status);

ALTER TABLE agents ADD COLUMN workspace_id CHAR(36) NULL AFTER id;
ALTER TABLE spending_policies ADD COLUMN workspace_id CHAR(36) NULL AFTER id;
ALTER TABLE payments ADD COLUMN workspace_id CHAR(36) NULL AFTER id;
ALTER TABLE audit_events ADD COLUMN workspace_id CHAR(36) NULL AFTER id;

UPDATE users
SET workspace_id = '00000000-0000-4000-8000-000000000001'
WHERE role <> 'super_admin';

UPDATE agents SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE spending_policies SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE payments SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;
UPDATE audit_events SET workspace_id = '00000000-0000-4000-8000-000000000001' WHERE workspace_id IS NULL;

ALTER TABLE agents MODIFY workspace_id CHAR(36) NOT NULL;
ALTER TABLE spending_policies MODIFY workspace_id CHAR(36) NOT NULL;
ALTER TABLE payments MODIFY workspace_id CHAR(36) NOT NULL;

ALTER TABLE agents ADD CONSTRAINT fk_agents_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE spending_policies ADD CONSTRAINT fk_policies_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE payments ADD CONSTRAINT fk_payments_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;

CREATE INDEX idx_agents_workspace_created ON agents(workspace_id, created_at);
CREATE INDEX idx_policies_workspace_agent_created ON spending_policies(workspace_id, agent_id, created_at);
CREATE INDEX idx_payments_workspace_created ON payments(workspace_id, created_at);
CREATE INDEX idx_audit_workspace_created ON audit_events(workspace_id, created_at);
