import { db } from "@ocrbase/db";
import { apiKeys } from "@ocrbase/db/schema/api-keys";
import { eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(ALPHABET, 32);

export const generateApiKey = (): string => `sk_${nanoid()}`;

export const hashApiKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const getKeyPrefix = (key: string): string => key.slice(0, 8);

export interface ApiKeyInfo {
  id: string;
  name: string;
  organizationId: string;
  userId: string;
}

interface ValidateApiKeyOptions {
  updateUsage?: boolean;
}

/**
 * Validates an API key from Authorization header.
 * Returns key info if valid, null otherwise.
 */
export const validateApiKey = async (
  authHeader: string | null | undefined,
  options: ValidateApiKeyOptions = {}
): Promise<ApiKeyInfo | null> => {
  const { updateUsage = true } = options;

  if (!authHeader) {
    return null;
  }

  const [scheme, ...rest] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer") {
    return null;
  }

  const token = rest.join(" ").trim();
  if (!token || !token.startsWith("sk_")) {
    return null;
  }

  const keyHash = await hashApiKey(token);
  const [foundKey] = await db
    .select({
      id: apiKeys.id,
      isActive: apiKeys.isActive,
      name: apiKeys.name,
      organizationId: apiKeys.organizationId,
      userId: apiKeys.userId,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!foundKey || !foundKey.isActive) {
    return null;
  }

  if (updateUsage) {
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        requestCount: sql`${apiKeys.requestCount} + 1`,
      })
      .where(eq(apiKeys.id, foundKey.id));
  }

  return {
    id: foundKey.id,
    name: foundKey.name,
    organizationId: foundKey.organizationId,
    userId: foundKey.userId,
  };
};
