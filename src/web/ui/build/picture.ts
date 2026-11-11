import * as THREE from 'three';
import { api, getSessionToken } from '../../api/client';

// 007 US5 (research R7-06): the user's own picture in a frame. The browser checks the file, scales it to at
// most 1024 px and re-encodes it (WebP, JPEG fallback) — small enough for the 2 MB upload limit and for the
// 60 FPS budget, and the re-encode drops EXIF data such as GPS position. The server only stores it locally.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export class PictureError extends Error {}

/** Check, decode, scale and re-encode a chosen file. Throws PictureError with a message for the user. */
export async function preparePicture(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new PictureError('Choose a PNG, JPEG or WebP image');
  if (file.size > MAX_FILE_BYTES) throw new PictureError('The image is larger than 10 MB');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PictureError('Could not read this image');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
  // toBlob falls back to PNG for a type it cannot write; only accept the type asked for.
  const webp = await encode('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg');
  if (!blob) throw new PictureError('Could not read this image');
  return blob;
}

/** Upload a prepared picture; returns its id (contracts/local-api.md L7-2). */
export async function uploadPicture(blob: Blob): Promise<string> {
  const res = await api<{ id: string }>('/api/pictures', { method: 'POST', body: blob, headers: { 'content-type': blob.type } });
  return res.id;
}

/** Fetch a stored picture as a texture; null when it is missing (the frame then shows its default picture). */
export async function loadPictureTexture(id: string): Promise<THREE.Texture | null> {
  if (id.startsWith('bench-')) return benchTexture(id);
  const token = getSessionToken();
  const res = await fetch(`/api/pictures/${encodeURIComponent(id)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob(), { imageOrientation: 'flipY' });
  const tex = new THREE.Texture(bitmap);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // ImageBitmap ignores flipY; it was flipped when decoded
  tex.needsUpdate = true;
  return tex;
}

/** FPS bench only (no server pictures there): a generated 1024 × 768 picture, the size of a real upload. */
function benchTexture(id: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const g = c.getContext('2d')!;
  const hue = (id.length * 47) % 360;
  const grad = g.createLinearGradient(0, 0, 1024, 768);
  grad.addColorStop(0, `hsl(${hue} 60% 70%)`);
  grad.addColorStop(1, `hsl(${(hue + 120) % 360} 50% 45%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 768);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Crop a texture to fill a frame of the given aspect (width / height) without stretching ("cover"). */
export function coverFit(tex: THREE.Texture, aspect: number): void {
  const img = tex.image as { width: number; height: number };
  const imgAspect = img.width / img.height;
  if (imgAspect > aspect) {
    tex.repeat.set(aspect / imgAspect, 1);
    tex.offset.set((1 - aspect / imgAspect) / 2, 0);
  } else {
    tex.repeat.set(1, imgAspect / aspect);
    tex.offset.set(0, (1 - imgAspect / aspect) / 2);
  }
}
