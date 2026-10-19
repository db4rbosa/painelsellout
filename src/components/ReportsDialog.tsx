import { useState } from "react";
import { FileBarChart2, FileDown, FileText, Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Kind = "executive" | "pdf" | "excel";

export function ReportsDialog({
  triggerClassName,
  onExport,
}: {
  triggerClassName?: string;
  onExport: (kind: Kind) => Promise<void>;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const options: { kind: Kind; icon: typeof FileText; title: string; text: string }[] = [
    {
      kind: "executive",
      icon: FileBarChart2,
      title: "Relatório executivo",
      text: "Resumo em tabelas com destaques, metas, realizado e gap por bolso e quarter.",
    },
    {
      kind: "pdf",
      icon: FileDown,
      title: "Relatório detalhado (PDF)",
      text: "Filtros, accounts por quarter e atingimento mensal e acumulado.",
    },
    {
      kind: "excel",
      icon: Sheet,
      title: "Planilha completa (Excel)",
      text: "Todas as linhas de venda do escopo, uma aba por bolso.",
    },
  ];
  const run = async (kind: Kind) => {
    setBusy(kind);
    try {
      await onExport(kind);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <FileText className="size-4" /> Relatórios
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Relatórios e exportação</DialogTitle>
          <DialogDescription>Gerados com os accounts, filtros e quarters atuais.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {options.map(({ kind, icon: Icon, title, text }) => (
            <button
              key={kind}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(kind)}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent disabled:opacity-60"
            >
              {busy === kind ? (
                <Loader2 className="mt-0.5 size-5 animate-spin text-primary" />
              ) : (
                <Icon className="mt-0.5 size-5 text-primary" />
              )}
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
