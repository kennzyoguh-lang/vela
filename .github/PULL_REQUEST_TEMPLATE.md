## What & Why

<!-- One paragraph: what changed, and which BRD feature ID(s) or handbook
     section this addresses. "Why" matters more than "what". -->

## BRD / Handbook Reference

- Feature ID(s):
- Handbook section(s):

## Testing

- [ ] Unit tests added/updated (boundary cases explicitly listed if numeric logic)
- [ ] Integration tests added/updated
- [ ] Manually verified against staging

## Security & Compliance Checklist

- [ ] No secrets committed (gitleaks passed)
- [ ] New tables have RLS policies (if applicable)
- [ ] No raw SQL string concatenation
- [ ] Audit logging added for new mutating endpoints (if applicable)

## Performance

- [ ] Bundle size impact checked (frontend changes)
- [ ] New DB queries have supporting indexes (Handbook 6.5) or an explicit justification for not needing one

## Rollback Plan

<!-- If this fails in production, what's the fastest safe way back? -->

---

Merging to `main` deploys to staging automatically; production is a manual, explicit promotion after a staging smoke test (Handbook 11.2) — never automatic on merge.
