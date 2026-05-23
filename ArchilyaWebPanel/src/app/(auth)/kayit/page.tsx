"use client";

import { Suspense } from "react";
import RegisterForm from "./register-form";

function RegisterFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-sm p-8 md:p-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded w-1/2" />
            <div className="h-4 bg-white/5 rounded w-3/4" />
            <div className="h-12 bg-white/5 rounded" />
            <div className="h-12 bg-white/5 rounded" />
            <div className="h-12 bg-white/5 rounded" />
            <div className="h-12 bg-primary/20 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
