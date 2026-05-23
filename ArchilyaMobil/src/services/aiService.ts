import { type AiStudioImageResult, runAiStudioToolSecureMobile } from './aiStudioService';

type GenerateImageSecurelyParams = {
  imageUri?: string | null;
  imageUrl?: string | null;
  prompt?: string | null;
  style?: string | null;
  toolId?: string;
};

export async function generateImageSecurely({
  imageUri,
  imageUrl,
  prompt,
  style,
  toolId = 'img2img',
}: GenerateImageSecurelyParams): Promise<AiStudioImageResult['dataUrl']> {
  const sourceImageUri = imageUri || imageUrl || '';
  const result = await runAiStudioToolSecureMobile({
    toolId,
    sourceImageUri,
    style,
    extraNote: prompt,
  });

  if (result.outputType !== 'image') {
    throw new Error('Secilen AI araci gorsel cikti uretmuyor.');
  }

  return result.dataUrl;
}
