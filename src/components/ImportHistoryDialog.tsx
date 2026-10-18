import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  getImportDownloadUrl,
  listImportHistory,
  type ImportHistoryEntry,
} from "@/lib/dashboard-state.functions";
import { fmtUSD } from "@/lib/sales-data";

const num = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const size = (b: number) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ImportHistoryDialog({ triggerClassName }: { triggerClassName?: string }) {
  const fetchHistory = useServerFn(listImportHistory);
  const fetchDownload = useServerFn(getImportDownloadUrl);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ImportHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (id: string) => {
    setDownloading(id);
    setError("");
    try {
      const { url } = await fetchDownload({ data: { id } });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível baixar a planilha.");
    } finally {
      setDownloading(null);
    }
  };

  const openDialog = async () => {
    setOpen(true);
    setError("");
    setItems(null);
    try {
      setItems(await fetchHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
      setItems([]);
    }
  };

  return (
    <>
      <Button variant="outline" className={triggerClassName} onClick={() => void openDialog()}>
        <History className="size-4" /> Histórico
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Histórico de importações</DialogTitle>
            <DialogDescription>
              Auditoria de cada planilha enviada. A primeira linha é a base ativa no painel.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {items === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : !items.length && !error ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma importação registrada ainda. As próximas aparecerão aqui.
            </p>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead className="text-right">Linhas válidas</TableHead>
                    <TableHead className="text-right">Excluídas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {when(item.createdAt)}
                        {index === 0 ? (
                          <Badge className="ml-2" variant="secondary">
                            Ativa
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal break-words">
                        {item.downloadable ? (
                          <button
                            type="button"
                            className="text-left font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
                            disabled={downloading === item.id}
                            onClick={() => void download(item.id)}
                            title="Baixar planilha"
                          >
                            {item.fileName}
                            {downloading === item.id ? (
                              <Loader2 className="ml-1 inline size-3 animate-spin" />
                            ) : null}
                          </button>
                        ) : (
                          <span title="Arquivo não disponível para download">{item.fileName}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {size(item.fileSize)}
                        </span>
                      </TableCell>
                      <TableCell>{item.uploadedBy || "—"}</TableCell>
                      <TableCell className="text-right">{num(item.validRows)}</TableCell>
                      <TableCell className="text-right">
                        {item.excludedRows ? (
                          <span className="text-destructive">{num(item.excludedRows)}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmtUSD(item.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
