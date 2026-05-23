"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Canvas, Circle, FabricImage, FabricText, Group, Line, Path, PencilBrush, Triangle } from "fabric";
import type { FabricObject } from "fabric";

import { useMarkupContext } from "@/stores/markup-store";
import type { Annotation, AnnotationType } from "@/lib/types/markup";

type FabricCanvasProps = {
  sceneId: string;
  sceneImagePreview: string | null;
};

export type FabricCanvasHandle = {
  exportCanvas: () => string;
};

type PointerPoint = { x: number; y: number };
type FabricPointerEvent = MouseEvent | TouchEvent | PointerEvent;

function createAnnotationId() {
  return `annotation-${crypto.randomUUID()}`;
}

function toAnnotation(
  type: AnnotationType,
  point: PointerPoint,
  color: string,
  strokeWidth: number,
  canvasSize: { width: number; height: number },
  width = 0,
  height = 0,
): Annotation {
  return {
    id: createAnnotationId(),
    type,
    coordinates: { x: point.x, y: point.y, width, height, canvasWidth: canvasSize.width, canvasHeight: canvasSize.height },
    color,
    strokeWidth,
    label: type,
  };
}

function scaleAnnotation(annotation: Annotation, canvasSize: { width: number; height: number }) {
  const sourceWidth = annotation.coordinates.canvasWidth || canvasSize.width;
  const sourceHeight = annotation.coordinates.canvasHeight || canvasSize.height;
  return {
    x: canvasSize.width / sourceWidth,
    y: canvasSize.height / sourceHeight,
  };
}

function buildObjectFromAnnotation(annotation: Annotation, canvasSize: { width: number; height: number }) {
  const { x, y, width = 0, height = 0 } = annotation.coordinates;
  const scale = scaleAnnotation(annotation, canvasSize);

  if (annotation.type === "freehand" && annotation.coordinates.pathData) {
    const path = new Path(annotation.coordinates.pathData, {
      fill: "transparent",
      stroke: annotation.color,
      strokeWidth: annotation.strokeWidth,
    });
    path.set({
      left: (path.left ?? 0) * scale.x,
      top: (path.top ?? 0) * scale.y,
      scaleX: scale.x,
      scaleY: scale.y,
    });
    return path;
  }

  if (annotation.type === "circle") {
    return new Circle({
      left: x * scale.x,
      top: y * scale.y,
      radius: Math.max(Math.abs(width * scale.x), Math.abs(height * scale.y), 24) / 2,
      fill: "transparent",
      stroke: annotation.color,
      strokeWidth: annotation.strokeWidth,
    });
  }

  if (annotation.type === "arrow") {
    const line = new Line([x * scale.x, y * scale.y, (x + width) * scale.x, (y + height) * scale.y], {
      stroke: annotation.color,
      strokeWidth: annotation.strokeWidth,
    });
    const head = new Triangle({
      left: (x + width) * scale.x,
      top: (y + height) * scale.y,
      width: annotation.strokeWidth * 4,
      height: annotation.strokeWidth * 4,
      fill: annotation.color,
      angle: (Math.atan2(height, width) * 180) / Math.PI + 90,
      originX: "center",
      originY: "center",
    });
    return new Group([line, head]);
  }

  if (annotation.type === "text") {
    return new FabricText(annotation.label || "Metin", {
      left: x * scale.x,
      top: y * scale.y,
      fill: annotation.color,
      fontSize: 22,
      fontFamily: "Montserrat, sans-serif",
    });
  }

  return new Path(`M ${x * scale.x} ${y * scale.y} L ${(x + Math.max(width, 24)) * scale.x} ${(y + Math.max(height, 24)) * scale.y}`, {
    fill: "transparent",
    stroke: annotation.color,
    strokeWidth: annotation.strokeWidth,
  });
}

