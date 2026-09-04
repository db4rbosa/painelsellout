import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Target, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvolutionChart } from "@/components/EvolutionChart";
import { TargetPanel } from "@/components/TargetPanel";
import {
  DIMENSIONS,
  buildSeries,
  fmtUSD,
  parseWorkbook,
  sum,
  uniqueValues,
  type DimensionKey,
  type Granularity,
  type SalesRow,
} from "@/lib/sales-data";
import { buildAttainment, emptyTargets, loadTargets, saveTargets, type Targets } from "@/lib/targets";

const PERSON_DIMS: DimensionKey[] = ["account", "cbm"];

export function SalesDashboard() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [personDim, setPersonDim] = useState<DimensionKey>("account");
  const [person, setPerson] = useState<string>("");
  const [onlyMine, setOnlyMine] = useState(true);

  const [groupBy, setGroupBy] = useState<DimensionKey | "none">("lob");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [metric, setMetric] = useState<"revenue" | "quantity">("revenue");
  const [chartType, setChartType] = useState<"area" | "line" | "bar">("area");
  const [stacked, setStacked] = useState(true);
  const [topN, setTopN] = useState(8);

  const [targets, setTargets] = useState<Targets>(emptyTargets());

  useEffect(() => {
    if (person) setTargets(loadTargets(person));
  }, [person]);

  const people = useMemo(() => (rows.length ? uniqueValues(rows, personDim) : []), [rows, personDim]);

  useEffect(() => {
    if (people.length && !people.includes(person)) setPerson(people[0] ?? "");
  }, [people, person]);

  const scopedRows = useMemo(
    () => (onlyMine && person ? rows.filter((r) => r[personDim] === person) : rows),
    [rows, onlyMine, person, personDim],
  );

  const myRows = useMemo(
    () => (person ? rows.filter((r) => r[personDim] === person) : []),
    [rows, person, personDim],
  );

  const series = useMemo(
    () => buildSeries(scopedRows, groupBy, granularity, metric, topN),
    [scopedRows, groupBy, granularity, metric, topN],
  );

  const ranking = useMemo(() => {
    if (groupBy === "none") return [];
    const map = new Map<string, { revenue: number; quantity: number; lines: number }>();
    for (const r of scopedRows) {
      const k = r[groupBy];
      const cur = map.get(k) ?? { revenue: 0, quantity: 0, lines: 0 };
      cur.revenue += r.revenue;
      cur.quantity += r.quantity;
      cur.lines += 1;
      map.set(k, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 25);
  }, [scopedRows, groupBy]);

  const attainment = useMemo(() => buildAttainment(myRows, targets), [myRows, targets]);

  const totalRevenue = useMemo(() => sum(scopedRows), [scopedRows]);
  const totalQty = useMemo(() => sum(scopedRows, "quantity"), [scopedRows]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.length) throw new Error("Nenhuma linha válida encontrada na planilha.");
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const updateTargets = (t: Targets) => {
    setTargets(t);
    if (person) saveTargets(person, t);
  };

  const valueFormatter = (v: number) =>
    metric === "revenue" ? fmtUSD(v) : `${new Intl.NumberFormat("pt-BR").format(v)} un.`;

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Sales Out · Fiscal Analytics
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Painel de Sell-Out e Metas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Importe sua planilha de sales out, agrupe por qualquer dimensão, acompanhe a evolução e
            compare o atingimento contra suas metas anual e trimestral.
          </p>
        </div>
        <label className="relative cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="Importar planilha"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Upload className="size-4" />
            {rows.length ? "Trocar planilha" : "Importar planilha"}
          </span>
        </label>
      </header>

      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <X className="size-4" /> {error}
        </div>
      ) : null}

      {!rows.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BarChart3 className="size-10 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">
                {loading ? "Lendo planilha..." : "Comece importando o arquivo de Sales Out"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Formatos .xlsx, .xls ou .csv. O processamento acontece no seu navegador — nada é
                enviado para servidores.
              </p>
            </div>
            <label className="relative cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Selecionar arquivo da planilha"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="size-4" /> Selecionar arquivo
              </span>
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Receita no escopo", value: fmtUSD(totalRevenue) },
              { label: "Quantidade", value: new Intl.NumberFormat("pt-BR").format(totalQty) },
              { label: "Linhas importadas", value: new Intl.NumberFormat("pt-BR").format(rows.length) },
              { label: "Arquivo", value: fileName },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="py-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="mt-1 truncate font-display text-xl font-semibold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="size-4 text-primary" /> Escopo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Campo de vendedor</Label>
                <Select
                  value={personDim}
                  onValueChange={(v) => setPersonDim(v as DimensionKey)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_DIMS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DIMENSIONS.find((x) => x.key === d)?.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meu nome</Label>
                <Select value={person} onValueChange={setPerson}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Switch id="mine" checked={onlyMine} onCheckedChange={setOnlyMine} />
                <Label htmlFor="mine" className="cursor-pointer">
                  Gráficos apenas com minha carteira
                </Label>
                <Badge variant="secondary">
                  {onlyMine ? `${scopedRows.length} linhas` : "todas as linhas"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="evolucao">
            <TabsList>
              <TabsTrigger value="evolucao">
                <BarChart3 className="mr-2 size-4" /> Evolução
              </TabsTrigger>
              <TabsTrigger value="metas">
                <Target className="mr-2 size-4" /> Metas e atingimento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="evolucao" className="mt-6 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Configuração do gráfico</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="space-y-2 xl:col-span-2">
                    <Label>Agrupar por</Label>
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as DimensionKey)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem agrupamento (total)</SelectItem>
                        {DIMENSIONS.map((d) => (
                          <SelectItem key={d.key} value={d.key}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Período</Label>
                    <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Mês</SelectItem>
                        <SelectItem value="quarter">Quarter</SelectItem>
                        <SelectItem value="week">Semana fiscal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Métrica</Label>
                    <Select value={metric} onValueChange={(v) => setMetric(v as "revenue")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita (USD)</SelectItem>
                        <SelectItem value="quantity">Quantidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={chartType} onValueChange={(v) => setChartType(v as "area")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="area">Área</SelectItem>
                        <SelectItem value="line">Linha</SelectItem>
                        <SelectItem value="bar">Barras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Top séries</Label>
                    <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 5, 8, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            Top {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 md:col-span-3 xl:col-span-6">
                    <Switch id="stack" checked={stacked} onCheckedChange={setStacked} />
                    <Label htmlFor="stack" className="cursor-pointer">
                      Empilhar séries
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Evolução ·{" "}
                    {groupBy === "none"
                      ? "total"
                      : DIMENSIONS.find((d) => d.key === groupBy)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EvolutionChart
                    data={series.data}
                    keys={series.keys}
                    type={chartType}
                    stacked={stacked}
                    valueFormatter={valueFormatter}
                  />
                </CardContent>
              </Card>

              {ranking.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Ranking por {DIMENSIONS.find((d) => d.key === groupBy)?.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Qtd.</TableHead>
                          <TableHead className="text-right">Linhas</TableHead>
                          <TableHead className="text-right">% do total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ranking.map((r, i) => (
                          <TableRow key={r.name}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="max-w-[380px] truncate font-medium">
                              {r.name}
                            </TableCell>
                            <TableCell className="text-right">{fmtUSD(r.revenue)}</TableCell>
                            <TableCell className="text-right">{r.quantity}</TableCell>
                            <TableCell className="text-right">{r.lines}</TableCell>
                            <TableCell className="text-right">
                              {totalRevenue > 0
                                ? `${((r.revenue / totalRevenue) * 100).toFixed(1)}%`
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="metas" className="mt-6">
              <TargetPanel
                person={person || "—"}
                targets={targets}
                onChange={updateTargets}
                attainment={attainment}
              />
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Real vs. meta acumulada</CardTitle>
                </CardHeader>
                <CardContent>
                  <EvolutionChart
                    data={attainment.months
                      .filter((m) => m.actual > 0 || m.target > 0)
                      .map((m) => ({
                        period: m.label,
                        Real: Math.round(m.actual),
                        Meta: Math.round(m.target),
                      }))}
                    keys={["Real", "Meta"]}
                    type="bar"
                    stacked={false}
                    valueFormatter={fmtUSD}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}
