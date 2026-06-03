export function compressImage(
  base64: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; mimeType?: string } = {}
): Promise<string> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.85, mimeType = 'image/jpeg' } = options;
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width *= ratio;
        height *= ratio;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('無法建立 canvas context'));
        return;
      }
      // Use better quality downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.onerror = () => reject(new Error('圖片壓縮失敗'));
    img.src = base64;
  });
}
