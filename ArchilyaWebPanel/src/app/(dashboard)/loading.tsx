export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-screen animate-pulse">
      {/* Header skeleton */}
      <div className="h-14 border-b border-white/5 bg-[#0a0c0f] flex items-center px-6 gap-4">
        <div className="w-5 h-5 bg-white/5 rounded-sm" />
        <div className="w-32 h-3 bg-white/5 rounded-sm" />
        <div className="ml-auto flex items-center gap-3">
          <div className="w-20 h-6 bg-white/5 rounded-sm" />
          <div className="w-20 h-6 bg-white/5 rounded-sm" />
          <div className="w-7 h-7 rounded-full bg-white/5" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-40 bg-white/5 rounded-sm" />
          <div className="h-40 bg-white/5 rounded-sm" />
          <div className="h-40 bg-white/5 rounded-sm" />
        </div>
        <div className="h-64 bg-white/5 rounded-sm" />
      </div>
    </div>
  );
}
