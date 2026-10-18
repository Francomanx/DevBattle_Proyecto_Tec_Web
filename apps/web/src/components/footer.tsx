import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[#16233B] bg-[#070B14] py-6 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-mono">©</span>
          <Link href="/" className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition">
            <span className="font-mono font-bold text-orange-500 text-sm">&lt;</span>
            <span className="font-semibold text-white text-sm">Dev</span>
            <span className="font-semibold text-orange-500 text-sm">Battle</span>
            <span className="font-mono font-bold text-orange-500 text-sm">&gt;</span>
          </Link>
        </div>
        <p className="text-slate-500">
          Plataforma web de retos de programación competitiva.
        </p>
      </div>
    </footer>
  );
}
