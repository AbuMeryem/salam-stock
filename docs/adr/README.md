# Architecture Decision Records (ADRs)

This directory holds architectural decisions for `salam-stock` (staff PWA). One file per decision, numbered sequentially.

## Format

```
NNNN-short-kebab-title.md
```

Example: `0001-pin-auth-client-only-until-v21.md`.

## Template

```markdown
# ADR-NNNN — <Title>

**Status**: Proposed | Accepted | Superseded by ADR-XXXX | Deprecated
**Date**: YYYY-MM-DD
**Deciders**: <names or roles>

## Context

What problem are we facing? What forces are at play (technical, business, team, time)?

## Decision

What we decided to do. Use active voice — "We will…".

## Consequences

- Positive
- Negative
- Risks / follow-ups

## Alternatives considered

- Option A — why rejected
- Option B — why rejected
```

## When to write one

Write an ADR when:

- A non-obvious choice was made between competing options (e.g. PIN auth vs Supabase Auth, `products` table vs view).
- A piece of dette technique is consciously accepted (so future readers know it's a known trade-off).
- A cross-cutting pattern is adopted (e.g. how to model statut workflows, how to handle multi-dépôt RLS).

Skip when the choice is mechanical, obvious, or already documented elsewhere (e.g. `WORKFLOW.md` or `SCHEMA.md`).

## Related

- `../../CONTEXT.md` — domain glossary; ADRs use this vocabulary.
- `/Users/mac/WORKFLOW.md` — business logic bible (cross-repo with `salamarket-drive`).
- `../../SCHEMA.md` — DB schema reference.
