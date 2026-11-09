import { Activity, CalendarRange, Crown, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtUSD } from "@/lib/sales-data";
import type { ExecutiveHighlights as Highlights, GoalHealth } from "@/lib/executive-highlights";

const pct = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(v);

const HEALTH: Record<
  GoalHealth,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  above: { label: "Superando", variant: "default" },
  onTrack: { label: "No ritmo", variant: "secondary" },
  attention: { label: "Atenção", variant: "destructive" },
  noTarget: { label: "Sem meta", variant: "outline" },
};

function Item({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-2 py-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="size-4 text-primary" /> {title}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

export function ExecutiveHighlights({ data }: { data: Highlights }) {
  const health = HEALTH[data.health];
  return (
    <section aria-label="Destaques executivos" className="mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Destaques executivos
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Item icon={Target} title="Saúde da meta">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-xl font-semibold">
              {data.attainment === null ? "—" : pct(data.attainment)}
            </p>
            <Badge variant={health.variant}>{health.label}</Badge>
          </div>
          {data.bucketHealth.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {data.bucketHealth.map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <strong>{b.name}</strong> ·{" "}
                    {b.attainment === null ? "—" : pct(b.attainment)}
                  </span>
                  <Badge variant={HEALTH[b.health].variant} className="shrink-0">
                    {HEALTH[b.health].label}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Informe metas para acompanhar o gap</p>
          )}
        </Item>
        <Item icon={Activity} title="Bolsos em destaque">
          {data.leader ? (
            <>
              <p className="truncate text-sm">
                <span className="text-muted-foreground">Líder: </span>
                <strong>{data.leader.name}</strong> · {pct(data.leader.attainment)}
              </p>
              {data.laggard ? (
                <p className="truncate text-sm">
                  <span className="text-muted-foreground">Prioridade: </span>
                  <strong>{data.laggard.name}</strong> · {pct(data.laggard.attainment)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem metas por bolso informadas</p>
          )}
        </Item>
        <Item icon={Crown} title="Principais clientes">
          {data.topCustomers.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {data.topCustomers.map((c, i) => (
                <li key={`${c.account}-${c.name}`} className="truncate text-sm" title={c.name}>
                  <span className="text-muted-foreground">{i + 1}. </span>
                  <strong>{c.name}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · {fmtUSD(c.revenue)} · {pct(c.share)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vendas no escopo</p>
          )}
        </Item>
        <Item icon={CalendarRange} title="Picos de vendas">
          {data.peakMonths.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {data.peakMonths.map((m, i) => (
                <li key={m.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    <span className="text-muted-foreground">{i + 1}. </span>
                    <strong>{m.label}</strong>
                  </span>
                  <span className="text-muted-foreground">{fmtUSD(m.revenue)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Sem vendas no escopo</p>
          )}
        </Item>
      </div>
    </section>
  );
}
