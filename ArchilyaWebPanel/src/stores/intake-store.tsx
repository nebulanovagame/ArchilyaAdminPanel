"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  Scene,
  MaterialRef,
  Moodboard,
  ClientReference,
  LightPreference,
} from "@/lib/types/scene";

type IntakeContextValue = {
  scenes: Scene[];
  materials: MaterialRef[];
  moodboards: Moodboard[];
  clientReferences: ClientReference[];
  lightPreference: LightPreference | null;
  isSubmitting: boolean;

  addScene: (scene: Omit<Scene, "id" | "createdAt">) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  reorderScenes: (sceneIds: string[]) => void;

  addMaterial: (material: Omit<MaterialRef, "id" | "createdAt">) => void;
  updateMaterial: (id: string, updates: Partial<MaterialRef>) => void;
  removeMaterial: (id: string) => void;

  addMoodboard: (moodboard: Omit<Moodboard, "id" | "createdAt">) => void;
  removeMoodboard: (id: string) => void;

  addClientReference: (ref: Omit<ClientReference, "id" | "createdAt">) => void;
  removeClientReference: (id: string) => void;

  setLightPreference: (preference: LightPreference | null) => void;
  setIsSubmitting: (value: boolean) => void;

  resetIntake: () => void;
};

const INTAKE_DRAFT_STORAGE_KEY = "archilya-render-intake-draft";

type PersistedIntakeDraft = {
  scenes: Array<Omit<Scene, "imageFile" | "imagePreview">>;
  materials: Array<Omit<MaterialRef, "imageFile" | "imagePreview">>;
  moodboards: Array<Omit<Moodboard, "imageFile" | "imagePreview">>;
  clientReferences: Array<Omit<ClientReference, "imageFile" | "imagePreview">>;
  lightPreference: LightPreference | null;
};

function generateId() {
  return crypto.randomUUID();
}

const IntakeContext = createContext<IntakeContextValue | null>(null);

function readPersistedDraft(): PersistedIntakeDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(INTAKE_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PersistedIntakeDraft) : null;
  } catch {
    return null;
  }
}

function restoreScene(scene: Omit<Scene, "imageFile" | "imagePreview">): Scene {
  return { ...scene, imageFile: null, imagePreview: null };
}

function restoreMaterial(material: Omit<MaterialRef, "imageFile" | "imagePreview">): MaterialRef {
  return { ...material, imageFile: null, imagePreview: null };
}

function restoreMoodboard(moodboard: Omit<Moodboard, "imageFile" | "imagePreview">): Moodboard {
  return { ...moodboard, imageFile: null, imagePreview: null };
}

function restoreClientReference(ref: Omit<ClientReference, "imageFile" | "imagePreview">): ClientReference {
  return { ...ref, imageFile: null, imagePreview: null };
}

function omitImageData<T extends { imageFile: File | null; imagePreview: string | null }>(
  item: T,
): Omit<T, "imageFile" | "imagePreview"> {
  const { imageFile, imagePreview, ...rest } = item;
  void imageFile;
  void imagePreview;
  return rest;
}

