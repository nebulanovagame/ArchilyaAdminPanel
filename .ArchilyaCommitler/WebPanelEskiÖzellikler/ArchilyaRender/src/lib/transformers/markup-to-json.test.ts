import { describe, expect, it } from "vitest";

import { markupToJson } from "@/lib/transformers/markup-to-json";
import type { Annotation } from "@/lib/types/markup";

describe("markupToJson", () => {
  const annotations: Annotation[] = [
    {
      id: "annotation-1",
      type: "circle",
      coordinates: { x: 10, y: 10, width: 30, height: 30 },
      color: "#FF4757",
      strokeWidth: 4,
      label: "circle",
    },
    {
      id: "annotation-2",
      type: "rectangle",
      coordinates: { x: 50, y: 50, width: 100, height: 80 },
      color: "#6C63FF",
      strokeWidth: 2,
      label: "rectangle",
    },
  ];

  it("maps annotations to constraints with default values", () => {
    const result = markupToJson(annotations, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      annotationId: "annotation-1",
      sceneId: "",
      type: "CHANGE",
      targetArea: "circle",
      description: "",
      confidence: 0.8,
    });
  });

  it("uses draft values when provided", () => {
    const drafts = [
      {
        annotationId: "annotation-1",
        sceneId: "scene-1",
        type: "REMOVE" as const,
        targetArea: "Duvar",
        description: "  Kırmızı duvar boyanacak  ",
        confidence: 0.95,
      },
    ];

    const result = markupToJson(annotations, drafts);
    expect(result[0]).toMatchObject({
      annotationId: "annotation-1",
      sceneId: "scene-1",
      type: "REMOVE",
      targetArea: "Duvar",
      description: "Kırmızı duvar boyanacak",
      confidence: 0.95,
    });
  });

  it("generates constraint id from annotation id", () => {
    const result = markupToJson(annotations, []);
    expect(result[0].id).toBe("constraint-annotation-1");
    expect(result[1].id).toBe("constraint-annotation-2");
  });

  it("uses annotation type as fallback for targetArea", () => {
    const annotationsWithoutLabel: Annotation[] = [
      {
        id: "annotation-3",
        type: "arrow",
        coordinates: { x: 0, y: 0, width: 10, height: 10 },
        color: "#000",
        strokeWidth: 1,
      },
    ];

    const result = markupToJson(annotationsWithoutLabel, []);
    expect(result[0].targetArea).toBe("arrow");
  });

  it("handles empty annotations array", () => {
    const result = markupToJson([], []);
    expect(result).toHaveLength(0);
  });

  it("trims description whitespace", () => {
    const drafts = [
      {
        annotationId: "annotation-1",
        sceneId: "scene-1",
        description: "  Leading and trailing spaces  ",
      },
    ];

    const result = markupToJson(annotations, drafts);
    expect(result[0].description).toBe("Leading and trailing spaces");
  });

  it("uses default confidence when not provided", () => {
    const result = markupToJson(annotations, []);
    expect(result[0].confidence).toBe(0.8);
  });
});
