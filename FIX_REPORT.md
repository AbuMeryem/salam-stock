# FIX REPORT — safe-area iOS

## URL prod
https://salam-stock.vercel.app (alias mis à jour, déploiement `salam-stock-l84qko52f`)

## Statut build
- `npm run build` : **OK** — 0 erreur, 0 régression, 16 routes générées
- Déploiement Vercel : **READY**

## Fichiers modifiés (4)

### 1. `app/globals.css`
Ajout de l'utilitaire :
```css
.safe-top { padding-top: max(env(safe-area-inset-top), 16px); }
```

### 2. `components/reception/PhotoCapture.tsx`
Header de la caméra "Photo du carton" :
- Avant : `className="flex items-center justify-between px-5 py-4 text-white"`
- Après : `className="safe-top flex items-center justify-between px-5 pb-4 text-white"`

Le `py-4` est devenu `pb-4` car le `safe-top` gère le padding haut.

### 3. `components/reception/BarcodeScanner.tsx`
Même fix sur le header du scanner code-barres (autre modale plein écran caméra) :
- Avant : `className="flex items-center justify-between px-5 py-4 text-white"`
- Après : `className="safe-top flex items-center justify-between px-5 pb-4 text-white"`

### 4. `app/layout.tsx`
Toaster Sonner :
```tsx
<Toaster
  position="top-center"
  offset="calc(env(safe-area-inset-top, 0px) + 16px)"
  ...
/>
```

## Audit des autres composants en haut

| Composant | Position | Verdict |
|---|---|---|
| `components/layout/PageHeader.tsx` | static (pt-12 = 48px) | OK — normal flow, pas fixed/absolute, pt-12 suffisant |
| `app/alertes/page.tsx` modale | `fixed inset-0` mais `items-end` (sheet bas) | Non concerné par dynamic island |
| `app/inventaire/page.tsx` modale | `fixed inset-0` mais `items-end` (sheet bas) | Non concerné par dynamic island |
| `app/reception/[id]/page.tsx` × 2 modales | `fixed inset-0` mais `items-end` (sheets bas) | Non concerné par dynamic island |
| Floating bottom bar (Réception / Inventaire) | `fixed bottom-0` + `pb-safe` | Déjà géré (safe-area-inset-bottom) |

Seuls les deux overlays caméra **plein écran ancrés en haut** étaient concernés. Les bottom sheets respectent déjà `pb-safe`.
