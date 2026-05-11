/**
 * Parseur défensif pour les CSV exportés depuis Cashmag.
 * Voir DEMO_TOMORROW.md pour le contexte métier.
 */

export interface CashmagRow {
  date_vente: string;
  heure_vente: string | null;
  numero_ticket: string;
  code_barre: string | null;
  designation: string;
  quantite: number;
  prix_ttc: number;
  prix_ht: number | null;
  tva_taux: number | null;
  mode_paiement: string | null;
  raw_line: string;
}

export interface CashmagParseResult {
  rows: CashmagRow[];
  errors: Array<{ line: number; raw: string; reason: string }>;
  meta: {
    separator: string;
    headers: string[];
    columnIndex: Record<string, number>;
    rowsCount: number;
    rowsSkipped: number;
  };
}

const KEYWORDS: Record<string, string[]> = {
  date: ["date", "jour"],
  heure: ["heure", "time"],
  ticket: ["ticket", "ref", "n°", "numero"],
  codebarre: ["code barre", "code-barre", "codebarre", "ean", "gencod"],
  designation: ["designation", "désignation", "produit", "libelle", "libellé", "nom"],
  quantite: ["quantite", "quantité", "qte", "qté", "nombre"],
  prixttc: ["prix ttc", "ttc", "montant ttc", "total ttc"],
  prixht: ["prix ht", "ht", "montant ht"],
  tvataux: ["tva", "taux"],
  paiement: ["paiement", "mode", "mp", "type"],
};

function detectSeparator(firstLine: string): string {
  const counts = {
    ";": (firstLine.match(/;/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  const sep = (Object.keys(counts) as Array<keyof typeof counts>).reduce(
    (a, b) => (counts[a] >= counts[b] ? a : b)
  );
  return sep || ";";
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function detectColumns(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  const norm = headers.map((h) => normalize(h));
  for (const [key, kws] of Object.entries(KEYWORDS)) {
    for (let i = 0; i < norm.length; i++) {
      if (kws.some((k) => norm[i].includes(normalize(k)))) {
        if (idx[key] === undefined) idx[key] = i;
      }
    }
  }
  return idx;
}

function parseNumberFr(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(/€|EUR/gi, "").trim();
  const n = parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDateFr(s: string | undefined): string | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  const m3 = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
  return null;
}

function parseHeureFr(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:hH](\d{2})(?:[:](\d{2}))?/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}:${(m[3] ?? "00").padStart(2, "0")}`;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
      continue;
    }
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === sep && !inQuote) { out.push(current); current = ""; continue; }
    current += c;
  }
  out.push(current);
  return out.map((s) => s.trim());
}

export function parseCashmagCsv(raw: string): CashmagParseResult {
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: CashmagParseResult["errors"] = [];

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, raw: "", reason: "Fichier vide" }],
      meta: { separator: ";", headers: [], columnIndex: {}, rowsCount: 0, rowsSkipped: 0 } };
  }

  const separator = detectSeparator(lines[0]);
  const headers = splitCsvLine(lines[0], separator);
  const columnIndex = detectColumns(headers);

  const required = ["date", "ticket", "designation", "prixttc"];
  const missing = required.filter((k) => columnIndex[k] === undefined);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, raw: lines[0],
        reason: `Colonnes manquantes : ${missing.join(", ")}. Headers : ${headers.join(" / ")}` }],
      meta: { separator, headers, columnIndex, rowsCount: 0, rowsSkipped: lines.length - 1 },
    };
  }

  const rows: CashmagRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    try {
      const cells = splitCsvLine(raw, separator);
      const get = (key: string) =>
        columnIndex[key] !== undefined ? cells[columnIndex[key]] : undefined;
      const date = parseDateFr(get("date"));
      const ticket = get("ticket");
      const designation = get("designation");
      const ttc = parseNumberFr(get("prixttc"));
      if (!date || !ticket || !designation || ttc === null) {
        errors.push({ line: i + 1, raw, reason: "Champs obligatoires manquants" });
        continue;
      }
      rows.push({
        date_vente: date,
        heure_vente: parseHeureFr(get("heure")),
        numero_ticket: ticket.toString(),
        code_barre: get("codebarre")?.toString() ?? null,
        designation,
        quantite: parseNumberFr(get("quantite")) ?? 1,
        prix_ttc: ttc,
        prix_ht: parseNumberFr(get("prixht")),
        tva_taux: parseNumberFr(get("tvataux")),
        mode_paiement: get("paiement") ?? null,
        raw_line: raw,
      });
    } catch (e) {
      errors.push({ line: i + 1, raw, reason: e instanceof Error ? e.message : "Erreur" });
    }
  }

  return { rows, errors,
    meta: { separator, headers, columnIndex, rowsCount: rows.length, rowsSkipped: errors.length } };
}
