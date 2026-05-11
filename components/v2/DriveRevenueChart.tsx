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
import { ArrowDownRight, ArrowUpRight, ShoppingCart } from "lucide-react";

/**
 * Point journalier pour le CA drive total.
 */
export interface DriveRevenueDataPoint {
  /** YYYY-MM-DD */
  date: string;
  ca: number;
  commandes: number;
}

type Period = 7 | 30 | 90;

interface DriveRevenueChartProps {
  data: DriveRevenueDataPoint[];
  initialPeriod?: Period;
}

const PERIOD_LABEL: Record<Period, string> = {
  7: "7 jours",
  30: "30 jours",
  90: "90 jours",
};

/** Courbe drive : néon cyan/violet — distinct des couleurs Stock
 *  (sapin/or/danger) et néon Particulier/Pro du RevenueChart Stock. */
const COLOR = {
  fill: "#7C5CFF", // electric violet
  stroke: "#5538D8",
  accent: "#3DDCFF", // neon cyan accent
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

export function DriveRevenueChart({
  data,
  initialPeriod = 30,
}: DriveRevenueChartProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);

  const sliced = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-period);
  }, [data, period]);

  const previousSliced = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-period * 2, -period);
  }, [data, period]);

  const total = useMemo(() => sliced.reduce((s, d) => s + d.ca, 0), [sliced]);
  const previousTotal = useMemo(
    () => previousSliced.reduce((s, d) => s + d.ca, 0),
    [previousSliced]
  );
  const totalCmds = useMemo(
    () => sliced.reduce((s, d) => s + d.commandes, 0),
    [sliced]
  );
  const delta =
    previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;
  const avgPanier = totalCmds > 0 ? total / totalCmds : 0;

  return (
    <div className="bg-white border border-rule rounded-[20px] p-4 shadow-card">
      {/* Header — KPI primary + period selector */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="section-eyebrow">
            <ShoppingCart className="w-3 h-3" />
            CA Drive · {PERIOD_LABEL[period]}
          </p>
          <p className="text-[28px] font-extrabold tracking-tight text-text-primary mt-1.5 tabular leading-none">
            {formatEUR(total)}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {delta !== null && (
              <p
                className={`inline-flex items-center gap-1 text-[12px] font-bold tabular ${
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
            <p className="text-[12px] text-text-secondary tabular">
              {totalCmds} cmd · panier moy.{" "}
              <span className="font-bold text-text-primary">
                {formatEUR(avgPanier)}
              </span>
            </p>
          </div>
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
                    active ? "bg-primary text-white" : "text-text-secondary"
                  }`}
                >
                  {p}j
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <motion.div
        key={period}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        className="h-[180px] -mx-2 mt-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={sliced}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-drive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.fill} stopOpacity={0.65} />
                <stop offset="100%" stopColor={COLOR.fill} stopOpacity={0.04} />
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
              tickFormatter={(v: number) =>
                v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
              }
              tick={{
                fill: "var(--text-tertiary)",
                fontSize: 10,
                fontWeight: 600,
              }}
              tickLine={false}
              axisLine={false}
              width={28}
              domain={["dataMin - 50", "dataMax + 80"]}
            />
            <Tooltip
              cursor={{
                stroke: "var(--border-medium)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              allowEscapeViewBox={{ x: false, y: false }}
              offset={16}
              wrapperStyle={{ outline: "none", zIndex: 50 }}
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(14,59,46,0.12)",
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
              formatter={(value, name) => {
                if (name === "ca") return [formatEUR(Number(value)), "CA"];
                return [Number(value), "Commandes"];
              }}
            />
            <Area
              type="monotone"
              dataKey="ca"
              stroke={COLOR.stroke}
              strokeWidth={2.4}
              fill="url(#grad-drive)"
              isAnimationActive
              animationDuration={420}
              activeDot={{
                r: 5,
                fill: COLOR.fill,
                stroke: COLOR.stroke,
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
