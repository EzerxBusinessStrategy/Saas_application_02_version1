import { GravityWellLoader } from "@/components/shared/gravity-well-loader";

export function LoadingState({
  label = "Loading content",
  rows,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="grid min-h-[calc(100vh-10rem)] place-items-center"
      data-loading-rows={rows}
      role="status"
    >
      <GravityWellLoader
        className="h-[min(52vw,24rem)] min-h-[18rem] max-w-2xl"
        label={label}
        particleCount={90}
      />
    </div>
  );
}
