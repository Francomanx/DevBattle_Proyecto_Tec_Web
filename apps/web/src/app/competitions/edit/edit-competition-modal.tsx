"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type MetricType = "OBJECTIVE" | "SUBJECTIVE";
type Status = "DRAFT" | "ACTIVE" | "VOTING" | "COMPLETED";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  competition: any;
  onSuccess: () => void;
}

export default function EditCompetitionModal({ isOpen, onClose, competition, onSuccess }: EditModalProps) {
  const trpc = useTRPC();
  const editMutation = useMutation(trpc.challenge.edit.mutationOptions());

  const toLocalDatetime = (dateString: string | Date) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    rules: "",
    fileFormat: "",
    submissionDeadline: "",
    votingDeadline: "",
  });
  
  const [metrics, setMetrics] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && competition) {
      setFormData({
        title: competition.title || "",
        description: competition.description || "",
        rules: competition.rules || "",
        fileFormat: competition.fileFormat || "",
        submissionDeadline: toLocalDatetime(competition.submissionDeadline),
        votingDeadline: toLocalDatetime(competition.votingDeadline),
      });
      setMetrics(competition.metrics || []);
      setError(null);
    }
  }, [isOpen, competition]);

  if (!isOpen) return null;

  const status = competition.status as Status;
  const canEditEverything = status === "DRAFT";
  const canEditActive = status === "ACTIVE";
  const canEditVoting = status === "VOTING";

  const isTitleDisabled = !canEditEverything;
  const isRulesDisabled = !canEditEverything;
  const isFormatDisabled = !canEditEverything;
  const isSubDateDisabled = !canEditEverything && !canEditActive;
  const isMetricsDisabled = !canEditEverything && !canEditActive;
  const isDescDisabled = false;
  const isVoteDateDisabled = false;

  const handleMetricChange = (index: number, field: string, value: any) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };
    setMetrics(newMetrics);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const subDate = new Date(formData.submissionDeadline);
    const voteDate = new Date(formData.votingDeadline);

    if (voteDate <= subDate) {
      setError("La fecha de votación debe ser posterior a la de recepción.");
      return;
    }
    if (metrics.length === 0) {
      setError("Debe haber al menos una métrica de evaluación.");
      return;
    }

    try {
      await editMutation.mutateAsync({
        id: competition.id,
        title: formData.title,
        description: formData.description,
        rules: formData.rules,
        fileFormat: formData.fileFormat,
        submissionDeadline: subDate,
        votingDeadline: voteDate,
        metrics: metrics.map(m => ({
          name: m.name,
          type: m.type,
          maxValue: Number(m.maxValue),
          weight: Number(m.weight),
        }))
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al guardar los cambios.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111A2E] border border-[#1E2D4A] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 space-y-6">
        
        <div className="flex justify-between items-center border-b border-[#1E2D4A] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Editar Competencia</h2>
            <p className="text-xs text-slate-400 mt-1">
              Estado actual: <span className="font-bold text-orange-400">{status}</span>. 
              {isTitleDisabled && " Algunos campos están bloqueados por las reglas del estado."}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Título</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              disabled={isTitleDisabled}
              className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-orange-500 outline-none"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
            <textarea 
              rows={4}
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              disabled={isDescDisabled}
              className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white focus:border-orange-500 outline-none"
            />
          </div>

          {/* Reglas y Formato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reglas</label>
              <textarea 
                rows={3}
                value={formData.rules} 
                onChange={e => setFormData({...formData, rules: e.target.value})}
                disabled={isRulesDisabled}
                className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Formatos (separados por coma)</label>
              <input 
                type="text" 
                value={formData.fileFormat} 
                onChange={e => setFormData({...formData, fileFormat: e.target.value})}
                disabled={isFormatDisabled}
                className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed outline-none"
              />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha de Recepción</label>
              <input 
                type="datetime-local" 
                value={formData.submissionDeadline} 
                onChange={e => setFormData({...formData, submissionDeadline: e.target.value})}
                disabled={isSubDateDisabled}
                className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Límite de Votación</label>
              <input 
                type="datetime-local" 
                value={formData.votingDeadline} 
                onChange={e => setFormData({...formData, votingDeadline: e.target.value})}
                disabled={isVoteDateDisabled}
                className="w-full bg-[#0A101D] border border-[#1E2D4A] rounded-lg p-2.5 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2D4A]">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#1E2D4A] transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={editMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-[#FF6B00] text-white hover:bg-[#E05E00] disabled:opacity-50 transition"
            >
              {editMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}