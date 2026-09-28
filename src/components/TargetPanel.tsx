import { Check, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { NumberInput } from "@/components/NumberInput";
import { fmtPct, fmtUSD } from "@/lib/sales-data";
import type { AttainmentResult, AttainmentRow, BucketDefinition, QuarterAccounts, Targets } from "@/lib/targets";
import { cn } from "@/lib/utils";

const QUARTERS = [1, 2, 3, 4] as const;
const toneFor = (value: number | null) => value === null
  ? "text-muted-foreground"
  : value >= 1 ? "text-[var(--positive)]" : value >= 0.8 ? "text-accent" : "text-destructive";

function AttainmentBlock({ title, row }: { title: string; row: AttainmentRow }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className={cn("font-display text-xl", toneFor(row.attainment))}>
          {row.attainment === null ? "—" : fmtPct(row.attainment)}
        </span>
      </div>
      <Progress value={row.attainment === null ? 0 : Math.min(row.attainment * 100, 100)} className="mt-3" />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Real {fmtUSD(row.actual)}</span><span>Meta {fmtUSD(row.target)}</span>
      </div>
    </div>
  );
}

type Props = {
  accountOptions: string[];
  buckets: BucketDefinition[];
  selectedQuarters: number[];
  onSelectedQuartersChange: (quarters: number[]) => void;
  accountsByQuarter: QuarterAccounts;
  onAccountsByQuarterChange: (quarter: number, accounts: string[]) => void;
  targets: Targets;
  onChange: (targets: Targets) => void;
  attainment: AttainmentResult;
};

export function TargetPanel({ accountOptions, buckets, selectedQuarters, onSelectedQuartersChange, accountsByQuarter, onAccountsByQuarterChange, targets, onChange, attainment }: Props) {
  const toggleQuarter = (quarter: number) => {
    const next = selectedQuarters.includes(quarter)
      ? selectedQuarters.filter((value) => value !== quarter)
      : [...selectedQuarters, quarter].sort();
    if (next.length) onSelectedQuartersChange(next);
  };

  return <div className="space-y-6">
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Quarters avaliados</CardTitle></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUARTERS.map((quarter) => {
          const active = selectedQuarters.includes(quarter);
          return <Button key={quarter} type="button" variant={active ? "default" : "outline"} onClick={() => toggleQuarter(quarter)} aria-pressed={active}>{active ? <Check /> : null} Q{quarter}</Button>;
        })}
      </div></CardContent>
    </Card>

    <div className="grid gap-5 xl:grid-cols-2">
      {selectedQuarters.map((quarter) => <Card key={quarter}>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="size-4 text-primary" /> Q{quarter}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <MultiSelectFilter label={`Accounts do Q${quarter}`} options={accountOptions} selected={accountsByQuarter[quarter] ?? []} onChange={(values) => values.length && onAccountsByQuarterChange(quarter, values)} placeholder="Selecione ao menos um account" showChips />
          <div className="grid gap-4 sm:grid-cols-2">
            {buckets.map((bucket) => <div key={bucket.id} className="space-y-2">
              <Label htmlFor={`target-${bucket.id}-q${quarter}`}>Meta {bucket.name} Q{quarter} (USD)</Label>
              <NumberInput id={`target-${bucket.id}-q${quarter}`} value={targets.byBucket[bucket.id]?.[quarter - 1] ?? 0} onChange={(value) => {
                const quarterValues = [...(targets.byBucket[bucket.id] ?? [0, 0, 0, 0])] as [number, number, number, number];
                quarterValues[quarter - 1] = value;
                onChange({ ...targets, byBucket: { ...targets.byBucket, [bucket.id]: quarterValues } });
              }} />
            </div>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {attainment.buckets.map((bucket) => {
              const row = bucket.quarters[quarter - 1];
              return row ? <AttainmentBlock key={bucket.id} title={`Atingimento · ${bucket.name}`} row={row} /> : null;
            })}
          </div>
        </CardContent>
      </Card>)}
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Total dos quarters selecionados</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {attainment.buckets.map((bucket) => <AttainmentBlock key={bucket.id} title={`Total · ${bucket.name}`} row={{ label: "Total", ...bucket.total }} />)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Atingimento mês a mês</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, index) => {
          const rows = attainment.buckets.map((bucket) => ({ bucket, row: bucket.months[index] })).filter((item) => item.row && (item.row.actual > 0 || item.row.target > 0));
          if (!rows.length) return null;
          return <div key={index} className="space-y-3"><p className="text-sm font-semibold">{rows[0]?.row?.label}</p>{rows.map(({ bucket, row }) => row ? <AttainmentBlock key={bucket.id} title={bucket.name} row={row} /> : null)}</div>;
        })}
      </CardContent>
    </Card>
  </div>;
}