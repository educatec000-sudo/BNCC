import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildPdfFilename, renderPlanningPdf } from "@/lib/pdf/render-planning-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await params
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, userId: session.user.id },
    include: {
      images: {
        where: { status: "READY", imageData: { not: null } },
        orderBy: [{ placementKey: "asc" }, { position: "asc" }],
      },
    },
  })
  if (!plan) return NextResponse.json({ error: "Planejamento não encontrado" }, { status: 404 })

  const version = req.nextUrl.searchParams.get("version") === "adapted" ? "adapted" : "original"
  if (version === "adapted" && !plan.adaptedContent) {
    return NextResponse.json({ error: "Este planejamento ainda não possui versão adaptada." }, { status: 404 })
  }

  const orientationParam = req.nextUrl.searchParams.get("orientation")
  const orientation =
    orientationParam === "landscape"
      ? "landscape"
      : orientationParam === "portrait"
        ? "portrait"
        : undefined
  const school = req.nextUrl.searchParams.get("school")
  const teacher = req.nextUrl.searchParams.get("teacher") || session.user.name
  const download = req.nextUrl.searchParams.get("download") === "1"
  const selectedContent = version === "adapted" ? plan.adaptedContent : plan.content

  try {
    const pdfPlan = {
      id: plan.id,
      title: plan.title,
      topic: plan.topic,
      educationStage: plan.educationStage,
      subject: plan.subject,
      grade: plan.grade,
      planningType: plan.planningType,
      request: plan.request,
      content: selectedContent,
      editorDocument: version === "original" ? plan.editorDocument : undefined,
      editorVersion: plan.editorVersion,
      images: plan.images.map((image) => ({
        id: image.id,
        placementKey: image.placementKey,
        position: image.position,
        widthPercent: image.widthPercent,
        mimeType: image.mimeType,
        imageData: image.imageData,
        altText: image.altText,
      })),
    }
    const { buffer } = await renderPlanningPdf({ plan: pdfPlan, school, teacher, orientation })
    const filename = buildPdfFilename(pdfPlan)
    const disposition = download ? "attachment" : "inline"

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    })
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error(`[pdf] Falha ao gerar documento (${errorName}).`)
    return NextResponse.json({ error: "Não foi possível gerar o PDF." }, { status: 500 })
  }
}
