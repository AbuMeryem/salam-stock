"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Send,
  Sparkles,
  TrendingUp,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { V2Shell } from "@/components/v2/V2Shell";
import { BackButton } from "@/components/v2/BackButton";
import { PageAccentStripe } from "@/components/v2/PageAccentStripe";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: Array<{ name: string; input: unknown }>;
}

const SUGGESTIONS = [
  "Combien j'ai vendu de Coca cette semaine ?",
  "Quels produits sont en alerte stock ?",
  "Top 5 produits du mois",
  "Quelle est ma démarque actuelle ?",
  "Quels employés ont le score IA le plus bas ?",
];

function md(text: string): string {
  // Très basique : **gras** → <b>, sauts de ligne → <br/>
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br/>");
}

export default function AssistantIAPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || sending) return;
    setInput("");
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: q,
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setSending(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMsgs.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = (await r.json()) as {
        answer: string;
        tool_calls?: Array<{ name: string; input: unknown }>;
        error?: string;
      };
      if (data.error) {
        throw new Error(data.error);
      }
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          tools: data.tool_calls,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur assistant");
    } finally {
      setSending(false);
    }
  }

  return (
    <V2Shell hideNav>
      <PageAccentStripe accent="sapin-or" />
      <header className="px-5 pt-7 pb-3 border-b border-rule">
        <BackButton />
        <div className="mt-2 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-gold flex items-center justify-center shadow-card">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="label-caps text-primary">Assistant Salam</p>
            <h1 className="text-[20px] font-extrabold text-text-primary leading-tight">
              IA business
            </h1>
          </div>
        </div>
      </header>

      {/* Chat zone */}
      <section className="px-4 pt-5 pb-[200px]">
        {messages.length === 0 ? (
          <EmptyState onPick={(q) => void send(q)} />
        ) : (
          <div className="space-y-3.5">
            {messages.map((m) =>
              m.role === "user" ? (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="bg-primary text-white rounded-[18px] rounded-tr-md px-4 py-2.5 max-w-[78%] shadow-card">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-gold flex items-center justify-center shrink-0 shadow-card">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white border border-rule rounded-[18px] rounded-tl-md px-4 py-3 shadow-card">
                      <p
                        className="text-[14px] text-text-primary leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: md(m.content) }}
                      />
                    </div>
                    {m.tools && m.tools.length > 0 && (
                      <ToolBadges
                        tools={m.tools}
                        msgId={m.id}
                        open={openTools[m.id] ?? false}
                        onToggle={() =>
                          setOpenTools((s) => ({
                            ...s,
                            [m.id]: !s[m.id],
                          }))
                        }
                      />
                    )}
                  </div>
                </motion.div>
              )
            )}

            {sending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2 items-center"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-gold flex items-center justify-center shadow-card">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-rule rounded-[18px] px-4 py-3 shadow-card">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <span
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "240ms" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </section>

      {/* Input bar — fixed bottom */}
      <div className="fixed bottom-0 inset-x-0 z-30 pb-safe bg-cream/95 backdrop-blur-md border-t border-rule pointer-events-none">
        <div className="mx-auto max-w-[460px] px-4 pt-3 pb-3 pointer-events-auto">
          {messages.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 scrollbar-hide">
              {SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  disabled={sending}
                  className="bg-white border border-rule rounded-full px-3 py-1.5 text-[11.5px] font-bold text-text-primary shrink-0 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose une question à l'IA…"
              className="flex-1 input-field"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-card disabled:opacity-40 active:scale-95 transition-transform"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </V2Shell>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="bg-white border border-rule rounded-[20px] p-6 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-gold flex items-center justify-center shadow-card">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-[16px] font-extrabold text-text-primary">
            Bonjour Otmane
          </h2>
          <p className="text-[12px] text-text-secondary">
            Pose-moi une question sur ton business.
          </p>
        </div>
      </div>
      <p className="label-caps text-text-tertiary mt-5 mb-2">
        Suggestions
      </p>
      <div className="space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full bg-cream border border-rule rounded-2xl p-3 text-left flex items-center gap-2.5 active:scale-[0.99] transition-transform"
          >
            <Sparkles className="w-4 h-4 text-gold shrink-0" />
            <span className="text-[13px] font-bold text-text-primary">
              {s}
            </span>
          </button>
        ))}
      </div>
      <p className="text-[10.5px] text-text-tertiary text-center mt-5">
        L&apos;assistant interroge Supabase via 6 tools : ventes, stock,
        alertes, top produits, employés, démarque.
      </p>
    </div>
  );
}

function ToolBadges({
  tools,
  open,
  onToggle,
}: {
  tools: Array<{ name: string; input: unknown }>;
  msgId: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-tertiary"
      >
        <Wrench className="w-3 h-3" />
        {tools.length} tool{tools.length > 1 ? "s" : ""} exécuté
        {tools.length > 1 ? "s" : ""}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {tools.map((t, i) => (
                <div
                  key={i}
                  className="bg-cream rounded-xl px-3 py-2 text-[11px] font-mono"
                >
                  <span className="text-primary font-bold">{t.name}</span>
                  <span className="text-text-tertiary">
                    ({Object.keys(t.input as object).join(", ")})
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
