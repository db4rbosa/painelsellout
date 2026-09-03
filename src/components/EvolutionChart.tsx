import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/sales-data";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.72 0.13 260)",
  "oklch(0.82 0.12 120)",
  "oklch(0.7 0.14 340)",
  "oklch(0.62 0.03 250)",
];

const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

type Props = {
  data: SeriesPoint[];
  keys: string[];
  type: "area" | "line" | "bar";
  stacked: boolean;
  valueFormatter: (v: number) => string;
};

export function EvolutionChart({ data, keys, type, stacked, valueFormatter }: Props) {
  const axis = {
    stroke: "var(--muted-foreground)",
    fontSize: 12,
    tickLine: false,
    axisLine: false,
  } as const;

  const shared = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis dataKey="period" {...axis} />
      <YAxis {...axis} tickFormatter={compact} width={56} />
      <Tooltip
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--popover-foreground)",
          fontSize: 12,
        }}
        formatter={(v) => valueFormatter(Number(v))}
      />
      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
    </>
  );

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {shared}
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId={stacked ? "a" : undefined}
                fill={PALETTE[i % PALETTE.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {shared}
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            {shared}
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId={stacked ? "a" : undefined}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                fill={`url(#grad-${i})`}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
