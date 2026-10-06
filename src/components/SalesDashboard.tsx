import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Building2,
  FileDown,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareText,
  Sheet,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import {
  GroupDetailsDialog,
  type GroupDetailSelection,
} from "@/components/GroupDetailsDialog";
import { SystemSettingsSheet } from "@/components/SystemSettingsSheet";
import {
  DIMENSIONS,
  FILTER_DIMS,
  buildSeries,
  emptyFilters,
  filterRows,
  fmtUSD,
  parseWorkbook,
  preloadWorkbookParser,
  sum,
  uniqueValues,
  type DimensionKey,
  type Filters,
  type Granularity,
  type SalesRow,
  type SeriesPoint,
} from "@/lib/sales-data";
import {
  buildAttainment,
  emptyTargets,
  groupKey,
  type BucketDefinition,
  type QuarterAccounts,
  type Targets,
} from "@/lib/targets";
import { defaultPrefs, normalizePrefs, type DashboardPrefs } from "@/lib/prefs";
import { buildSalesReport, downloadReportExcel, downloadReportPdf } from "@/lib/report-export";
import { logout } from "@/lib/gate.functions";
import {
  createWorkbookUpload,
  getDashboardState,
  registerWorkbook,
  saveDashboardPrefs,
} from "@/lib/dashboard-state.functions";
import { supabase } from "@/integrations/supabase/client";

export type AccessInfo = {
  kind: "master" | "user";
  name: string;
  email: string;
  isAdmin: boolean;
};

