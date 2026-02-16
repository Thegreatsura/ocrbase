/**
 * Generate an API key for dev/testing without the dashboard UI.
 *
 * Usage:
 *   bun run scripts/generate-api-key.ts --org <slug-or-id> [--name <key-name>]
 */
import { db } from "@ocrbase/db";
import { member, organization } from "@ocrbase/db/schema/auth";
import { eq, or } from "drizzle-orm";
import { parseArgs } from "node:util";

import { KeyService } from "../src/modules/keys/service";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    name: { default: "cli-generated", type: "string" },
    org: { type: "string" },
  },
  strict: true,
});

if (!values.org) {
  console.error(
    "Usage: bun run scripts/generate-api-key.ts --org <slug-or-id> [--name <key-name>]"
  );
  process.exit(1);
}

// Look up org by slug or ID
const [org] = await db
  .select({ id: organization.id, name: organization.name })
  .from(organization)
  .where(or(eq(organization.slug, values.org), eq(organization.id, values.org)))
  .limit(1);

if (!org) {
  console.error(`Organization not found: ${values.org}`);
  process.exit(1);
}

// Grab first member as the userId
const [firstMember] = await db
  .select({ userId: member.userId })
  .from(member)
  .where(eq(member.organizationId, org.id))
  .limit(1);

if (!firstMember) {
  console.error(`No members found for organization: ${org.name}`);
  process.exit(1);
}

const result = await KeyService.create({
  name: values.name ?? "cli-generated",
  organizationId: org.id,
  userId: firstMember.userId,
});

console.log(`API key created for org "${org.name}":`);
console.log(result.key);
