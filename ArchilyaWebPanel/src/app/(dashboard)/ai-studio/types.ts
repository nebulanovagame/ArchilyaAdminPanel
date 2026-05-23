import type { ProjectRecord } from "@/lib/projects/types";

export type PromptHistoryEntry = {
  id: string;
  toolId: string;
  toolLabel: string;
  outputType: "text" | "image";
  style: string;
  sceneEditMode: string;
  referenceCount: number;
  extraNote: string;
  generationVariant: string;
  statusLabel: string;
  createdAt: string;
};

export type ResultImage = {
  src: string;
  mimeType: string;
};

export type ResultMeta = Omit<PromptHistoryEntry, "statusLabel">;

export type ResultRevisionStep = {
  src: string;
  mimeType: string;
  meta: ResultMeta | null;
};

export type ActiveJobDraft = ResultMeta & {
  sourceImageUri: string;
};

export type StoredActiveJob = {
  jobId: string;
  toolId: string;
  style: string;
  sceneEditMode: string;
  extraNote: string;
  outputType: "text" | "image";
  generationVariant: string;
  sourceImageUri: string;
};

export type SceneReference = {
  id: string;
  file: File | null;
  url: string;
  label: string;
  note: string;
  type: string;
};

export type ToolConfig = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  label: string;
  desc: string;
  credit: number;
  badge: string;
  hasStyle: boolean;
  outputType: "text" | "image";
};

export type StyleOption = {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
};

export type GenerateOptions = {
  extraNoteOverride?: string;
  generationVariant?: string;
};

export type AiStudioPageDependencies = {
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  ownerName: string;
  credits: number | null;
  hasEnough: (amount: number) => boolean;
  projects: ProjectRecord[];
  refreshProjects: () => Promise<void>;
  updatePoolStorage: (bytesDelta: number) => Promise<void>;
};
