"use client";

import { useEffect } from "react";

export default function LegacyAbonelikCallbackPage() {
  useEffect(() => {
    window.location.replace(`/abonelik${window.location.search}`);
  }, []);

  return null;
}
