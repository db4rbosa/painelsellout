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
  "#2ee6c5",
  "#f5b942",
  "#a78bfa",
  "#4ade80",
  "#fb7185",
  "#60a5fa",
  "#bef264",
  "#f472b6",
  "#94a3b8",
];

const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const AXIS = {
  stroke: "#94a3b8",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const TOOLTIP_STYLE = {
  background: "#1b2230",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 12,
} as const;

type Props = {
  data: SeriesPoint[];
  keys: string[];
  type: "area" | "line" | "bar";
  stacked: boolean;
  valueFormatter: (v: number) => string;
};

export function EvolutionChart({ data, keys, type, stacked, valueFormatter }: Props) {
  const margin = { top: 8, right: 8, left: 0, bottom: 0 };
  const stackProps = (i: number) => (stacked ? { stackId: "a" } : { stackId: `s${i}` });
  const color = (i: number) => PALETTE[i % PALETTE.length]!;

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b3444" vertical={false} />
            <XAxis dataKey="period" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={compact} width={64} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: "#ffffff10" }}
              formatter={(v) => valueFormatter(Number(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} {...stackProps(i)} fill={color(i)} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b3444" vertical={false} />
            <XAxis dataKey="period" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={compact} width={64} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => valueFormatter(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={color(i)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={margin}>
            <defs>
              {keys.map((k, i) => (
                <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color(i)} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color(i)} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b3444" vertical={false} />
            <XAxis dataKey="period" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={compact} width={64} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => valueFormatter(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                {...stackProps(i)}
                stroke={color(i)}
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
