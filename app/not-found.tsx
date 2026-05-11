import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="mx-auto w-full max-w-[460px] flex-1 flex flex-col">
        <header className="gradient-header rounded-b-[28px] safe-top-hero pb-12 px-6 text-text-ondark">
          <p className="label-caps text-text-ondark/70">404 · introuvable</p>
          <h1 className="h1 text-text-ondark mt-2">Page non trouvée</h1>
          <p className="body-md text-text-ondarkmuted mt-2">
            Cette adresse n&apos;existe pas dans Salam Stock. Soit la page a été
            déplacée, soit le lien est erroné.
          </p>
        </header>

        <div className="flex-1 px-5 pt-8 pb-10 space-y-3">
          <Link
            href="/v2"
            className="bg-white rounded-2xl shadow-card border border-rule p-4 flex items-center gap-4 active:scale-[0.99] transition-transform block"
          >
            <span className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center">
              <Home className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-text-primary">
                Retour à l&apos;accueil V2
              </p>
              <p className="text-xs text-text-secondary">
                Hub multi-dépôts Salam Stock
              </p>
            </div>
          </Link>

          <Link
            href="/v2/login"
            className="bg-white rounded-2xl shadow-card border border-rule p-4 flex items-center gap-4 active:scale-[0.99] transition-transform block"
          >
            <span className="w-11 h-11 rounded-xl bg-gold-soft text-primary-dark flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-text-primary">
                Se reconnecter
              </p>
              <p className="text-xs text-text-secondary">
                Saisir un code PIN
              </p>
            </div>
          </Link>

          <p className="text-[11px] text-text-tertiary text-center pt-4">
            Salam Stock V2 · multi-dépôts Toulouse
          </p>
        </div>
      </div>
    </div>
  );
}
