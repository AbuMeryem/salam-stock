"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { PageWrapper } from "@/components/layout/PageWrapper";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
}

const quickQuestions = [
  "Quels écarts cette semaine ?",
  "Quels produits en rupture ?",
  "Analyse une livraison",
];

function buildAnswer(question: string): React.ReactNode {
  if (question.includes("écarts")) {
    return (
      <>
        <p>
          Cette semaine, j&apos;ai détecté <strong>3 écarts critiques</strong> sur tes
          réceptions :
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>
            <strong>Coca-Cola Zero 1,5L</strong> — 60 commandés, 54 reçus (-10%) le 03/05.
            Avoir en attente côté Cevital.
          </li>
          <li>
            <strong>Olives Picholine</strong> — 18 kg reçus vs 20 commandés (-10%) le 06/05.
            Fournisseur Maamora à recontacter.
          </li>
          <li>
            <strong>Harissa Le Phare</strong> — livraison de 5 unités sans bon de commande
            correspondant le 04/05.
          </li>
        </ul>
        <p className="mt-3">
          Conformité globale réceptions : <strong>96%</strong> (+2 pts vs semaine dernière).
        </p>
      </>
    );
  }
  if (question.includes("rupture")) {
    return (
      <>
        <p>
          Selon la vitesse d&apos;écoulement, <strong>3 produits</strong> sont à risque
          dans les 5 jours :
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>
            <strong>Dattes Medjool 500g</strong> — stock 8, vitesse 2,8/jour. Rupture estimée 11/05.
          </li>
          <li>
            <strong>Semoule Ferrero 1kg</strong> — stock 9, vitesse 8/jour. Rupture estimée 09/05.
          </li>
          <li>
            <strong>Freez Litchi 275ml</strong> — stock 28, vitesse 6,5/jour. Rupture estimée 12/05.
          </li>
        </ul>
        <p className="mt-3">
          Recommandation : passer commande à Maamora (24 dattes), Ferrero France (60 semoule)
          et Cevital (36 freez) avant 18h aujourd&apos;hui.
        </p>
      </>
    );
  }
  if (question.includes("livraison") || question.includes("Analyse")) {
    return (
      <>
        <p>
          Dernière livraison analysée — <strong>BC-2026-0136 / Lactel du 07/05</strong> :
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>3 produits réceptionnés, <strong>100% conforme</strong>.</li>
          <li>Photographie carton effectuée pour chaque ligne.</li>
          <li>Validée par Mehdi Tazi à 07h20, dans les délais.</li>
        </ul>
        <p className="mt-3">
          Bilan 7 jours : 14 réceptions, taux de photographie <strong>96%</strong> (objectif 95%).
          Aucune anomalie de procédure côté Mehdi cette semaine.
        </p>
      </>
    );
  }
  return (
    <p>
      Je suis encore en bêta sur la saisie libre. Utilise les questions rapides en haut pour
      voir une démonstration des analyses.
    </p>
  );
}

export default function AssistantPage() {
  const router = useRouter();
  const user = useStore((s) => s.currentUser);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: (
        <p>
          Bonjour {user?.name?.split(" ")[0] ?? "à toi"}, je suis l&apos;assistant Salam.
          Pose-moi une question sur tes réceptions, tes stocks ou tes alertes — je suis
          connecté en temps réel à tes données.
        </p>
      ),
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages, thinking]);

  async function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [
      ...m,
      { id: "u-" + Date.now(), role: "user", content: question },
    ]);
    setInput("");
    setThinking(true);
    await new Promise((r) => setTimeout(r, 1400 + Math.random() * 700));
    setMessages((m) => [
      ...m,
      { id: "a-" + Date.now(), role: "assistant", content: buildAnswer(question) },
    ]);
    setThinking(false);
  }

  return (
    <PageWrapper hideNav className="!pb-0">
      <div className="min-h-screen flex flex-col">
        <header className="gradient-header rounded-b-[28px] px-5 pt-12 pb-5 text-text-ondark sticky top-0 z-30 shadow-card-lg">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center"
              aria-label="Retour"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-gold font-semibold">EN LIGNE</span>
            </div>
            <div className="w-10" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-gold flex items-center justify-center text-primary-dark">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <p className="label-caps text-gold">ASSISTANT IA</p>
              <h1 className="text-xl font-extrabold leading-tight">Assistant Salam</h1>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="shrink-0 bg-white/10 text-white text-xs font-semibold rounded-full px-3 py-2 backdrop-blur-sm border border-white/10"
              >
                {q}
              </button>
            ))}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-[18px] px-4 py-3 text-[14px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-tr-md"
                    : "bg-white text-text-primary shadow-card rounded-tl-md"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
          {thinking && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white shadow-card rounded-[18px] rounded-tl-md px-4 py-3 flex items-center gap-2 text-sm text-text-secondary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:120ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:240ms]" />
                <span className="ml-1">Assistant réfléchit…</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t border-line-light bg-white px-4 py-3 pb-safe">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Disponible en V2 — utilise les questions rapides"
              className="input-field !rounded-full flex-1 !py-3"
            />
            <button
              type="submit"
              className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-50"
              disabled={!input.trim()}
              aria-label="Envoyer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-[10px] text-text-tertiary text-center mt-2">
            Démonstration — IA connectée à vos données réelles en V2
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
