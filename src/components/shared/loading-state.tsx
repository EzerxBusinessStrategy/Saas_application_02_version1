import { BoxBuildLoader } from "@/components/shared/box-build-loader";

export function LoadingState({
  label = "Loading content",
  rows,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div data-loading-rows={rows}>
      <BoxBuildLoader
        className="min-h-[calc(100vh-10rem)]"
        label={label}
        variant="page"
      />
    </div>
  );
}
