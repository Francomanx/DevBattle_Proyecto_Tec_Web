import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChallengeList } from "@/components/challenge-list";
import { AuthGate } from "@/components/auth-gate";
export default function Home() {
  //return <AuthGate />; 
  const isLogged = true;
  return (
    <div className="min-h-screen flex flex-col">
      {/*Navbar*/}
      <Navbar />

      {/*Contenido principal*/}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        
        {/*Bloque de bienvenida*/}
        {isLogged && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Bienvenido Usuario!</h1>
            <p className="mt-2 text-zinc-400">Compite, Construye y Demuestra tu Talento</p>
          </div>
        )}

        {/*Lista de retos*/}
        <ChallengeList />
      </main>

      {/*Footer*/}
      <Footer />
    </div>
  );
}