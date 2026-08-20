import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@huggingface/inference",
    "@prisma/client",
    "@react-pdf/renderer",
    "bcryptjs",
    "sharp",
  ],
}

export default nextConfig
