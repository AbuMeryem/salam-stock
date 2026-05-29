"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";

interface ImportResult {
  ok: boolean;
  inserted: number;
  parsed: number;
  parseErrors?: Array<{ line: number; raw: string; reason: string }>;
  dbErrors?: string[];
  meta?: { separator: string; headers: string[]; columnIndex: Record<string, number> };
}

export default function ImportCashmagPage() {
  const router = useRouter();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Seuls les fichiers .csv sont acceptés");
      return;
    }
    setBusy(true); setResult(null);
    try {
      let text = await file.text();
      if (!/[éèàçâêîôûë]/i.test(text) && /\xe9|\xe8|\xe0/.test(text)) {
        const buf = await file.arrayBuffer();
        text = new TextDecoder("iso-8859-1").decode(buf);
      }
      setPreview(text.split(/\r?\n/).slice(0, 6));
      const r = await fetch("/api/cashbox/import-cashmag", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: text, importedBy: "v2-admin" }),
      });
      const data = (await r.json()) as ImportResult;
      setResult(data);
      if (data.ok) toast.success(`${data.inserted} ligne(s) importée(s)`);
      else if (data.inserted > 0) toast.warning(`${data.inserted} importées, ${data.parseErrors?.length ?? 0} erreurs`);
      else toast.error("Aucune ligne importée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(false); }
  }, []);

  return (
    <V2Shell hideNav>
      <header className="px-5 pt-7">
        <BackButton />
        <p className="section-eyebrow mt-3"><FileSpreadsheet className="w-3 h-3" />Import ventes Cashmag</p>
        <h1 className="h1 text-text-primary mt-1">Importer le CSV Cashmag</h1>
        <p className="body-md text-text-secondary mt-1">
          Glisse-dépose ton export Cashmag pour intégrer les ventes magasin dans le rapport mensuel.
        </p>
      </header>

      <section className="px-5 mt-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
          className={`relative rounded-[20px] border-2 border-dashed transition-all px-5 py-10 text-center ${
            drag ? "border-primary bg-primary/5" : "border-line-medium bg-white"
          }`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-3 ${drag ? "text-primary" : "text-text-tertiary"}`} />
          <p className="text-[15px] font-bold text-text-primary">Dépose ton CSV Cashmag ici</p>
          <p className="text-[12px] text-text-secondary mt-1.5">Séparateur ; ou , — UTF-8 ou ISO-8859-1 (auto-détecté)</p>
          <label className="mt-4 inline-flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">
            <Upload className="w-4 h-4" />Choisir un fichier
            <input type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
          </label>
          <p className="text-[11px] text-text-tertiary mt-3">Idempotent : ré-importer ne crée pas de doublons.</p>
        </div>
      </section>

      {busy && (
        <section className="px-5 mt-4">
          <div className="bg-white border border-rule rounded-[16px] p-4 flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
            <p className="text-[13px] text-text-secondary">Parse + insertion en cours…</p>
          </div>
        </section>
      )}

      {result && (
        <section className="px-5 mt-4 space-y-3">
          <div className={`rounded-[18px] p-4 border ${
            result.ok ? "bg-success-soft border-success/30"
              : result.inserted > 0 ? "bg-warning-soft border-warning/30"
              : "bg-danger-soft border-danger/30"
          }`}>
            <div className="flex items-center gap-2">
              {result.ok ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-danger" />}
              <p className="text-[14px] font-extrabold tabular">{result.inserted}/{result.parsed} ligne(s) importée(s)</p>
            </div>
            {result.meta && (
              <p className="text-[11px] text-text-secondary mt-2 mono">
                Séparateur : <span className="font-bold">{result.meta.separator || "?"}</span> · Colonnes : {Object.keys(result.meta.columnIndex).join(", ")}
              </p>
            )}
          </div>
          {result.parseErrors && result.parseErrors.length > 0 && (
            <div className="bg-white border border-rule rounded-[18px] p-4">
              <p className="text-[12px] font-bold text-warning uppercase tracking-wide mb-2">
                {result.parseErrors.length} erreur(s) ignorée(s)
              </p>
              <ul className="text-[11px] text-text-secondary space-y-1 max-h-48 overflow-y-auto">
                {result.parseErrors.slice(0, 10).map((e) => (
                  <li key={e.line} className="mono">Ligne {e.line}: {e.reason}</li>
                ))}
                {result.parseErrors.length > 10 && <li className="italic">… et {result.parseErrors.length - 10} autres</li>}
              </ul>
            </div>
          )}
          {preview.length > 0 && (
            <div className="bg-white border border-rule rounded-[18px] p-4">
              <p className="text-[12px] font-bold text-text-secondary uppercase tracking-wide mb-2">Aperçu</p>
              <div className="mono text-[10.5px] text-text-secondary leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {preview.join("\n")}
              </div>
            </div>
          )}
          <a href="/v2/admin/rapport-mensuel"
            className="block w-full bg-primary text-white rounded-[18px] py-3.5 px-4 text-center font-bold text-[14px] active:scale-[0.99] transition-transform">
            Voir le rapport mensuel consolidé →
          </a>
        </section>
      )}
    </V2Shell>
  );
}
