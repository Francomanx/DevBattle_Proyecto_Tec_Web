import { Button } from "./ui/button";
import Image from "next/image";

export function Navbar() {
  return (
    <header className="flex items-center justify-between border-b-2 border-[#455b7a]/40 bg-[#263245] px-6 py-4">
      
        {/*Logo*/}
      <div className="flex items-center gap-2">
        <Image 
          src="/logo.png" 
          alt="Logo DevBattle" 
          width={180}
          height={40}
          className="object-contain"
        />
      </div>

      {/*Controles del lado derecho*/}
      <div className="flex items-center gap-4">
        
        {/*Boton genérico primario*/}
        <div className="w-32">
          <Button href="#" variant="primary">
            + Crear Reto
          </Button>
        </div>

        {/*Separador visual*/}
        <div className="h-9 w-px bg-[#455b7a]/40"></div>

        {/*Botón de perfil*/}
        <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="h-10 w-10 rounded bg-zinc-300"></div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-white">User</span>
            <span className="text-xs text-zinc-400">Perfil</span>
          </div>
        </button>
        
      </div>
    </header>
  );
}