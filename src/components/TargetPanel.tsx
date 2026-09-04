import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { NumberInput } from "@/components/NumberInput";
import { fmtPct, fmtUSD } from "@/lib/sales-data";
import type { AttainmentRow, Targets } from "@/lib/targets";

const toneFor = (a: number | null) =>
  a === null
    ? "text-muted-foreground"
    : a >= 1
      ? "text-[var(--positive)]"
      : a >= 0.8
        ? "text-accent"
        : "text-destructive";

function AttainmentCard({ row, big = false }: { row: AttainmentRow; big?: boolean }) {
  const pct = row.attainment === null ? 0 : Math.min(row.attainment * 100, 100);
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{row.label}</span>
        <span className={`font-display ${big ? "text-2xl" : "text-lg"} ${toneFor(row.attainment)}`}>
          {row.attainment === null ? "—" : fmtPct(row.attainment)}
        </span>
      </div>
      <Progress value={pct} className="mt-3 h-2" />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Real {fmtUSD(row.actual)}</span>
        <span>Meta {fmtUSD(row.target)}</span>
      </div>
    </div>
  );
}

type Props = {
  accounts: string[];
  targets: Targets;
  onChange: (t: Targets) => void;
  attainment: {
    months: AttainmentRow[];
    quarters: AttainmentRow[];
    halves: AttainmentRow[];
    fullYear: AttainmentRow;
  };
};

export function TargetPanel({ accounts, targets, onChange, attainment }: Props) {
  const quartersSum = targets.quarters.reduce((a, b) => a + b, 0);
  const monthsWithData = attainment.months.filter((m) => m.actual > 0 || m.target > 0);
  const groupLabel = accounts.length ? accounts.join(" + ") : "todos os accounts";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas do grupo</CardTitle>
          <p className="text-sm text-muted-foreground">{groupLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="annual">Meta anual (USD)</Label>
            <NumberInput
              id="annual"
              value={targets.annual}
              onChange={(v) => onChange({ ...targets, annual: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {targets.quarters.map((q, i) => (
              <div key={i} className="space-y-2">
                <Label htmlFor={`q${i}`}>Meta Q{i + 1}</Label>
                <NumberInput
                  id={`q${i}`}
                  value={q}
                  onChange={(v) => {
                    const quarters = [...targets.quarters] as Targets["quarters"];
                    quarters[i] = v;
                    onChange({ ...targets, quarters });
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            onClick={() => {
              const per = Math.round((targets.annual || 0) / 4);
              onChange({ ...targets, quarters: [per, per, per, per] });
            }}
          >
            Distribuir meta anual entre os quarters
          </button>
          <p className="text-xs text-muted-foreground">
            Soma dos quarters: {fmtUSD(quartersSum)}
            {targets.annual > 0 && quartersSum !== targets.annual
              ? ` · diferença de ${fmtUSD(targets.annual - quartersSum)} vs. meta anual`
              : ""}
            . A meta mensal é a meta do quarter dividida por 3. Valores salvos automaticamente neste
            navegador.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {attainment.halves.map((h) => (
            <AttainmentCard key={h.label} row={h} big />
          ))}
          <AttainmentCard row={attainment.fullYear} big />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atingimento por quarter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {attainment.quarters.map((q) => (
              <AttainmentCard key={q.label} row={q} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atingimento mês a mês</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(monthsWithData.length ? monthsWithData : attainment.months).map((m) => (
              <AttainmentCard key={m.label} row={m} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
