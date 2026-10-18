"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/components/private-route";
import { CreateCompetitionForm } from "@/components/create-competition-form";

export default function CreateCompetitionPage() {
  return (
    <PrivateRoute>
      <main className="min-h-full py-6">
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
          }
        >
          <CreateCompetitionForm />
        </Suspense>
      </main>
    </PrivateRoute>
  );
}
