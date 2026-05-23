export async function generateMockDepthMap(imageUrl: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Depth map için görsel yüklenemedi."));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 960;
  canvas.height = image.naturalHeight || 640;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context oluşturulamadı.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-atop";

  const horizontalGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  horizontalGradient.addColorStop(0, "rgba(13, 27, 42, 0.82)");
  horizontalGradient.addColorStop(0.45, "rgba(108, 99, 255, 0.66)");
  horizontalGradient.addColorStop(1, "rgba(46, 213, 115, 0.52)");
  context.fillStyle = horizontalGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const radialGradient = context.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.05,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.65,
  );
  radialGradient.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  radialGradient.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  context.globalCompositeOperation = "overlay";
  context.fillStyle = radialGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}
