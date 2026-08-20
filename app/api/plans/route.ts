import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const plans = await prisma.lessonPlan.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      educationStage: true,
      planningType: true,
      theme: true,
      topic: true,
      grade: true,
      subject: true,
      inclusionMode: true,
      adaptedFor: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ plans })
}
