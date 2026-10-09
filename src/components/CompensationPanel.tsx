import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type calculateCompensation } from "@/lib/compensation";

export type CompensationResult = ReturnType<typeof calculateCompensation>;
export const compensationMoney = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function CompensationPanel({ result, selectedQuarters }: {
  result: CompensationResult; selectedQuarters: number[];
}) {
  const data = selectedQuarters.map((quarter) => {
    const payout = result.quarters[quarter - 1];
    return { period: `Q${quarter}`, expected: result.issues.length ? null : payout?.base ?? null, calculated: payout?.amount ?? null };
  });
  return <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base">Pagamentos por quarter · esperado vs. a receber</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {result.issues.length > 0 ? <ul role="status" className="space-y-1 text-sm text-destructive">{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
      <div className="h-64 w-full sm:h-72" role="img" aria-label="Comparação dos valores esperados a 100% e calculados a receber por quarter">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={12} width={64} tickFormatter={(value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
            <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }} formatter={(value) => compensationMoney(value === null ? null : Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="expected" name="Esperado · 100%" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={48} />
            <Bar dataKey="calculated" name="A receber · calculado" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Valores na moeda do salário. A receber é uma projeção, não uma confirmação de pagamento. Quarters sem meta ficam pendentes (—).</p>
    </CardContent>
  </Card>;
}
