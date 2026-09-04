import { Input } from "@/components/ui/input";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

const parse = (raw: string): number => {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits.length) return 0;
  return Number(digits);
};

type Props = {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
};

export function NumberInput({ id, value, onChange, placeholder = "0" }: Props) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      maxLength={20}
      value={value ? fmt(value) : ""}
      placeholder={placeholder}
      onChange={(e) => onChange(parse(e.target.value))}
    />
  );
}
