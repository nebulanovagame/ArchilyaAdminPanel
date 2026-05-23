import { z } from "zod";

export const MAX_SCENES = 8;
export const MAX_MATERIALS = 12;
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const sceneDirectionSchema = z.enum([
  "north",
  "south",
  "east",
  "west",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
]);

export const sceneTypeSchema = z.enum(["interior", "exterior"]);

export const materialCategorySchema = z.enum(["floor", "wall", "ceiling", "object"]);

export const lightPreferenceSchema = z.enum([
  "sunny",
  "cloudy",
  "sunset",
  "night",
  "overcast",
  "golden-hour",
]);

export const sceneMetadataSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().min(1).max(200),
  direction: sceneDirectionSchema,
  type: sceneTypeSchema,
  hasFurnishing: z.boolean(),
  frameQuality: z.number().int().min(0).max(100),
  order: z.number().int().min(0),
  imageUrl: z.string().max(2048).optional(),
});

export const materialMetadataSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().min(1).max(200),
  category: materialCategorySchema,
  imageUrl: z.string().max(2048).optional(),
});

export const renderPipelineBodySchema = z.object({
  scenes: z.array(sceneMetadataSchema).min(1).max(MAX_SCENES),
  materials: z.array(materialMetadataSchema).min(0).max(MAX_MATERIALS),
  lightPreference: lightPreferenceSchema.nullable().optional(),
  moodboardUrls: z.array(z.string().max(2048)).max(6).optional(),
  constraints: z.string().max(5000).optional(),
});

export const depthEstimationBodySchema = z.object({
  imageUrl: z.string().min(1).max(2048),
  sceneId: z.string().min(1).max(128),
});

export const sceneConsistencyBodySchema = z.object({
  sceneImageUrls: z.array(z.string().min(1).max(2048)).min(2).max(MAX_SCENES),
  sceneIds: z.array(z.string().min(1).max(128)).min(2).max(MAX_SCENES),
});

export const renderSessionInputSchema = z.object({
  uid: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128).optional(),
  status: z.enum([
    "draft",
    "audited",
    "markup-done",
    "spatial-locked",
    "rendering",
    "completed",
    "failed",
  ]).optional(),
  scenes: z.array(sceneMetadataSchema).max(MAX_SCENES).optional(),
  materials: z.array(materialMetadataSchema).max(MAX_MATERIALS).optional(),
  lightPreference: lightPreferenceSchema.nullable().optional(),
  annotations: z.array(z.unknown()).optional(),
  constraints: z.array(z.unknown()).optional(),
  metricLocks: z.record(
    z.string(),
    z.object({
      aspectRatio: z.number(),
      estimatedDepth: z.number(),
      volumeScore: z.number(),
      isLocked: z.boolean(),
    }),
  ).optional(),
  consistencyScore: z.number().min(0).max(100).nullable().optional(),
  jobId: z.string().max(128).optional(),
  outputImageUrls: z.array(z.string().max(2048)).optional(),
});

export type RenderPipelineBody = z.infer<typeof renderPipelineBodySchema>;
export type DepthEstimationBody = z.infer<typeof depthEstimationBodySchema>;
export type SceneConsistencyBody = z.infer<typeof sceneConsistencyBodySchema>;
export type RenderSessionInputBody = z.infer<typeof renderSessionInputSchema>;
