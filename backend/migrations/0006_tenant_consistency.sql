-- Enforce tenant consistency even if a future handler accidentally links a record
-- to an agent from another workspace.
ALTER TABLE agents
  ADD CONSTRAINT uq_agents_workspace_id UNIQUE (workspace_id, id);

ALTER TABLE spending_policies
  ADD CONSTRAINT fk_policies_workspace_agent
  FOREIGN KEY (workspace_id, agent_id)
  REFERENCES agents (workspace_id, id)
  ON DELETE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_workspace_agent
  FOREIGN KEY (workspace_id, agent_id)
  REFERENCES agents (workspace_id, id)
  ON DELETE RESTRICT;
