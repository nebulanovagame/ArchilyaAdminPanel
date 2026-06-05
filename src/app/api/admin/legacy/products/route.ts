import "server-only";
import { NextResponse } from "next/server";

// Legacy data — Supabase'de legacy tablosu yok, bos dizi don
export async function GET() {
  return NextResponse.json({ data: [] });
}
