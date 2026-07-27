export function LoadingView({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="border-white/10 h-7 w-7 animate-spin rounded-full border-2 border-t-[#8b7cf8]" />
      <p className="text-zinc-500 text-xs">{label}</p>
    </div>
  );
}
