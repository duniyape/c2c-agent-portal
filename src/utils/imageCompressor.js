/**
 * Utility to compress image files on the client side using HTML5 Canvas.
 * Ensures uploaded images stay well below Nginx's 1MB client_max_body_size limit,
 * preventing HTTP 413 (Payload Too Large) and subsequent CORS/Network Errors.
 */
export const compressImage = async (file, maxWidth = 1000, maxHeight = 1000, quality = 0.65) => {
  if (!file || !(file instanceof File || file instanceof Blob)) return file;
  if (file.type && !file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const origName = file.name || 'document.jpg';
                const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
                let newFile;
                try {
                  newFile = new File([blob], `${baseName}.jpg`, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                } catch {
                  blob.name = `${baseName}.jpg`;
                  newFile = blob;
                }
                console.log(`[Compressed] ${file.name || 'file'}: ${(file.size / 1024).toFixed(1)} KB -> ${(newFile.size / 1024).toFixed(1)} KB`);
                resolve(newFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      resolve(file);
    }
  });
};

export default compressImage;
