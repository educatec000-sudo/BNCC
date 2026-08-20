import Link from "next/link"
import { BookOpenCheck } from "lucide-react"
import { cn } from "@/lib/utils"

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-3", className)} aria-label="+ Educação — início">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-sm">
        <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-bold tracking-tight">
            <span className="text-primary">+</span> Educação
          </span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            BNCC Planner
          </span>
        </span>
      )}
    </Link>
  )
}
