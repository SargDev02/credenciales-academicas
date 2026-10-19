import type {Metadata} from "next";
import "@raes/ui/styles.css";
import "./app.css";
export const metadata:Metadata={title:{default:"Credenly",template:"%s · Credenly"},description:"Credenciales académicas consultadas desde RAES"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><a href="#main-content" className="ui-skip">Saltar al contenido</a>{children}</body></html>;}
