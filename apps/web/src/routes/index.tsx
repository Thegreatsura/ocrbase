import { createFileRoute } from "@tanstack/react-router";

const HomeComponent = () => <h1>Hello ocrbase!</h1>;

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
