"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";

/**
 * Point de données journalier pour le CA.
 * Une seule source pour les 2 courbes — chaque jour expose ses 2 totaux.
 */
export interface RevenueDataPoint {
  /** YYYY-MM-DD */
  date: string;
  particulier: number;
  pro: number;
}

type Series = "global" | "particulier" | "pro";
type Period = 7 | 30 | 90;

interface RevenueChartProps {
  data: RevenueDataPoint[];
  initialSeries?: Series;
  initialPeriod?: Period;
}

const SERIES_LABEL: Record<Series, string> = {
  global: "Global",
  particulier: "Particulier",
  pro: "Professionnel",
};

const PERIOD_LABEL: Record<Period, string> = {
  7: "7 jours",
  30: "30 jours",
  90: "90 jours",
};

/** Couleurs néon — pop sur cream chaud + lisibles dans tooltip. */
const COLOR = {
  particulier: "#22D67A", // neon spring green
  pro: "#F2C314", // neon gold
  particulierStroke: "#16A055",
  proStroke: "#C99800",
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function RevenueChart({
  data,
  initialSeries = "global",
  initialPeriod = 30,
}: RevenueChartProps) {
  const [series, setSeries] = useState<Series>(initialSeries);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  /** Tooltip suit le doigt UNIQUEMENT pendant l'appui (touch) ou le hover (souris).
   *  Sur touchend on remet à false → la carte recap disparaît dès qu'on relâche. */
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const sliced = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-period);
  }, [data, period]);

  const previousSliced = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-period * 2, -period);
  }, [data, period]);

  const sum = (arr: RevenueDataPoint[], s: Series) =>
    arr.reduce((acc, d) => {
      if (s === "global") return acc + d.particulier + d.pro;
      return acc + d[s];
    }, 0);

  const total = useMemo(() => sum(sliced, series), [sliced, series]);
  const previousTotal = useMemo(() => sum(previousSliced, series), [previousSliced, series]);
  const delta = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

  const showParticulier = series === "global" || series === "particulier";
  const showPro = series === "global" || series === "pro";

  return (
    <div className="bg-white border border-rule rounded-[20px] p-4 shadow-card">
      {/* Header — KPI primary + selectors */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="section-eyebrow">
            <TrendingUp className="w-3 h-3" />
            Chiffre d&apos;affaires · {PERIOD_LABEL[period]}
          </p>
          <p className="text-[28px] font-extrabold tracking-tight text-text-primary mt-1.5 tabular leading-none">
            {formatEUR(total)}
          </p>
          {delta !== null && (
            <p
              className={`mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold tabular ${
                delta >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}%
              <span className="text-text-tertiary font-medium ml-1">
                vs précédent
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="inline-flex bg-cream rounded-full p-0.5 gap-0.5">
            {(["7", "30", "90"] as const).map((p) => {
              const n = parseInt(p, 10) as Period;
              const active = period === n;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(n)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-text-secondary"
                  }`}
                >
                  {p}j
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Series tabs */}
      <div className="flex gap-1.5 mt-3 mb-2">
        {(["global", "particulier", "pro"] as const).map((s) => {
          const active = series === s;
          return (
            <button
              key={s}
              onClick={() => setSeries(s)}
              aria-pressed={active}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11.5px] font-bold transition-all ${
                active
                  ? "bg-text-primary text-white shadow-card"
                  : "bg-cream text-text-secondary"
              }`}
            >
              {s === "particulier" && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: COLOR.particulier }}
                />
              )}
              {s === "pro" && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: COLOR.pro }}
                />
              )}
              {s === "global" && (
                <span className="inline-flex gap-px">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: COLOR.particulier }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: COLOR.pro }}
                  />
                </span>
              )}
              {SERIES_LABEL[s]}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <motion.div
        key={`${series}-${period}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        className="h-[180px] -mx-2 mt-2 select-none touch-none"
        onTouchStart={() => setTooltipVisible(true)}
        onTouchMove={() => setTooltipVisible(true)}
        onTouchEnd={() => setTooltipVisible(false)}
        onTouchCancel={() => setTooltipVisible(false)}
        onMouseLeave={() => setTooltipVisible(false)}
        onMouseEnter={() => setTooltipVisible(true)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={sliced}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-particulier" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.particulier} stopOpacity={0.55} />
                <stop offset="100%" stopColor={COLOR.particulier} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-pro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.pro} stopOpacity={0.55} />
                <stop offset="100%" stopColor={COLOR.pro} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border-light)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => formatDay(v)}
              tick={{
                fill: "var(--text-tertiary)",
                fontSize: 10,
                fontWeight: 600,
              }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              hide
              domain={["dataMin - 50", "dataMax + 50"]}
            />
            <Tooltip
              active={tooltipVisible ? undefined : false}
              /* Clamp horizontal ET vertical : la card recap ne peut plus
                 sortir du chart. C'était le bug "tooltip dans le top-left
                 de l'écran" quand on tape près du bord gauche. */
              allowEscapeViewBox={{ x: false, y: false }}
              offset={14}
              cursor={{
                stroke: "var(--border-medium)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              wrapperStyle={{
                outline: "none",
                pointerEvents: "none",
                zIndex: 50,
                transition: "opacity 120ms ease-out",
              }}
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(14,59,46,0.18)",
                padding: "10px 12px",
                fontSize: 12,
                maxWidth: 200,
              }}
              labelStyle={{
                color: "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 4,
              }}
              itemStyle={{
                color: "var(--text-primary)",
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 0",
              }}
              labelFormatter={(v) =>
                typeof v === "string" ? formatDay(v) : String(v)
              }
              formatter={(value, name) => [
                formatEUR(Number(value)),
                name === "particulier" ? "Particulier" : "Pro",
              ]}
            />
            {showParticulier && (
              <Area
                type="monotone"
                dataKey="particulier"
                stroke={COLOR.particulierStroke}
                strokeWidth={2.4}
                fill="url(#grad-particulier)"
                isAnimationActive
                animationDuration={420}
                /* Dot visible uniquement sur les jours avec activité — évite
                   les ronds inutiles sur 30j de zéros, mais rend visibles
                   les rares pics quand il n'y a que quelques commandes. */
                dot={(props: { cx?: number; cy?: number; payload?: RevenueDataPoint }) => {
                  const v = props.payload?.particulier ?? 0;
                  if (v <= 0 || props.cx === undefined || props.cy === undefined) {
                    return <g key={`dot-p-${props.cx ?? 0}-${props.cy ?? 0}`} />;
                  }
                  return (
                    <circle
                      key={`dot-p-${props.cx}-${props.cy}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill={COLOR.particulier}
                      stroke={COLOR.particulierStroke}
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  fill: COLOR.particulier,
                  stroke: COLOR.particulierStroke,
                  strokeWidth: 2,
                }}
              />
            )}
            {showPro && (
              <Area
                type="monotone"
                dataKey="pro"
                stroke={COLOR.proStroke}
                strokeWidth={2.4}
                fill="url(#grad-pro)"
                isAnimationActive
                animationDuration={420}
                dot={(props: { cx?: number; cy?: number; payload?: RevenueDataPoint }) => {
                  const v = props.payload?.pro ?? 0;
                  if (v <= 0 || props.cx === undefined || props.cy === undefined) {
                    return <g key={`dot-pr-${props.cx ?? 0}-${props.cy ?? 0}`} />;
                  }
                  return (
                    <circle
                      key={`dot-pr-${props.cx}-${props.cy}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill={COLOR.pro}
                      stroke={COLOR.proStroke}
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{
                  r: 5,
                  fill: COLOR.pro,
                  stroke: COLOR.proStroke,
                  strokeWidth: 2,
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
