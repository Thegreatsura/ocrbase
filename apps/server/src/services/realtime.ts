import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";

import { env } from "@ocrbase/env/server";
import Redis from "ioredis";
import { setTimeout } from "node:timers/promises";

export type { JobUpdateMessage };

const getRedisUrl = (): string | null => env.REDIS_URL ?? null;

const createRedisClient = (): Redis | null => {
  const url = getRedisUrl();
  if (!url) {
    return null;
  }
  return new Redis(url, {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });
};

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

const getPublisher = (): Redis | null => {
  if (!publisher) {
    publisher = createRedisClient();
  }
  return publisher;
};

const getSubscriber = (): Redis | null => {
  if (!subscriber) {
    subscriber = createRedisClient();
  }
  return subscriber;
};

const subscriptions = new Map<
  string,
  Set<(message: JobUpdateMessage) => void>
>();

// Track the in-flight Redis SUBSCRIBE for each channel so callers can await
// readiness and avoid a race where a publish happens before the subscriber is
// actually subscribed.
const subscriptionReady = new Map<string, Promise<void>>();

const getChannelName = (jobId: string): string => `job:${jobId}`;

export const publishJobUpdate = async (
  jobId: string,
  message: JobUpdateMessage
): Promise<void> => {
  const pub = getPublisher();
  if (!pub) {
    return;
  }
  const channel = getChannelName(jobId);
  await pub.publish(channel, JSON.stringify(message));
};

const subscribeToChannel = async (
  sub: Redis,
  channel: string
): Promise<void> => {
  try {
    await sub.subscribe(channel);
  } catch (error) {
    // Allow retry on later subscribe attempts if Redis was temporarily down.
    subscriptionReady.delete(channel);
    throw error;
  }
};

export const subscribeToJob = async (
  jobId: string,
  handler: (message: JobUpdateMessage) => void
): Promise<void> => {
  const sub = getSubscriber();
  if (!sub) {
    return;
  }

  initializeMessageHandler();
  const channel = getChannelName(jobId);

  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set());
    // Store the promise immediately so concurrent calls can await it.
    const ready = subscribeToChannel(sub, channel);
    subscriptionReady.set(channel, ready);
  }

  subscriptions.get(channel)?.add(handler);

  const ready = subscriptionReady.get(channel);
  if (ready) {
    try {
      // Avoid hanging the SSE handler forever if Redis is slow/unavailable.
      await Promise.race([ready, setTimeout(1000)]);
    } catch {
      // If Redis subscribe fails, keep the handler registered; callers can
      // decide on fallback behaviour (polling, reconnect, etc.).
    }
  }
};

export const unsubscribeFromJob = (
  jobId: string,
  handler: (message: JobUpdateMessage) => void
): void => {
  const channel = getChannelName(jobId);
  const handlers = subscriptions.get(channel);

  if (handlers) {
    handlers.delete(handler);

    if (handlers.size === 0) {
      subscriptions.delete(channel);
      subscriptionReady.delete(channel);
      subscriber?.unsubscribe(channel);
    }
  }
};

let messageHandlerInitialized = false;

const initializeMessageHandler = (): void => {
  if (messageHandlerInitialized) {
    return;
  }
  const sub = getSubscriber();
  if (!sub) {
    return;
  }
  messageHandlerInitialized = true;

  sub.on("message", (channel, messageStr) => {
    const handlers = subscriptions.get(channel);

    if (handlers) {
      try {
        const message = JSON.parse(messageStr) as JobUpdateMessage;

        for (const handler of handlers) {
          handler(message);
        }
      } catch {
        // Invalid message, ignore
      }
    }
  });
};

export const closeRealtimeConnections = async (): Promise<void> => {
  subscriptions.clear();
  subscriptionReady.clear();
  const promises: Promise<string>[] = [];
  if (publisher) {
    promises.push(publisher.quit());
  }
  if (subscriber) {
    promises.push(subscriber.quit());
  }
  await Promise.all(promises);
};