export function IntakeProvider({ children }: { children: ReactNode }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [materials, setMaterials] = useState<MaterialRef[]>([]);
  const [moodboards, setMoodboards] = useState<Moodboard[]>([]);
  const [clientReferences, setClientReferences] = useState<ClientReference[]>([]);
  const [lightPreference, setLightPreferenceState] = useState<LightPreference | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const draft = readPersistedDraft();
    if (!draft) return;
    startTransition(() => {
      if (draft.scenes?.length) setScenes(draft.scenes.map(restoreScene));
      if (draft.materials?.length) setMaterials(draft.materials.map(restoreMaterial));
      if (draft.moodboards?.length) setMoodboards(draft.moodboards.map(restoreMoodboard));
      if (draft.clientReferences?.length) setClientReferences(draft.clientReferences.map(restoreClientReference));
      if (draft.lightPreference) setLightPreferenceState(draft.lightPreference);
    });
  }, []);

  useEffect(() => {
    const draft: PersistedIntakeDraft = {
      scenes: scenes.map(omitImageData),
      materials: materials.map(omitImageData),
      moodboards: moodboards.map(omitImageData),
      clientReferences: clientReferences.map(omitImageData),
      lightPreference,
    };

    window.localStorage.setItem(INTAKE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [clientReferences, lightPreference, materials, moodboards, scenes]);

  const addScene = useCallback((scene: Omit<Scene, "id" | "createdAt">) => {
    const newScene: Scene = {
      ...scene,
      id: generateId(),
      createdAt: Date.now(),
    };
    setScenes((prev) => [...prev, newScene]);
  }, []);

  const updateScene = useCallback((id: string, updates: Partial<Scene>) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, ...updates } : scene)),
    );
  }, []);

  const removeScene = useCallback((id: string) => {
    setScenes((prev) => {
      const filtered = prev.filter((scene) => scene.id !== id);
      return filtered.map((scene, index) => ({ ...scene, order: index }));
    });
  }, []);

  const reorderScenes = useCallback((sceneIds: string[]) => {
    setScenes((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      return sceneIds
        .map((id) => map.get(id))
        .filter(Boolean)
        .map((scene, index) => ({ ...scene!, order: index }));
    });
  }, []);

  const addMaterial = useCallback((material: Omit<MaterialRef, "id" | "createdAt">) => {
    const newMaterial: MaterialRef = {
      ...material,
      id: generateId(),
      createdAt: Date.now(),
    };
    setMaterials((prev) => [...prev, newMaterial]);
  }, []);

  const updateMaterial = useCallback((id: string, updates: Partial<MaterialRef>) => {
    setMaterials((prev) =>
      prev.map((material) => (material.id === id ? { ...material, ...updates } : material)),
    );
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  }, []);

  const addMoodboard = useCallback((moodboard: Omit<Moodboard, "id" | "createdAt">) => {
    const newMoodboard: Moodboard = {
      ...moodboard,
      id: generateId(),
      createdAt: Date.now(),
    };
    setMoodboards((prev) => [...prev, newMoodboard]);
  }, []);

  const removeMoodboard = useCallback((id: string) => {
    setMoodboards((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addClientReference = useCallback((ref: Omit<ClientReference, "id" | "createdAt">) => {
    const newRef: ClientReference = {
      ...ref,
      id: generateId(),
      createdAt: Date.now(),
    };
    setClientReferences((prev) => [...prev, newRef]);
  }, []);

  const removeClientReference = useCallback((id: string) => {
    setClientReferences((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const setLightPreference = useCallback((preference: LightPreference | null) => {
    setLightPreferenceState(preference);
  }, []);

  const setIsSubmittingState = useCallback((value: boolean) => {
    setIsSubmitting(value);
  }, []);

  const resetIntake = useCallback(() => {
    setScenes([]);
    setMaterials([]);
    setMoodboards([]);
    setClientReferences([]);
    setLightPreferenceState(null);
    setIsSubmitting(false);
    window.localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY);
  }, []);

  const value = useMemo<IntakeContextValue>(
    () => ({
      scenes,
      materials,
      moodboards,
      clientReferences,
      lightPreference,
      isSubmitting,
      addScene,
      updateScene,
      removeScene,
      reorderScenes,
      addMaterial,
      updateMaterial,
      removeMaterial,
      addMoodboard,
      removeMoodboard,
      addClientReference,
      removeClientReference,
      setLightPreference,
      setIsSubmitting: setIsSubmittingState,
      resetIntake,
    }),
    [
      scenes,
      materials,
      moodboards,
      clientReferences,
      lightPreference,
      isSubmitting,
      addScene,
      updateScene,
      removeScene,
      reorderScenes,
      addMaterial,
      updateMaterial,
      removeMaterial,
      addMoodboard,
      removeMoodboard,
      addClientReference,
      removeClientReference,
      setLightPreference,
      setIsSubmittingState,
      resetIntake,
    ],
  );

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntakeContext() {
  const context = useContext(IntakeContext);
  if (!context) {
    throw new Error("useIntakeContext must be used within an IntakeProvider.");
  }
  return context;
}
