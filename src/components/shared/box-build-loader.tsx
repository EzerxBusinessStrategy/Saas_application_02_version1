import { cn } from "@/lib/utils";

export function BoxBuildLoader({
  label = "Loading content",
  className,
  variant = "page",
}: {
  label?: string;
  className?: string;
  variant?: "page" | "panel";
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={cn("box-build-loader", `box-build-loader--${variant}`, className)}
      role="status"
    >
      <div aria-hidden="true" className="box-build-loader__scene">
        <div className="box-build-loader__ground"><div /></div>
        {Array.from({ length: 8 }, (_, index) => (
          <div className={`box-build-loader__box box-build-loader__box--${index}`} key={index}>
            <div />
          </div>
        ))}
      </div>
      <p className="box-build-loader__label">{label}</p>
    </div>
  );
}
