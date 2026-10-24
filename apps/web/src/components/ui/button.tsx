import Link from "next/link";
import { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
};

export function Button({ href, children, variant = "primary" }: ButtonProps) {
  const baseClasses = "block w-full rounded-lg text-center font-semibold transition-all duration-250";

  const variants = {
    primary: "bg-orange-500 text-base text-white hover:bg-orange-600 py-2 px-4",
    secondary: "bg-[#161B28] border border-[#455b7a] text-sm text-white hover:bg-orange-500 hover:border-orange-500 py-2 px-4",
    outline: "bg-transparent border border-orange-500 text-sm text-orange-500 hover:bg-orange-500 hover:text-white py-2 px-4",
  };

  return (
    <Link href={href} className={`${baseClasses} ${variants[variant]}`}>
      {children}
    </Link>
  );
}