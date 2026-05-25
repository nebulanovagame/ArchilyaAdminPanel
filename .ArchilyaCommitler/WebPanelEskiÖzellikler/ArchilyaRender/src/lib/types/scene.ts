export type SceneDirection =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west";

export type SceneType = "interior" | "exterior";

export type MaterialCategory = "floor" | "wall" | "ceiling" | "object";

export type LightPreference =
  | "sunny"
  | "cloudy"
  | "sunset"
  | "night"
  | "overcast"
  | "golden-hour";

export interface Scene {
  id: string;
  label: string;
  direction: SceneDirection;
  type: SceneType;
  imageFile: File | null;
  imagePreview: string | null;
  thumbnailUrl: string | null;
  hasFurnishing: boolean;
  frameQuality: number;
  order: number;
  createdAt: number;
}

export interface MaterialRef {
  id: string;
  label: string;
  category: MaterialCategory;
  imageFile: File | null;
  imagePreview: string | null;
  order: number;
  createdAt: number;
}

export interface Moodboard {
  id: string;
  label: string;
  imageFile: File | null;
  imagePreview: string | null;
  createdAt: number;
}

export interface ClientReference {
  id: string;
  label: string;
  imageFile: File | null;
  imagePreview: string | null;
  createdAt: number;
}

export interface IntakeState {
  scenes: Scene[];
  materials: MaterialRef[];
  moodboards: Moodboard[];
  clientReferences: ClientReference[];
  lightPreference: LightPreference | null;
  isSubmitting: boolean;
}

export interface IntakeActions {
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

  resetIntake: () => void;
}

export const SCENE_DIRECTION_LABEL_KEYS: Record<SceneDirection, string> = {
  north: "directions.north",
  south: "directions.south",
  east: "directions.east",
  west: "directions.west",
  "north-east": "directions.northEast",
  "north-west": "directions.northWest",
  "south-east": "directions.southEast",
  "south-west": "directions.southWest",
};

export function getSceneDirectionLabelKey(direction: SceneDirection) {
  return SCENE_DIRECTION_LABEL_KEYS[direction];
}

export const SCENE_DIRECTIONS: { value: SceneDirection; labelKey: string }[] = [
  { value: "north", labelKey: SCENE_DIRECTION_LABEL_KEYS.north },
  { value: "south", labelKey: SCENE_DIRECTION_LABEL_KEYS.south },
  { value: "east", labelKey: SCENE_DIRECTION_LABEL_KEYS.east },
  { value: "west", labelKey: SCENE_DIRECTION_LABEL_KEYS.west },
  { value: "north-east", labelKey: SCENE_DIRECTION_LABEL_KEYS["north-east"] },
  { value: "north-west", labelKey: SCENE_DIRECTION_LABEL_KEYS["north-west"] },
  { value: "south-east", labelKey: SCENE_DIRECTION_LABEL_KEYS["south-east"] },
  { value: "south-west", labelKey: SCENE_DIRECTION_LABEL_KEYS["south-west"] },
];

export const MATERIAL_CATEGORIES: { value: MaterialCategory; labelKey: string }[] = [
  { value: "floor", labelKey: "categories.floor" },
  { value: "wall", labelKey: "categories.wall" },
  { value: "ceiling", labelKey: "categories.ceiling" },
  { value: "object", labelKey: "categories.object" },
];

export const LIGHT_PREFERENCES: { value: LightPreference; labelKey: string }[] = [
  { value: "sunny", labelKey: "dashboard.archilyaRender.light.sunny" },
  { value: "cloudy", labelKey: "dashboard.archilyaRender.light.cloudy" },
  { value: "sunset", labelKey: "dashboard.archilyaRender.light.sunset" },
  { value: "night", labelKey: "dashboard.archilyaRender.light.night" },
  { value: "overcast", labelKey: "dashboard.archilyaRender.light.overcast" },
  { value: "golden-hour", labelKey: "dashboard.archilyaRender.light.goldenHour" },
];

export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_SCENES = 8;
export const MAX_MATERIALS = 12;
export const MAX_MOODBOARDS = 6;
export const MAX_CLIENT_REFERENCES = 4;
