import Image from "next/image";

export function Footer() {
  return (
    <footer className="flex w-full items-center border-t border-zinc-800 bg-[#263245] px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[#455b7a]">©</span>
        <Image 
          src="/logo.png" 
          alt="Logo DevBattle" 
          width={100}
          height={26}
          className="opacity-70 transition-all hover:grayscale-0 hover:opacity-100" 
        />
      </div>
    </footer>
  );
}