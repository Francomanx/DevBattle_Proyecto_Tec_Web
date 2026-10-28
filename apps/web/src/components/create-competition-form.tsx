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
      name: "",
      type: "OBJECTIVE",
      weight: 100,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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
  const addObjectiveMetric = () => {
    const newId = `metric-${Date.now()}`;
    setMetrics((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        type: "OBJECTIVE",
        weight: 0,
      },
    ]);
  };

  const addSubjectiveMetric = () => {
    const newId = `metric-${Date.now()}`;
    setMetrics((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        type: "SUBJECTIVE",
        weight: 0,
      },
    ]);
  };

  const updateMetric = (id: string, field: "name" | "weight", value: string | number) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const removeMetric = (id: string) => {
    if (metrics.length <= 1) return;
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  };

  // Metric calculations
  const objectiveMetrics = useMemo(
    () => metrics.filter((m) => m.type === "OBJECTIVE"),
    [metrics]
  );
  const subjectiveMetrics = useMemo(
    () => metrics.filter((m) => m.type === "SUBJECTIVE"),
    [metrics]
  );

  const objectiveSubtotal = useMemo(
    () => objectiveMetrics.reduce((sum, m) => sum + (Number(m.weight) || 0), 0),
    [objectiveMetrics]
  );

  const subjectiveSubtotal = useMemo(
    () => subjectiveMetrics.reduce((sum, m) => sum + (Number(m.weight) || 0), 0),
    [subjectiveMetrics]
  );

  const totalAssignedWeight = objectiveSubtotal + subjectiveSubtotal;

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

    const namedMetrics = metrics.filter((m) => m.name.trim().length > 0);
    if (namedMetrics.length === 0) {
      errors.push("Debes definir al menos una métrica de evaluación con su nombre.");
    }

    if (!submissionDeadline) {
      errors.push("Debes definir la fecha límite de recepción de soluciones.");
    }
    if (!votingDeadline) {
      errors.push("Debes definir la fecha límite de votación.");
    }
    if (submissionDeadline && votingDeadline) {
      const subDate = new Date(submissionDeadline).getTime();
      const voteDate = new Date(votingDeadline).getTime();
      if (isNaN(subDate) || isNaN(voteDate)) {
        errors.push("Las fechas ingresadas tienen un formato inválido.");
      } else if (subDate >= voteDate) {
        errors.push(
          "La fecha límite de votación debe ser posterior a la fecha límite de recepción de proyectos."
        );
      }
    }

    return errors;
  }, [
    title,
    description,
    rules,
    selectedFormats,
    metrics,
    submissionDeadline,
    votingDeadline,
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
      });

      const competitionId = result.competitionId || result.id;
      if (!competitionId) {
        throw new Error(
          "No se recibió el ID de la competencia creada por el servidor."
        );
      }

      // Redirect to competition detail page in draft status
      router.push(`/competitions/${competitionId}`);
    } catch (err: unknown) {
      console.error("Error creating draft competition:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al guardar el borrador.";
      setErrorMessage(message);
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

      {/* Error Alert if submit attempted with errors */}
      {hasAttemptedSubmit && validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm shadow-md animate-fadeIn">
          <div className="flex items-start gap-3">
            <span className="text-red-400 font-bold text-lg leading-none">⚠️</span>
            <div>
              <p className="font-semibold text-red-200">
                Se encontraron los siguientes errores en el formulario:
              </p>
              <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-red-300/90">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm shadow-md">
          <p className="font-semibold">Error al guardar:</p>
          <p className="text-xs mt-1">{errorMessage}</p>
        </div>
      )}

      {/* SECTION 1: INFORMACIÓN BASE DEL RETO */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
          <h2 className="text-base font-bold text-white tracking-wide">
            1. Información base del reto
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
                  ✓ Requisito mínimo de longitud cumplido.
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
            2. Reglas y formato de recepción
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
              className={`w-full rounded-xl border bg-[#0A101D] p-4 text-sm text-white placeholder-slate-500 transition focus:outline-none focus:ring-1 ${
                hasAttemptedSubmit && !rules.trim()
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
                    className={`h-4 w-4 transition-transform ${
                      isFormatDropdownOpen ? "rotate-180" : ""
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
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition ${
                          isChecked
                            ? "bg-orange-500/20 text-orange-200 border border-orange-500/30"
                            : "bg-[#111A2E] text-slate-300 hover:bg-[#16233B] border border-[#1E2D4A]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center text-[10px] ${
                              isChecked
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

      {/* SECTION 3: CONFIGURACIÓN DE EVALUACIÓN (MÉTRICAS) */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
          <h2 className="text-base font-bold text-white tracking-wide">
            3. Configuración de evaluación
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Banner de balance de ponderación */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-5 py-3.5">
            <div>
              <p className="text-sm font-bold text-white">Balance de ponderación</p>
              <p className="text-xs text-slate-400">
                La suma de las directrices debe alcanzar exactamente 100%
              </p>
            </div>
            <div
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${totalAssignedWeight === 100
                ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                : "bg-amber-950/80 border border-amber-500/40 text-amber-300"
                }`}
            >
              Total: {totalAssignedWeight}% Asignado
            </div>
          </div>

          {/* Dos Columnas: Métricas Objetivas y Subjetivas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna Izquierda: Métricas Objetivas */}
            <div className="flex flex-col rounded-xl border border-[#1A2845] bg-[#0D1527] p-5">
              <div className="flex items-center justify-between mb-4 border-b border-[#1A2845] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  MÉTRICAS AUTOMATIZADAS (OBJETIVAS)
                </h3>
                <span className="text-xs font-semibold text-orange-400">
                  {objectiveSubtotal}% subtotal
                </span>
              </div>

              <div className="flex-1 space-y-3 min-h-[140px]">
                {objectiveMetrics.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-6 text-center">
                    No hay métricas objetivas definidas. Haz clic abajo para agregar una.
                  </p>
                ) : (
                  objectiveMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-3 space-y-2.5 transition hover:border-[#273B60]"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={metric.name}
                          onChange={(e) =>
                            updateMetric(metric.id, "name", e.target.value)
                          }
                          placeholder="Nombre de la métrica (ej: Cobertura de pruebas)"
                          className="flex-1 rounded-lg border border-[#1E2D4A] bg-[#111A2E] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={metric.weight}
                            onChange={(e) =>
                              updateMetric(
                                metric.id,
                                "weight",
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-14 rounded-lg border border-[#1E2D4A] bg-[#111A2E] px-2 py-1.5 text-xs text-white text-right focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400 font-semibold">%</span>
                        </div>
                        {metrics.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMetric(metric.id)}
                            className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center text-xs"
                            title="Eliminar métrica"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#0E1627] rounded-md px-2.5 py-1">
                        <span>Escala 1 al 5:</span>
                        <span className="text-slate-300">
                          1=muy malo | 3=ok | 5=muy bueno
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={addObjectiveMetric}
                className="mt-4 w-full rounded-xl bg-[#FF6B00] py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#E05E00] active:scale-[0.99]"
              >
                + Agregar Objetiva
              </button>
            </div>

            {/* Columna Derecha: Métricas Subjetivas */}
            <div className="flex flex-col rounded-xl border border-[#1A2845] bg-[#0D1527] p-5">
              <div className="flex items-center justify-between mb-4 border-b border-[#1A2845] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  MÉTRICAS DE JURADO (SUBJETIVAS)
                </h3>
                <span className="text-xs font-semibold text-orange-400">
                  {subjectiveSubtotal}% subtotal
                </span>
              </div>

              <div className="flex-1 space-y-3 min-h-[140px]">
                {subjectiveMetrics.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-6 text-center">
                    No hay métricas subjetivas definidas. Haz clic abajo para agregar una.
                  </p>
                ) : (
                  subjectiveMetrics.map((metric) => (
                    <div
                      key={metric.id}
                      className="rounded-xl border border-[#1E2D4A] bg-[#0A101D] p-3 space-y-2.5 transition hover:border-[#273B60]"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={metric.name}
                          onChange={(e) =>
                            updateMetric(metric.id, "name", e.target.value)
                          }
                          placeholder="Nombre de la métrica (ej: Calidad de arquitectura)"
                          className="flex-1 rounded-lg border border-[#1E2D4A] bg-[#111A2E] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={metric.weight}
                            onChange={(e) =>
                              updateMetric(
                                metric.id,
                                "weight",
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-14 rounded-lg border border-[#1E2D4A] bg-[#111A2E] px-2 py-1.5 text-xs text-white text-right focus:border-orange-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400 font-semibold">%</span>
                        </div>
                        {metrics.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMetric(metric.id)}
                            className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center text-xs"
                            title="Eliminar métrica"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#0E1627] rounded-md px-2.5 py-1">
                        <span>Escala 1 al 5:</span>
                        <span className="text-slate-300">
                          1=muy malo | 3=ok | 5=muy bueno
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={addSubjectiveMetric}
                className="mt-4 w-full rounded-xl bg-[#FF6B00] py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#E05E00] active:scale-[0.99]"
              >
                + Agregar Subjetiva
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CRONOGRAMA Y FECHAS LÍMITE */}
      <section className="rounded-2xl border border-[#1E2D4A] bg-[#111A2E] overflow-hidden shadow-lg transition duration-200 hover:border-[#283C63]">
        <div className="border-b border-[#1A2845] bg-[#0E1628] px-6 py-4 flex items-center gap-3">
          <div className="h-4 w-4 rounded-sm bg-white shadow-sm flex-shrink-0" />
          <h2 className="text-base font-bold text-white tracking-wide">
            4. Cronograma y fechas limite
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cierre de recepción de soluciones */}
            <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-5 space-y-3">
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
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  className="w-full rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Publicación final y veredicto de jurado */}
            <div className="rounded-xl border border-[#1A2845] bg-[#0D1527] p-5 space-y-3">
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
                  value={votingDeadline}
                  onChange={(e) => setVotingDeadline(e.target.value)}
                  className="w-full rounded-xl border border-[#1E2D4A] bg-[#0A101D] px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

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
              <span className="text-emerald-400">Listo para guardar</span>
            ) : (
              <span className="text-amber-400">
                Faltan campos obligatorios ({validationErrors.length})
              </span>
            )}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="rounded-xl border border-[#2A3B5C] bg-[#0D1527] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow transition hover:bg-[#1A2640] hover:border-slate-400 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando borrador…" : "Guardar como borrador"}
          </button>

          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            className="rounded-xl bg-[#FF6B00] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#E05E00] active:scale-[0.98]"
          >
            Publicar Competencia
          </button>
        </div>
      </div>

      {/* Publish Modal Informative Notice */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#1E2D4A] bg-[#111A2E] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Publicar Competencia
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              ...Trabajo en proceso
            </p>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Por el momento, guarda el borrador{" "}
              <strong className="text-white">“Guardar como borrador”</strong>{" "}
              para dejarla creada en estado <span className="font-mono text-amber-300">draft</span>.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="rounded-xl bg-[#0D1527] border border-[#1E2D4A] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-[#16233B]"
              >
                Entendido
              </button>
              <button
                type="button"
                onClick={() => {
                  setPublishModalOpen(false);
                  handleSaveDraft();
                }}
                className="rounded-xl bg-[#FF6B00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E05E00]"
              >
                Guardar Borrador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
