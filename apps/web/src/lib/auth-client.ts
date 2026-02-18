import { env } from "@ocrbase/env/web";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: `${env.VITE_SERVER_URL}/v1/auth`,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [organizationClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
