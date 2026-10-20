import { useMemo } from "react";
import { Layers3, Package, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvolutionChart } from "@/components/EvolutionChart";
import { quarterRangeLabel, summarizePartnumberDetails } from "@/lib/partnumber-details";
import {
  DIMENSIONS,
  buildSeries,
  fmtUSD,
  sum,
  type DimensionKey,
  type SalesRow,
} from "@/lib/sales-data";

export type GroupDetailSelection = {
  dimension: DimensionKey;
  value: string;
  account?: string;
} | null;

type Props = {
  selection: GroupDetailSelection;
  rows: SalesRow[];
  onOpenChange: (open: boolean) => void;
};

const fmtQty = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export function GroupDetailsDialog({ selection, rows, onOpenChange }: Props) {
  const selectedRows = useMemo(
    () =>
      selection
        ? rows.filter((row) => {
            if (row[selection.dimension] !== selection.value) return false;
            return selection.account === undefined || row.account === selection.account;
          })
        : [],
    [rows, selection],
  );
  const monthly = useMemo(
    () => buildSeries(selectedRows, "lob", "month", "revenue", 8),
    [selectedRows],
  );
  const revenue = useMemo(() => sum(selectedRows), [selectedRows]);
  const quantity = useMemo(() => sum(selectedRows, "quantity"), [selectedRows]);
  const partnumberGroups = useMemo(() => summarizePartnumberDetails(selectedRows), [selectedRows]);
  const dimensionLabel = selection
    ? DIMENSIONS.find((dimension) => dimension.key === selection.dimension)?.label
    : undefined;

  return (
    <Dialog open={selection !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
          <DialogTitle>{selection?.value ?? "Detalhes das vendas"}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Layers3 className="size-4" /> {dimensionLabel ?? "Agrupamento"}
            {selection?.account ? ` · Account: ${selection.account}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 max-h-[calc(92vh-88px)] overflow-y-auto">
          <div className="space-y-6 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase text-muted-foreground">Receita</p>
                  <p className="mt-1 text-xl font-semibold">{fmtUSD(revenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase text-muted-foreground">Quantidade</p>
                  <p className="mt-1 text-xl font-semibold">{fmtQty(quantity)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs uppercase text-muted-foreground">Linhas de venda</p>
                  <p className="mt-1 text-xl font-semibold">{selectedRows.length}</p>
                </CardContent>
              </Card>
            </div>

            <section>
              <h3 className="mb-3 font-semibold">Evolução mensal por Line of Business</h3>
              <EvolutionChart
                data={monthly.data}
                keys={monthly.keys}
                type="line"
                stacked={false}
                valueFormatter={fmtUSD}
              />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">Itens vendidos por partnumber</h3>
                <Badge variant="secondary">{partnumberGroups.length} partnumbers</Badge>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead>LOB</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnumberGroups.map((group) => (
                      <PartnumberSection key={group.sku} group={group} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!partnumberGroups.length ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <ReceiptText className="size-4" /> Nenhuma linha encontrada.
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PartnumberSection({ group }: { group: ReturnType<typeof summarizePartnumberDetails>[number] }) {
  return (
    <>
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={5} className="font-semibold">
          <span className="flex items-center gap-2">
            <Package className="size-3.5 shrink-0 text-muted-foreground" />
            Partnumber&nbsp;{group.sku}
          </span>
        </TableCell>
      </TableRow>
      {group.rows.map((period) => (
        <TableRow
          key={JSON.stringify([period.fiscalYear, period.fiscalQuarter, period.fiscalWeek, period.lob])}
        >
          <TableCell className="whitespace-nowrap">{period.fiscalWeek}</TableCell>
          <TableCell className="whitespace-nowrap">Q{period.fiscalQuarter}</TableCell>
          <TableCell>{period.lob}</TableCell>
          <TableCell className="whitespace-nowrap text-right">{fmtUSD(period.revenue)}</TableCell>
          <TableCell className="text-right">{fmtQty(period.quantity)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t-2 border-border font-semibold">
        <TableCell>Total</TableCell>
        <TableCell className="whitespace-nowrap">{quarterRangeLabel(group)}</TableCell>
        <TableCell>{group.lobs.join(" · ")}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{fmtUSD(group.totalRevenue)}</TableCell>
        <TableCell className="text-right">{fmtQty(group.totalQuantity)}</TableCell>
      </TableRow>
    </>
  );
}
