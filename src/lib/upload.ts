import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a file to Firebase Storage with resumable uploads, progress tracking, and timeout protection.
 * Falls back to a compressed data URL if storage is unconfigured or times out.
 */
export const uploadFile = async (
  file: File | Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    let isCompleted = false;

    // Timeout safeguard (30 seconds for upload attempt)
    const timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        console.warn('[Upload] Firebase Storage upload timed out after 30s. Falling back to persistent Data URL representation.');
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(new Error('Storage upload timeout and data URL conversion failed.'));
        reader.readAsDataURL(file);
      }
    }, 30000);

    try {
      const storageRef = ref(storage, path);
      const metadata = {
        contentType: file.type || 'image/webp',
      };
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(Math.round(progress));
          }
        },
        (error) => {
          clearTimeout(timeoutTimer);
          if (isCompleted) return;
          isCompleted = true;

          console.warn('[Upload] Firebase Storage upload error code:', error.code, error.message);
          
          // Handle specific storage errors gracefully or fallback to data URL
          if (
            error.code === 'storage/unauthorized' ||
            error.code === 'storage/canceled' ||
            error.code === 'storage/bucket-not-found' ||
            error.code === 'storage/quota-exceeded'
          ) {
            // Fallback to data URL representation for robust user experience
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error(`Storage error (${error.code}) and fallback failed.`));
            reader.readAsDataURL(file);
          } else {
            reject(new Error(`Upload failed (${error.code || 'network-error'})`));
          }
        },
        async () => {
          clearTimeout(timeoutTimer);
          if (isCompleted) return;
          isCompleted = true;

          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (urlErr: any) {
            console.warn('[Upload] Failed to get download URL, falling back to data URL:', urlErr);
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(urlErr);
            reader.readAsDataURL(file);
          }
        }
      );
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (isCompleted) return;
      isCompleted = true;

      // Fallback on synchronous error
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(err);
      reader.readAsDataURL(file);
    }
  });
};

export const validateFile = (
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): string | null => {
  const { maxSizeMB = 50, allowedTypes } = options;
  
  if (allowedTypes && !allowedTypes.some(type => file.type.startsWith(type.replace('*', '')))) {
    return `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`;
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `File size exceeds ${maxSizeMB}MB limit.`;
  }
  
  return null;
};
