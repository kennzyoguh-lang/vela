-- compliance_frequency was created in 20260729020000_compliance_schema but
-- never attached to any column — frequency is pure application metadata
-- (compliance-obligation-rules.ts), not stored per-row, so Prisma correctly
-- pruned it from the generated client. Dropping the now-orphaned DB type
-- rather than leaving dead schema behind.
DROP TYPE "compliance_frequency";
