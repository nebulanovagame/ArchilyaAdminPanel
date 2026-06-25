import { AdminAuthProvider } from "@/components/auth/admin-auth-provider";
import LoginForm from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AdminAuthProvider>
      <LoginForm />
    </AdminAuthProvider>
  );
}
