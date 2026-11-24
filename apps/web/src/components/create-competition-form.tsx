"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useAuth } from "@/context/auth-context";

interface MetricItem {
  id: string;
  name: string;
  type: "OBJECTIVE" | "SUBJECTIVE";
  weight: number;
}

const DEFAULT_CATEGORIES = [
  "Backend",
  "Frontend",
  "Sistemas",
  "IA / Machine Learning",
  "Ciberseguridad",
  "Móvil",
];

const FORMAT_OPTIONS = [
  { value: "link", label: "Enlace / Repositorio (GitHub, GitLab, URL)" },
  { value: "zip", label: "Archivo comprimido (.ZIP)" },
  { value: "archivo", label: "Archivo individual de código (.py, .ts, etc.)" },
];

export interface EvaluationPreset {
  id: string;
  label: string;
  description: string;
  metrics: {
    name: string;
    type: "OBJECTIVE" | "SUBJECTIVE";
    weight: number;
  }[];
}

export const EVALUATION_PRESETS: EvaluationPreset[] = [
  {
    id: "frontend",
    label: "Frontend / UI",
    description: "Para interfaces y diseño: funcionalidad, experiencia de usuario y fidelidad visual.",
    metrics: [
      { name: "Funcionalidad y Requerimientos", type: "OBJECTIVE", weight: 40 },
      { name: "Diseño, UX y Responsividad", type: "SUBJECTIVE", weight: 35 },
      { name: "Calidad y Estructura del Código", type: "OBJECTIVE", weight: 25 },
    ],
  },
  {
    id: "backend",
    label: "Backend / Algoritmos",
    description: "Para servicios y lógica: exactitud técnica, pruebas, rendimiento y arquitectura.",
    metrics: [
      { name: "Exactitud y Casos Borde", type: "OBJECTIVE", weight: 45 },
      { name: "Rendimiento y Eficiencia", type: "OBJECTIVE", weight: 30 },
      { name: "Arquitectura y Buenas Prácticas", type: "SUBJECTIVE", weight: 25 },
    ],
  },
  {
    id: "hackathon",
    label: "Hackathon / Innovación",
    description: "Para prototipos y proyectos rápidos: propuesta de valor, ejecución y presentación.",
    metrics: [
      { name: "Innovación y Propuesta de Valor", type: "SUBJECTIVE", weight: 35 },
      { name: "Ejecución Técnica y Funcionalidad", type: "OBJECTIVE", weight: 35 },
      { name: "Usabilidad y Presentación", type: "SUBJECTIVE", weight: 30 },
    ],
  },
];

