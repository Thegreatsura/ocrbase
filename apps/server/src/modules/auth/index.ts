import { auth } from "@ocrbase/auth";
import { Elysia } from "elysia";

/**
 * Forward a request to Better Auth and copy response headers/body back
 * through Elysia's context so Set-Cookie (multi-value) headers are preserved.
 */
export const handleAuthRequest = async ({
  request,
  set,
}: {
  request: Request;
  set: { headers: Record<string, unknown>; status?: number | string };
}) => {
  const response = await auth.handler(request);

  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) {
    set.headers["set-cookie"] = cookies;
  }

  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() !== "set-cookie") {
      set.headers[key] = value;
    }
  }

  set.status = response.status;

  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

/**
 * Auth routes with OpenAPI documentation.
 * Each handler delegates to handleAuthRequest which wraps Better Auth and
 * correctly forwards Set-Cookie headers. The .all("/v1/auth/*") catch-all
 * in app.ts handles any undocumented routes (e.g. OAuth callbacks).
 * No body validation here to avoid conflicts with Better Auth's body parsing.
 */
export const authRoutes = new Elysia({ prefix: "/v1/auth" })
  // ============== Authentication ==============
  .post("/sign-up/email", handleAuthRequest, {
    detail: {
      description: "Create a new account with email and password",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                email: { example: "user@example.com", type: "string" },
                name: { example: "John Doe", type: "string" },
                password: { example: "securepassword123", type: "string" },
              },
              required: ["email", "password", "name"],
              type: "object",
            },
          },
        },
      },
      tags: ["Auth"],
    },
  })
  .post("/sign-in/email", handleAuthRequest, {
    detail: {
      description: "Sign in with email and password",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                email: { example: "user@example.com", type: "string" },
                password: { type: "string" },
              },
              required: ["email", "password"],
              type: "object",
            },
          },
        },
      },
      tags: ["Auth"],
    },
  })
  .post("/sign-in/social", handleAuthRequest, {
    detail: {
      description: "Initiate social login (e.g., GitHub)",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                callbackURL: { type: "string" },
                provider: { example: "github", type: "string" },
              },
              required: ["provider"],
              type: "object",
            },
          },
        },
      },
      tags: ["Auth"],
    },
  })
  .post("/sign-out", handleAuthRequest, {
    detail: {
      description: "Sign out and invalidate the current session",
      tags: ["Auth"],
    },
  })
  .get("/session", handleAuthRequest, {
    detail: {
      description: "Get the current user session",
      tags: ["Auth"],
    },
  })
  .post("/forget-password", handleAuthRequest, {
    detail: {
      description: "Request a password reset email",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                email: { example: "user@example.com", type: "string" },
              },
              required: ["email"],
              type: "object",
            },
          },
        },
      },
      tags: ["Auth"],
    },
  })
  .post("/reset-password", handleAuthRequest, {
    detail: {
      description: "Reset password using a token from the reset email",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                newPassword: { type: "string" },
                token: { type: "string" },
              },
              required: ["token", "newPassword"],
              type: "object",
            },
          },
        },
      },
      tags: ["Auth"],
    },
  })
  .get("/verify-email", handleAuthRequest, {
    detail: {
      description: "Verify email address using a token",
      tags: ["Auth"],
    },
  })

  // ============== Organization Management ==============
  .post("/organization/create", handleAuthRequest, {
    detail: {
      description: "Create a new organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                name: { example: "My Organization", type: "string" },
                slug: { example: "my-org", type: "string" },
              },
              required: ["name", "slug"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .get("/organization/get-full-organization", handleAuthRequest, {
    detail: {
      description: "Get full organization details including members",
      tags: ["Organization"],
    },
  })
  .post("/organization/update", handleAuthRequest, {
    detail: {
      description: "Update organization details",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                data: {
                  properties: {
                    name: { type: "string" },
                    slug: { type: "string" },
                  },
                  type: "object",
                },
                organizationId: { type: "string" },
              },
              required: ["organizationId", "data"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/delete", handleAuthRequest, {
    detail: {
      description: "Delete an organization (owner only)",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                organizationId: { type: "string" },
              },
              required: ["organizationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/set-active", handleAuthRequest, {
    detail: {
      description: "Set the active organization for the current session",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                organizationId: { type: "string" },
              },
              required: ["organizationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .get("/organization/list-organizations", handleAuthRequest, {
    detail: {
      description: "List all organizations the user is a member of",
      tags: ["Organization"],
    },
  })
  .get("/organization/check-slug", handleAuthRequest, {
    detail: {
      description: "Check if an organization slug is available",
      tags: ["Organization"],
    },
  })

  // ============== Member Management ==============
  .get("/organization/list-members", handleAuthRequest, {
    detail: {
      description: "List all members of an organization",
      tags: ["Organization"],
    },
  })
  .post("/organization/add-member", handleAuthRequest, {
    detail: {
      description: "Add a user directly to an organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                organizationId: { type: "string" },
                role: { example: "member", type: "string" },
                userId: { type: "string" },
              },
              required: ["organizationId", "userId", "role"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/remove-member", handleAuthRequest, {
    detail: {
      description: "Remove a member from an organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                memberId: { type: "string" },
                organizationId: { type: "string" },
              },
              required: ["organizationId", "memberId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/update-member-role", handleAuthRequest, {
    detail: {
      description: "Update a member's role in the organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                memberId: { type: "string" },
                organizationId: { type: "string" },
                role: { example: "admin", type: "string" },
              },
              required: ["organizationId", "memberId", "role"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .get("/organization/get-active-member", handleAuthRequest, {
    detail: {
      description: "Get current user's member details in active organization",
      tags: ["Organization"],
    },
  })
  .post("/organization/leave", handleAuthRequest, {
    detail: {
      description: "Leave an organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                organizationId: { type: "string" },
              },
              required: ["organizationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })

  // ============== Invitations ==============
  .post("/organization/invite-member", handleAuthRequest, {
    detail: {
      description: "Send an invitation to join an organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                email: { example: "user@example.com", type: "string" },
                organizationId: { type: "string" },
                role: { example: "member", type: "string" },
              },
              required: ["organizationId", "email", "role"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/accept-invitation", handleAuthRequest, {
    detail: {
      description: "Accept an organization invitation",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                invitationId: { type: "string" },
              },
              required: ["invitationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/reject-invitation", handleAuthRequest, {
    detail: {
      description: "Reject an organization invitation",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                invitationId: { type: "string" },
              },
              required: ["invitationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .post("/organization/cancel-invitation", handleAuthRequest, {
    detail: {
      description: "Cancel a pending invitation",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                invitationId: { type: "string" },
              },
              required: ["invitationId"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  })
  .get("/organization/get-invitation", handleAuthRequest, {
    detail: {
      description: "Get details of a specific invitation",
      tags: ["Organization"],
    },
  })
  .get("/organization/list-invitations", handleAuthRequest, {
    detail: {
      description: "List all invitations for an organization",
      tags: ["Organization"],
    },
  })

  // ============== Access Control ==============
  .post("/organization/has-permission", handleAuthRequest, {
    detail: {
      description: "Check if user has specific permissions in the organization",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                organizationId: { type: "string" },
                permission: { type: "string" },
              },
              required: ["organizationId", "permission"],
              type: "object",
            },
          },
        },
      },
      tags: ["Organization"],
    },
  });
