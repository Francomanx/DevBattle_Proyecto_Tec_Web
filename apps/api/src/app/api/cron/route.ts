import { NextResponse } from "next/server";
import { prisma } from "@devbattle/db"; 
import { updateCompetitionStatuses } from "@/server/services/cron.service";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await updateCompetitionStatuses(prisma);
    
    return NextResponse.json({ success: true, message: "Cron de estados ejecutado correctamente" });
  } catch (error) {
    console.error("Error en endpoint Cron:", error);
    return NextResponse.json({ success: false, error: "Fallo en el cron" }, { status: 500 });
  }
}