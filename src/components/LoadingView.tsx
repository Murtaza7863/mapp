export function LoadingView({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="border-rule h-7 w-7 animate-spin rounded-full border-2 border-t-mark" />
      <p className="text-muted text-xs">{label}</p>
    </div>
  );
}
