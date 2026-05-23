import { getFunctions, httpsCallable, type HttpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app } from '../config/firebase';

type TransformStyle = {
  id: string;
  label: string;
};

type TransformImagePayload = {
  imageUrl: string;
  imageDataUrl: null;
  prompt: string;
  strength: number;
  style: string;
  toolId: string;
};

type TransformImageResponse = {
  success?: boolean;
  outputUrl?: string;
};

type TransformImageParams = {
  imageUrl: string;
  prompt?: string;
  style?: string;
  strength?: number;
  toolId?: string;
};

type TransformImageResult = {
  outputUrl: string;
};

const functions = getFunctions(app, 'europe-west1');
const transformImageCall: HttpsCallable<TransformImagePayload, TransformImageResponse> = httpsCallable(functions, 'transformImage', { timeout: 540000 });

export const TRANSFORM_STYLES: TransformStyle[] = [
  { id: 'photorealistic', label: 'Fotorealistik' },
  { id: 'modern', label: 'Modern Mimari' },
  { id: 'scandinavian', label: 'Iskandinav' },
  { id: 'brutalist', label: 'Brutalist' },
  { id: 'mediterranean', label: 'Akdeniz' },
  { id: 'industrial', label: 'Endustriyel' },
  { id: 'sketch', label: 'Mimari Eskiz' },
];

const TOOL_PROMPTS: Record<string, string> = {
  img2img: 'professional architectural render enhancement',
  presentation: 'architectural competition presentation board, clean layout, diagrams and sections',
  exploded: 'architectural exploded axonometric diagram, clean technical style',
  climate: 'architectural climate and sun path analysis diagram, vector technical illustration',
  concept: 'architectural concept process board, sketch and moodboard collage',
};

export async function transformImageWithCloudFunction({
  imageUrl,
  prompt,
  style = 'photorealistic',
  strength = 0.65,
  toolId = 'img2img',
}: TransformImageParams): Promise<TransformImageResult> {
  if (!imageUrl) throw new Error('Referans gorsel URL zorunludur.');

  const fullPrompt = `${TOOL_PROMPTS[toolId] || TOOL_PROMPTS.img2img}, ${prompt || ''}`.trim();

  const res: HttpsCallableResult<TransformImageResponse> = await transformImageCall({
    imageUrl,
    imageDataUrl: null,
    prompt: fullPrompt,
    strength,
    style,
    toolId,
  });

  if (!res?.data?.success || !res?.data?.outputUrl) {
    throw new Error('AI gorsel uretimi basarisiz oldu.');
  }

  return {
    outputUrl: res.data.outputUrl,
  };
}
