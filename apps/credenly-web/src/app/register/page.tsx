import { AuthPage } from "../../components/auth-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Crear cuenta" };
export default function Register() {
  return <AuthPage mode="register" />;
}
