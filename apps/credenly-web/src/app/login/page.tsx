import { safeReturnPath } from "@raes/web-core";
import { AuthPage } from "../../components/auth-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirmation?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthPage
      mode="login"
      next={safeReturnPath(params.next, "/credentials")}
      failed={params.confirmation === "failed"}
    />
  );
}
