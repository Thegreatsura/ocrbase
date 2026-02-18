import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeysSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const readErrorMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    const message = value.trim();
    if (message.length > 0 && message !== "[object Object]") {
      return message;
    }
    return null;
  }

  if (value instanceof Error) {
    return readErrorMessage(value.message) ?? readErrorMessage(value.cause);
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;

    const message =
      readErrorMessage(record.message) ??
      readErrorMessage(record.error) ??
      readErrorMessage(record.detail) ??
      readErrorMessage(record.cause);
    if (message) {
      return message;
    }

    if (Array.isArray(record.errors)) {
      for (const item of record.errors) {
        const nestedMessage = readErrorMessage(item);
        if (nestedMessage) {
          return nestedMessage;
        }
      }
    }

    if ("value" in record) {
      return readErrorMessage(record.value);
    }
  }

  return null;
};

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  readErrorMessage(error) ?? fallback;

const ApiKeyItem = React.memo(
  ({
    apiKey,
    onCopy,
    onRevoke,
    isCopied,
  }: {
    apiKey: ApiKey;
    onCopy: (text: string, id: string) => void;
    onRevoke: (key: ApiKey) => void;
    isCopied: boolean;
  }) => {
    const handleCopyClick = useCallback(() => {
      onCopy(apiKey.keyPrefix, apiKey.id);
    }, [apiKey.keyPrefix, apiKey.id, onCopy]);

    const handleRevokeClick = useCallback(() => {
      onRevoke(apiKey);
    }, [apiKey, onRevoke]);

    return (
      <div
        className={`rounded-md border p-3 ${apiKey.isActive ? "" : "opacity-60"}`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{apiKey.name}</span>
              {!apiKey.isActive && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                  Revoked
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <code className="font-mono text-sm text-muted-foreground">
                {apiKey.keyPrefix}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={handleCopyClick}
                aria-label="Copy API key prefix"
              >
                {isCopied ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Created {new Date(apiKey.createdAt).toLocaleDateString()}
              {apiKey.lastUsedAt &&
                ` · Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`}
            </p>
          </div>
          {apiKey.isActive && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="API key options"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleRevokeClick}
                >
                  <Trash2 className="size-4" />
                  Revoke key
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  }
);

ApiKeyItem.displayName = "ApiKeyItem";

export const ApiKeysSheet = ({ open, onOpenChange }: ApiKeysSheetProps) => {
  const queryClient = useQueryClient();
  const {
    data: keys = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    enabled: open,
    queryFn: async () => {
      const response = await api.v1.keys.get();
      if (response.error) {
        throw response.error;
      }
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Invalid API response while loading API keys.");
      }
      return response.data as ApiKey[];
    },
    queryKey: ["api-keys"],
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  let displayError = error;
  if (!displayError && fetchError) {
    displayError = getApiErrorMessage(fetchError, "Failed to load API keys.");
  }

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) {
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      const response = await api.v1.keys.post({
        name: newKeyName.trim(),
      });

      if (response.error) {
        throw response.error;
      }

      if (
        !response.data ||
        !("key" in response.data) ||
        typeof response.data.key !== "string"
      ) {
        throw new Error("Invalid API response while creating API key.");
      }

      setNewKey(response.data.key);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to create API key."));
    } finally {
      setIsCreating(false);
    }
  }, [newKeyName, queryClient]);

  const handleRevoke = useCallback(async () => {
    if (!keyToRevoke) {
      return;
    }

    setError(null);
    try {
      const response = await api.v1.keys({ id: keyToRevoke.id }).revoke.post();
      if (response.error) {
        throw response.error;
      }
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to revoke API key."));
    } finally {
      setKeyToRevoke(null);
    }
  }, [keyToRevoke, queryClient]);

  const handleCopyText = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCloseNewKey = useCallback(() => {
    setNewKey(null);
    setShowNewKey(true);
  }, []);

  const handleNewKeyNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewKeyName(e.target.value);
    },
    []
  );

  const handleNewKeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCreate();
      }
    },
    [handleCreate]
  );

  const handleToggleShowNewKey = useCallback(() => {
    setShowNewKey((prev) => !prev);
  }, []);

  const handleCopyNewKey = useCallback(() => {
    if (newKey) {
      handleCopyText(newKey, "new");
    }
  }, [newKey, handleCopyText]);

  const handleSetKeyToRevoke = useCallback((key: ApiKey | null) => {
    setKeyToRevoke(key);
  }, []);

  const handleClearKeyToRevoke = useCallback(() => {
    setKeyToRevoke(null);
  }, []);

  const keysList = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      );
    }

    if (keys.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Key className="size-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>
              Create an API key to access ocrbase programmatically
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/docs/$"
              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              View API documentation
              <ExternalLink className="size-3" />
            </Link>
          </EmptyContent>
        </Empty>
      );
    }

    return (
      <div className="space-y-2">
        {keys.map((key) => (
          <ApiKeyItem
            key={key.id}
            apiKey={key}
            onCopy={handleCopyText}
            onRevoke={handleSetKeyToRevoke}
            isCopied={copiedId === key.id}
          />
        ))}
      </div>
    );
  }, [keys, isLoading, handleCopyText, handleSetKeyToRevoke, copiedId]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Key className="size-5" />
              API Keys
            </SheetTitle>
            <SheetDescription>
              Manage your API keys for programmatic access
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4">
            {displayError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {displayError}
              </div>
            )}
            {/* New key display */}
            {newKey && (
              <div className="shrink-0 rounded-md border border-success/20 bg-success/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    Copy now — you won&apos;t see it again
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleCloseNewKey}
                  >
                    Dismiss
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">
                    {showNewKey ? newKey : "•".repeat(32)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={handleToggleShowNewKey}
                    aria-label={showNewKey ? "Hide API key" : "Show API key"}
                  >
                    {showNewKey ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={handleCopyNewKey}
                    aria-label="Copy API key"
                  >
                    {copiedId === "new" ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Create new key */}
            <div className="shrink-0 space-y-2">
              <Label htmlFor="key-name">Create new key</Label>
              <div className="flex gap-2">
                <Input
                  id="key-name"
                  name="key-name"
                  autoComplete="off"
                  placeholder="e.g., Production, Development…"
                  value={newKeyName}
                  onChange={handleNewKeyNameChange}
                  onKeyDown={handleNewKeyKeyDown}
                />
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newKeyName.trim()}
                >
                  {isCreating ? (
                    <Spinner className="size-4" />
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Keys list */}
            <ScrollArea className="min-h-0 flex-1">{keysList}</ScrollArea>
          </div>

          <div className="border-t px-4 py-3">
            <Link
              to="/docs/$"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              API Documentation
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!keyToRevoke} onOpenChange={handleClearKeyToRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke &quot;{keyToRevoke?.name}&quot;?
              This action cannot be undone and any applications using this key
              will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
