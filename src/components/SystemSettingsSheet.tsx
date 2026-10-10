import { useState } from "react";
import { Check, Filter, Loader2, Save, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BucketConfig } from "@/components/BucketConfig";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FILTER_DIMS, FILTER_LABELS, emptyFilters, type Filters } from "@/lib/sales-data";
import type { BucketDefinition } from "@/lib/targets";
import { CompensationSettings } from "@/components/CompensationSettings";
import type { CompensationSettings as PayoutSettings } from "@/lib/compensation";

type Props = {
  triggerClassName?: string;
  accounts: string[];
  accountOptions: string[];
  filters: Filters;
  filterOptions: Record<(typeof FILTER_DIMS)[number], string[]>;
  buckets: BucketDefinition[];
  lineOfBusinessOptions: string[];
  scopedLineCount: number;
  onAccountsChange: (accounts: string[]) => void;
  onFiltersChange: (filters: Filters) => void;
  onBucketsChange: (buckets: BucketDefinition[]) => void;
  compensation: PayoutSettings;
  onCompensationChange: (settings: PayoutSettings) => void;
  onSave: () => Promise<void>;
};

function SaveSection({ name, onSave }: { name: string; onSave: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
    <span role="status" className={state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
      {state === "saved" ? "Configurações salvas na sua conta." : state === "error" ? "Não foi possível salvar. Tente novamente." : ""}
    </span>
    <Button variant="outline" disabled={state === "saving"} onClick={async () => {
      setState("saving");
      try { await onSave(); setState("saved"); } catch { setState("error"); }
    }} aria-label={`Salvar ${name}`}>
      {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : state === "saved" ? <Check className="size-4" /> : <Save className="size-4" />} Salvar
    </Button>
  </div>;
}

export function SystemSettingsSheet({
  triggerClassName,
  accounts,
  accountOptions,
  filters,
  filterOptions,
  buckets,
  lineOfBusinessOptions,
  scopedLineCount,
  onAccountsChange,
  onFiltersChange,
  onBucketsChange,
  compensation,
  onCompensationChange,
  onSave,
}: Props) {
  const hasFilters = accounts.length > 0 || FILTER_DIMS.some((key) => filters[key].length > 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <Settings2 className="size-4" /> Configurações
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" /> Configurações do Sistema
          </SheetTitle>
          <SheetDescription>
              Configurações pessoais da sua conta.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-102px)]">
          <div className="space-y-6 p-6">
            <section className="space-y-4" aria-labelledby="scope-settings-title">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="scope-settings-title" className="flex items-center gap-2 font-semibold">
                  <Filter className="size-4 text-primary" /> Escopo e filtros
                </h2>
                <Badge variant="secondary">{scopedLineCount} linhas no escopo</Badge>
                {hasFilters ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      onAccountsChange([]);
                      onFiltersChange(emptyFilters());
                    }}
                  >
                    Limpar tudo
                  </Button>
                ) : null}
              </div>
              <MultiSelectFilter
                label="Accounts (vendedores)"
                options={accountOptions}
                selected={accounts}
                onChange={onAccountsChange}
                placeholder="Todos os accounts"
                showChips
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {FILTER_DIMS.map((key) => (
                  <MultiSelectFilter
                    key={key}
                    label={FILTER_LABELS[key]}
                    options={filterOptions[key]}
                    selected={filters[key]}
                    onChange={(values) => onFiltersChange({ ...filters, [key]: values })}
                  />
                ))}
              </div>
              <SaveSection name="escopo e filtros" onSave={onSave} />
            </section>
            <Separator />
            <BucketConfig
              buckets={buckets}
              lineOfBusinessOptions={lineOfBusinessOptions}
              onChange={onBucketsChange}
            />
            <SaveSection name="bolsos" onSave={onSave} />
            <Separator />
            <CompensationSettings value={compensation} buckets={buckets} onChange={onCompensationChange} />
            <SaveSection name="valores a receber" onSave={onSave} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
