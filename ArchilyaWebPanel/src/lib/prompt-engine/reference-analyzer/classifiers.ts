import type { GeometryRisk, ReferenceAnalyzerInput, ReferenceType } from "./types";

const REFERENCE_TYPES: ReadonlySet<string> = new Set([
  "style",
  "material",
  "object",
  "lighting",
  "layout",
  "scene",
]);

const KEYWORD_TYPES: ReadonlyArray<{
  type: ReferenceType;
  keywords: readonly string[];
}> = [
  { type: "material", keywords: ["material", "wood", "stone", "metal", "texture"] },
  { type: "style", keywords: ["style", "design", "aesthetic", "look"] },
  { type: "lighting", keywords: ["lighting", "light", "lamp", "ambient"] },
  { type: "object", keywords: ["furniture", "chair", "table", "sofa", "object"] },
  { type: "layout", keywords: ["layout", "plan", "floorplan", "arrangement"] },
  { type: "scene", keywords: ["scene", "room", "space", "interior"] },
];

function isReferenceType(type: string): type is ReferenceType {
  return REFERENCE_TYPES.has(type);
}

export class ReferenceClassifier {
  classifyReferenceType(input: ReferenceAnalyzerInput): ReferenceType {
    const providedType = input.type?.trim().toLowerCase();

    if (providedType && isReferenceType(providedType)) {
      return providedType;
    }

    const searchableText = `${input.label ?? ""} ${input.note ?? ""}`.toLowerCase();
    const matchedRule = KEYWORD_TYPES.find(({ keywords }) =>
      keywords.some((keyword) => searchableText.includes(keyword)),
    );

    return matchedRule?.type ?? "style";
  }

  assessGeometryRisk(type: ReferenceType): GeometryRisk {
    if (type === "layout" || type === "scene") {
      return "high";
    }

    if (type === "style") {
      return "medium";
    }

    return "low";
  }
}

export function classifyReferenceType(input: ReferenceAnalyzerInput): ReferenceType {
  return new ReferenceClassifier().classifyReferenceType(input);
}

export function assessGeometryRisk(type: ReferenceType): GeometryRisk {
  return new ReferenceClassifier().assessGeometryRisk(type);
}
