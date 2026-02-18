import { createFileRoute, redirect } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient, signIn } from "@/lib/auth-client";

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGithubLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn.social({
        callbackURL: `${window.location.origin}/app`,
        provider: "github",
      });
    } catch {
      setError("Failed to sign in with GitHub. Please try again.");
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthLayout>
      <div className="mx-auto flex w-full max-w-sm flex-col justify-center gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Welcome to ocrbase
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            Sign in with your GitHub account to continue
          </p>
        </div>

        <div className="grid gap-4">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleGithubLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Spinner className="mr-2" />
            ) : (
              <GithubIcon className="mr-2" />
            )}
            Continue with GitHub
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/app" });
    }
  },
  component: LoginPage,
  ssr: false,
});
