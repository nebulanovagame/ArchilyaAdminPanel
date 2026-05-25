export type AnnotationType = "circle" | "arrow" | "freehand" | "text";

export type MarkupTool = AnnotationType | "eraser";

export type ConstraintType = "CHANGE" | "REMOVE" | "KEEP" | "ADD";

export type AnnotationCoordinates = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  pathData?: string;
  canvasWidth?: number;
  canvasHeight?: number;
};

export interface Annotation {
  id: string;
  type: AnnotationType;
  coordinates: AnnotationCoordinates;
  color: string;
  strokeWidth: number;
  label?: string;
}

export interface Constraint {
  id: string;
  annotationId: string;
  sceneId: string;
  type: ConstraintType;
  targetArea: string;
  description: string;
  confidence: number;
}

export interface MarkupSession {
  id: string;
  activeSceneId: string | null;
  annotations: Annotation[];
  constraints: Constraint[];
  createdAt: number;
  updatedAt: number;
}
