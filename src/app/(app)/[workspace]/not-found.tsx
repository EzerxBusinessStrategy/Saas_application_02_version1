export default function NotFound() {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <h1 className="text-lg font-semibold">This record is not available</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have moved, been removed, or belong to another tenant.
      </p>
    </div>
  );
}
