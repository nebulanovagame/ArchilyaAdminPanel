export type PickedImage = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type SceneReference = {
  id: string;
  uri: string;
  name: string;
  mimeType?: string | null;
  type: string;
  label: string;
  note: string;
};

export type AiToolOption = {
  id: string;
  label: string;
  cost: number;
  outputType: string;
  requiresStyle: boolean;
  supportsSceneReferences: boolean;
};

export type AiSelectOption = {
  id: string;
  label: string;
};

export type PromptHistoryEntry = {
  id: string;
  toolId: string;
  toolLabel: string;
  outputType: string;
  style: string;
  sceneEditMode: string;
  referenceCount: number;
  extraNote: string;
  generationVariant: string;
  statusLabel: string;
  createdAt: string;
};

export type AiRunPayload = {
  toolId: string;
  toolLabel: string;
  style: string;
  workflow: string;
  prompt: string;
  sourceProjectId: string;
  sourceImage: PickedImage | null;
  sceneReferences: SceneReference[];
};

export type SavedResultInfo = {
  projectId: string;
  projectName?: string;
  fileName?: string;
  savedAt: string;
};

export type ImagePickerSource = 'camera' | 'gallery' | 'document';
export type ResultPreviewMode = 'after' | 'before';
