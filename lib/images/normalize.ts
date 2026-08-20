import "server-only"

import sharp from "sharp"

const MAX_IMAGE_SIDE = 2048

export async function normalizeImageForPersistence(data: Buffer): Promise<{
  data: Buffer
  mimeType: "image/png"
  width: number
  height: number
}> {
  if (!data.length) throw new Error("A imagem recebida está vazia.")
  const pipeline = sharp(data, { failOn: "error", limitInputPixels: 40_000_000 }).rotate()
  const metadata = await pipeline.metadata()
  if (!metadata.width || !metadata.height) throw new Error("Formato de imagem inválido.")

  const normalized = await pipeline
    .resize({
      width: MAX_IMAGE_SIDE,
      height: MAX_IMAGE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true })

  return {
    data: normalized.data,
    mimeType: "image/png",
    width: normalized.info.width,
    height: normalized.info.height,
  }
}

export async function imageBytesForPdf(data: Uint8Array, mimeType: string | null) {
  const buffer = Buffer.from(data)
  if (mimeType === "image/png") return { data: buffer, format: "png" as const }
  if (mimeType === "image/jpeg") return { data: buffer, format: "jpg" as const }
  const normalized = await normalizeImageForPersistence(buffer)
  return { data: normalized.data, format: "png" as const }
}
