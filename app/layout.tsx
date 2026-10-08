import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Instagram Analytics", description: "Painel estratégico de análise de conteúdo do Instagram." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}