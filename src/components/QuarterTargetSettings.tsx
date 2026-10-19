import { Target } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { NumberInput } from "@/components/NumberInput";
import type { BucketDefinition, QuarterAccounts, QuarterValues, Targets } from "@/lib/targets";

type Props = {
  accountOptions: string[];
  accountsByQuarter: QuarterAccounts;
  onAccountsChange: (quarter: number, accounts: string[]) => void;
  buckets: BucketDefinition[];
  targets: Targets;
  onTargetsChange: (targets: Targets) => void;
};

export function QuarterTargetSettings({
  accountOptions,
  accountsByQuarter,
  onAccountsChange,
  buckets,
  targets,
  onTargetsChange,
}: Props) {
  return (
    <section className="space-y-4" aria-labelledby="quarter-settings-title">
      <h2 id="quarter-settings-title" className="flex items-center gap-2 font-semibold">
        <Target className="size-4 text-primary" /> Accounts e metas por quarter
      </h2>
      <Tabs defaultValue="1" className="space-y-4">
        <TabsList className="grid h-11 w-full grid-cols-4">
          {[1, 2, 3, 4].map((quarter) => (
            <TabsTrigger key={quarter} value={String(quarter)}>Q{quarter}</TabsTrigger>
          ))}
        </TabsList>
        {[1, 2, 3, 4].map((quarter) => (
          <TabsContent key={quarter} value={String(quarter)} className="space-y-4">
            <MultiSelectFilter
              label={`Accounts do Q${quarter}`}
              options={accountOptions}
              selected={accountsByQuarter[quarter] ?? []}
              onChange={(values) => { if (values.length) onAccountsChange(quarter, values); }}
              placeholder="Selecione ao menos um account"
              showChips
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {buckets.map((bucket) => (
                <div key={bucket.id} className="min-w-0 space-y-2">
                  <Label className="break-words" htmlFor={`target-${bucket.id}-q${quarter}`}>
                    Meta {bucket.name} · Q{quarter} (USD)
                  </Label>
                  <NumberInput
                    id={`target-${bucket.id}-q${quarter}`}
                    value={targets.byBucket[bucket.id]?.[quarter - 1] ?? 0}
                    onChange={(value) => {
                      const values: QuarterValues = [...(targets.byBucket[bucket.id] ?? [0, 0, 0, 0])];
                      values[quarter - 1] = value;
                      onTargetsChange({ ...targets, byBucket: { ...targets.byBucket, [bucket.id]: values } });
                    }}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}