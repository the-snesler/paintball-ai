export async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
      URL.revokeObjectURL(url);
    };

    img.src = url;
  });
}

export async function createThumbnailBlob(
  originalBlob: Blob,
  maxWidth: number = 400
): Promise<Blob> {
  const dimensions = await getImageDimensions(originalBlob);

  if (dimensions.width <= maxWidth) {
    return originalBlob;
  }

  const scale = maxWidth / dimensions.width;
  const targetWidth = Math.max(1, Math.round(dimensions.width * scale));
  const targetHeight = Math.max(1, Math.round(dimensions.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalBlob;
  }

  const image = await loadImageFromBlob(originalBlob);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const thumbnail = await canvasToBlob(canvas, "image/webp", 0.88);
  return thumbnail ?? originalBlob;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });
}
