import { Layers3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import type { BucketDefinition } from "@/lib/targets";

type Props = {
  buckets: BucketDefinition[];
  lineOfBusinessOptions: string[];
  onChange: (buckets: BucketDefinition[]) => void;
};

export function BucketConfig({ buckets, lineOfBusinessOptions, onChange }: Props) {
  const setCount = (count: number) => {
    const next = buckets.slice(0, count);
    while (next.length < count) {
      const index = next.length + 1;
      next.push({ id: crypto.randomUUID(), name: `Bolso ${index}`, lineOfBusiness: [] });
    }
    onChange(next);
  };

  const update = (index: number, changes: Partial<BucketDefinition>) => {
    onChange(buckets.map((bucket, itemIndex) => itemIndex === index ? { ...bucket, ...changes } : bucket));
  };

  const assign = (index: number, values: string[]) => {
    const selected = new Set(values.map((value) => value.trim().toLocaleLowerCase("en-US")));
    onChange(buckets.map((bucket, itemIndex) => ({
      ...bucket,
      lineOfBusiness: itemIndex === index
        ? values
        : bucket.lineOfBusiness.filter((value) => !selected.has(value.trim().toLocaleLowerCase("en-US"))),
    })));
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="size-4 text-primary" /> Configuração de bolsos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-xs space-y-2">
          <Label>Quantidade de bolsos</Label>
          <Select value={String(buckets.length)} onValueChange={(value) => setCount(Number(value))}>
            <SelectTrigger aria-label="Quantidade de bolsos"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((count) => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {buckets.map((bucket, index) => (
            <div key={bucket.id} className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor={`bucket-name-${bucket.id}`}>Nome do bolso {index + 1}</Label>
                <Input
                  id={`bucket-name-${bucket.id}`}
                  value={bucket.name}
                  maxLength={40}
                  onChange={(event) => update(index, { name: event.target.value })}
                  onBlur={() => {
                    if (!bucket.name.trim()) update(index, { name: `Bolso ${index + 1}` });
                  }}
                />
              </div>
              <MultiSelectFilter
                label="Line of Business"
                options={lineOfBusinessOptions}
                selected={bucket.lineOfBusiness}
                onChange={(values) => assign(index, values)}
                placeholder="Selecione as linhas de negócio"
                showChips
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}