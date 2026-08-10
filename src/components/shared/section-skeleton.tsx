import { GravityWellLoader } from "@/components/shared/gravity-well-loader";

export function SectionSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading section"
      className="grid min-h-[calc(100vh-10rem)] place-items-center"
      role="status"
    >
      <GravityWellLoader
        className="h-[min(52vw,24rem)] min-h-[18rem] max-w-2xl"
        label="Preparing this section..."
        particleCount={90}
      />
    </div>
  );
}
