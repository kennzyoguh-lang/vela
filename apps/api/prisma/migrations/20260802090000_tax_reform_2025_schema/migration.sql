-- Nigeria Tax Act 2025 (effective 1 Jan 2026) support:
-- 1. "Small company" status (Section 56) needs turnover, fixed assets, and
--    a professional-services flag on Organisation to determine 0% vs 30%
--    CIT/CGT/Development Levy eligibility (tax-status.service.ts). All
--    nullable — status is "unknown" until an owner supplies all three,
--    never silently assumed either way.
-- 2. The Consolidated Relief Allowance is eliminated and replaced with rent
--    relief (20% of annual rent paid, capped at NGN500,000) — Employee needs
--    an annual-rent-paid figure to compute it (paye-calculator.ts).
ALTER TABLE "organisations"
  ADD COLUMN "annual_turnover" DECIMAL(14, 2),
  ADD COLUMN "fixed_assets_value" DECIMAL(14, 2),
  ADD COLUMN "provides_professional_services" BOOLEAN;

ALTER TABLE "employees"
  ADD COLUMN "annual_rent_paid" DECIMAL(14, 2) NOT NULL DEFAULT 0;
