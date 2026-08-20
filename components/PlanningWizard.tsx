"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Accessibility,
  Activity,
  Atom,
  Baby,
  Blocks,
  BookOpen,
  Brain,
  BrainCircuit,
  Calculator,
  CalendarDays,
  CalendarRange,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FlaskConical,
  FolderKanban,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Library,
  ListOrdered,
  Loader2,
  MessageCircle,
  Microscope,
  MonitorSmartphone,
  Network,
  NotebookTabs,
  Orbit,
  Palette,
  PanelsTopLeft,
  PersonStanding,
  Puzzle,
  School,
  Shapes,
  Sparkles,
  Sprout,
  Trees,
  UserRoundCheck,
  Users,
} from "lucide-react"
import { EDUCATION_STAGES, PLANNING_TYPES, type PlanningOption } from "@/lib/planning-options"
import { IMAGE_MODES, IMAGE_STYLES, type ImageModeId, type ImageStyleId } from "@/lib/image-options"
import {
  ACCESSIBILITY_RESOURCE_GROUPS,
  INCLUSION_MODES,
  INCLUSION_NEEDS,
  PEDAGOGICAL_PROFILE_FIELDS,
  type InclusionModeId,
  type PedagogicalProfile,
} from "@/lib/inclusion-options"
import { cn } from "@/lib/utils"
import { PlanningStepper } from "@/components/PlanningStepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const ICONS: Record<string, LucideIcon> = {
  Accessibility,
  Activity,
  Atom,
  Baby,
  Blocks,
  BookOpen,
  Brain,
  BrainCircuit,
  Calculator,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FlaskConical,
  FolderKanban,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Library,
  ListOrdered,
  MessageCircle,
  Microscope,
  MonitorSmartphone,
  Network,
  NotebookTabs,
  Orbit,
  Palette,
  PanelsTopLeft,
  PersonStanding,
  Puzzle,
  School,
  Shapes,
  Sparkles,
  Sprout,
  Trees,
  UserRoundCheck,
  Users,
}

export interface PlanningWizardInitialData {
  planId?: string
  stageId?: string
  areaId?: string
  gradeId?: string
  planningTypeId?: string
  inclusionMode?: InclusionModeId
  inclusionNeeds?: string[]
  accessibilityResources?: string[]
  pedagogicalProfile?: PedagogicalProfile
  imageMode?: ImageModeId
  imageStyle?: ImageStyleId
  coloringPage?: boolean
  accessibleImages?: boolean
  generateAltText?: boolean
  topic?: string
  request?: string
  additionalPreferences?: string
}

interface PlanningWizardProps {
  initialAccess: {
    canGenerate: boolean
    message?: string
  }
  initialData?: PlanningWizardInitialData
}

interface OptionGridProps {
  options: PlanningOption[]
  selectedId: string
  onSelect: (option: PlanningOption) => void
  areaCounts?: Record<string, number>
}

