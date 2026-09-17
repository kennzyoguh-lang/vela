-- stored_files RLS (Handbook 6.3, every org-scoped table, no exceptions).
-- No UPDATE policy — a stored file's content is immutable once uploaded
-- (a corrected receipt is a new upload, not an edit); no DELETE policy
-- either, same "no blanket DELETE beyond what each table's own policy
-- allows" precedent as every other table in this codebase without one.

ALTER TABLE stored_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON stored_files
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON stored_files
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
