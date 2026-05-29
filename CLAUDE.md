# Salam Stock

Staff-facing PWA for K & A FOOD (Salamarket) — Next.js 14 App Router. Handles preparation Drive, reception marchandise, sortie stock, transferts inter-depots, inventaire tournant, Labo (recettes/productions), admin Pro & reporting. Pair to `salamarket-drive` (client app), both on Supabase project `tltmermqodelorthtbre`.

## Agent skills

### Issue tracker

Issues live in GitHub at `AbuMeryem/salam-stock`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage state machine. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.

## Quick references

- **Business logic bible** — `/Users/mac/WORKFLOW.md` (master workflow, shared with `salamarket-drive`). Read first for any feature touching Drive, Pro, paiement, preparation, reception, sortie, transfert, inventaire, labo, admin.
- **Database schema** — `SCHEMA.md` (full DB reference: 36 tables, 2 views, 7+ triggers, enums, sequences, RLS).
- **Design tokens** — `app/globals.css` (CSS variables: palette `#0E3B2E` sapin / `#082A20` nuit / `#C9A227` or / `#FAF7EE` creme, Plus Jakarta Sans).
- **Schema evolution** — `supabase/migrations/` (0001 → 0030+, source of truth for table shapes).
- **Domain glossary** — `CONTEXT.md` (vocab to use in code, issues, PR titles).