function OptionGrid({ options, selectedId, onSelect, areaCounts }: OptionGridProps) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {options.map((option) => {
        const Icon = ICONS[option.icon] || FileText
        const selected = selectedId === option.id

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            aria-pressed={selected}
            className={cn(
              "group relative min-h-36 rounded-md border-2 bg-card p-5 text-left transition-all",
              "hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected ? "border-primary bg-primary/5 shadow-sm" : "border-border",
            )}
          >
            {selected && (
              <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" />
              </span>
            )}
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-6 w-6" />
            </div>
            <p className="font-semibold leading-tight">{option.label}</p>
            {option.description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{option.description}</p>
            )}
            {areaCounts?.[option.id] !== undefined && (
              <p className="mt-3 text-xs font-medium text-primary">
                {areaCounts[option.id]} áreas disponíveis
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

const GENERATION_MESSAGES = [
  "Analisando a etapa de ensino...",
  "Relacionando habilidades da BNCC...",
  "Organizando objetivos e atividades...",
  "Aplicando princípios do DUA...",
  "Verificando possibilidades de acessibilidade...",
  "Preparando a avaliação e os recursos...",
]

function AIGenerationOverlay() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length),
      1_800,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7 animate-pulse" />
        </div>
        <h3 className="text-xl font-semibold">Criando seu planejamento</h3>
        <p className="mt-2 min-h-6 text-muted-foreground">{GENERATION_MESSAGES[messageIndex]}</p>
        <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Mantenha esta página aberta. O conteúdo será salvo automaticamente.
        </p>
      </div>
    </div>
  )
}

export function PlanningWizard({ initialAccess, initialData }: PlanningWizardProps) {
  const router = useRouter()
  const hasInitialSelection = Boolean(
    initialData?.stageId && initialData.areaId && initialData.gradeId && initialData.planningTypeId,
  )
  const [step, setStep] = useState(hasInitialSelection ? 6 : 1)
  const [stageId, setStageId] = useState(initialData?.stageId || "")
  const [areaId, setAreaId] = useState(initialData?.areaId || "")
  const [gradeId, setGradeId] = useState(initialData?.gradeId || "")
  const [planningTypeId, setPlanningTypeId] = useState(initialData?.planningTypeId || "")
  const [inclusionMode, setInclusionMode] = useState<InclusionModeId>(
    initialData?.inclusionMode || "REGULAR",
  )
  const [inclusionNeeds, setInclusionNeeds] = useState<string[]>(initialData?.inclusionNeeds || [])
  const [accessibilityResources, setAccessibilityResources] = useState<string[]>(
    initialData?.accessibilityResources || [],
  )
  const [pedagogicalProfile, setPedagogicalProfile] = useState<PedagogicalProfile>(
    initialData?.pedagogicalProfile || {},
  )
  const [imageMode, setImageMode] = useState<ImageModeId>(initialData?.imageMode || "NONE")
  const [imageStyle, setImageStyle] = useState<ImageStyleId>(
    initialData?.imageStyle || "EDUCATIONAL",
  )
  const [coloringPage, setColoringPage] = useState(Boolean(initialData?.coloringPage))
  const [accessibleImages, setAccessibleImages] = useState(
    Boolean(initialData?.accessibleImages),
  )
  const [generateAltText, setGenerateAltText] = useState(
    initialData?.generateAltText !== false,
  )
  const [topic, setTopic] = useState(initialData?.topic || "")
  const [request, setRequest] = useState(initialData?.request || "")
  const [additionalPreferences, setAdditionalPreferences] = useState(
    initialData?.additionalPreferences || "",
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const selectedStage = EDUCATION_STAGES.find((item) => item.id === stageId)
  const selectedArea = selectedStage?.areas.find((item) => item.id === areaId)
  const selectedGrade = selectedStage?.grades.find((item) => item.id === gradeId)
  const selectedType = PLANNING_TYPES.find((item) => item.id === planningTypeId)
  const areaCounts = useMemo(
    () => Object.fromEntries(EDUCATION_STAGES.map((item) => [item.id, item.areas.length])),
    [],
  )

  const maxAccessibleStep = stageId
    ? areaId
      ? gradeId
        ? planningTypeId
          ? 6
          : 4
        : 3
      : 2
    : 1

  const inclusionReady = inclusionMode === "REGULAR" || inclusionNeeds.length > 0
  const canContinue =
    (step === 1 && Boolean(stageId)) ||
    (step === 2 && Boolean(areaId)) ||
    (step === 3 && Boolean(gradeId)) ||
    (step === 4 && Boolean(planningTypeId)) ||
    (step === 5 && inclusionReady)

  const selectStage = (option: PlanningOption) => {
    if (option.id !== stageId) {
      setAreaId("")
      setGradeId("")
    }
    setStageId(option.id)
    setError("")
    setStep(2)
  }

  const toggleSelection = (
    id: string,
    values: string[],
    setter: (next: string[]) => void,
  ) => {
    setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id])
  }

  const updateProfile = (key: keyof PedagogicalProfile, value: string) => {
    setPedagogicalProfile((current) => ({ ...current, [key]: value }))
  }

  const submit = async () => {
    if (planningTypeId !== "outro" && topic.trim().length < 2) {
      setError("Informe o assunto da aula para que a IA possa gerar um material mais preciso.")
      return
    }
    if (request.trim().length < 10) {
      setError("Descreva o que você deseja criar com pelo menos 10 caracteres.")
      return
    }
    if (!initialAccess.canGenerate) {
      setError(initialAccess.message || "Você não possui geração disponível.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId,
          areaId,
          gradeId,
          planningTypeId,
          inclusionMode,
          inclusionNeeds,
          accessibilityResources,
          pedagogicalProfile,
          imageMode,
          imageStyle,
          coloringPage,
          accessibleImages,
          generateAltText,
          topic,
          request,
          additionalPreferences,
          planId: initialData?.planId,
        }),
      })
      const data: {
        error?: string
        code?: string
        message?: string
        upgradeRequired?: boolean
        plan?: { id?: string }
      } = await response.json().catch(() => ({}))

      if (!response.ok || !data.plan?.id) {
        setError(data.message || data.error || "Não foi possível gerar o planejamento.")
        return
      }

      const notice = data.message ? `?notice=${encodeURIComponent(data.message)}` : ""
      router.push(`/planos/${data.plan.id}${notice}`)
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const heading =
    step === 1
      ? ["Escolha a etapa de ensino", "As próximas opções serão adaptadas ao contexto selecionado."]
      : step === 2
        ? ["Escolha a área do conhecimento", `Áreas disponíveis para ${selectedStage?.label}.`]
        : step === 3
          ? ["Escolha a série ou grupo", "Selecione o público para adequar linguagem e complexidade."]
          : step === 4
            ? ["O que você deseja criar?", "Escolha o formato do material pedagógico."]
            : step === 5
              ? [
                  "Inclusão e acessibilidade",
                  "Defina apoios pedagógicos sem informar dados pessoais ou realizar diagnóstico.",
                ]
              : ["Descreva seu pedido", "Revise as escolhas e complemente o que a IA deve produzir."]

  return (
    <Card className="relative mx-auto w-full max-w-5xl overflow-hidden shadow-lg">
      <CardHeader className="space-y-5 border-b bg-muted/20">
        <PlanningStepper
          currentStep={step}
          maxAccessibleStep={maxAccessibleStep}
          onStepSelect={setStep}
        />
        <div>
          <CardTitle className="text-2xl">{heading[0]}</CardTitle>
          <CardDescription className="mt-1">{heading[1]}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 lg:p-8">
        {step === 1 && (
          <OptionGrid
            options={EDUCATION_STAGES}
            selectedId={stageId}
            onSelect={selectStage}
            areaCounts={areaCounts}
          />
        )}

        {step === 2 && selectedStage && (
          <OptionGrid
            options={selectedStage.areas}
            selectedId={areaId}
            onSelect={(option) => {
              setAreaId(option.id)
              setError("")
              setStep(3)
            }}
          />
        )}

        {step === 3 && selectedStage && (
          <OptionGrid
            options={selectedStage.grades}
            selectedId={gradeId}
            onSelect={(option) => {
              setGradeId(option.id)
              setError("")
              setStep(4)
            }}
          />
        )}

        {step === 4 && (
          <OptionGrid
            options={PLANNING_TYPES}
            selectedId={planningTypeId}
            onSelect={(option) => {
              setPlanningTypeId(option.id)
              setError("")
              setStep(5)
            }}
          />
        )}

        {step === 5 && (
          <div className="space-y-7">
            <div className="grid gap-4 md:grid-cols-3">
              {INCLUSION_MODES.map((mode) => {
                const Icon = ICONS[mode.icon] || Accessibility
                const selected = inclusionMode === mode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setInclusionMode(mode.id)
                      if (mode.id === "REGULAR") {
                        setInclusionNeeds([])
                        setAccessibilityResources([])
                      }
                    }}
                    className={cn(
                      "relative min-h-40 border-2 bg-card p-5 text-left transition-all hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    <Icon className="mb-4 h-7 w-7 text-primary" />
                    <p className="font-semibold">{mode.label}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">{mode.description}</p>
                  </button>
                )
              })}
            </div>

            {inclusionMode !== "REGULAR" && (
              <div className="space-y-7 border-t pt-7">
                <section aria-labelledby="needs-title">
                  <div className="mb-3">
                    <h3 id="needs-title" className="font-semibold">Necessidades educacionais</h3>
                    <p className="text-sm text-muted-foreground">
                      Selecione uma ou mais. Essas informações apoiam o planejamento e não representam diagnóstico.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {INCLUSION_NEEDS.map((need) => {
                      const selected = inclusionNeeds.includes(need.id)
                      return (
                        <button
                          key={need.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            toggleSelection(need.id, inclusionNeeds, setInclusionNeeds)
                          }
                          className={cn(
                            "flex min-h-11 items-center gap-3 border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            selected
                              ? "border-primary bg-primary/5 text-foreground"
                              : "bg-background hover:bg-muted/60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center border",
                              selected && "border-primary bg-primary text-primary-foreground",
                            )}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          {need.label}
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section aria-labelledby="resources-title">
                  <div className="mb-3">
                    <h3 id="resources-title" className="font-semibold">Recursos de acessibilidade</h3>
                    <p className="text-sm text-muted-foreground">Selecione apenas recursos pertinentes ao contexto.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {ACCESSIBILITY_RESOURCE_GROUPS.map((group) => (
                      <div key={group.id} className="border bg-muted/20 p-4">
                        <h4 className="mb-3 text-sm font-semibold">{group.label}</h4>
                        <div className="flex flex-wrap gap-2">
                          {group.resources.map(([id, label]) => {
                            const selected = accessibilityResources.includes(id)
                            return (
                              <button
                                key={id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  toggleSelection(
                                    id,
                                    accessibilityResources,
                                    setAccessibilityResources,
                                  )
                                }
                                className={cn(
                                  "min-h-9 border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "bg-background hover:border-primary/50",
                                )}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-labelledby="profile-title">
                  <div className="mb-3">
                    <h3 id="profile-title" className="font-semibold">Perfil pedagógico opcional</h3>
                    <p className="text-sm text-muted-foreground">
                      Não informe nome, CPF, endereço, diagnóstico ou outros dados identificáveis.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PEDAGOGICAL_PROFILE_FIELDS.map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`profile-${key}`}>{label}</Label>
                        <Textarea
                          id={`profile-${key}`}
                          value={pedagogicalProfile[key] || ""}
                          onChange={(event) => updateProfile(key, event.target.value)}
                          maxLength={500}
                          className="min-h-20 resize-y"
                          placeholder="Informação pedagógica opcional"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            <div className="border-l-4 border-primary bg-primary/5 p-4 text-sm">
              <strong>Compromisso com a inclusão:</strong> o + Educação utiliza essas informações
              somente para sugerir estratégias pedagógicas e princípios do DUA. A ferramenta não
              realiza diagnóstico e não substitui o trabalho da equipe escolar especializada.
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="planning-topic" className="text-base">
                  Assunto {planningTypeId === "outro" ? "(opcional)" : "*"}
                </Label>
                <Input
                  id="planning-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  maxLength={160}
                  required={planningTypeId !== "outro"}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Ex.: Frações e números decimais"
                  aria-describedby="planning-topic-help"
                />
                <p id="planning-topic-help" className="text-xs text-muted-foreground">
                  Informe o tema específico que será trabalhado nesta aula ou atividade.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planning-request" className="text-base">
                  Descreva o que você deseja criar
                </Label>
                <Textarea
                  id="planning-request"
                  value={request}
                  onChange={(event) => setRequest(event.target.value)}
                  maxLength={2_000}
                  className="min-h-40 resize-y"
                  placeholder="Ex: Crie uma aula sobre meio ambiente para o 3º ano, utilizando atividades práticas, materiais simples e alinhamento à BNCC."
                />
                <p className="text-right text-xs text-muted-foreground">{request.length}/2000</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="additional-preferences">Preferências adicionais (opcional)</Label>
                <Textarea
                  id="additional-preferences"
                  value={additionalPreferences}
                  onChange={(event) => setAdditionalPreferences(event.target.value)}
                  maxLength={1_000}
                  className="min-h-24 resize-y"
                  placeholder="Ex: priorizar trabalho em grupo, evitar telas, incluir adaptação inclusiva..."
                />
              </div>

              <section className="space-y-4 border-t pt-5" aria-labelledby="visual-resources-title">
                <div>
                  <h3 id="visual-resources-title" className="font-semibold">Recursos visuais</h3>
                  <p className="text-sm text-muted-foreground">
                    As imagens são geradas somente quando possuem função pedagógica e consomem o limite de imagens do plano.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {IMAGE_MODES.map((mode) => (
                    <label
                      key={mode.id}
                      className={cn(
                        "flex cursor-pointer gap-3 border p-3 text-sm",
                        imageMode === mode.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="image-mode"
                        value={mode.id}
                        checked={imageMode === mode.id}
                        onChange={() => setImageMode(mode.id)}
                      />
                      <span><strong className="block">{mode.label}</strong><span className="text-xs text-muted-foreground">{mode.description}</span></span>
                    </label>
                  ))}
                </div>

                {imageMode !== "NONE" && (
                  <div className="space-y-4 border bg-muted/20 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="image-style">Estilo das imagens</Label>
                      <select
                        id="image-style"
                        value={imageStyle}
                        onChange={(event) => {
                          const next = event.target.value as ImageStyleId
                          setImageStyle(next)
                          if (next === "COLORING_PAGE") setColoringPage(true)
                        }}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {IMAGE_STYLES.map((style) => (
                          <option key={style.id} value={style.id}>{style.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["coloring", "Desenho para colorir", coloringPage, setColoringPage],
                        ["accessible", "Adaptar imagens para acessibilidade", accessibleImages, setAccessibleImages],
                        ["alt", "Gerar descrição alternativa", generateAltText, setGenerateAltText],
                      ].map(([id, label, checked, setter]) => (
                        <label key={String(id)} className="flex min-h-11 cursor-pointer items-center gap-3 border bg-background px-3 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(checked)}
                            onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                          />
                          {String(label)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="h-fit rounded-md border bg-muted/30 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Resumo do pedido</h3>
              </div>
              <dl className="space-y-4 text-sm">
                {[
                  ["Etapa", selectedStage?.label, 1],
                  ["Área", selectedArea?.label, 2],
                  ["Série", selectedGrade?.label, 3],
                  ["Tipo", selectedType?.label, 4],
                  [
                    "Inclusão",
                    INCLUSION_MODES.find((item) => item.id === inclusionMode)?.label,
                    5,
                  ],
                  ["Assunto", topic || "—", 6],
                  [
                    "Imagens",
                    IMAGE_MODES.find((item) => item.id === imageMode)?.label,
                    6,
                  ],
                ].map(([label, value, editStep]) => (
                  <div key={String(label)}>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 flex items-start justify-between gap-2 font-medium">
                      <span>{String(value || "—")}</span>
                      <button
                        type="button"
                        onClick={() => setStep(Number(editStep))}
                        className="text-xs text-primary hover:underline"
                      >
                        Editar
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t pt-5 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1 || loading}
          >
            Voltar
          </Button>

          {step < 6 ? (
            <Button
              type="button"
              onClick={() => setStep((current) => Math.min(6, current + 1))}
              disabled={!canContinue}
            >
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={loading || !initialAccess.canGenerate}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {initialData?.planId ? "Gerar nova versão" : "Gerar planejamento"}
            </Button>
          )}
        </div>
      </CardContent>
      {loading && <AIGenerationOverlay />}
    </Card>
  )
}
