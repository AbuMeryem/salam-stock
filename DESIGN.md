# DESIGN.md — Salam Stock V2

## Theme

**Light, sapin & or sur fond crème chaud.**

Scène physique qui force le choix : *Otmane lit son écran à 30cm en plein magasin un mardi 14h, lumière sodium chaud, derrière sa caisse, l'iPhone posé à plat sur un comptoir blanc fluorescent.* Sous ces conditions :

- Dark mode → trop contraste, fatigue les yeux après 2h de service
- Pur blanc → reflète le néon et brûle les yeux
- Cream chaud (`#FAF7EE`) → équilibre les réflexions, agrandit visuellement sans agresser

## Color palette

Stratégie : **Restrained** côté contenu, **Committed** côté brand surfaces (header gradient + bottom-sheet drag handle).

Variables CSS dans `:root` (déjà en place dans `app/globals.css`, conservées).

| Token | Hex | Usage |
|---|---|---|
| `--primary-green` | `#0E3B2E` | Sapin profond. Header gradient, CTAs primaires, accent actif (bottom nav, dot indicators). |
| `--primary-green-hover` | `#14523F` | Hover sapin (mais sur mobile c'est `active:`). |
| `--primary-green-dark` | `#082A20` | Sapin nuit. Bottom du gradient header, texte sur fond or. |
| `--accent-gold` | `#C9A227` | Or principal. Logo "S", underline actif sur la nav, label-caps de section. |
| `--accent-gold-bright` | `#DDB31C` | Or brillant pour bouton de capture photo, badges hover. |
| `--accent-gold-soft` | `#F4E9C4` | Or fond doux. Cards traiteur, pills "or". |
| `--bg-cream` | `#FAF7EE` | Fond global. Aucun pur `#fff` ailleurs que sur les cards. |
| `--bg-card` | `#FFFFFF` | Cards et inputs. Léger ombre sapin pour décoller du crème. |
| `--text-primary` | `#0F1A14` | Texte principal. Quasi-noir tinté sapin. |
| `--text-secondary` | `#6B7280` | Texte secondaire. Gris neutre, lisible mais effacé. |
| `--text-tertiary` | `#9CA3AF` | Texte tertiaire. Hints, captions. |
| `--danger` | `#E5483D` | Rouge tomate. Sortie de stock, alertes IA. |
| `--danger-soft` | `#FEF2F1` | Fond doux rouge pour cards alertes. |
| `--success` | `#2D7A4F` | Vert prairie. Conformité, scan réussi. |
| `--warning` | `#D97706` | Ambre. Réceptions vides, écarts d'inventaire. |
| `--border-light` (`rule`) | `#E8E4D8` | Bordures cards. |
| `--border-medium` | `#D1CCB8` | Bordures input focus, drag handles. |

**Anti-color rules.**
- Jamais `#000` ni `#fff` direct. Toujours via les tokens.
- Pas de couleur hors palette pour les data viz. Tout dérive de sapin / or / rouge / vert / ambre.
- Le sapin domine 5-8% de la surface (CTAs + headers). Pas plus, pour éviter "trop d'identité".
- L'or est ponctuel : 1-3% de la surface. Plus → ça devient kitsch.

## Typography

**Plus Jakarta Sans** (déjà chargé via next/font, weights 400, 500, 600, 700, 800).

Famille déclarée : `var(--font-jakarta), system-ui, -apple-system, sans-serif`.

Hiérarchie (déjà partiellement définie dans `globals.css`, à durcir cette session) :

| Class | Size | Weight | Line-height | Letter-spacing | Usage |
|---|---|---|---|---|---|
| `.display` | 32/36px | 800 | 1.08 | -0.02em | Réservé login + 404. |
| `.h1` | 28/32px | 700 | 1.15 | -0.01em | Titre de page V2. |
| `.h2` | 22/24px | 600 | 1.2 | -0.01em | Section heading. |
| `.h3` | 18px | 600 | 1.3 | 0 | Sub-section. |
| `.body-lg` | 16px | 400 | 1.55 | 0 | Body long. |
| `.body-md` | 15px | 400 | 1.5 | 0 | Body court (sous-titres). |
| `.body-sm` | 13px | 500 | 1.45 | 0 | Secondary, captions. |
| `.label-caps` | 11px | 600 | 1.3 | 0.08em UPPERCASE | Section labels (DÉPÔT ACTIF, etc.). |
| `.mono` | inherits | 500 | inherits | -0.01em | EAN, codes-barres, IDs. Familiale `ui-monospace, SF Mono`. |
| `.tabular` | inherits | inherits | inherits | inherits | `font-variant-numeric: tabular-nums`. Stats, quantités. |

Ratio entre steps ≥ 1.25 partout. Pas de "tout en 14px".

## Spacing rhythm

Échelle 4px (Tailwind par défaut), mais **on varie** :

- Cards entre elles : 12px (`space-y-3`)
- Section entre elles : 24-32px (`mt-6` à `mt-8`)
- Header page → premier élément : 24px (`mt-6`)
- Padding interne card : 16-20px (`p-4` à `p-5`)
- Padding interne input/button : 14-16px vertical, 16-24px horizontal
- Gap dans une row : 12px (`gap-3`)

Anti-pattern bannis :
- Tout en `p-4` partout → monotonie
- Cards imbriquées → double bordure inutile
- Wrap inutile dans des containers

## Elevation

Trois niveaux uniquement :

```css
--shadow-card:      0 2px 12px rgba(14, 59, 46, 0.06);
--shadow-card-hover:0 4px 20px rgba(14, 59, 46, 0.10);
--shadow-card-lg:   0 8px 32px rgba(14, 59, 46, 0.12);  /* Floating CTAs, modals */
```

Pas de glassmorphism décoratif. Le seul blur autorisé : le backdrop de la bottom-sheet "Plus" (lisibilité), et le header sticky (`backdrop-blur-md` léger pour que le contenu qui passe dessous reste lisible).

## Border radius

| Radius | Usage |
|---|---|
| `4px` | Jamais utilisé seul ; on monte direct à 8. |
| `12px` | Inputs, petits boutons. |
| `16px` | Pills, badges. |
| `20px` | Cards de section. |
| `22px` | CTAs flottants. |
| `28px` | Bottom-sheet top, login header bottom. |
| `999px` | Boutons pill, avatars, dots indicators. |

## Components

### Card

```css
background: var(--bg-card);
border: 1px solid var(--border-light);
border-radius: 20px;
box-shadow: var(--shadow-card);
padding: 16-20px;
```

Active state : `active:scale-[0.99] active:shadow-card-hover transition-transform duration-150 ease-out`.

### Primary CTA (sapin)

```css
height: 56px;
border-radius: 22px;
background: var(--primary-green);
color: white;
font-weight: 700;
font-size: 15px;
box-shadow: var(--shadow-card-lg);
```

Floating CTA : positionné via `.cta-above-safe` (déjà en place), avec une mini-ribbon doré pour le label uppercase + sub-label en 15px extra-bold.

### Pill filter

```css
height: 36px;
border-radius: 999px;
border: 1px solid var(--border-light);
padding: 8px 16px;
font-size: 13px;
font-weight: 600;
background: white;
color: var(--primary-green);
```

État actif (`data-active="true"`) : fond sapin + texte blanc, sans bordure. Transition 150ms ease-out.

### Toast (sonner)

```ts
offset: 80           // numérique, clear Dynamic Island
mobileOffset: 80
duration: 2400
visibleToasts: 2
gap: 6
style: {
  borderRadius: 16,
  border: 1px solid var(--border-light),
  padding: 14px 16px,
  boxShadow: 0 8px 24px rgba(14,59,46,0.12),
}
```

ID stable obligatoire sur tout toast déclenché par useEffect.

## Motion

### Variants de page

```ts
initial: { opacity: 0, y: 6 }
animate: { opacity: 1, y: 0 }
transition: { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }  // ease-out cubic-ish
```

### Apparition de cards

Stagger 30ms entre cards d'une liste. Décalage 4px sur l'axe Y.

### Bottom-sheet

```ts
type: "spring"
damping: 32
stiffness: 320
```

Drag-to-dismiss : seuil 90px d'offset OU 500/s de velocity.

### Boutons & toggles

`active:scale-[0.97]` + transition 150ms. Jamais bounce, jamais elastic.

### Anti-motion

- Pas de bounce (`spring` avec stiffness < 100, damping < 20)
- Pas d'elastic
- Pas de hover-glow décoratif
- Pas de skeleton qui pulse à plus de 1.2× (pulse subtil ou rien)

## Layout

- Cap mobile à **max-w-[460px]** centré. Pas de breakpoint desktop ambitieux pour V2 — on assume iPhone/iPad portrait. Desktop = mobile centré.
- Container shell : `min-h-screen bg-cream` avec une sticky header en haut et une bottom nav qui flotte 16px du bas.
- Bottom nav : 4 primary items + 1 "Plus" qui ouvre une bottom-sheet (modal-tier 2).

## Animation tokens (utiles à reuse)

| Token | Curve | Duration | Usage |
|---|---|---|---|
| `--ease-out-quart` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | — | Transitions de page. |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | — | Bottom-sheet, gros mouvements. |
| `--dur-fast` | — | 120ms | Tap feedback. |
| `--dur-base` | — | 200ms | Apparitions card. |
| `--dur-page` | — | 280ms | Transitions de section. |

## Accessibilité

- WCAG AA minimum, AAA souhaité sur les CTAs.
- Focus visible : ring sapin 2px + 2px offset crème.
- Tous les bouton interactifs ont un `aria-label` ou un texte visible explicite.
- `prefers-reduced-motion` → toutes les transitions tombent à 0ms et la motion devient une opacity simple 100ms.
- Tailles min : tap target 44pt × 44pt, texte body ≥ 15px.

## Anti-patterns

- ❌ Side-stripe borders gauche/droite ≥ 2px en accent
- ❌ Gradient text via `background-clip: text`
- ❌ Glassmorphism comme défaut
- ❌ Hero-metric template avec gros chiffre + petit label + gradient
- ❌ Identical card grids (cards toutes identiques répétées)
- ❌ Modale comme premier réflexe
- ❌ Em dashes — utilise virgule, deux-points, parenthèses
