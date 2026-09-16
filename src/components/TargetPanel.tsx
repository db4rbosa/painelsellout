import { Check, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { NumberInput } from "@/components/NumberInput";
import { fmtPct, fmtUSD } from "@/lib/sales-data";
import type {
  AttainmentResult,
  AttainmentRow,
  QuarterAccounts,
  Targets,
} from "@/lib/targets";
import { cn } from "@/lib/utils";

const QUARTERS = [1, 2, 3, 4] as const;

const toneFor = (attainment: number | null) =>
  attainment === null
    ? "text-muted-foreground"
    : attainment >= 1
      ? "text-[var(--positive)]"
      : attainment >= 0.8
        ? "text-accent"
        : "text-destructive";

function AttainmentBlock({ title, row }: { title: string; row: AttainmentRow }) {
  const percent = row.attainment === null ? 0 : Math.min(row.attainment * 100, 100);
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className={cn("font-display text-xl", toneFor(row.attainment))}>
          {row.attainment === null ? "—" : fmtPct(row.attainment)}
        </span>
      </div>
      <Progress value={percent} className="mt-3" />
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Real {fmtUSD(row.actual)}</span>
        <span>Meta {fmtUSD(row.target)}</span>
      </div>
    </div>
  );
}

type Props = {
  accountOptions: string[];
  selectedQuarters: number[];
  onSelectedQuartersChange: (quarters: number[]) => void;
  accountsByQuarter: QuarterAccounts;
  onAccountsByQuarterChange: (quarter: number, accounts: string[]) => void;
  targets: Targets;
  onChange: (targets: Targets) => void;
  attainment: AttainmentResult;
};

export function TargetPanel({
  accountOptions,
  selectedQuarters,
  onSelectedQuartersChange,
  accountsByQuarter,
  onAccountsByQuarterChange,
  targets,
  onChange,
  attainment,
}: Props) {
  const toggleQuarter = (quarter: number) => {
    const next = selectedQuarters.includes(quarter)
      ? selectedQuarters.filter((value) => value !== quarter)
      : [...selectedQuarters, quarter].sort();
    if (next.length) onSelectedQuartersChange(next);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quarters avaliados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUARTERS.map((quarter) => {
              const active = selectedQuarters.includes(quarter);
              return (
                <Button
                  key={quarter}
                  type="button"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleQuarter(quarter)}
                  aria-pressed={active}
                >
                  {active ? <Check /> : null} Q{quarter}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {selectedQuarters.map((quarter) => {
          const index = quarter - 1;
          const general = attainment.quarters[index];
          const services = attainment.servicesQuarters[index];
          if (!general || !services) return null;
          return (
            <Card key={quarter}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers3 className="size-4 text-primary" /> Q{quarter}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <MultiSelectFilter
                  label={`Accounts do Q${quarter}`}
                  options={accountOptions}
                  selected={accountsByQuarter[quarter] ?? []}
                  onChange={(values) => {
                    if (values.length) onAccountsByQuarterChange(quarter, values);
                  }}
                  placeholder="Selecione ao menos um account"
                  showChips
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`target-q${quarter}`}>Meta geral Q{quarter} (USD)</Label>
                    <NumberInput
                      id={`target-q${quarter}`}
                      value={targets.quarters[index] ?? 0}
                      onChange={(value) => {
                        const quarters = [...targets.quarters] as Targets["quarters"];
                        quarters[index] = value;
                        onChange({ ...targets, quarters });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`services-q${quarter}`}>Meta de Serviços Q{quarter} (USD)</Label>
                    <NumberInput
                      id={`services-q${quarter}`}
                      value={targets.servicesQuarters[index] ?? 0}
                      onChange={(value) => {
                        const servicesQuarters = [
                          ...targets.servicesQuarters,
                        ] as Targets["servicesQuarters"];
                        servicesQuarters[index] = value;
                        onChange({ ...targets, servicesQuarters });
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AttainmentBlock title="Atingimento geral" row={general} />
                  <AttainmentBlock title="Atingimento de Serviços" row={services} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total dos quarters selecionados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <AttainmentBlock title="Total geral" row={{ label: "Total", ...attainment.total }} />
          <AttainmentBlock
            title="Total de Serviços"
            row={{ label: "Services", ...attainment.servicesTotal }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atingimento mês a mês</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {attainment.months
            .filter((month) => month.actual > 0 || month.target > 0)
            .map((month) => (
              <AttainmentBlock key={month.label} title={month.label} row={month} />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}