import PdfThumbnail, { type ThumbnailResult } from 'react-native-pdf-thumbnail';

export function isPdfFile(fileName: string | null | undefined = '', mimeType: string | null | undefined = ''): boolean {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (normalizedMimeType === 'application/pdf') {
    return true;
  }

  return String(fileName || '').trim().toLowerCase().endsWith('.pdf');
}

export async function renderPdfFirstPageToImage(pdfUri: string): Promise<ThumbnailResult> {
  const normalizedUri = String(pdfUri || '').trim();
  if (!normalizedUri) {
    throw new Error('PDF dosyasi bulunamadi.');
  }

  try {
    const result = await PdfThumbnail.generate(normalizedUri, 0);
    if (!result?.uri) {
      throw new Error('PDF ilk sayfasi gorsele donusturulemedi.');
    }

    return {
      uri: String(result.uri).trim(),
      width: Number(result.width || 0),
      height: Number(result.height || 0),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    throw new Error(message || 'PDF ilk sayfasi gorsele donusturulemedi.');
  }
}
