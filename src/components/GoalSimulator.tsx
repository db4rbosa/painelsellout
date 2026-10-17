import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { NumberInput } from "@/components/NumberInput";
import { fmtPct, fmtUSD } from "@/lib/sales-data";
import {
  calculateCompensation,
  type CompensationSettings,
} from "@/lib/compensation";
import { compensationMoney } from "@/components/CompensationPanel";
import type {
  AttainmentResult,
  BucketDefinition,
  QuarterValues,
  Targets,
} from "@/lib/targets";
import { cn } from "@/lib/utils";

const QUARTERS = [1, 2, 3, 4] as const;

const toneFor = (value: number | null) =>
  value === null
    ? "text-muted-foreground"
    : value >= 1
      ? "text-[var(--positive)]"
      : value >= 0.8
        ? "text-accent"
        : "text-destructive";

type SimulatedSales = Record<string, QuarterValues>;

const zeroSales = (buckets: BucketDefinition[]): SimulatedSales =>
  Object.fromEntries(buckets.map((bucket) => [bucket.id, [0, 0, 0, 0]]));

const actualSales = (
  buckets: BucketDefinition[],
  annualAttainment: AttainmentResult,
): SimulatedSales =>
  Object.fromEntries(
    buckets.map((bucket) => {
      const data = annualAttainment.buckets.find((item) => item.id === bucket.id);
      return [
        bucket.id,
        [0, 1, 2, 3].map((index) => data?.quarters[index]?.actual ?? 0) as QuarterValues,
      ];
    }),
  );

function buildSimulatedAttainment(
  buckets: BucketDefinition[],
  targets: Targets,
  sales: SimulatedSales,
): AttainmentResult {
  return {
    buckets: buckets.map((bucket) => {
      const quarterTargets = targets.byBucket[bucket.id] ?? [0, 0, 0, 0];
      const values = sales[bucket.id] ?? [0, 0, 0, 0];
      const quarters = QUARTERS.map((quarter) => {
        const actual = values[quarter - 1] ?? 0;
        const target = quarterTargets[quarter - 1] ?? 0;
        return {
          label: `Q${quarter}`,
          actual,
          target,
          attainment: target > 0 ? actual / target : null,
        };
      });
      const actual = quarters.reduce((sum, row) => sum + row.actual, 0);
      const target = quarters.reduce((sum, row) => sum + row.target, 0);
      return {
        id: bucket.id,
        name: bucket.name,
        months: [],
        quarters,
        total: { actual, target, attainment: target > 0 ? actual / target : null },
      };
    }),
  };
}

type Props = {
  buckets: BucketDefinition[];
  targets: Targets;
  compensation: CompensationSettings;
  annualAttainment: AttainmentResult;
};

export function GoalSimulator({ buckets, targets, compensation, annualAttainment }: Props) {
  const [sales, setSales] = useState<SimulatedSales>(() => zeroSales(buckets));

  const setValue = (bucketId: string, quarter: number, value: number) => {
    setSales((current) => {
      const values = [...(current[bucketId] ?? [0, 0, 0, 0])] as QuarterValues;
      values[quarter - 1] = value;
      return { ...current, [bucketId]: values };
    });
  };

  const simulated = useMemo(
    () => buildSimulatedAttainment(buckets, targets, sales),
    [buckets, targets, sales],
  );
  const payments = useMemo(
    () => calculateCompensation(compensation, buckets, simulated),
    [compensation, buckets, simulated],
  );
  const pending = payments.issues.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Simulador de metas</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSales(actualSales(buckets, annualAttainment))}
          >
            Usar realizado atual
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSales(zeroSales(buckets))}
          >
            <RotateCcw /> Limpar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Informe quanto espera vender em cada bolso e quarter. Os quarters pagam no máximo 100%; o
        acelerador vale somente para o ano completo.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vendas esperadas (USD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="space-y-2">
              <p className="text-sm font-medium">{bucket.name}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {QUARTERS.map((quarter) => (
                  <div key={quarter} className="space-y-1.5">
                    <Label htmlFor={`sim-${bucket.id}-q${quarter}`}>Q{quarter}</Label>
                    <NumberInput
                      id={`sim-${bucket.id}-q${quarter}`}
                      value={sales[bucket.id]?.[quarter - 1] ?? 0}
                      onChange={(value) => setValue(bucket.id, quarter, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-label="Atingimento simulado por quarter">
        <h3 className="text-sm font-semibold">Atingimento simulado por quarter</h3>
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUARTERS.map((quarter) => {
            const period = payments.quarters[quarter - 1];
            return (
              <div key={quarter} className="space-y-3 rounded-md border border-border p-4">
                <p className="text-sm font-semibold">Q{quarter}</p>
                {simulated.buckets.map((bucket) => {
                  const row = bucket.quarters[quarter - 1];
                  const payout = period?.details.find((detail) => detail.id === bucket.id);
                  return row ? (
                    <div key={bucket.id} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words text-xs text-muted-foreground">
                          {bucket.name}
                        </span>
                        <span className={cn("font-display text-sm", toneFor(row.attainment))}>
                          {row.attainment === null ? "—" : fmtPct(row.attainment)}
                        </span>
                      </div>
                      <Progress
                        value={row.attainment === null ? 0 : Math.min(row.attainment * 100, 100)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{fmtUSD(row.actual)}</span>
                        <span>
                          A receber{" "}
                          {compensationMoney(pending ? null : (payout?.amount ?? null))}
                        </span>
                      </div>
                    </div>
                  ) : null;
                })}
                <div className="border-t border-border pt-2 text-right">
                  <p className="text-xs text-muted-foreground">Total a receber Q{quarter}</p>
                  <p className="font-display text-base font-semibold tabular-nums text-primary">
                    {compensationMoney(period?.amount ?? null)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-label="Projeção anual simulada">
        <h3 className="text-sm font-semibold">Projeção anual simulada · Q1–Q4</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Soma dos pagamentos trimestrais</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">
              {compensationMoney(payments.quarterlyTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Projeção anual com acelerador</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-primary">
              {compensationMoney(payments.annual.amount)}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {simulated.buckets.map((bucket) => {
            const payout = payments.annual.details.find((detail) => detail.id === bucket.id);
            return (
              <div key={bucket.id} className="rounded-md border border-border bg-muted/30 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words text-sm font-medium">{bucket.name}</span>
                  <span className={cn("font-display text-xl", toneFor(bucket.total.attainment))}>
                    {bucket.total.attainment === null ? "—" : fmtPct(bucket.total.attainment)}
                  </span>
                </div>
                <Progress
                  value={
                    bucket.total.attainment === null
                      ? 0
                      : Math.min(bucket.total.attainment * 100, 100)
                  }
                  className="mt-3"
                />
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>Simulado {fmtUSD(bucket.total.actual)}</span>
                  <span>Meta {fmtUSD(bucket.total.target)}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Payout {payout?.rate === null || !payout ? "—" : fmtPct(payout.rate)}</span>
                  <span>
                    A receber {compensationMoney(pending ? null : (payout?.amount ?? null))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {pending ? (
          <p className="text-xs text-muted-foreground">
            Configure salário QAF, OPI, distribuição dos quarters e pesos dos bolsos nas
            configurações para ver os valores a receber.
          </p>
        ) : null}
      </section>
    </div>
  );
}
