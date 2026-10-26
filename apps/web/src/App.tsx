import { RouterProvider } from "@tanstack/react-router";
import { useSession } from "@/auth/session";
import { createAppRouter } from "@/router";
import { Loading } from "@/screens/loading";
import { SignIn } from "@/screens/sign-in";

const router = createAppRouter();

export function App() {
  const session = useSession();

  if (session.status === "loading") return <Loading />;
  if (session.status === "anonymous") return <SignIn onSignIn={session.signIn} />;
  return <RouterProvider router={router} />;
}