const FabricCanvas = forwardRef<FabricCanvasHandle, FabricCanvasProps>(
  ({ sceneId, sceneImagePreview }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasElementRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);
    const startPointRef = useRef<PointerPoint | null>(null);
    const sceneIdRef = useRef(sceneId);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [containerWidth, setContainerWidth] = useState(0);
    const [photoAspectRatio, setPhotoAspectRatio] = useState(0.65);
    const {
      annotations,
      constraints,
      selectedTool,
      color,
      strokeWidth,
      addAnnotation,
      removeAnnotation,
    } = useMarkupContext();

    useEffect(() => {
      sceneIdRef.current = sceneId;
    }, [sceneId]);

    useImperativeHandle(ref, () => ({
      exportCanvas: () =>
        fabricCanvasRef.current?.toDataURL({ format: "png", multiplier: 1 }) ?? "",
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(([entry]) => {
        const width = Math.max(320, Math.round(entry.contentRect.width));
        setContainerWidth(width);
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (containerWidth > 0) {
        // p-3 padding (12px each side) is already excluded by contentRect
        setCanvasSize({
          width: containerWidth,
          height: Math.round(containerWidth * photoAspectRatio),
        });
      }
    }, [containerWidth, photoAspectRatio]);

    useEffect(() => {
      if (!canvasElementRef.current) return;

      const canvas = new Canvas(canvasElementRef.current, {
        backgroundColor: "transparent",
        width: canvasSize.width,
        height: canvasSize.height,
        enablePointerEvents: true,
      });

      fabricCanvasRef.current = canvas;

      return () => {
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    }, [canvasSize.height, canvasSize.width]);

    // Effect 1: load + scale background image whenever the scene or canvas size changes.
    // Intentionally does NOT depend on annotations/constraints to avoid full reload on every draw.
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || canvasSize.width === 0) return;

      let isActive = true;

      if (!sceneImagePreview) {
        canvas.backgroundImage = undefined;
        canvas.requestRenderAll();
        return undefined;
      }

      void FabricImage.fromURL(sceneImagePreview, { crossOrigin: "anonymous" }).then((image) => {
        if (!isActive) return;

        const el = image.getElement();
        // Prefer Fabric's own tracked dimensions; fall back to HTMLImageElement.naturalWidth
        const naturalWidth =
          (image.width ?? 0) ||
          (el instanceof HTMLImageElement ? el.naturalWidth : 0) ||
          canvasSize.width;
        const naturalHeight =
          (image.height ?? 0) ||
          (el instanceof HTMLImageElement ? el.naturalHeight : 0) ||
          canvasSize.height;

        // Update aspect ratio so the canvas height adjusts to match the photo
        if (naturalWidth > 0 && naturalHeight > 0) {
          setPhotoAspectRatio(naturalHeight / naturalWidth);
        }

        // Scale image to fill the canvas while preserving aspect ratio
        const scale = Math.min(
          canvasSize.width / naturalWidth,
          canvasSize.height / naturalHeight,
        );
        image.set({
          originX: "left",
          originY: "top",
          left: Math.round((canvasSize.width - naturalWidth * scale) / 2),
          top: Math.round((canvasSize.height - naturalHeight * scale) / 2),
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });

        canvas.backgroundImage = image;
        canvas.requestRenderAll();
      });

      return () => {
        isActive = false;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasSize.width, canvasSize.height, sceneId, sceneImagePreview]);

    // Effect 2: re-render annotation objects when annotations/constraints change.
    // Does NOT touch the background image — only adds/removes annotation objects.
    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || canvasSize.width === 0) return;

      // Remove all existing annotation objects from canvas
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => (obj.get("data") as { annotationId?: string } | undefined)?.annotationId);
      objectsToRemove.forEach((obj) => canvas.remove(obj));

      const activeAnnotationIds = new Set(
        constraints
          .filter((constraint) => constraint.sceneId === sceneId)
          .map((constraint) => constraint.annotationId),
      );

      annotations
        .filter((annotation) => activeAnnotationIds.has(annotation.id))
        .forEach((annotation) => {
          const object = buildObjectFromAnnotation(annotation, canvasSize);
          object.set("data", { annotationId: annotation.id });
          canvas.add(object);
        });

      canvas.requestRenderAll();
    }, [annotations, constraints, sceneId, canvasSize]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      canvas.isDrawingMode = selectedTool === "freehand";
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = strokeWidth;
      }
      canvas.selection = selectedTool === "eraser";
    }, [selectedTool, color, strokeWidth]);

    useEffect(() => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const handlePathCreated = (event: { path?: FabricObject }) => {
        const path = event.path;
        if (!(path instanceof Path)) return;

        const annotation: Annotation = {
          id: createAnnotationId(),
          type: "freehand",
          coordinates: {
            x: path.left ?? 0,
            y: path.top ?? 0,
            width: path.width ?? 0,
            height: path.height ?? 0,
            pathData: path.path.map((segment) => segment.join(" ")).join(" "),
            canvasWidth: canvasSize.width,
            canvasHeight: canvasSize.height,
          },
          color,
          strokeWidth,
          label: "freehand",
        };
        path.set("data", { annotationId: annotation.id });
        addAnnotation(annotation, sceneIdRef.current);
      };

      const handleMouseDown = (event: { e: FabricPointerEvent }) => {
        const pointer = canvas.getScenePoint(event.e);

        if (selectedTool === "eraser") {
          const activeObject = canvas.findTarget(event.e).target;
          const annotationId = activeObject?.get("data")?.annotationId as string | undefined;
          if (activeObject) {
            canvas.remove(activeObject);
          }
          if (annotationId) {
            removeAnnotation(annotationId);
          }
          return;
        }

        startPointRef.current = { x: pointer.x, y: pointer.y };
      };

      const handleMouseUp = (event: { e: FabricPointerEvent }) => {
        const startPoint = startPointRef.current;
        if (!startPoint || selectedTool === "freehand" || selectedTool === "eraser") return;

        const pointer = canvas.getScenePoint(event.e);
        const width = pointer.x - startPoint.x;
        const height = pointer.y - startPoint.y;
        const annotation = toAnnotation(selectedTool, startPoint, color, strokeWidth, canvasSize, width, height);

        if (selectedTool === "circle") {
          const circle = new Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: Math.max(Math.abs(width), Math.abs(height), 24) / 2,
            fill: "transparent",
            stroke: color,
            strokeWidth,
          });
          circle.set("data", { annotationId: annotation.id });
          canvas.add(circle);
        }

        if (selectedTool === "arrow") {
          const line = new Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
            stroke: color,
            strokeWidth,
          });
          const head = new Triangle({
            left: pointer.x,
            top: pointer.y,
            width: strokeWidth * 4,
            height: strokeWidth * 4,
            fill: color,
            angle: (Math.atan2(height, width) * 180) / Math.PI + 90,
            originX: "center",
            originY: "center",
          });
          const arrow = new Group([line, head]);
          arrow.set("data", { annotationId: annotation.id });
          canvas.add(arrow);
        }

        if (selectedTool === "text") {
          const text = new FabricText("Metin", {
            left: startPoint.x,
            top: startPoint.y,
            fill: color,
            fontSize: 22,
            fontFamily: "Montserrat, sans-serif",
          });
          text.set("data", { annotationId: annotation.id });
          canvas.add(text);
        }

        canvas.requestRenderAll();
        addAnnotation(annotation, sceneIdRef.current);
        startPointRef.current = null;
      };

      canvas.on("path:created", handlePathCreated);
      canvas.on("mouse:down", handleMouseDown);
      canvas.on("mouse:up", handleMouseUp);

      return () => {
        canvas.off("path:created", handlePathCreated);
        canvas.off("mouse:down", handleMouseDown);
        canvas.off("mouse:up", handleMouseUp);
      };
    }, [addAnnotation, canvasSize, color, removeAnnotation, selectedTool, strokeWidth]);

    // Annotation cleanup is now handled inside the annotation-render effect above.
    // This effect is intentionally removed to avoid double-processing.

    return (
      <div
        ref={containerRef}
        className="overflow-hidden rounded-sm border border-white/10 bg-[#0A0A0F] p-3"
      >
        <canvas ref={canvasElementRef} className="touch-none" />
      </div>
    );
  },
);

FabricCanvas.displayName = "FabricCanvas";

export default FabricCanvas;
