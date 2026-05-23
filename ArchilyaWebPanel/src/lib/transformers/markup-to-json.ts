import type { Annotation, Constraint, ConstraintType } from "@/lib/types/markup";

type ConstraintDraft = Pick<Constraint, "annotationId" | "sceneId" | "targetArea" | "description"> & {
  type?: ConstraintType;
  confidence?: number;
};

export function markupToJson(
  annotations: Annotation[],
  constraintDrafts: ConstraintDraft[],
): Constraint[] {
  return annotations.map((annotation) => {
    const draft = constraintDrafts.find((item) => item.annotationId === annotation.id);

    return {
      id: draft ? `constraint-${draft.annotationId}` : `constraint-${annotation.id}`,
      annotationId: annotation.id,
      sceneId: draft?.sceneId ?? "",
      type: draft?.type ?? "CHANGE",
      targetArea: draft?.targetArea || annotation.label || annotation.type,
      description: draft?.description.trim() ?? "",
      confidence: draft?.confidence ?? 0.8,
    };
  });
}
