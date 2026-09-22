export function SalesAnalystMark({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex size-10 items-end justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 p-2 ${className}`}
    >
      <span className="h-2 w-1.5 rounded-sm bg-accent" />
      <span className="h-4 w-1.5 rounded-sm bg-primary" />
      <span className="h-6 w-1.5 rounded-sm bg-positive" />
    </div>
  );
}