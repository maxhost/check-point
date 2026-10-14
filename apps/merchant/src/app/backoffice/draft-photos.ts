import { panelRequest } from "./panel-request";

export const MAX_DRAFT_PHOTOS = 3;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4.4 * 1024 * 1024;

function preparePhoto(file: File): Promise<File> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    const finish = (prepared: File) => {
      URL.revokeObjectURL(url);
      resolve(prepared);
    };
    image.onerror = () => finish(file);
    image.onload = () => {
      try {
        const ratio = Math.min(1, 2000 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) return finish(file);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            finish(
              blob
                ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
                    type: "image/jpeg",
                  })
                : file,
            ),
          "image/jpeg",
          0.85,
        );
      } catch {
        finish(file);
      }
    };
    image.src = url;
  });
}

export async function prepareDraftPhotos(
  files: readonly File[],
): Promise<File[]> {
  if (files.length < 1 || files.length > MAX_DRAFT_PHOTOS)
    throw new Error("Elige entre 1 y 3 fotos.");
  const prepared: File[] = [];
  for (const file of files) prepared.push(await preparePhoto(file));
  if (
    prepared.some((file) => file.size > MAX_PHOTO_BYTES) ||
    prepared.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES
  )
    throw new Error("Las fotos son muy pesadas. Elige fotos más pequeñas.");
  return prepared;
}

export async function requestPhotoDraft<T>(
  url: string,
  files: readonly File[],
): Promise<T> {
  const photos = await prepareDraftPhotos(files);
  const body = new FormData();
  for (const photo of photos) body.append("photos", photo);
  return panelRequest<T>(url, "POST", body);
}
