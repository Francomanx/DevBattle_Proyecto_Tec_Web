import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevBattle",
  description: "Plataforma web de retos de programación",
};

import { AuthProvider } from "@/context/auth-context";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat/chat-widget";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#090E1A] text-slate-100">
        <TRPCReactProvider>
          <AuthProvider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <ChatWidget />
            <Footer />
          </AuthProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
