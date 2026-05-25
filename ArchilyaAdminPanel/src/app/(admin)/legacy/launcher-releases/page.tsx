"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function LegacyLauncherPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Eski Sistem</p>
        <h1 className="font-serif text-3xl text-white italic">Launcher Surumleri</h1>
      </div>
      <Card>
        <div className="text-center py-10">
          <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <CardTitle>Cok Yakinda</CardTitle>
          <p className="text-sm font-sans text-gray-500 mt-2">
            Launcher surumleri API'si henuz kullanima hazir degil.
          </p>
        </div>
      </Card>
    </div>
  );
}
