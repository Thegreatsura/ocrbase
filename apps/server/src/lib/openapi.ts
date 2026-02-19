/**
 * Common OpenAPI schemas and documentation helpers
 */

// OpenAPI info metadata
export const OpenApiInfo = {
  description: "API for OCR document processing and structured data extraction",
  title: "ocrbase API",
  version: "1.0.0",
};

// OpenAPI servers configuration
export const OpenApiServers = [
  { description: "Production", url: "https://api.ocrbase.dev" },
  { description: "Local development", url: "http://localhost:3000" },
];

// Security scheme for OpenAPI spec
export const SecuritySchemes = {
  bearerAuth: {
    bearerFormat: "API Key",
    description:
      "API key obtained from the ocrbase dashboard. Pass as Bearer token.",
    scheme: "bearer",
    type: "http" as const,
  },
};

// OpenAPI tags configuration
export const OpenApiTags = [
  { description: "Health check endpoints", name: "Health" },
  { description: "Authentication endpoints", name: "Auth" },
  { description: "Organization management", name: "Organization" },
  { description: "Document parsing (OCR to markdown)", name: "Parse" },
  { description: "Structured data extraction", name: "Extract" },
  { description: "OCR job management", name: "Jobs" },
  { description: "API key management", name: "Keys" },
  { description: "Extraction schema management", name: "Schemas" },
  { description: "Direct upload with presigned URLs", name: "Uploads" },
];

// Tag groups for better organization in docs (Scalar/Redocly extension)
export const OpenApiTagGroups = [
  { name: "System", tags: ["Health"] },
  { name: "Authentication", tags: ["Auth", "Organization"] },
  { name: "Documents", tags: ["Parse", "Extract", "Uploads", "Jobs"] },
  { name: "Configuration", tags: ["Keys", "Schemas"] },
];

// File upload constraints
export const FileConstraints = {
  maxSize: "50MB",
  maxSizeBytes: 52_428_800,
  supportedFormats: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/tiff",
  ],
};

// ID patterns for validation
export const IdPatterns = {
  job: "^job_[a-zA-Z0-9_-]+$",
  key: "^ak_[a-zA-Z0-9_-]+$",
  schema: "^sch_[a-zA-Z0-9_-]+$",
};

// Example URLs for documentation
export const ExampleUrls = {
  document: "https://arxiv.org/pdf/2601.21957v1",
};