function getFormattedDefaultDate(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setHours(23, 59, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function getFormattedCurrentDate(): string {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

export function CreateCompetitionForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const { user } = useAuth();

  // Form State
  const [title, setTitle] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Backend"]);
  const [newTagInput, setNewTagInput] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["zip"]);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);

  // Metrics State
  const [metrics, setMetrics] = useState<MetricItem[]>([
    {
      id: "metric-1",
      name: "Exactitud y Casos Borde",
      type: "OBJECTIVE",
      weight: 45,
    },
    {
      id: "metric-2",
      name: "Rendimiento y Eficiencia",
      type: "OBJECTIVE",
      weight: 30,
    },
    {
      id: "metric-3",
      name: "Arquitectura y Buenas Prácticas",
      type: "SUBJECTIVE",
      weight: 25,
    },
  ]);

  // Deadlines
  const [submissionDeadline, setSubmissionDeadline] = useState(() =>
    getFormattedDefaultDate(7)
  );
  const [votingDeadline, setVotingDeadline] = useState(() =>
    getFormattedDefaultDate(14)
  );

  // Submission & UI feedback
  const createMutation = useMutation(trpc.competition.create.mutationOptions());
  const isSubmitting = createMutation.isPending;
  const [submittingAction, setSubmittingAction] = useState<"draft" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const resetForm = () => {
    setTitle("");
    setSelectedCategories(["Backend"]);
    setNewTagInput("");
    setShowAddTag(false);
    setDescription("");
    setRules("");
    setSelectedFormats(["zip"]);
    setIsFormatDropdownOpen(false);
    setMetrics([
      { id: "metric-1", name: "Exactitud y Casos Borde", type: "OBJECTIVE", weight: 45 },
      { id: "metric-2", name: "Rendimiento y Eficiencia", type: "OBJECTIVE", weight: 30 },
      { id: "metric-3", name: "Arquitectura y Buenas Prácticas", type: "SUBJECTIVE", weight: 25 },
    ]);
    setSubmissionDeadline(getFormattedDefaultDate(7));
    setVotingDeadline(getFormattedDefaultDate(14));
    setHasAttemptedSubmit(false);
  };

  // Category toggle
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim() && !selectedCategories.includes(newTagInput.trim())) {
      setSelectedCategories((prev) => [...prev, newTagInput.trim()]);
      setNewTagInput("");
      setShowAddTag(false);
    }
  };

  // Format toggle
  const toggleFormat = (fmt: string) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt)
        ? prev.length > 1
          ? prev.filter((f) => f !== fmt)
          : prev
        : [...prev, fmt]
    );
  };

  // Metric helpers
  const addMetric = (type: "OBJECTIVE" | "SUBJECTIVE" = "OBJECTIVE") => {
    const newId = `metric-${Date.now()}`;
    setMetrics((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        type,
        weight: 0,
      },
    ]);
  };

  const updateMetric = (
    id: string,
    field: "name" | "type" | "weight",
    value: string | number
  ) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMetric = (id: string) => {
    if (metrics.length <= 1) return;
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  };

  const handleDistributeEquitably = () => {
    if (metrics.length === 0) return;
    const count = metrics.length;
    const base = Math.floor(100 / count);
    const remainder = 100 % count;
    setMetrics((prev) =>
      prev.map((m, idx) => ({
        ...m,
        weight: base + (idx < remainder ? 1 : 0),
      }))
    );
  };

  const applyPreset = (presetId: string) => {
    const preset = EVALUATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setMetrics(
      preset.metrics.map((m, idx) => ({
        id: `metric-${Date.now()}-${idx}`,
        name: m.name,
        type: m.type,
        weight: m.weight,
      }))
    );
  };

  // Metric calculations
  const totalAssignedWeight = useMemo(
    () => metrics.reduce((sum, m) => sum + (Number(m.weight) || 0), 0),
    [metrics]
  );

  const [minDateTime] = useState(() => getFormattedCurrentDate());
  const [nowWithBuffer] = useState(() => Date.now() - 60 * 1000);

  // Validaciones individuales de cronograma
  const submissionDateError = useMemo(() => {
    if (!submissionDeadline) {
      return "Debes definir la fecha límite de recepción de soluciones.";
    }
    const subTime = new Date(submissionDeadline).getTime();
    if (isNaN(subTime)) {
      return "La fecha límite de recepción de soluciones tiene un formato inválido.";
    }
    if (subTime < nowWithBuffer) {
      return "La fecha límite de recepción no puede ser anterior a la fecha actual.";
    }
    return null;
  }, [submissionDeadline, nowWithBuffer]);

  const votingDateError = useMemo(() => {
    if (!votingDeadline) {
      return "Debes definir la fecha límite de votación.";
    }
    const voteTime = new Date(votingDeadline).getTime();
    if (isNaN(voteTime)) {
      return "La fecha límite de votación tiene un formato inválido.";
    }
    if (voteTime < nowWithBuffer) {
      return "La fecha límite de votación no puede ser anterior a la fecha actual.";
    }
    if (submissionDeadline) {
      const subTime = new Date(submissionDeadline).getTime();
      if (!isNaN(subTime) && voteTime <= subTime) {
        return "La fecha límite de votación debe ser estrictamente posterior a la fecha límite de recepción.";
      }
    }
    return null;
  }, [votingDeadline, submissionDeadline, nowWithBuffer]);

  const scheduleErrors = useMemo(() => {
    const errors: string[] = [];
    if (submissionDateError) errors.push(submissionDateError);
    if (votingDateError) errors.push(votingDateError);
    return errors;
  }, [submissionDateError, votingDateError]);

  // Validations
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!title.trim()) {
      errors.push("El título de la competencia no puede estar vacío.");
    }
    if (description.trim().length < 150) {
      errors.push(
        `La descripción debe tener al menos 150 caracteres (actualmente tiene ${description.trim().length}).`
      );
    }
    if (!rules.trim()) {
      errors.push("Debes especificar las reglas y restricciones.");
    }
    if (selectedFormats.length === 0) {
      errors.push("Debes seleccionar al menos un formato de recepción.");
    }

    if (metrics.length === 0) {
      errors.push("Debes definir al menos una métrica de evaluación.");
    }

    const hasEmptyMetricName = metrics.some((m) => !m.name.trim());
    if (hasEmptyMetricName) {
      errors.push("Todos los criterios de evaluación deben tener un nombre asignado.");
    }

    if (totalAssignedWeight !== 100) {
      errors.push(
        `La suma de las ponderaciones de evaluación debe ser exactamente 100% (actualmente es ${totalAssignedWeight}%).`
      );
    }

    // Cronograma y fechas
    errors.push(...scheduleErrors);

    return errors;
  }, [
    title,
    description,
    rules,
    selectedFormats,
    metrics,
    totalAssignedWeight,
    scheduleErrors,
  ]);

  const isFormValid = validationErrors.length === 0;

  // Handle Save as Draft
  const handleSaveDraft = async () => {
    setHasAttemptedSubmit(true);
    setErrorMessage(null);

    if (!isFormValid) {
      setErrorMessage(
        "Por favor completa todos los campos obligatorios antes de continuar."
      );
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }

    try {
      setSubmittingAction("draft");
      // Build dictionary of metrics
      const metricsDict: Record<
        string,
        { type: "OBJECTIVE" | "SUBJECTIVE"; maxValue: number; weight: number }
      > = {};

      metrics.forEach((m, idx) => {
        const key = m.name.trim() || `Metrica_${idx + 1}`;
        metricsDict[key] = {
          type: m.type,
          maxValue: 5,
          weight: Number(m.weight) || 0,
        };
      });

      if (!user?.id) {
        setErrorMessage("Debes iniciar sesión para crear una competencia.");
        return;
      }

      const result = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        rules: rules.trim(),
        fileFormat: selectedFormats.join(", "),
        tags: selectedCategories,
        submissionDeadline: new Date(submissionDeadline),
        votingDeadline: new Date(votingDeadline),
        metrics: metricsDict,
        userId: user.id,
        status: "DRAFT",
      });

      const competitionId = result.competitionId || result.id;
      if (!competitionId) {
        throw new Error(
          "No se recibió el ID de la competencia creada por el servidor."
        );
      }

      resetForm();

      // Redirect to competition detail page in draft status
      router.push(`/competitions/${competitionId}`);
    } catch (err: unknown) {
      console.error("Error creating draft competition:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al guardar el borrador.";
      setErrorMessage(message);
    } finally {
      setSubmittingAction(null);
    }
  };

  // Handle Publish Directly (Caso 2: Crear y Activar en un solo paso)
  const handlePublishCompetition = async () => {
    setHasAttemptedSubmit(true);
    setErrorMessage(null);

    if (!isFormValid) {
      setErrorMessage(
        "Por favor completa todos los campos obligatorios antes de publicar la competencia."
      );
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }

    try {
      setSubmittingAction("publish");
      const metricsDict: Record<
        string,
        { type: "OBJECTIVE" | "SUBJECTIVE"; maxValue: number; weight: number }
      > = {};

      metrics.forEach((m, idx) => {
        const key = m.name.trim() || `Metrica_${idx + 1}`;
        metricsDict[key] = {
          type: m.type,
          maxValue: 5,
          weight: Number(m.weight) || 0,
        };
      });

      if (!user?.id) {
        setErrorMessage("Debes iniciar sesión para publicar una competencia.");
        return;
      }

      const result = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        rules: rules.trim(),
        fileFormat: selectedFormats.join(", "),
        tags: selectedCategories,
        submissionDeadline: new Date(submissionDeadline),
        votingDeadline: new Date(votingDeadline),
        metrics: metricsDict,
        userId: user.id,
        status: "ACTIVE",
      });

      const competitionId = result.competitionId || result.id;
      if (!competitionId) {
        throw new Error(
          "No se recibió el ID de la competencia creada por el servidor."
        );
      }

      resetForm();

      // Redirect to competition detail page (which is now active)
      router.push(`/competitions/${competitionId}`);
    } catch (err: unknown) {
      console.error("Error publishing competition:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al publicar la competencia.";
      setErrorMessage(message);
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Page Header Banner */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Crear nueva competencia de programación
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
            Define las directrices, métricas de evaluación objetivas y subjetivas,
            y el cronograma para tu hackathon o reto técnico de alto impacto. Así
            como los rangos de evaluaciones y fechas.
          </p>
        </div>
        {user && (
          <div className="flex-shrink-0 self-start sm:self-center rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-xs text-orange-200">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Creador / Host asignado</span>
            <span className="font-bold text-white text-sm">@{user.username}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: INFORMACIÓN BASE DEL RETO */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
          <h2 className="text-base font-bold text-white tracking-wide">
            Información base del reto
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Título de la competencia */}
          <div>
            <label
              htmlFor="title"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Título de la competencia <span className="text-orange-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Algoritmo de Optimización de Rutas en Redes Distribuidas"
              maxLength={150}
              className="w-full rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-4 py-3 text-sm text-white placeholder-slate-500 transition focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            {hasAttemptedSubmit && !title.trim() && (
              <p className="mt-1.5 text-xs text-red-400">
                El título de la competencia es obligatorio.
              </p>
            )}
          </div>

          {/* Categorías y etiquetas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Categorías y etiquetas
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${isSelected
                      ? "bg-[#FF6B00] text-white shadow-md shadow-orange-500/20"
                      : "border border-[#23355A] bg-[#0D1527] text-slate-300 hover:border-slate-500 hover:text-white"
                      }`}
                  >
                    {cat}
                  </button>
                );
              })}

              {selectedCategories
                .filter((c) => !DEFAULT_CATEGORIES.includes(c))
                .map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#FF6B00] px-3.5 py-1.5 text-xs font-semibold text-white shadow-md"
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] opacity-75">×</span>
                  </button>
                ))}

              {showAddTag ? (
                <form
                  onSubmit={handleAddCustomTag}
                  className="flex items-center gap-1"
                >
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Nueva etiqueta..."
                    className="rounded-lg border border-[#23355A] bg-[#0D1527] px-3 py-1 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#FF6B00] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#E05E00]"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTag(false)}
                    className="rounded-lg border border-[#23355A] bg-[#0D1527] px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddTag(true)}
                  className="rounded-lg border border-[#23355A] bg-[#0D1527] px-3.5 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-white"
                >
                  + Añadir etiqueta
                </button>
              )}
            </div>
          </div>

          {/* Descripción detallada y contexto del problema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="description"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Descripción detallada y contexto del problema{" "}
                <span className="text-orange-400">*</span>
              </label>
              <span
                className={`text-xs font-mono font-medium ${description.trim().length >= 150
                  ? "text-emerald-400"
                  : "text-amber-400"
                  }`}
              >
                {description.trim().length} / 150 caracteres mínimos
              </span>
            </div>
            <textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalladamente el contexto del reto, los objetivos principales, los requerimientos técnicos esperados y el caso de negocio o impacto de la solución (mínimo 150 caracteres)..."
              className={`w-full rounded-xl border bg-[#0A101D] p-4 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-1 ${hasAttemptedSubmit && description.trim().length < 150
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-[#1E2D4A] focus:border-orange-500 focus:ring-orange-500"
                }`}
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              {description.trim().length < 150 ? (
                <p className="text-slate-400">
                  Faltan{" "}
                  <span className="font-semibold text-amber-400">
                    {Math.max(0, 150 - description.trim().length)}
                  </span>{" "}
                  caracteres para cumplir el mínimo requerido.
                </p>
              ) : (
                <p className="text-emerald-400 flex items-center gap-1 font-medium">
                  Requisito mínimo de longitud cumplido.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: REGLAS Y FORMATO DE RECEPCIÓN */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center gap-3 rounded-t-2xl">
          <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
          <h2 className="text-base font-bold text-white tracking-wide">
            Reglas y formato de recepción
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Reglas y restricciones de entorno */}
          <div>
            <label
              htmlFor="rules"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Reglas y restricciones de entorno{" "}
              <span className="text-orange-400">*</span>
            </label>
            <textarea
              id="rules"
              rows={4}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="1. Soluciones en cualquier lenguaje moderno (Node.js, Rust, Go, Python, etc.).&#10;2. Tiempo de ejecución límite: 2s por caso de prueba.&#10;3. Uso obligatorio de git con historial legible."
              className={`w-full rounded-xl border bg-[#0A101D] p-4 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-1 ${hasAttemptedSubmit && !rules.trim()
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-[#1E2D4A] focus:border-orange-500 focus:ring-orange-500"
                }`}
            />
            {hasAttemptedSubmit && !rules.trim() && (
              <p className="mt-1.5 text-xs text-red-400">
                Las reglas y restricciones son obligatorias.
              </p>
            )}
          </div>

          {/* Formato de entrega y recepción */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Formato de entrega y recepción{" "}
              <span className="text-orange-400">*</span>
            </label>

            <button
              type="button"
              onClick={() => setIsFormatDropdownOpen(!isFormatDropdownOpen)}
              className="w-full flex items-center justify-between rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-4 py-3 text-sm text-white cursor-pointer hover:border-[#2B406A] transition text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                {selectedFormats.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-md bg-orange-500/20 border border-orange-500/30 px-2.5 py-0.5 text-xs font-semibold text-orange-300 uppercase"
                  >
                    {fmt}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {selectedFormats.length} seleccionado(s)
                </span>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF6B00] text-white">
                  <svg
                    className={`h-4 w-4 transition-transform ${isFormatDropdownOpen ? "rotate-180" : ""
                      }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </button>

            {isFormatDropdownOpen && (
              <div className="mt-3 rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-3.5 shadow-inner space-y-2 transition-all">
                <p className="text-xs text-slate-400 font-medium px-1">
                  Selecciona los formatos admitidos (link, zip y/o archivo):
                </p>
                <div className="space-y-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const isChecked = selectedFormats.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleFormat(opt.value)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition ${isChecked
                          ? "bg-orange-500/20 text-orange-200 border border-orange-500/30"
                          : "bg-[#111A2E] text-slate-300 hover:bg-[#16233B] border border-[#1E2D4A]"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center text-[10px] ${isChecked
                              ? "bg-[#FF6B00] text-white"
                              : "border border-[#23355A] bg-[#0B111E]"
                              }`}
                          >
                            {isChecked && "✓"}
                          </div>
                          <span className="font-semibold uppercase tracking-wider text-white">
                            {opt.value}
                          </span>
                          <span className="text-slate-400">({opt.label})</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: CONFIGURACIÓN DE EVALUACIÓN Y RÚBRICA */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-sm bg-orange-500 shadow-sm flex-shrink-0" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Configuración de evaluación y rúbrica
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Escala estándar 1 al 5
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Plantillas de Evaluación Recomendadas */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Plantillas recomendadas
              </label>
              <span className="text-[11px] text-slate-400">
                Selecciona una plantilla para rellenar criterios balanceados al 100%
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {EVALUATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="rounded-xl border border-[#1E2D4A] bg-[#0D1527] p-3 text-left transition hover:border-orange-500/60 hover:bg-[#121c33] active:scale-[0.99] group"
                >
                  <p className="text-xs font-bold text-white group-hover:text-orange-400 transition">
                    {preset.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Banner de Balance de Ponderación */}
          <div className="space-y-3 rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Balance de ponderación</p>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {totalAssignedWeight === 100
                    ? "La ponderación suma exactamente 100%. Las calificaciones se calcularán con este peso relativo."
                    : `La suma de las ponderaciones debe ser 100% (diferencia: ${100 - totalAssignedWeight > 0
                      ? `+${100 - totalAssignedWeight}% restante`
                      : `${100 - totalAssignedWeight}% excedido`
                    }).`}
                </p>
              </div>
            </div>

            {/* Barra segmentada de ponderación */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A2845] flex">
              {metrics.map((m, idx) => {
                const widthPercent = Math.max(0, Math.min(100, Number(m.weight) || 0));
                if (widthPercent === 0) return null;
                const colors = [
                  "bg-orange-500",
                  "bg-blue-500",
                  "bg-emerald-500",
                  "bg-purple-500",
                  "bg-amber-500",
                  "bg-cyan-500",
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={m.id}
                    style={{ width: `${widthPercent}%` }}
                    className={`${color} h-full transition-all duration-300`}
                    title={`${m.name || `Criterio ${idx + 1}`}: ${widthPercent}%`}
                  />
                );
              })}
            </div>
          </div>

          {/* Lista Unificada de Criterios */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Criterios de evaluación ({metrics.length})
              </label>
              <span className="text-[11px] text-slate-400">
                Ponderación individual y tipo de evaluación
              </span>
            </div>

            <div className="space-y-3">
              {metrics.map((metric, index) => (
                <div
                  key={metric.id}
                  className="rounded-xl border border-[#1E2D4A] bg-[#0D1527] p-4 space-y-3 transition hover:border-[#283C63]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {metric.name.trim() || `Criterio ${index + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Tipo selector */}
                      <div className="flex rounded-lg border border-[#1E2D4A] bg-[#0A101D] p-0.5">
                        <button
                          type="button"
                          onClick={() => updateMetric(metric.id, "type", "OBJECTIVE")}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${metric.type === "OBJECTIVE"
                            ? "bg-orange-500 text-white"
                            : "text-slate-400 hover:text-white"
                            }`}
                        >
                          Técnico (Objetivo)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateMetric(metric.id, "type", "SUBJECTIVE")}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${metric.type === "SUBJECTIVE"
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-white"
                            }`}
                        >
                          Jurado (Subjetivo)
                        </button>
                      </div>

                      {metrics.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMetric(metric.id)}
                          className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center text-xs"
                          title="Eliminar criterio"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Campos de Nombre y Ponderación */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        value={metric.name}
                        onChange={(e) => updateMetric(metric.id, "name", e.target.value)}
                        placeholder="Nombre del criterio (ej: Pruebas unitarias, Usabilidad)"
                        className="w-full rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-5 flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={metric.weight}
                        onChange={(e) =>
                          updateMetric(
                            metric.id,
                            "weight",
                            Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                          )
                        }
                        className="flex-1 accent-orange-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-1 w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={metric.weight}
                          onChange={(e) =>
                            updateMetric(
                              metric.id,
                              "weight",
                              Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                            )
                          }
                          className="w-14 rounded-lg border border-[#1E2D4A] bg-[#0A101D] px-2 py-1.5 text-xs text-white text-right focus:border-orange-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-semibold">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Guía de Rúbrica */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-[#0A101D] rounded-lg px-3 py-1.5">
                    <span className="text-slate-300">
                      Tipo: {metric.type === "OBJECTIVE" ? "Evaluación técnica y automatizada" : "Cualitativa por jurado o pares"}
                    </span>
                    <span className="text-slate-400 font-mono">
                      Escala 1 a 5 (1: Insuficiente | 3: Aceptable | 5: Sobresaliente)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones de Agregar y Balancear */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => addMetric("OBJECTIVE")}
                className="flex-1 sm:flex-initial rounded-xl bg-[#1A2845] hover:bg-[#24375e] text-white border border-[#283C63] px-4 py-2.5 text-xs font-bold transition active:scale-[0.99]"
              >
                + Agregar criterio técnico
              </button>
              <button
                type="button"
                onClick={() => addMetric("SUBJECTIVE")}
                className="flex-1 sm:flex-initial rounded-xl bg-[#1A2845] hover:bg-[#24375e] text-white border border-[#283C63] px-4 py-2.5 text-xs font-bold transition active:scale-[0.99]"
              >
                + Agregar criterio de jurado
              </button>
              <button
                type="button"
                onClick={handleDistributeEquitably}
                className="flex-1 sm:flex-initial rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-2.5 text-xs font-bold transition active:scale-[0.99]"
              >
                Distribuir equitativamente
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CRONOGRAMA Y FECHAS LÍMITE */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Cronograma y fechas limite
            </h2>
          </div>
          {scheduleErrors.length > 0 && (
            <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 text-[11px] font-bold text-red-300">
              Fechas inconsistentes
            </span>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Alerta visible para fechas inconsistentes */}
          {scheduleErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs shadow-md animate-fadeIn"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-red-400 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                <div className="space-y-1">
                  <p className="font-bold text-red-200">
                    Conflicto en el cronograma: se han detectado fechas inconsistentes.
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-red-300/90">
                    {scheduleErrors.map((err, i) => (
                      <li key={i} className="break-words">{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cierre de recepción de soluciones */}
            <div
              className={`rounded-xl border bg-[#0D1527] p-5 space-y-3 transition ${submissionDateError ? "border-red-500/50" : "border-[#1A2845]"
                }`}
            >
              <div>
                <h3 className="text-sm font-bold text-white">
                  Cierre de recepción de soluciones{" "}
                  <span className="text-orange-400">*</span>
                </h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Momento exacto en el que se congelan los commits y se inhabilita el
                  envío de nuevas propuestas.
                </p>
              </div>

              <div className="pt-2">
                <input
                  type="datetime-local"
                  min={minDateTime}
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  className={`w-full rounded-xl border bg-[#0A101D] px-4 py-2.5 text-sm text-white focus:outline-none transition ${submissionDateError
                    ? "border-red-500/80 focus:border-red-500"
                    : "border-[#1E2D4A] focus:border-orange-500"
                    }`}
                />
                {submissionDateError && (
                  <p className="mt-1.5 text-xs text-red-400 font-medium">
                    {submissionDateError}
                  </p>
                )}
              </div>
            </div>

            {/* Publicación final y veredicto de jurado */}
            <div
              className={`rounded-xl border bg-[#0D1527] p-5 space-y-3 transition ${votingDateError ? "border-red-500/50" : "border-[#1A2845]"
                }`}
            >
              <div>
                <h3 className="text-sm font-bold text-white">
                  Publicación final y veredicto de jurado{" "}
                  <span className="text-orange-400">*</span>
                </h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Límite para que jueces asignen calificación en base a las métricas
                  subjetivas y se publique el podio global.
                </p>
              </div>

              <div className="pt-2">
                <input
                  type="datetime-local"
                  min={submissionDeadline || minDateTime}
                  value={votingDeadline}
                  onChange={(e) => setVotingDeadline(e.target.value)}
                  className={`w-full rounded-xl border bg-[#0A101D] px-4 py-2.5 text-sm text-white focus:outline-none transition ${votingDateError
                    ? "border-red-500/80 focus:border-red-500"
                    : "border-[#1E2D4A] focus:border-orange-500"
                    }`}
                />
                {votingDateError && (
                  <p className="mt-1.5 text-xs text-red-400 font-medium">
                    {votingDateError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Error Alert if submit attempted with errors */}
      {hasAttemptedSubmit && validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm shadow-md animate-fadeIn">
          <div className="flex items-start gap-3">
            <div>
              <p className="font-semibold text-red-200">
                Se encontraron los siguientes errores en el formulario:
              </p>
              <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-red-300/90">
                {validationErrors.map((err, i) => (
                  <li key={i} className="break-words">{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}


      {/* FOOTER ACTION BAR */}
      <div className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Status */}
        <div className="flex items-center gap-2.5">
          <div
            className={`h-2.5 w-2.5 rounded-full ${isFormValid ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
          />
          <p className="text-xs sm:text-sm font-semibold text-slate-200">
            Estado del formulario:{" "}
            {isFormValid ? (
              <span className="text-emerald-400">Listo para publicar</span>
            ) : (
              <span className="text-amber-400">
                Faltan campos obligatorios ({validationErrors.length})
              </span>
            )}
          </p>
        </div>

        {errorMessage && (
          <div className="w-full rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 break-words">
            {errorMessage}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="rounded-xl border border-[#2A3B5C] bg-[#0D1527] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow transition hover:bg-[#1A2640] hover:border-slate-400 disabled:opacity-50"
          >
            {isSubmitting && submittingAction === "draft"
              ? "Guardando borrador…"
              : "Guardar como borrador"}
          </button>

          <button
            type="button"
            onClick={() => {
              setHasAttemptedSubmit(true);
              if (!isFormValid) {
                setErrorMessage(
                  "Por favor completa todos los campos obligatorios antes de publicar la competencia."
                );
                window.scrollTo({
                  top: document.body.scrollHeight,
                  behavior: "smooth",
                });
                return;
              }
              setPublishModalOpen(true);
            }}
            disabled={isSubmitting}
            className="rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#E05E00] active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting && submittingAction === "publish"
              ? "Publicando competencia…"
              : "Publicar Competencia"}
          </button>
        </div>
      </div>

      {/* Publish Modal Confirmation */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">
                Publicar Competencia
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Estás seguro de que deseas publicar esta competencia directamente? Estará disponible públicamente para todos los participantes.
            </p>
            <div className="mt-6 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl bg-[#0D1527] border border-[#1E2D4A] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-[#16233B] hover:text-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPublishModalOpen(false);
                  await handlePublishCompetition();
                }}
                disabled={isSubmitting}
                className="rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#E05E00] shadow-md transition disabled:opacity-50"
              >
                {isSubmitting && submittingAction === "publish"
                  ? "Publicando…"
                  : "Confirmar y Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
