import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  paymentChartSeries,
  reconcilePayments,
  type calculateCompensation,
  type RecordedPayment,
} from "@/lib/compensation";

export type CompensationResult = ReturnType<typeof calculateCompensation>;
export const compensationMoney = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      );

export function CompensationPanel({
  result,
  selectedQuarters,
  payments,
}: {
  result: CompensationResult;
  selectedQuarters: number[];
  payments: RecordedPayment[];
}) {
  const data = paymentChartSeries(result, selectedQuarters, payments);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pagamentos por Quarter · Esperado vs. À Receber vs. Pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.issues.length > 0 ? (
          <ul role="status" className="space-y-1 text-sm text-destructive">
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        <div
          className="h-64 w-full sm:h-72"
          role="img"
          aria-label="Comparação dos valores esperados a 100%, calculados a receber e já pagos por quarter"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barGap={4}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={64}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
                formatter={(value) => compensationMoney(value === null ? null : Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="expected"
                name="Esperado (100%)"
                fill="var(--accent)"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="calculated"
                name="À Receber"
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="paid"
                name="Pago"
                fill="var(--chart-3)"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">
          Valores na moeda do salário. A receber é uma projeção, não uma confirmação de pagamento.
          Quarters sem meta ficam pendentes (—). Pago é a soma dos pagamentos cadastrados em
          Configurações.
        </p>
      </CardContent>
    </Card>
  );
}

export function PaymentReconciliationCard({
  result,
  payments,
}: {
  result: CompensationResult;
  payments: RecordedPayment[];
}) {
  const r = reconcilePayments(result, payments);
  const tone = (value: number | null) =>
    value === null ? "" : value > 0.005 ? "text-destructive" : value < -0.005 ? "text-primary" : "";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Calculado vs. Pago</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Quarter</th>
                <th className="py-2 pr-3 text-right font-medium">À receber</th>
                <th className="py-2 pr-3 text-right font-medium">Pago</th>
                <th className="py-2 text-right font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {r.quarters.map((q) => (
                <tr key={q.quarter} className="border-t border-border">
                  <td className="py-2 pr-3">Q{q.quarter}{q.quarter === 4 ? " (inclui acelerador)" : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{compensationMoney(q.calculated)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{compensationMoney(q.paid)}</td>
                  <td className={`py-2 text-right tabular-nums ${tone(q.difference)}`}>{compensationMoney(q.difference)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 pr-3">Ano (com acelerador)</td>
                <td className="py-2 pr-3 text-right tabular-nums">{compensationMoney(r.annualDue)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{compensationMoney(r.totalPaid)}</td>
                <td className={`py-2 text-right tabular-nums ${tone(r.annualRemaining)}`}>{compensationMoney(r.annualRemaining)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Diferença positiva = falta pagar; negativa = pago a mais. A conta final do ano usa o total anual com acelerador menos tudo o que já foi pago. Cadastre os pagamentos em Configurações.
        </p>
      </CardContent>
    </Card>
  );
}
