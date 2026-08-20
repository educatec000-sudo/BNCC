"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["Etapa", "Área", "Série", "Tipo", "Inclusão", "Pedido", "Resultado"]

interface PlanningStepperProps {
  currentStep: number
  maxAccessibleStep?: number
  onStepSelect?: (step: number) => void
}

export function PlanningStepper({
  currentStep,
  maxAccessibleStep = currentStep,
  onStepSelect,
}: PlanningStepperProps) {
  return (
    <div className="w-full overflow-x-auto pb-2 print:hidden">
      <ol className="flex min-w-[820px] items-center" aria-label="Etapas do planejamento">
        {STEPS.map((label, index) => {
          const step = index + 1
          const completed = step < currentStep
          const active = step === currentStep
          const accessible = step <= maxAccessibleStep && Boolean(onStepSelect)

          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!accessible}
                onClick={() => accessible && onStepSelect?.(step)}
                className={cn(
                  "group flex items-center gap-2 rounded-full px-2 py-1.5 text-sm transition-colors",
                  accessible && "cursor-pointer hover:bg-primary/10",
                  !accessible && "cursor-default",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors",
                    active && "border-primary bg-primary text-primary-foreground shadow-sm",
                    completed && "border-primary bg-primary/10 text-primary",
                    !active && !completed && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="h-4 w-4" /> : step}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
              {step < STEPS.length && (
                <div
                  className={cn(
                    "mx-1 h-0.5 min-w-5 flex-1",
                    completed ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
