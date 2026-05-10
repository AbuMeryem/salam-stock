import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const products = JSON.parse(readFileSync("lib/data/products.json", "utf8"));

const depots = [
  { name: "Particulier",   type: "point_vente", adresse: "8 av. Larrieu-Thibaud, Toulouse" },
  { name: "Professionnel", type: "point_vente", adresse: "8 av. Larrieu-Thibaud, Toulouse" },
  { name: "Sodrune",       type: "entrepot",    adresse: "Entrepôt Sud Toulouse" },
];
const employes = [
  { nom: "Jamal",  prenom: "Otmane", role: "manager",     depot: "Particulier",   pin: "1234" },
  { nom: "Mehdi",  prenom: "Ilyes",  role: "preparation", depot: "Professionnel", pin: "5678" },
  { nom: "Nasri",  prenom: "Ahmed",  role: "admin",       depot: "Particulier",   pin: "9999" },
];

function depotsFor(cat) {
  switch (cat) {
    case "Boucherie":           return [{ d: "Particulier",  q: [12, 40] }];
    case "Charcuterie":         return [{ d: "Particulier",  q: [8, 30]  }, { d: "Professionnel", q: [20, 60]  }];
    case "Surgelés":            return [{ d: "Particulier",  q: [10, 40] }, { d: "Professionnel", q: [20, 80]  }];
    case "Frais":               return [{ d: "Particulier",  q: [10, 50] }, { d: "Professionnel", q: [12, 40]  }];
    case "Boissons":            return [{ d: "Particulier",  q: [20, 80] }, { d: "Professionnel", q: [40, 200] }, { d: "Sodrune", q: [60, 300] }];
    case "Hygiène":             return [{ d: "Particulier",  q: [10, 40] }, { d: "Professionnel", q: [20, 80]  }, { d: "Sodrune", q: [40, 200] }];
    case "Épicerie":            return [{ d: "Particulier",  q: [15, 50] }, { d: "Professionnel", q: [25, 80]  }, { d: "Sodrune", q: [50, 200] }];
    case "Produits du Maghreb": return [{ d: "Particulier",  q: [20, 60] }, { d: "Professionnel", q: [30, 100] }, { d: "Sodrune", q: [60, 250] }];
    default:                    return [{ d: "Particulier",  q: [10, 30] }];
  }
}

// PostgreSQL dollar-quoted string escape (uses $TG$..$TG$ to avoid collisions).
function pg(v) {
  if (v === null || v === undefined) return "null";
  return "$TG$" + String(v) + "$TG$";
}

const lines = [];
lines.push(`-- ════════════════════════════════════════════════════════════════`);
lines.push(`-- Seed initial Salam Stock V2`);
lines.push(`-- 3 dépôts, 3 employés, 35 produits, stock_par_depot par heuristique catégorie.`);
lines.push(`-- ════════════════════════════════════════════════════════════════`);
lines.push(`begin;`);
lines.push(``);

lines.push(`-- depots`);
lines.push(`insert into public.depots (nom, type, adresse) values`);
lines.push(depots.map(d =>
  `  (${pg(d.name)}, ${pg(d.type)}, ${pg(d.adresse)})`
).join(",\n") + " on conflict do nothing;");
lines.push(``);

lines.push(`-- employés`);
lines.push(`insert into public.employes (nom, prenom, role, depot_principal_id, pin_code) values`);
lines.push(employes.map(e =>
  `  (${pg(e.nom)}, ${pg(e.prenom)}, ${pg(e.role)}, (select id from public.depots where nom = ${pg(e.depot)}), ${pg(e.pin)})`
).join(",\n") + " on conflict do nothing;");
lines.push(``);

lines.push(`-- produits`);
lines.push(`insert into public.produits (ean, nom, marque, categorie, image_url, requires_barcode_print) values`);
const pRows = products.map(p => {
  const requiresPrint = (p.barcode && p.barcode.startsWith("290")) ? "true" : "false";
  return `  (${pg(p.barcode)}, ${pg(p.name)}, ${pg(p.brand)}, ${pg(p.category)}, ${pg(p.image_url)}, ${requiresPrint})`;
});
lines.push(pRows.join(",\n") + " on conflict (ean) do nothing;");
lines.push(``);

lines.push(`-- stock_par_depot`);
lines.push(`insert into public.stock_par_depot (produit_id, depot_id, quantite, prix_vente, is_visible) values`);
const stockLines = [];
let seed = 42;
function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
products.forEach(p => {
  const targets = depotsFor(p.category);
  targets.forEach(t => {
    const [lo, hi] = t.q;
    const qty = Math.floor(lo + rand() * (hi - lo));
    const prix = p.sale_price;
    stockLines.push(
      `  ((select id from public.produits where ean = ${pg(p.barcode)}), ` +
      `(select id from public.depots where nom = ${pg(t.d)}), ${qty}, ${prix}, true)`
    );
  });
});
lines.push(stockLines.join(",\n") + " on conflict (produit_id, depot_id) do update set quantite = excluded.quantite, prix_vente = excluded.prix_vente;");
lines.push(``);

lines.push(`commit;`);

const sql = lines.join("\n");
mkdirSync("supabase/seed", { recursive: true });
writeFileSync("supabase/seed/0001_seed.sql", sql);
console.log("Wrote", sql.split("\n").length, "lines to supabase/seed/0001_seed.sql");
console.log("  ", products.length, "products,", stockLines.length, "stock entries");
