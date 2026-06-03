export function TripCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden animate-pulse">
      <div className="h-44 bg-slate-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-800 rounded w-3/4" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 bg-slate-800 rounded-xl flex-1" />
          <div className="h-8 bg-slate-800 rounded-xl flex-1" />
          <div className="h-8 bg-slate-800 rounded-xl w-10" />
        </div>
      </div>
    </div>
  );
}

export function PhotoGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function UploadAreaSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900 animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 mb-3" />
      <div className="h-4 bg-slate-800 rounded w-32 mb-1" />
      <div className="h-3 bg-slate-800 rounded w-48" />
    </div>
  );
}
