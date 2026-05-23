"use client";

import { useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  useEffect(() => {
    // Check if we're back online and reload
    const handleOnline = () => {
      window.location.reload();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
          <WifiOff className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">
          Çevrimdışısınız
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          İnternet bağlantınızı kontrol edin. Bağlantı geri geldiğinde sayfa otomatik yenilenecektir.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </div>
    </div>
  );
}
