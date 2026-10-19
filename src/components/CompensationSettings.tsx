import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { compensationIssues, resolvedBucketWeights, type CompensationSettings as Settings, type RecordedPayment } from "@/lib/compensation";
import type { BucketDefinition, QuarterValues } from "@/lib/targets";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function CompensationSettings({ value, buckets, onChange }: {
  value: Settings; buckets: BucketDefinition[]; onChange: (value: Settings) => void;
}) {
  const weights = resolvedBucketWeights(value, buckets);
  const numeric = (raw: string, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Number(raw) || 0));
  const issues = compensationIssues(value, buckets);
  return <section className="space-y-4" aria-labelledby="compensation-settings-title">
    <h2 id="compensation-settings-title" className="font-semibold">Valores a receber · QAF e OPI</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="qaf-salary">Salário na assinatura do QAF</Label>
        <Input id="qaf-salary" type="number" inputMode="decimal" min="0" step="0.01" value={value.salaryAtQaf || ""} placeholder="0" onChange={(event) => onChange({ ...value, salaryAtQaf: numeric(event.target.value) })} /></div>
      <div className="space-y-2"><Label htmlFor="opi-percent">OPI (%)</Label>
        <Input id="opi-percent" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={value.opiPercent || ""} placeholder="0" onChange={(event) => onChange({ ...value, opiPercent: numeric(event.target.value, 100) })} /></div>
    </div>
    <p className="text-sm text-muted-foreground">Base anual: 13 × salário QAF × OPI. Valores na mesma moeda do salário.</p>
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Distribuição por quarter (%)</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{value.quarterShares.map((share, index) => <div key={index} className="space-y-2">
        <Label htmlFor={`opi-share-${index}`}>Q{index + 1} (%)</Label>
        <Input id={`opi-share-${index}`} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={share} onChange={(event) => {
          const shares = [...value.quarterShares] as QuarterValues;
          shares[index] = numeric(event.target.value, 100);
          onChange({ ...value, quarterShares: shares });
        }} />
      </div>)}</div>
      <p className="text-sm text-muted-foreground">Total: {value.quarterShares.reduce((sum, share) => sum + share, 0).toFixed(2)}%</p>
    </fieldset>
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Peso de cada bolso (%)</legend>
      <div className="grid gap-3 sm:grid-cols-2">{buckets.map((bucket) => <div key={bucket.id} className="space-y-2">
        <Label htmlFor={`opi-weight-${bucket.id}`}>{bucket.name} (%)</Label>
        <Input id={`opi-weight-${bucket.id}`} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={weights[bucket.id] ?? 0} onChange={(event) => onChange({ ...value, bucketWeights: { ...weights, [bucket.id]: numeric(event.target.value, 100) } })} />
      </div>)}</div>
      <p className="text-sm text-muted-foreground">Total: {Object.values(weights).reduce((sum, weight) => sum + weight, 0).toFixed(2)}%</p>
    </fieldset>
    {issues.length > 0 && <ul className="space-y-1 text-sm text-destructive" role="status">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Valores já pagos</legend>
      {value.payments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pagamento cadastrado.</p>}
      {value.payments.map((payment, index) => {
        const update = (patch: Partial<RecordedPayment>) => onChange({ ...value, payments: value.payments.map((p, i) => i === index ? { ...p, ...patch } : p) });
        return <div key={payment.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
          <div className="space-y-1"><Label htmlFor={`pay-q-${payment.id}`}>Quarter</Label>
            <select id={`pay-q-${payment.id}`} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={payment.quarter} onChange={(e) => update({ quarter: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor={`pay-m-${payment.id}`}>Mês do pagamento</Label>
            <select id={`pay-m-${payment.id}`} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={payment.month} onChange={(e) => update({ month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor={`pay-y-${payment.id}`}>Ano</Label>
            <Input id={`pay-y-${payment.id}`} type="number" min="2000" max="2100" value={payment.year} onChange={(e) => update({ year: Math.round(Number(e.target.value) || new Date().getFullYear()) })} /></div>
          <div className="space-y-1"><Label htmlFor={`pay-a-${payment.id}`}>Valor pago</Label>
            <Input id={`pay-a-${payment.id}`} type="number" inputMode="decimal" step="0.01" value={payment.amount || ""} placeholder="0" onChange={(e) => update({ amount: Number(e.target.value) || 0 })} /></div>
          <Button type="button" variant="outline" onClick={() => onChange({ ...value, payments: value.payments.filter((_, i) => i !== index) })}>Remover</Button>
        </div>;
      })}
      <Button type="button" variant="secondary" onClick={() => {
        const now = new Date();
        onChange({ ...value, payments: [...value.payments, { id: crypto.randomUUID(), quarter: 1, month: now.getMonth() + 1, year: now.getFullYear(), amount: 0 }] });
      }}>Adicionar pagamento</Button>
    </fieldset>
  </section>;
}