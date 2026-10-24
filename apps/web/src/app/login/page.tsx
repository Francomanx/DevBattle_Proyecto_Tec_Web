//con esta pagina se implementa el inicio de sesion real
//se utiliza el componente AuthGate que se encuentra en components/auth-gate.tsx

import { AuthGate } from "@/components/auth-gate";

export default function LoginPage() {
  return <AuthGate />;
}