# Fix Scanner code-barre — 11 mai 2026

## Symptôme
Le scanner code-barre ne démarrait pas sur iPhone Safari + PWA standalone (testé par Mohamed).

## Causes identifiées
1. **Pas de user gesture explicite** — l'ancien composant lançait `Html5Qrcode.start()` automatiquement dans un `useEffect` au montage. iOS Safari, depuis ~iOS 16, exige que `getUserMedia` soit déclenchée *synchrone* dans un handler de click pour fiabilité maximale. Sans tap visible, Safari refusait parfois silencieusement.
2. **`facingMode: "environment"`** sans `ideal` → erreur `OverconstrainedError` sur iPhones où la caméra arrière refuse temporairement (autre app la possède, etc.).
3. **Pas de `formatsToSupport`** → la lib essayait tout (QR, Data Matrix, Aztec, EAN, UPC, etc.). Beaucoup d'auto-détection ralentit la lecture des EAN-13 imprimés petits.
4. **Pas de fallback saisie manuelle** → si la caméra refuse, le workflow magasin est complètement bloqué.
5. **`onScan` dans la deps de `useEffect`** → si le parent recrée la fonction à chaque render, le scanner se restart, perd le contexte caméra, peut crasher.
6. **Header `Permissions-Policy` absent** côté Vercel → certains environnements PWA durcis bloquent `getUserMedia` même HTTPS valide.

## Solution appliquée

### `components/reception/BarcodeScanner.tsx` (réécrit, même signature de props)
- **User gesture obligatoire** — la caméra ne démarre PAS automatiquement. Écran initial avec bouton "Activer la caméra" en gold-bright. L'utilisateur tape, `startCamera()` exécute `getUserMedia` dans la pile d'appel directe → Safari accepte.
- **`facingMode: { ideal: "environment" }`** → fallback automatique vers caméra frontale si arrière indispo.
- **`formatsToSupport` explicite** : EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39, ITF.
- **`focusMode: "continuous"` + `advanced: [{ zoom: 1.5 }]`** → meilleure lecture des EAN petits (canettes, sachets). Supporté Safari iOS 17+.
- **Fallback saisie manuelle TOUJOURS visible** en bas de l'écran, clavier numérique (`inputMode="numeric"`). Si la caméra refuse, l'employé tape l'EAN et continue. Workflow jamais bloqué.
- **`onScanRef` capturé via `useRef`** → le scanner ne restart pas si le parent recrée la fonction.
- **Messages d'erreur FR actionnables** (`humanError(raw)`) — permission, NotFound, NotReadable, Overconstrained, secure context → chaque cas explique au non-dev quoi faire.
- **Vibration haptique** (40ms) à la détection — feedback tactile immédiat.

### `next.config.mjs`
Ajout du bloc `async headers()` :
```
Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Compatibilité préservée
La signature des props (`open`, `onClose`, `onScan`) et l'export nommé `BarcodeScanner` sont conservés. Aucun des 6 callers n'a besoin d'être modifié :
- `app/v2/reception/page.tsx`
- `app/v2/sortie/page.tsx`
- `app/v2/transfert/page.tsx`
- `app/v2/preparation/[id]/page.tsx`
- `app/catalogue/nouveau/page.tsx`
- `app/reception/[id]/page.tsx`

## Tests
- `npx tsc --noEmit` → EXIT 0
- `next build` → 30 routes compilées, pas de warning

## Tests restants à faire (sur iPhone réel)
- [ ] Safari iOS 17/18 : tap "Activer la caméra" → permission demandée → flux caméra visible
- [ ] PWA standalone (ajoutée à l'écran d'accueil) : même flow
- [ ] Scan EAN-13 d'un produit réel (canette Coca, sachet) → décodage + vibration + onScan
- [ ] Caméra refusée : saisie manuelle d'un EAN → submit → onScan déclenché

## Plan B pour la démo
Si la caméra refuse pour une raison quelconque (permissions iOS Réglages, app concurrente), **la saisie manuelle est toujours visible** en bas de la modale. Mohamed peut taper l'EAN au clavier et continuer la prépa. Le workflow drive n'est jamais bloqué.

## URL prod à tester
https://salam-stock.vercel.app/v2/reception