export function SalesDashboard({ access }: { access: AccessInfo }) {
  const headerActionClass = "h-11 w-full min-w-0 px-3";
  const router = useRouter();
  const doLogout = useServerFn(logout);
  const loadState = useServerFn(getDashboardState);
  const savePrefs = useServerFn(saveDashboardPrefs);
  const prepareUpload = useServerFn(createWorkbookUpload);
  const saveWorkbook = useServerFn(registerWorkbook);

  const [rows, setRows] = useState<SalesRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [accounts, setAccounts] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters());

  const [groupBy, setGroupBy] = useState<DimensionKey | "none">("lob");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [metric, setMetric] = useState<"revenue" | "quantity">("revenue");
  const [chartType, setChartType] = useState<"area" | "line" | "bar">("area");
  const [stacked, setStacked] = useState(true);
  const [topN, setTopN] = useState(8);
  const [buckets, setBuckets] = useState<BucketDefinition[]>(defaultPrefs().buckets);
  const [targetsByGroup, setTargetsByGroup] = useState<Record<string, Targets>>({});
  const [selectedQuarters, setSelectedQuarters] = useState<number[]>([1, 2, 3, 4]);
  const [accountsByQuarter, setAccountsByQuarter] = useState<QuarterAccounts>({});
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupDetailSelection>(null);

  const currentGroupKey = groupKey(accounts);
  const targets = targetsByGroup[currentGroupKey] ?? emptyTargets(buckets);

  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) idle(() => void preloadWorkbookParser());
    else {
      const t = window.setTimeout(() => void preloadWorkbookParser(), 300);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, []);

  const applyPrefs = useCallback((prefs: DashboardPrefs) => {
    setAccounts(prefs.accounts);
    setFilters(prefs.filters);
    setGroupBy(prefs.groupBy);
    setGranularity(prefs.granularity);
    setMetric(prefs.metric);
    setChartType(prefs.chartType);
    setStacked(prefs.stacked);
    setTopN(prefs.topN);
    setBuckets(prefs.buckets);
    setTargetsByGroup(prefs.targetsByGroup);
    setSelectedQuarters(prefs.selectedQuarters);
    setAccountsByQuarter(prefs.accountsByQuarter);
  }, []);

  // Restaura a última configuração do usuário e a última planilha importada.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await loadState();
        if (cancelled) return;
        applyPrefs(normalizePrefs(state.prefs));

        if (state.workbook) {
          setFileName(state.workbook.fileName);
          const res = await fetch(state.workbook.url);
          if (!res.ok) throw new Error("Não foi possível baixar a última planilha.");
          const blob = await res.blob();
          const parsed = await parseWorkbook(
            new File([blob], state.workbook.fileName, { type: blob.type }),
          );
          if (!cancelled && parsed.length) setRows(parsed);
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a última planilha salva.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPrefs, loadState]);

  // Salva a configuração atual (com atraso, para não gravar a cada clique).
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return undefined;
    const prefs: DashboardPrefs = {
      ...defaultPrefs(),
      accounts,
      filters,
      groupBy,
      granularity,
      metric,
      chartType,
      stacked,
      topN,
      buckets,
      targetsByGroup,
      selectedQuarters,
      accountsByQuarter,
    };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSavingState(true);
      void savePrefs({ data: { prefs } })
        .catch(() => undefined)
        .finally(() => setSavingState(false));
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [
    ready,
    accounts,
    filters,
    groupBy,
    granularity,
    metric,
    chartType,
    stacked,
    topN,
    buckets,
    targetsByGroup,
    selectedQuarters,
    accountsByQuarter,
    savePrefs,
  ]);

  const accountOptions = useMemo(() => (rows.length ? uniqueValues(rows, "account") : []), [rows]);

  const targetAccountOptions = useMemo(
    () =>
      accounts.length
        ? accountOptions.filter((account) => accounts.includes(account))
        : accountOptions,
    [accountOptions, accounts],
  );

  const lineOfBusinessOptions = useMemo(
    () => (rows.length ? uniqueValues(rows, "lob") : []),
    [rows],
  );

  useEffect(() => {
    if (!ready || !targetAccountOptions.length) return;
    const allowed = new Set(targetAccountOptions);
    setAccountsByQuarter((previous) => {
      let changed = false;
      const next: QuarterAccounts = { ...previous };
      for (const quarter of [1, 2, 3, 4]) {
        const current = previous[quarter] ?? [];
        const valid = current.filter((account) => allowed.has(account));
        const resolved = valid.length ? valid : targetAccountOptions;
        if (
          resolved.length !== current.length ||
          resolved.some((account, index) => account !== current[index])
        ) {
          next[quarter] = resolved;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [ready, targetAccountOptions]);

  const scopedRows = useMemo(() => filterRows(rows, accounts, filters), [rows, accounts, filters]);

  const filterOptions = useMemo(() => {
    const base = filterRows(rows, accounts, emptyFilters());
    return Object.fromEntries(
      FILTER_DIMS.map((k) => {
        const others: Filters = { ...emptyFilters(), ...filters, [k]: [] };
        return [k, uniqueValues(filterRows(base, [], others), k)];
      }),
    ) as Record<(typeof FILTER_DIMS)[number], string[]>;
  }, [rows, accounts, filters]);

  const series = useMemo(
    () => buildSeries(scopedRows, groupBy, granularity, metric, topN),
    [scopedRows, groupBy, granularity, metric, topN],
  );

  const ranking = useMemo(() => {
    if (groupBy === "none" || groupBy === "endUser") return [];
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

  const customerRanking = useMemo(() => {
    if (groupBy !== "endUser") return [];
    const accountsMap = new Map<
      string,
      Map<string, { revenue: number; quantity: number; lines: number }>
    >();
    for (const row of scopedRows) {
      const customers = accountsMap.get(row.account) ?? new Map();
      const current = customers.get(row.endUser) ?? { revenue: 0, quantity: 0, lines: 0 };
      current.revenue += row.revenue;
      current.quantity += row.quantity;
      current.lines += 1;
      customers.set(row.endUser, current);
      accountsMap.set(row.account, customers);
    }
    return [...accountsMap.entries()]
      .map(([account, customers]) => {
        const items = [...customers.entries()]
          .map(([name, values]) => ({ name, ...values }))
          .sort((a, b) => b.revenue - a.revenue);
        return {
          account,
          revenue: items.reduce((total, item) => total + item.revenue, 0),
          items,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [scopedRows, groupBy]);

  const attainment = useMemo(
    () => buildAttainment(scopedRows, targets, buckets, selectedQuarters, accountsByQuarter),
    [scopedRows, targets, buckets, selectedQuarters, accountsByQuarter],
  );

  const report = useMemo(
    () =>
      buildSalesReport({
        fileName,
        accounts,
        allAccountOptions: targetAccountOptions,
        filters,
        selectedQuarters,
        accountsByQuarter,
        buckets,
        attainment,
      }),
    [
      fileName,
      accounts,
      targetAccountOptions,
      filters,
      selectedQuarters,
      accountsByQuarter,
      buckets,
      attainment,
    ],
  );

  const cumulativeAttainment = useMemo(() => {
    const totals = new Map(
      attainment.buckets.map((bucket) => [bucket.id, { actual: 0, target: 0 }]),
    );
    return Array.from({ length: 12 }, (_, index) => {
      const point: SeriesPoint = {
        period: attainment.buckets[0]?.months[index]?.label ?? String(index + 1),
      };
      let visible = false;
      for (const bucket of attainment.buckets) {
        const month = bucket.months[index];
        const total = totals.get(bucket.id);
        if (!month || !total) continue;
        total.actual += month.actual;
        total.target += month.target;
        point[`${bucket.name} · realizado`] = Math.round(total.actual);
        point[`${bucket.name} · meta`] = Math.round(total.target);
        if (month.actual > 0 || month.target > 0) visible = true;
      }
      return visible ? point : null;
    }).filter((point): point is SeriesPoint => point !== null);
  }, [attainment]);

  const totalRevenue = useMemo(() => sum(scopedRows), [scopedRows]);
  const totalQty = useMemo(() => sum(scopedRows, "quantity"), [scopedRows]);
  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setLoading(true);
    setError("");
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.length) throw new Error("Nenhuma linha válida encontrada na planilha.");
      // Mantém a configuração atual: tudo é recalculado com os filtros e metas já salvos.
      setRows(parsed);
      setFileName(file.name);

      const upload = await prepareUpload({ data: { fileName: file.name } });
      const { error: uploadError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, file);
      if (uploadError) throw new Error("A planilha foi lida, mas não pôde ser salva na nuvem.");
      await saveWorkbook({
        data: { path: upload.path, fileName: file.name, fileSize: file.size },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const updateTargets = (t: Targets) => {
    setTargetsByGroup((prev) => ({ ...prev, [currentGroupKey]: t }));
  };

  const updateQuarterAccounts = (quarter: number, quarterAccounts: string[]) => {
    setAccountsByQuarter((previous) => ({ ...previous, [quarter]: quarterAccounts }));
  };

  const handleLogout = async () => {
    if (access.kind === "master") await doLogout();
    else await supabase.auth.signOut();
    await router.invalidate();
    await router.navigate({ to: "/unlock", replace: true });
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    setError("");
    try {
      await downloadReportPdf(report);
    } catch {
      setError("Não foi possível gerar o relatório em PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExcelExport = async () => {
    setExportingExcel(true);
    setError("");
    try {
      await downloadReportExcel(report, scopedRows, accountsByQuarter);
    } catch {
      setError("Não foi possível gerar a planilha em Excel.");
    } finally {
      setExportingExcel(false);
    }
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
            Olá, {access.name}. Sua última configuração e a última planilha importada são
            restauradas automaticamente.{" "}
            {savingState ? <span className="text-primary">Salvando…</span> : null}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[repeat(2,11.5rem)] xl:grid-cols-[repeat(3,11.5rem)]">
          <SystemSettingsSheet
            triggerClassName={headerActionClass}
            accounts={accounts}
            accountOptions={accountOptions}
            filters={filters}
            filterOptions={filterOptions}
            buckets={buckets}
            lineOfBusinessOptions={lineOfBusinessOptions}
            scopedLineCount={scopedRows.length}
            onAccountsChange={setAccounts}
            onFiltersChange={setFilters}
            onBucketsChange={setBuckets}
          />
          {rows.length ? (
            <>
              <Button
                variant="outline"
                className={headerActionClass}
                onClick={handleExcelExport}
                disabled={exportingExcel}
              >
                {exportingExcel ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sheet className="size-4" />
                )}
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                className={headerActionClass}
                onClick={handlePdfExport}
                disabled={exportingPdf}
              >
                {exportingPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                Exportar PDF
              </Button>
            </>
          ) : null}
          <label
            className="relative block w-full cursor-pointer"
            onPointerEnter={() => void preloadWorkbookParser()}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label="Importar planilha"
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onFocus={() => void preloadWorkbookParser()}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className={buttonVariants({ className: headerActionClass })}>
              <Upload className="size-4" />
              {rows.length ? "Trocar planilha" : "Importar planilha"}
            </span>
          </label>
          {access.isAdmin ? (
            <Button variant="outline" className={headerActionClass} asChild>
              <Link to="/usuarios">
                <Users className="size-4" /> Usuários
              </Link>
            </Button>
          ) : null}
          {access.kind === "user" ? (
            <>
              <Button variant="outline" className={headerActionClass} asChild>
                <Link to="/analises">
                  <MessageSquareText className="size-4" /> Análises com IA
                </Link>
              </Button>
              <ChangePasswordDialog
                email={access.email}
                trigger={
                  <Button variant="outline" className={headerActionClass}>
                    <KeyRound className="size-4" /> Alterar senha
                  </Button>
                }
              />
            </>
          ) : null}
          <Button variant="outline" className={headerActionClass} onClick={handleLogout}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
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
                Formatos .xlsx, .xls ou .csv. A planilha fica salva e volta a carregar sozinha no
                próximo acesso.
              </p>
            </div>
            <label
              className="relative cursor-pointer"
              onPointerEnter={() => void preloadWorkbookParser()}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Selecionar arquivo da planilha"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onFocus={() => void preloadWorkbookParser()}
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
              {
                label: "Linhas importadas",
                value: new Intl.NumberFormat("pt-BR").format(rows.length),
              },
              { label: "Arquivo", value: fileName },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="py-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="mt-1 truncate font-display text-xl font-semibold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

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
                    <Select
                      value={groupBy}
                      onValueChange={(value) => {
                        setSelectedGroupDetail(null);
                        setGroupBy(value as DimensionKey | "none");
                      }}
                    >
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
                    <Select
                      value={granularity}
                      onValueChange={(v) => setGranularity(v as Granularity)}
                    >
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
                            <TableCell className="max-w-[380px]">
                              <Button
                                variant="link"
                                className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                                onClick={() => {
                                  if (groupBy === "none") return;
                                  setSelectedGroupDetail({ dimension: groupBy, value: r.name });
                                }}
                              >
                                {r.name}
                              </Button>
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

              {customerRanking.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking por Cliente Final</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {customerRanking.map((accountGroup) => (
                      <section key={accountGroup.account}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <Building2 className="size-4 text-primary" /> {accountGroup.account}
                          </h3>
                          <Badge variant="secondary">
                            {accountGroup.items.length} clientes · {fmtUSD(accountGroup.revenue)}
                          </Badge>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Cliente Final</TableHead>
                                <TableHead className="text-right">Receita</TableHead>
                                <TableHead className="text-right">Qtd.</TableHead>
                                <TableHead className="text-right">Linhas</TableHead>
                                <TableHead className="text-right">% do Account</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {accountGroup.items.map((customer, index) => (
                                <TableRow key={`${accountGroup.account}-${customer.name}`}>
                                  <TableCell className="text-muted-foreground">
                                    {index + 1}
                                  </TableCell>
                                  <TableCell className="max-w-[380px]">
                                    <Button
                                      variant="link"
                                      className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                                      onClick={() =>
                                        setSelectedGroupDetail({
                                          dimension: "endUser",
                                          account: accountGroup.account,
                                          value: customer.name,
                                        })
                                      }
                                    >
                                      {customer.name}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {fmtUSD(customer.revenue)}
                                  </TableCell>
                                  <TableCell className="text-right">{customer.quantity}</TableCell>
                                  <TableCell className="text-right">{customer.lines}</TableCell>
                                  <TableCell className="text-right">
                                    {accountGroup.revenue > 0
                                      ? `${((customer.revenue / accountGroup.revenue) * 100).toFixed(1)}%`
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </section>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="metas" className="mt-6">
              <TargetPanel
                accountOptions={targetAccountOptions}
                buckets={buckets}
                selectedQuarters={selectedQuarters}
                onSelectedQuartersChange={setSelectedQuarters}
                accountsByQuarter={accountsByQuarter}
                onAccountsByQuarterChange={updateQuarterAccounts}
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
                    data={cumulativeAttainment}
                    keys={attainment.buckets.flatMap((bucket) => [
                      `${bucket.name} · realizado`,
                      `${bucket.name} · meta`,
                    ])}
                    type="line"
                    stacked={false}
                    valueFormatter={fmtUSD}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      <GroupDetailsDialog
        selection={selectedGroupDetail}
        rows={scopedRows}
        onOpenChange={(open) => {
          if (!open) setSelectedGroupDetail(null);
        }}
      />
    </main>
  );
}
