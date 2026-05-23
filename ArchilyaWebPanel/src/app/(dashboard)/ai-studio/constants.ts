import {
  Search,
  Image,
  Wand2,
  Layers,
  PaintBucket,
} from "lucide-react";

import type { ToolConfig, StyleOption } from "./types";

export const STYLES: StyleOption[] = [
  { id: "photorealistic", label: "photorealistic", icon: "📷", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
  { id: "modern", label: "Modern", icon: "🏢", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  { id: "scandinavian", label: "scandinavian", icon: "🌲", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { id: "brutalist", label: "brutalist", icon: "🏛️", color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20" },
  { id: "mediterranean", label: "mediterranean", icon: "☀️", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  { id: "industrial", label: "industrial", icon: "🏭", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" },
  { id: "sketch", label: "sketch", icon: "✏️", color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20" },
  { id: "futuristic", label: "futuristic", icon: "🚀", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
];

export const TOOLS = [
  { id: "analysis", icon: Search, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", label: "analysis", desc: "", credit: 5, badge: "Archilya AI", hasStyle: false, outputType: "text" },
  { id: "img2img", icon: Image, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", label: "img2img", desc: "", credit: 20, badge: "Image to Image", hasStyle: true, outputType: "image" },
  { id: "enhance", icon: Wand2, color: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/20", label: "enhance", desc: "", credit: 20, badge: "Image to Image", hasStyle: false, outputType: "image" },
  { id: "sceneedit", icon: Layers, color: "text-cyan-300", bg: "bg-cyan-400/10", border: "border-cyan-400/20", label: "sceneedit", desc: "", credit: 35, badge: "Scene Edit", hasStyle: false, outputType: "image" },
  { id: "plancolor", icon: PaintBucket, color: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20", label: "plancolor", desc: "", credit: 15, badge: "Image to Image", hasStyle: true, outputType: "image" },
] as const satisfies ReadonlyArray<ToolConfig>;

export const COMING_SOON = [
  { id: "presentation", icon: Layers, label: "presentation", color: "text-blue-400" },
  { id: "exploded", icon: Layers, label: "exploded", color: "text-indigo-400" },
  { id: "climate", icon: Layers, label: "climate", color: "text-cyan-400" },
  { id: "concept", icon: Layers, label: "concept", color: "text-rose-400" },
];

export const SCENE_EDIT_MODES = [
  { id: "place", label: "place" },
  { id: "replace", label: "replace" },
  { id: "material-swap", label: "material-swap" },
  { id: "scene-compose", label: "scene-compose" },
  { id: "remove", label: "remove" },
];

export const MAX_PROMPT_HISTORY = 8;
export const VARIATION_NOTE_SUFFIX = "Mevcut kompozisyonu ve perspektifi koruyarak farkli bir varyasyon uret. Ana geometriyi bozma.";
export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const ACTIVE_AI_JOB_STORAGE_PREFIX = "archilya:ai-studio:active-job:v1";
