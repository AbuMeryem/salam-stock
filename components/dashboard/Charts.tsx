"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

interface AreaPoint {
  day: string;
  current: number;
  previous: number;
}

export function ConformiteChart({ data }: { data: AreaPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={data} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="conformiteFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0E3B2E" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#0E3B2E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="previous"
          stroke="#9CA3AF"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="transparent"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="current"
          stroke="#0E3B2E"
          strokeWidth={2.4}
          fill="url(#conformiteFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface BarPoint {
  day: string;
  value: number;
}

export function ReceptionsBarChart({ data }: { data: BarPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
        <CartesianGrid stroke="transparent" />
        <XAxis dataKey="day" hide />
        <YAxis hide />
        <Bar dataKey="value" fill="#C9A227" radius={[6, 6, 6, 6]} barSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
