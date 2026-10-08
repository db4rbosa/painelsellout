import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { compensationIssues, resolvedBucketWeights, type CompensationSettings as Settings } from "@/lib/compensation";
import type { BucketDefinition, QuarterValues } from "@/lib/targets";

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
  </section>;
}