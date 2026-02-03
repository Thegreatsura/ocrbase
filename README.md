# ocrbase

Turn PDFs into structured data at scale. Powered by frontier open-weight OCR models.

## Features

- **Best-in-class OCR** - PaddleOCR-VL-0.9B for accurate text extraction
- **Structured extraction** - Define schemas, get JSON back
- **Built for scale** - Queue-based processing for thousands of documents
- **Real-time updates** - WebSocket notifications for job progress
- **Self-hostable** - Run on your own infrastructure

## API Usage

```bash
# Parse a document
curl -X POST https://api.ocrbase.dev/api/parse \
  -H "Authorization: Bearer sk_xxx" \
  -F "file=@document.pdf"

# Extract with schema
curl -X POST https://api.ocrbase.dev/api/extract \
  -H "Authorization: Bearer sk_xxx" \
  -F "file=@invoice.pdf" \
  -F "schemaId=inv_schema_123"
```

**Important:** Jobs are processed asynchronously. Poll the job status or use WebSocket for real-time updates.

## LLM Integration

**Best practice:** Parse documents with ocrbase before sending to LLMs. Raw PDF binary wastes tokens and produces poor results.

## Self-Hosting

See [Self-Hosting Guide](./docs/SELF_HOSTING.md) for deployment instructions.

**Requirements:** Docker, Bun

## Architecture

![Architecture Diagram](docs/architecture.svg)

## License

MIT - See [LICENSE](LICENSE) for details.

## Contact

For API access, on-premise deployment, or questions: adammajcher20@gmail.com
