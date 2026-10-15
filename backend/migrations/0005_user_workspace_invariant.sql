-- Keep platform identities separate from tenant identities at the database layer.
ALTER TABLE users
  ADD CONSTRAINT chk_users_role_workspace
  CHECK (
    (role = 'super_admin' AND workspace_id IS NULL)
    OR
    (role <> 'super_admin' AND workspace_id IS NOT NULL)
  );
