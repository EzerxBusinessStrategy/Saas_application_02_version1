import type { ReactNode } from "react";

type ChartTooltipItem = {
  color?: string;
  name?: string | number;
  value?: string | number;
};

export const chartAxisTick = {
  fill: "var(--muted-foreground)",
  fontSize: 12,
};
export const chartTooltipCursor = false;

const numberFormatter = new Intl.NumberFormat("en-US");

export function ChartTooltipContent({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: ReactNode;
  payload?: ChartTooltipItem[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="min-w-32 rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-[var(--shadow-card)]"
      data-testid="chart-tooltip"
    >
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => (
          <div
            key={`${item.name ?? "value"}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name ?? "Value"}
            </span>
            <span className="font-medium tabular-nums">
              {typeof item.value === "number"
                ? numberFormatter.format(item.value)
                : (item.value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
