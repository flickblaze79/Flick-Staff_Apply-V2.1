/**
 * Client-side high-performance image compression and cropping utilities.
 * Reduces 5-10MB files to ~30-150KB payloads for sub-second uploads to Firebase Storage.
 */

export interface CropConfig {
  offsetYPercent: number; // 0 (top) to 100 (bottom)
  offsetXPercent?: number; // 0 (left) to 100 (right)
  zoom?: number; // 1.0 to 2.5
}

/**
 * Reads a File or Data URL into an HTMLImageElement
 */
export const loadImage = (src: File | string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for processing'));

    if (src instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    } else {
      img.src = src;
    }
  });
};

/**
 * Compresses and resizes a user avatar to square dimensions (max 360x360).
 * Yields a small JPEG/WebP Blob (~20-50KB).
 */
export const compressAvatarImage = async (
  fileOrSrc: File | string,
  maxDimension = 360,
  quality = 0.85
): Promise<Blob> => {
  const img = await loadImage(fileOrSrc);
  const canvas = document.createElement('canvas');
  
  // Calculate center square crop
  const minDim = Math.min(img.width, img.height);
  const sx = (img.width - minDim) / 2;
  const sy = (img.height - minDim) / 2;

  canvas.width = maxDimension;
  canvas.height = maxDimension;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context creation failed');

  // Smooth scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDimension, maxDimension);

  return new Promise((resolve, reject) => {
    const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Avatar compression failed'));
      },
      mimeType,
      quality
    );
  });
};

/**
 * Crops and compresses a profile banner image according to vertical offset and zoom config.
 * Produces a high quality widescreen banner Blob (e.g. 1400x450, ~80-150KB).
 */
export const cropAndCompressBanner = async (
  fileOrSrc: File | string,
  cropConfig: CropConfig = { offsetYPercent: 50, zoom: 1.0 },
  targetWidth = 1000,
  targetHeight = 320,
  quality = 0.75
): Promise<Blob> => {
  const img = await loadImage(fileOrSrc);
  const canvas = document.createElement('canvas');
  
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context creation failed');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const zoom = Math.max(1.0, cropConfig.zoom || 1.0);
  const offsetY = Math.min(100, Math.max(0, cropConfig.offsetYPercent));
  const offsetX = Math.min(100, Math.max(0, cropConfig.offsetXPercent ?? 50));

  // Destination aspect ratio
  const targetAspect = targetWidth / targetHeight;
  
  // Effective source dimensions after zoom
  let srcWidth = img.width / zoom;
  let srcHeight = srcWidth / targetAspect;

  if (srcHeight > img.height) {
    srcHeight = img.height / zoom;
    srcWidth = srcHeight * targetAspect;
  }

  // Calculate top-left source coordinates based on offset percentages
  const maxSx = Math.max(0, img.width - srcWidth);
  const maxSy = Math.max(0, img.height - srcHeight);

  const sx = (maxSx * offsetX) / 100;
  const sy = (maxSy * offsetY) / 100;

  ctx.drawImage(img, sx, sy, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Banner compression failed'));
      },
      mimeType,
      quality
    );
  });
};

/**
 * Creates a fast preview Data URL for instant optimistic UI display.
 */
export const createFastDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  const elem = document.createElement('canvas');
  if (elem.getContext && elem.getContext('2d')) {
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}
