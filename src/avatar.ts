const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;

export async function imageFileToAvatar(file: File): Promise<string> {
  if (!ACCEPTED_AVATAR_TYPES.has(file.type)) throw new Error('头像仅支持 JPG、PNG 或 WebP 格式');
  if (file.size > MAX_AVATAR_FILE_SIZE) throw new Error('头像文件不能超过 5 MB');
  const source = await loadImage(file);
  const scale = Math.min(1, AVATAR_SIZE / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.max(1, Math.round(source.naturalWidth * scale));
  const height = Math.max(1, Math.round(source.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法处理头像图片');
  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/webp', 0.86);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取头像图片')); };
    image.src = url;
  });
}
