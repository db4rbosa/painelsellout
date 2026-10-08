import { calculateCompensation, type CompensationSettings } from "@/lib/compensation";
import { fmtPct } from "@/lib/sales-data";
import type { AttainmentResult, BucketDefinition } from "@/lib/targets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function CompensationPanel({ settings, buckets, annualAttainment, selectedQuarters }: {
  settings: CompensationSettings; buckets: BucketDefinition[]; annualAttainment: AttainmentResult; selectedQuarters: number[];
}) {
  const result = calculateCompensation(settings, buckets, annualAttainment);
  return <section className="space-y-4 border-t border-border pt-6" aria-labelledby="payout-title">
    <h2 id="payout-title" className="text-lg font-semibold">Valores a receber</h2>
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      <div><p className="text-sm text-muted-foreground">OPI anual · 100%</p><p className="text-2xl font-semibold" data-testid="opi-base">{money(result.annualBase)}</p></div>
      <div><p className="text-sm text-muted-foreground">Projeção anual com acelerador · Q1–Q4</p><p className="text-2xl font-semibold" data-testid="opi-annual">{money(result.annual.amount)}</p></div>
    </div>
    <p className="text-sm text-muted-foreground">LT_PAYCURVE_P2_60_PCT · quarters limitados a 100% de pagamento; anual limitado a 275%. Valores na moeda do salário.</p>
    {result.issues.length > 0 ? <ul role="status" className="space-y-1 text-sm text-destructive">{result.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
    <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Bolso</TableHead><TableHead className="text-right">Peso</TableHead><TableHead className="text-right">Atingimento</TableHead><TableHead className="text-right">Payout do OPI</TableHead><TableHead className="text-right">A receber</TableHead></TableRow></TableHeader>
      <TableBody>{selectedQuarters.map((quarter) => {
        const payout = result.quarters[quarter - 1];
        if (!payout) return null;
        return <TableRow key={quarter}><TableCell className="font-medium">Q{quarter}</TableCell><TableCell colSpan={4}>Base OPI: {money(payout.base)}</TableCell><TableCell className="text-right font-semibold" data-testid={`opi-q${quarter}`}>{money(payout.amount)}</TableCell></TableRow>;
      })}
      {selectedQuarters.flatMap((quarter) => (result.quarters[quarter - 1]?.details ?? []).map((detail) => <TableRow key={`${quarter}-${detail.id}`}>
        <TableCell>Q{quarter}</TableCell><TableCell>{detail.name}</TableCell><TableCell className="text-right">{detail.weight}%</TableCell><TableCell className="text-right">{detail.attainment === null ? "—" : fmtPct(detail.attainment)}</TableCell><TableCell className="text-right">{detail.rate === null ? "—" : fmtPct(detail.rate)}</TableCell><TableCell className="text-right">{money(result.issues.length ? null : detail.amount)}</TableCell>
      </TableRow>))}
      {result.annual.details.map((detail) => <TableRow key={`annual-${detail.id}`}>
        <TableCell className="font-medium">Anual Q1–Q4</TableCell><TableCell>{detail.name}</TableCell><TableCell className="text-right">{detail.weight}%</TableCell><TableCell className="text-right">{detail.attainment === null ? "—" : fmtPct(detail.attainment)}</TableCell><TableCell className="text-right">{detail.rate === null ? "—" : fmtPct(detail.rate)}</TableCell><TableCell className="text-right">{money(result.issues.length ? null : detail.amount)}</TableCell>
      </TableRow>)}
      </TableBody>
    </Table></div>
    <p className="text-sm text-muted-foreground">Projeção anual não somada aos pagamentos trimestrais. Sem meta em um bolso com peso, o valor fica pendente (—).</p>
  </section>;
}