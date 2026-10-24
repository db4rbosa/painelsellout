import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, Trash2 } from "lucide-react";
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
  deleteImport,
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
  const removeImport = useServerFn(deleteImport);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ImportHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ImportHistoryEntry | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setDeleting(item.id);
    setError("");
    try {
      await removeImport({ data: { id: item.id } });
      setItems((previous) => previous?.filter((entry) => entry.id !== item.id) ?? []);
      setPendingDelete(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível excluir a planilha.");
    } finally { setDeleting(null); }
  };

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
              Sellout e produtos. A planilha de vendas ativa é preservada na limpeza.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {pendingDelete ? (
            <div role="alert" className="space-y-3 border-b border-border pb-4">
              <p className="break-words text-sm">Excluir “{pendingDelete.fileName}” e seu registro do histórico? O arquivo será removido para todos os usuários. Os dados de produtos já importados serão mantidos.</p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={deleting !== null} onClick={() => setPendingDelete(null)}>Cancelar</Button>
                <Button variant="destructive" disabled={deleting !== null} onClick={() => void confirmDelete()}>
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir planilha
                </Button>
              </div>
            </div>
          ) : null}
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Enviado por</TableHead>
                    <TableHead className="text-right">Linhas válidas</TableHead>
                    <TableHead className="text-right">Excluídas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Limpeza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {when(item.createdAt)}
                        {item.active ? (
                          <Badge className="ml-2" variant="secondary">
                            Ativa
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal break-words">
                        {item.downloadable ? (
                           <Button
                             variant="link"
                            type="button"
                             className="h-auto max-w-full whitespace-normal p-0 text-left font-medium"
                            disabled={downloading === item.id}
                            onClick={() => void download(item.id)}
                            title="Baixar planilha"
                          >
                            {item.fileName}
                            {downloading === item.id ? (
                              <Loader2 className="ml-1 inline size-3 animate-spin" />
                            ) : null}
                           </Button>
                        ) : (
                          <span title="Arquivo não disponível para download">{item.fileName}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {size(item.fileSize)}
                        </span>
                      </TableCell>
                      <TableCell>{item.kind === "products" ? "Produtos" : "Sellout"}</TableCell>
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
                        {item.kind === "products" ? "—" : fmtUSD(item.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" aria-label={`Excluir ${item.fileName}`}
                          title={item.active ? "Importe outra planilha antes de excluir a ativa" : "Excluir planilha"}
                          disabled={item.active || deleting !== null} onClick={() => setPendingDelete(item)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
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
