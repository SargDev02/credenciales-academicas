import type { Metadata } from "next";
import "@raes/ui/styles.css";
import "./app.css";
export const metadata: Metadata = {
  title: { default: "RAES", template: "%s · RAES" },
  description: "Registro académico e interoperabilidad institucional",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a href="#main-content" className="ui-skip">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
