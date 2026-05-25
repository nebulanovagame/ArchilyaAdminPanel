import type { Scene, MaterialRef, Moodboard, ClientReference } from "@/lib/types/scene";

export const MOCK_SCENES: Scene[] = [
  {
    id: "mock-scene-001",
    label: "Salon - Kuzey Cephe",
    direction: "north",
    type: "interior",
    imageFile: null,
    imagePreview: null,
    thumbnailUrl: null,
    hasFurnishing: true,
    frameQuality: 85,
    order: 0,
    createdAt: Date.now(),
  },
  {
    id: "mock-scene-002",
    label: "Mutfak - Giriş",
    direction: "south",
    type: "interior",
    imageFile: null,
    imagePreview: null,
    thumbnailUrl: null,
    hasFurnishing: true,
    frameQuality: 82,
    order: 1,
    createdAt: Date.now() - 1000,
  },
  {
    id: "mock-scene-003",
    label: "Balkon - Güney",
    direction: "south",
    type: "exterior",
    imageFile: null,
    imagePreview: null,
    thumbnailUrl: null,
    hasFurnishing: true,
    frameQuality: 78,
    order: 2,
    createdAt: Date.now() - 2000,
  },
];

export const MOCK_MATERIALS: MaterialRef[] = [
  {
    id: "mock-mat-001",
    label: "Meşe Parke",
    category: "floor",
    imageFile: null,
    imagePreview: null,
    order: 0,
    createdAt: Date.now(),
  },
  {
    id: "mock-mat-002",
    label: "Beyaz Mermer",
    category: "wall",
    imageFile: null,
    imagePreview: null,
    order: 1,
    createdAt: Date.now() - 1000,
  },
  {
    id: "mock-mat-003",
    label: "Antrasit Metal",
    category: "object",
    imageFile: null,
    imagePreview: null,
    order: 2,
    createdAt: Date.now() - 2000,
  },
];

export const MOCK_MOODBOARDS: Moodboard[] = [
  {
    id: "mock-mood-001",
    label: "Modern Minimal",
    imageFile: null,
    imagePreview: null,
    createdAt: Date.now(),
  },
  {
    id: "mock-mood-002",
    label: "Iskandinav",
    imageFile: null,
    imagePreview: null,
    createdAt: Date.now() - 1000,
  },
];

export const MOCK_CLIENT_REFERENCES: ClientReference[] = [
  {
    id: "mock-ref-001",
    label: "Referans 1",
    imageFile: null,
    imagePreview: null,
    createdAt: Date.now(),
  },
];
