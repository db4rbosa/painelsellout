import { useMemo } from "react";
import { Building2, Layers3, Package, ReceiptText } from "lucide-react";
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
import { normalizePn } from "@/lib/product-catalog";
import { EvolutionChart } from "@/components/EvolutionChart";
import {
  quarterRangeLabel,
  summarizeEndUserPartnumbers,
  summarizePartnumberDetails,
  type PartnumberGroup,
} from "@/lib/partnumber-details";
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
  descriptions?: Map<string, string>;
  onOpenChange: (open: boolean) => void;
};

const fmtQty = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export function GroupDetailsDialog({ selection, rows, descriptions, onOpenChange }: Props) {
  const selectedRows = useMemo(
    () =>
      selection
        ? rows.filter((row) => {
            if (row[selection.dimension] !== selection.value) return false;
            return selection.account === undefined || row.account === selection.account;
          }).map((row) => {
            const description = descriptions?.get(normalizePn(row.sku));
            return description ? { ...row, description } : row;
          })
        : [],
    [rows, selection, descriptions],
  );
  const monthly = useMemo(
    () => buildSeries(selectedRows, "lob", "month", "revenue", 8),
    [selectedRows],
  );
  const revenue = useMemo(() => sum(selectedRows), [selectedRows]);
  const quantity = useMemo(() => sum(selectedRows, "quantity"), [selectedRows]);
  const partnumberGroups = useMemo(() => summarizePartnumberDetails(selectedRows), [selectedRows]);
  const byEndUser = selection !== null;
  const customerGroups = useMemo(
    () => (byEndUser ? summarizeEndUserPartnumbers(selectedRows) : []),
    [byEndUser, selectedRows],
  );
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
                <h3 className="font-semibold">Itens Vendidos Por Part Number</h3>
                <div className="flex gap-2">
                  {byEndUser ? (
                    <Badge variant="secondary">{customerGroups.length} clientes finais</Badge>
                  ) : null}
                  <Badge variant="secondary">{partnumberGroups.length} part numbers</Badge>
                </div>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col />
                    <col className="w-[14%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarter</TableHead>
                      <TableHead>LOB</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byEndUser
                      ? customerGroups.map((customer) => (
                          <CustomerSection
                            key={JSON.stringify([customer.endUser, customer.account])}
                            customer={customer}
                          />
                        ))
                      : partnumberGroups.map((group) => (
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

function CustomerSection({
  customer,
}: {
  customer: ReturnType<typeof summarizeEndUserPartnumbers>[number];
}) {
  return (
    <>
      <TableRow className="bg-primary/15 hover:bg-primary/15">
        <TableCell colSpan={2} className="font-bold">
          <span className="flex min-w-0 items-center gap-2" title={`${customer.endUser} · ${customer.account}`}>
            <Building2 className="size-4 shrink-0 text-primary" />
            <span className="truncate">{customer.endUser}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">· {customer.account}</span>
          </span>
        </TableCell>
        <TableCell className="text-right font-bold">{fmtQty(customer.totalQuantity)}</TableCell>
        <TableCell className="whitespace-nowrap text-right font-bold">{fmtUSD(customer.totalRevenue)}</TableCell>
      </TableRow>
      {customer.partnumbers.map((group) => (
        <PartnumberSection key={group.sku} group={group} />
      ))}
    </>
  );
}

function PartnumberSection({ group }: { group: PartnumberGroup }) {
  const label = group.description ? `${group.sku} | ${group.description}` : group.sku;
  return (
    <>
      <TableRow className="bg-accent/40 hover:bg-accent/40">
        <TableCell colSpan={4} className="max-w-0 font-semibold">
          <span className="flex min-w-0 items-center gap-2" title={label}>
            <Package className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
        </TableCell>
      </TableRow>
      {group.rows.map((quarter) => (
        <TableRow key={JSON.stringify([quarter.fiscalQuarter, quarter.lob])}>
          <TableCell className="whitespace-nowrap">Q{quarter.fiscalQuarter}</TableCell>
          <TableCell className="truncate">{quarter.lob}</TableCell>
          <TableCell className="text-right">{fmtQty(quarter.quantity)}</TableCell>
          <TableCell className="whitespace-nowrap text-right">{fmtUSD(quarter.revenue)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="border-t-2 border-border bg-muted font-semibold hover:bg-muted">
        <TableCell className="whitespace-nowrap">{quarterRangeLabel(group)} · Total</TableCell>
        <TableCell className="truncate">{group.lobs.join(" · ")}</TableCell>
        <TableCell className="text-right">{fmtQty(group.totalQuantity)}</TableCell>
        <TableCell className="whitespace-nowrap text-right">{fmtUSD(group.totalRevenue)}</TableCell>
      </TableRow>
    </>
  );
}
