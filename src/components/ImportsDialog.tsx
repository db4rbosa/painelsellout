import { useRef, useState } from "react";
import { Package, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImportHistoryDialog } from "@/components/ImportHistoryDialog";

export function ImportsDialog({ triggerClassName, busy, catalogStatus, onSales, onProducts }: {
  triggerClassName?: string;
  busy: boolean;
  catalogStatus: string | null;
  onSales: (file: File) => Promise<void>;
  onProducts: (file: File) => Promise<void>;
}) {
  const salesInput = useRef<HTMLInputElement>(null);
  const productsInput = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const run = async (file: File | undefined, handler: (file: File) => Promise<void>) => {
    if (!file) return;
    setRunning(true);
    try { await handler(file); } finally { setRunning(false); }
  };
  const optionClass = "h-auto w-full justify-start gap-3 whitespace-normal rounded-lg p-4 text-left";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName}><Upload className="size-4" /> Importações</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Importações de planilhas</DialogTitle></DialogHeader>
        <input ref={salesInput} type="file" accept=".xlsx,.xls,.csv" aria-label="Importar planilha" className="hidden"
          onChange={(event) => { void run(event.target.files?.[0], onSales); event.target.value = ""; }} />
        <input ref={productsInput} type="file" accept=".xlsx" aria-label="Importar produtos" className="hidden"
          onChange={(event) => { void run(event.target.files?.[0], onProducts); event.target.value = ""; }} />
        <div className="grid gap-3">
          <Button variant="outline" className={optionClass} disabled={busy || running} onClick={() => salesInput.current?.click()}>
            <Upload className="size-5 shrink-0 text-primary" /><span>Importar Planilha de Sellout</span>
          </Button>
          <Button variant="outline" className={optionClass} disabled={busy || running} onClick={() => productsInput.current?.click()}>
            <Package className="size-5 shrink-0 text-primary" /><span>Importar Produtos</span>
          </Button>
          <ImportHistoryDialog triggerClassName={optionClass} />
        </div>
        {running && catalogStatus ? <p role="status" className="text-sm text-muted-foreground">{catalogStatus}</p> : null}
      </DialogContent>
    </Dialog>
  );
}