-- ─────────────────────────────────────────────────────────────────────────
-- 0003_reception_vide.sql
-- Bug client (RDV Otmane 12/05) : Mohamed a observé qu'on pouvait
-- valider une réception sans avoir scanné un seul produit. Désormais on
-- bloque visuellement le CTA quand la liste est vide, on demande une
-- confirmation explicite, et on tag la ligne en base avec reception_vide
-- = true pour qu'Otmane voie l'incident dans le dashboard.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.receptions
  add column if not exists reception_vide boolean not null default false;

create index if not exists idx_receptions_vide
  on public.receptions(reception_vide)
  where reception_vide = true;
