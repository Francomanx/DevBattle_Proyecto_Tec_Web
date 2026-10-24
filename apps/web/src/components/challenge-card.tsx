"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import Image from "next/image";

type ChallengeCardProps = {
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    status: "active" | "vote" | "completed";
    formats: string[];
    deadline: string | Date | null;
    host: string;
    participantCount: number;
  };
};

const statusColors = {
  active: "bg-green-900/30 text-green-400 border border-green-800",
  vote: "bg-amber-900/30 text-amber-400 border border-amber-800",
  completed: "bg-zinc-800/50 text-zinc-400 border border-zinc-600",
} as const;

const statusLabels = {
  active: "En competición",
  vote: "En votación",
  completed: "Finalizado",
} as const;

function computeTimeLeft(deadline: string | Date | null): string {
  if (!deadline) return "Sin límite de tiempo";

  const targetDate = new Date(deadline).getTime();
  const now = Date.now();
  const distance = targetDate - now;

  if (distance < 0) return "Tiempo agotado";

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `Restan: ${days}d : ${hStr}h : ${mStr}min`;
  }
  return `Restan: ${hStr}h : ${mStr}min : ${sStr}sec`;
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    computeTimeLeft(challenge.deadline)
  );

  useEffect(() => {
    if (!challenge.deadline) return;

    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(challenge.deadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [challenge.deadline]);

  return (
    <div className="flex flex-col rounded-md border border-[#455b7a] bg-[#263245] p-5 shadow-md">
      {/* Cabecera: Host + estado */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded bg-zinc-600 flex items-center justify-center font-bold text-white text-xs uppercase">
            {challenge.host.slice(0, 2)}
          </div>
          <span className="text-sm font-semibold text-white">{challenge.host}</span>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            statusColors[challenge.status]
          }`}
        >
          {statusLabels[challenge.status]}
        </span>
      </div>

      {/* Recuadro de imagen */}
      <div className="relative mb-4 flex aspect-video w-full flex-col justify-between overflow-hidden rounded-md bg-zinc-800 p-2">
        <Image
          src="/default.png"
          alt="Imagen del reto"
          fill
          className="object-cover"
        />

        {/* Tiempo */}
        {timeLeft && (
          <div className="relative z-10 self-start">
            <span className="bg-black/80 px-3 py-1 text-[11px] font-semibold text-red-500 rounded">
              {timeLeft}
            </span>
          </div>
        )}

        {/* Formatos */}
        <div className="relative z-10 self-end">
          <span className="border border-orange-500 bg-black px-2 py-1 text-xs font-bold text-orange-500 rounded">
            {challenge.formats.length > 0
              ? challenge.formats[0] + (challenge.formats.length > 1 ? ", etc." : "")
              : "Sin formato"}
          </span>
        </div>
      </div>

      {/* Info del reto */}
      <h2 className="text-lg font-bold text-white">{challenge.title}</h2>
      <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
        {challenge.description}
      </p>

      {/* Tecnologías / Formatos */}
      <div className="mt-4 flex flex-wrap gap-2">
        {challenge.formats.map((format) => (
          <span
            key={format}
            className="border border-[#455b7a] bg-[#161B28] px-2 py-0.5 text-xs text-zinc-300 rounded"
          >
            {format}
          </span>
        ))}
      </div>

      {/* Footer: Participantes, XP y botón */}
      <div className="mt-5 border-t-2 border-[#455b7a]/40 pt-5">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>{challenge.participantCount} Participantes inscritos</span>
          <span className="font-bold text-orange-400">1,500 XP</span>
        </div>

        <Button href={`/reto/${challenge.id}`} variant="secondary">
          Ver reto
        </Button>
      </div>
    </div>
  );
}