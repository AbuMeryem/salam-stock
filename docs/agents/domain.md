# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — domain glossary for salam-stock (staff PWA).
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── README.md
│   ├── 0001-*.md
│   └── 0002-*.md
└── app/  components/  lib/  supabase/  ...
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids — e.g. write "préparation Drive" not "order prep", "sortie stock" not "stock loss", "BDL" not "delivery slip".

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## Related references

- `/Users/mac/WORKFLOW.md` — the cross-repo business-logic bible (shared with `salamarket-drive`). Authoritative for parcours utilisateur, Stripe flows, sync triggers, roles, cron, IA, TVA. Read this for any feature that crosses the Drive ↔ Stock boundary.
- `SCHEMA.md` at the repo root — full DB schema (tables, enums, sequences, triggers, RLS). Authoritative for column shapes.
- `supabase/migrations/` — chronological schema evolution (0001 → 0030+).
