import { createFileRoute, redirect } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to ocrbase</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <Button
            variant="outline"
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
        </CardContent>
      </Card>
    </div>
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
