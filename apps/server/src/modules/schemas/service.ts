import { db } from "@ocrbase/db";
import { schemas } from "@ocrbase/db/schema/schemas";
import { and, eq, sql } from "drizzle-orm";

import type { CreateSchemaBody, UpdateSchemaBody } from "./model";

import { llmService } from "../../services/llm";

export interface GeneratedSchemaResult {
  suggestedName: string;
  suggestedDescription: string;
  suggestedSchema: Record<string, unknown>;
  sampleMarkdown?: string;
  sampleJobId?: string;
}

const create = async (
  organizationId: string,
  userId: string,
  data: CreateSchemaBody
) => {
  const [schema] = await db
    .insert(schemas)
    .values({
      description: data.description,
      jsonSchema: data.jsonSchema,
      name: data.name,
      organizationId,
      userId,
    })
    .returning();

  return schema;
};

const list = async (organizationId: string, userId: string) => {
  const result = await db
    .select()
    .from(schemas)
    .where(
      and(
        eq(schemas.organizationId, organizationId),
        eq(schemas.userId, userId)
      )
    );

  return result;
};

const getById = async (
  organizationId: string,
  userId: string,
  schemaId: string
) => {
  const [schema] = await db
    .select()
    .from(schemas)
    .where(
      and(
        eq(schemas.id, schemaId),
        eq(schemas.organizationId, organizationId),
        eq(schemas.userId, userId)
      )
    );

  return schema ?? null;
};

const update = async (
  organizationId: string,
  userId: string,
  schemaId: string,
  data: UpdateSchemaBody
) => {
  const updateData: Partial<{
    name: string;
    description: string | null;
    jsonSchema: Record<string, unknown>;
  }> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.jsonSchema !== undefined) {
    updateData.jsonSchema = data.jsonSchema;
  }

  const [schema] = await db
    .update(schemas)
    .set(updateData)
    .where(
      and(
        eq(schemas.id, schemaId),
        eq(schemas.organizationId, organizationId),
        eq(schemas.userId, userId)
      )
    )
    .returning();

  return schema ?? null;
};

const deleteSchema = async (
  organizationId: string,
  userId: string,
  schemaId: string
): Promise<boolean> => {
  const result = await db
    .delete(schemas)
    .where(
      and(
        eq(schemas.id, schemaId),
        eq(schemas.organizationId, organizationId),
        eq(schemas.userId, userId)
      )
    )
    .returning({ id: schemas.id });

  return result.length > 0;
};

const generate = async (
  _organizationId: string,
  _userId: string,
  markdown: string,
  hints?: string,
  sampleJobId?: string
): Promise<GeneratedSchemaResult> => {
  const result = await llmService.generateSchema({
    hints,
    markdown,
  });

  return {
    sampleJobId,
    sampleMarkdown: markdown,
    suggestedDescription: result.description,
    suggestedName: result.name,
    suggestedSchema: result.jsonSchema,
  };
};

const incrementUsageCount = async (schemaId: string): Promise<void> => {
  await db
    .update(schemas)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${schemas.usageCount} + 1`,
    })
    .where(eq(schemas.id, schemaId));
};

export const SchemaService = {
  create,
  delete: deleteSchema,
  generate,
  getById,
  incrementUsageCount,
  list,
  update,
};
