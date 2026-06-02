import type { Metadata } from "next";
import InactivitySessionGuard from "../components/InactivitySessionGuard";
import ThemeProvider from "../components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control+",
  description: "ERP Empresarial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <InactivitySessionGuard />
        </ThemeProvider>
      </body>
    </html>
  );
}
