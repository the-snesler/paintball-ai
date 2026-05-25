import type { LoadingPreview } from "~/types";

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

export async function createLoadingPreview(
  originalBlob: Blob,
  maxEdge: number = 24
): Promise<LoadingPreview | undefined> {
  try {
    const image = await loadImageFromBlob(originalBlob);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) return undefined;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    context.imageSmoothingEnabled = true;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return {
      dataUrl: canvas.toDataURL("image/webp", 0.65),
      width,
      height,
    };
  } catch {
    return undefined;
  }
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

// --- Media-aware helpers (handles both images and videos) ---

export async function getMediaDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (blob.type.startsWith("video/")) {
    return getVideoDimensions(blob);
  }
  return getImageDimensions(blob);
}

export async function createMediaThumbnailBlob(
  originalBlob: Blob,
  maxWidth: number = 400
): Promise<Blob> {
  if (originalBlob.type.startsWith("video/")) {
    return createVideoThumbnailBlob(originalBlob, maxWidth);
  }
  return createThumbnailBlob(originalBlob, maxWidth);
}

function getVideoDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);

    video.onloadedmetadata = () => {
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1920, height: 1080 });
    };

    video.src = url;
    video.load();
  });
}

async function createVideoThumbnailBlob(blob: Blob, maxWidth: number): Promise<Blob> {
  try {
    const frame = await captureVideoFrame(blob);
    const targetWidth = Math.min(frame.width, maxWidth);
    const scale = targetWidth / frame.width;
    const targetHeight = Math.max(1, Math.round(frame.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.drawImage(frame.element, 0, 0, targetWidth, targetHeight);
    URL.revokeObjectURL(frame.url);

    const thumbnail = await canvasToBlob(canvas, "image/webp", 0.88);
    return thumbnail ?? blob;
  } catch {
    return blob;
  }
}

function captureVideoFrame(
  blob: Blob
): Promise<{ element: HTMLVideoElement; url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek slightly in to avoid blank first frames on some codecs.
      video.currentTime = Math.min(0.1, video.duration / 2);
    };

    video.onseeked = () => {
      resolve({
        element: video,
        url,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for thumbnail"));
    };

    video.src = url;
    video.load();
  });
}
