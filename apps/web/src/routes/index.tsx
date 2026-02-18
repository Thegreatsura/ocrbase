import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing-page";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      {
        title: "ocrbase — OCR for developers",
      },
      {
        content:
          "The fastest way to extract structured data from documents. 260x cheaper than GPT-4o. Open source.",
        name: "description",
      },
    ],
  }),
});
