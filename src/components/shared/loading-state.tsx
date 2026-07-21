export function LoadingState({
  label = "Loading content",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div
      className="flex flex-col gap-[30px]"
      aria-label={label}
      aria-busy="true"
    >
      <div className="flex flex-col gap-3">
        <div className="h-4 w-24 animate-pulse rounded-[var(--radius-control)] bg-muted" />
        <div className="h-[34px] w-64 max-w-full animate-pulse rounded-[var(--radius-control)] bg-muted" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded-[var(--radius-control)] bg-muted" />
      </div>
      <div className="overflow-hidden rounded-[var(--radius-card)] border bg-card">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse border-b bg-card last:border-0"
          />
        ))}
      </div>
    </div>
  );
}
