import type { Metadata } from "next";
import InactivitySessionGuard from "../components/InactivitySessionGuard";
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
    <html lang="es">
      <body>
        {children}
        <InactivitySessionGuard />
      </body>
    </html>
  );
}
