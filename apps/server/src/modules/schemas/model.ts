import { t, type Static } from "elysia";

export const SchemaModel = {
  createBody: t.Object({
    description: t.Optional(t.String({ maxLength: 1000 })),
    jsonSchema: t.Record(t.String(), t.Unknown()),
    name: t.String({ maxLength: 255, minLength: 1 }),
  }),

  generateBody: t.Object({
    hints: t.Optional(t.String({ maxLength: 2000 })),
    jobId: t.Optional(t.String()),
    name: t.Optional(t.String({ maxLength: 255, minLength: 1 })),
  }),

  generateResponse: t.Object({
    sampleJobId: t.Optional(t.String()),
    sampleMarkdown: t.Optional(t.String()),
    suggestedDescription: t.String(),
    suggestedName: t.String(),
    suggestedSchema: t.Record(t.String(), t.Unknown()),
  }),

  id: t.String({ pattern: "^sch_[a-zA-Z0-9_-]+$" }),

  listResponse: t.Array(
    t.Object({
      createdAt: t.String(),
      description: t.Union([t.String(), t.Null()]),
      generatedBy: t.Union([t.String(), t.Null()]),
      id: t.String(),
      jsonSchema: t.Record(t.String(), t.Unknown()),
      lastUsedAt: t.Union([t.String(), t.Null()]),
      name: t.String(),
      organizationId: t.String(),
      sampleJobId: t.Union([t.String(), t.Null()]),
      updatedAt: t.String(),
      usageCount: t.Number(),
      userId: t.String(),
    })
  ),

  response: t.Object({
    createdAt: t.String(),
    description: t.Union([t.String(), t.Null()]),
    generatedBy: t.Union([t.String(), t.Null()]),
    id: t.String(),
    jsonSchema: t.Record(t.String(), t.Unknown()),
    lastUsedAt: t.Union([t.String(), t.Null()]),
    name: t.String(),
    organizationId: t.String(),
    sampleJobId: t.Union([t.String(), t.Null()]),
    updatedAt: t.String(),
    usageCount: t.Number(),
    userId: t.String(),
  }),

  updateBody: t.Object({
    description: t.Optional(t.Union([t.String({ maxLength: 1000 }), t.Null()])),
    jsonSchema: t.Optional(t.Record(t.String(), t.Unknown())),
    name: t.Optional(t.String({ maxLength: 255, minLength: 1 })),
  }),
};

export type CreateSchemaBody = Static<typeof SchemaModel.createBody>;
export type UpdateSchemaBody = Static<typeof SchemaModel.updateBody>;
export type GenerateSchemaBody = Static<typeof SchemaModel.generateBody>;
export type SchemaResponse = Static<typeof SchemaModel.response>;
export type GenerateSchemaResponse = Static<
  typeof SchemaModel.generateResponse
>;
