import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DevBattle API",
  description: "Backend tRPC de DevBattle",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
