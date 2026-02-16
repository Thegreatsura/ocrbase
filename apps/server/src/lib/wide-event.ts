import type { EnvironmentContext } from "./env-context";

export interface UserContext {
  id: string;
  email?: string;
}

export interface AuthContext {
  type: "anonymous" | "api_key" | "session";
  apiKeyId?: string;
}

export interface OrganizationContext {
  id: string;
  name?: string;
}

export interface JobContext {
  id: string;
  type?: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  status?: string;
}

export interface ErrorContext {
  message: string;
  code?: string;
  stack?: string;
}

export interface WideEventData {
  event: "api_request";
  requestId: string;
  timestamp?: string;
  method: string;
  path: string;
  userAgent?: string;
  statusCode?: number;
  durationMs?: number;
  outcome?: "success" | "error";
  auth?: AuthContext;
  user?: UserContext;
  organization?: OrganizationContext;
  job?: JobContext;
  error?: ErrorContext;
  env: EnvironmentContext;
}

interface InitialContext {
  requestId: string;
  method: string;
  path: string;
  userAgent?: string;
  env: EnvironmentContext;
}

const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseError = (error: unknown): ErrorContext => {
  if (error instanceof Error) {
    return {
      code: error.name || "UNKNOWN_ERROR",
      message: error.message || "Unknown error",
      stack: error.stack,
    };
  }

  if (isRecord(error)) {
    return {
      code:
        toStringValue(error.code) ??
        toStringValue(error.name) ??
        "UNKNOWN_ERROR",
      message: toStringValue(error.message) ?? String(error),
      stack: toStringValue(error.stack),
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: String(error),
  };
};

export class WideEventContext {
  private data: WideEventData;
  private startTime: number;
  private emitted: boolean;

  constructor(initial: InitialContext) {
    this.startTime = performance.now();
    this.emitted = false;
    this.data = {
      env: initial.env,
      event: "api_request",
      method: initial.method,
      path: initial.path,
      requestId: initial.requestId,
      userAgent: initial.userAgent,
    };
  }

  setAuth(auth: AuthContext): void {
    this.data.auth = auth;
  }

  setUser(user: UserContext): void {
    this.data.user = user;
  }

  setOrganization(org: OrganizationContext): void {
    this.data.organization = org;
  }

  setJob(job: JobContext): void {
    this.data.job = { ...this.data.job, ...job };
  }

  setError(error: unknown): void {
    this.data.error = parseError(error);
  }

  finalize(statusCode: number): WideEventData {
    const durationMs = Math.round(performance.now() - this.startTime);
    const isSuccess = statusCode >= 200 && statusCode < 400;

    return {
      ...this.data,
      durationMs,
      outcome: isSuccess ? "success" : "error",
      statusCode,
      timestamp: new Date().toISOString(),
    };
  }

  finalizeOnce(statusCode: number): WideEventData | null {
    if (this.emitted) {
      return null;
    }

    this.emitted = true;
    return this.finalize(statusCode);
  }
}
