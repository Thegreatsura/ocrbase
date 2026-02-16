import { customAlphabet } from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 16);

export const ID_PREFIXES = {
  account: "acc",
  apiKey: "ak",
  apiKeyUsage: "aku",
  invitation: "inv",
  job: "job",
  member: "mem",
  organization: "org",
  schema: "sch",
  session: "ses",
  usageEvent: "ue",
  user: "usr",
  verification: "vrf",
} as const;

type IdPrefix = keyof typeof ID_PREFIXES;

export const createId = (prefix: IdPrefix): string => {
  const prefixValue = ID_PREFIXES[prefix];
  const id = nanoid();
  return `${prefixValue}_${id}`;
};
