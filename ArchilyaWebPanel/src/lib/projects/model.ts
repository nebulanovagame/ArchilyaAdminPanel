import type { ProjectFileCount } from "./types";

export function getDefaultFileCount(): ProjectFileCount {
  return { pdf: 0, dwg: 0, img: 0 };
}

export function getFileTypeKey(fileNameOrType: string) {
  const value = fileNameOrType.toLowerCase();

  if (value.endsWith(".pdf") || value === "pdf") return "pdf" as const;
  if (
    value.endsWith(".dwg")
    || value.endsWith(".dxf")
    || value === "dwg"
    || value === "dxf"
  ) {
    return "dwg" as const;
  }

  return "img" as const;
}

export function formatDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
