import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  showChips?: boolean;
};

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Todos",
  showChips = false,
}: Props) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium leading-none">{label}</span>
        {selected.length ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onChange([])}
          >
            limpar
          </button>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            aria-label={`Filtrar por ${label}`}
          >
            <span className="truncate">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? selected[0]
                  : `${selected.length} selecionados`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(420px,90vw)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar em ${label}...`} />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum valor encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const active = selected.includes(opt);
                  return (
                    <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                      <Check className={cn("mr-2 size-4", active ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{opt}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showChips && selected.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[160px] truncate">{s}</span>
              <button
                type="button"
                aria-label={`Remover ${s}`}
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => onChange(selected.filter((v) => v !== s))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
