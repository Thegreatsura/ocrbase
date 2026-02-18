import type { ReactElement } from "react";

import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Github, Linkedin } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import { Nav } from "@/components/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CodeBlock } from "@/components/ui/code-block";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ─── helpers ─── */

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactElement;
  fallback?: ReactElement | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? children : fallback;
}

const formatCurrency = (value: unknown): string => {
  if (typeof value === "number" || typeof value === "string") {
    return `$${value}`;
  }

  return "$0";
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  HERO                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function Hero() {
  const { copied, copy } = useCopy("bun add ocrbase");

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-300">
        <Card
          className="relative overflow-hidden rounded-2xl border  py-24 shadow-none ring-0 sm:py-32"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* Corner marks */}
          <span className="absolute top-4 left-4 text-[10px] leading-none text-border dark:text-muted-foreground select-none">
            +
          </span>
          <span className="absolute top-4 right-4 text-[10px] leading-none text-border dark:text-muted-foreground select-none">
            +
          </span>
          <span className="absolute bottom-4 left-4 text-[10px] leading-none text-border dark:text-muted-foreground select-none">
            +
          </span>
          <span className="absolute right-4 bottom-4 text-[10px] leading-none text-border dark:text-muted-foreground select-none">
            +
          </span>

          <div className="relative text-center">
            {/* ── Variant A: Soft gradient pill ── */}
            <a
              href="https://news.ycombinator.com/item?id=46691454"
              target="_blank"
              rel="noopener noreferrer"
              className="hn-pill group mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-all"
            >
              <span className="hn-pill-bold font-semibold">#1</span>
              <span className="hn-pill-text">on Hacker News</span>
              <ExternalLink className="h-3 w-3 hn-pill-icon transition-transform group-hover:translate-x-0.5" />
            </a>
            <h1 className="font-display text-4xl font-semibold tracking-tighter leading-[0.95] text-foreground sm:text-6xl md:text-[5.5rem]">
              OCR for developers.
            </h1>

            <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground sm:text-2xl">
              The fastest way to extract structured data
              <br />
              from documents using AI.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/app"
                className={cn(
                  buttonVariants({ size: "lg", variant: "default" }),
                  "h-11 rounded-md px-6 text-[15px]"
                )}
              >
                Try Playground
              </Link>
              <Button
                onClick={copy}
                variant="outline"
                className="h-11 gap-3 rounded-md border bg-background px-5 font-code text-[14px] text-muted-foreground shadow-none"
              >
                $ bun add ocrbase
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  LOGO BAR                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function LogoBar() {
  const base =
    "w-auto opacity-40 hover:opacity-100 transition-opacity duration-300 logo-themed";
  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-[1200px] text-center">
        <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
          Trusted by devs at
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-10 sm:gap-14">
          <img
            src="/logos/palantir.svg"
            alt="Palantir"
            className={`h-5 ${base}`}
          />
          <img
            src="/logos/Deloitte-Logo.wine.svg"
            alt="Deloitte"
            className={`h-5 ${base}`}
          />
          <img src="/logos/orange.svg" alt="Orange" className={`h-7 ${base}`} />
          <img src="/logos/esa.svg" alt="ESA" className={`h-7 ${base}`} />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  COMPARISON CHARTS                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const ACCURACY_DATA = [
  { fill: "var(--color-aws)", provider: "AWS Textract", score: 78 },
  { fill: "var(--color-azure)", provider: "Azure Doc AI", score: 82 },
  { fill: "var(--color-gpt4o)", provider: "GPT-4o", score: 85 },
  { fill: "var(--color-ocrbase)", provider: "ocrbase", score: 94.5 },
];

const COST_DATA = [
  { cost: 1, fill: "var(--color-ocrbase)", provider: "ocrbase" },
  { cost: 12, fill: "var(--color-azure)", provider: "Azure Doc AI" },
  { cost: 15, fill: "var(--color-aws)", provider: "AWS Textract" },
  { cost: 50, fill: "var(--color-gpt4o)", provider: "GPT-4o" },
];

const accuracyConfig = {
  aws: { color: "var(--chart-5)", label: "AWS Textract" },
  azure: { color: "var(--chart-5)", label: "Azure Doc AI" },
  gpt4o: { color: "var(--chart-5)", label: "GPT-4o" },
  ocrbase: { color: "var(--chart-1)", label: "ocrbase" },
  score: { label: "OmniDocBench Score" },
} satisfies ChartConfig;

const costConfig = {
  aws: { color: "var(--chart-5)", label: "AWS Textract" },
  azure: { color: "var(--chart-5)", label: "Azure Doc AI" },
  cost: { label: "Cost / 1k pages" },
  gpt4o: { color: "var(--chart-5)", label: "GPT-4o" },
  ocrbase: { color: "var(--chart-1)", label: "ocrbase" },
} satisfies ChartConfig;

const FEATURES = [
  { label: "Structured output", ocrbase: true, others: "GPT-4o only" },
  { label: "Self-hostable", ocrbase: true, others: false },
  { label: "Open source", ocrbase: true, others: false },
] as const;

function ComparisonTable() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[1200px]">
        <Separator />
        <div className="pt-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Replace your current stack
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Better accuracy at a fraction of the cost. Actually open source.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Accuracy chart */}
            <Card className="rounded-2xl border border-border dark:border-muted-foreground/20 py-0 shadow-none ring-0">
              <CardContent className="p-6">
                <span className="inline-block rounded-full border border-border dark:border-muted-foreground/20 bg-muted/60 px-3.5 py-1 text-[13px] font-semibold text-foreground">
                  OmniDocBench Accuracy
                </span>
                <ClientOnly
                  fallback={
                    <div className="mt-4 aspect-[4/3] w-full rounded-md bg-muted/40" />
                  }
                >
                  <ChartContainer
                    config={accuracyConfig}
                    className="mt-4 aspect-[4/3] w-full"
                  >
                    <BarChart
                      data={ACCURACY_DATA}
                      margin={{ bottom: 0, left: 0, right: 0, top: 24 }}
                      barSize={48}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="provider"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        domain={[60, 100]}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="score"
                          position="top"
                          className="fill-foreground text-xs font-medium"
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </ClientOnly>
              </CardContent>
            </Card>

            {/* Cost chart */}
            <Card className="rounded-2xl border border-border dark:border-muted-foreground/20 py-0 shadow-none ring-0">
              <CardContent className="p-6">
                <span className="inline-block rounded-full border border-border dark:border-muted-foreground/20 bg-muted/60 px-3.5 py-1 text-[13px] font-semibold text-foreground">
                  Cost per 1,000 Pages
                </span>
                <ClientOnly
                  fallback={
                    <div className="mt-4 aspect-[4/3] w-full rounded-md bg-muted/40" />
                  }
                >
                  <ChartContainer
                    config={costConfig}
                    className="mt-4 aspect-[4/3] w-full"
                  >
                    <BarChart
                      data={COST_DATA}
                      margin={{ bottom: 0, left: 0, right: 0, top: 24 }}
                      barSize={48}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="provider"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                        tickFormatter={formatCurrency}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={formatCurrency}
                          />
                        }
                      />
                      <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="cost"
                          position="top"
                          className="fill-foreground text-xs font-medium"
                          formatter={formatCurrency}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </ClientOnly>
              </CardContent>
            </Card>
          </div>

          {/* Feature badges */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="inline-flex items-center gap-2 rounded-full border border-border dark:border-muted-foreground/20 bg-muted/60 px-4 py-1.5 text-[13px]"
              >
                <Check className="h-3.5 w-3.5 text-foreground" />
                <span className="font-medium text-foreground">{f.label}</span>
                {typeof f.others === "string" && (
                  <span className="text-muted-foreground">({f.others})</span>
                )}
                {f.others === false && (
                  <span className="text-muted-foreground">(ocrbase only)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  TESTIMONIALS (masonry)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const QUOTES = [
  {
    handle: "@lukasz_dev",
    name: "\u0141ukasz",
    text: "Built an identical pipeline before \u2014 happy to advise on architecture and scaling. ocrbase nails the hard parts.",
  },
  {
    handle: "@jakub_ai",
    name: "Jakub",
    text: "Currently processing ~1k documents/day, targeting 2M pages/year. The queue-based architecture handles it without breaking a sweat.",
  },
  {
    handle: "@mikolaj_m",
    name: "Miko\u0142aj",
    text: "We want to cut our Textract costs.",
  },
  {
    handle: "@tomek_dev",
    name: "Tomek",
    text: "3 lines of code to replace our entire document processing pipeline. The schema-driven approach is exactly what we needed.",
  },
  {
    handle: "@marta_ml",
    name: "Marta",
    text: "94.5 on OmniDocBench speaks for itself. We tested every provider \u2014 ocrbase wins on accuracy and cost.",
  },
  {
    handle: "@piotr_ops",
    name: "Piotr",
    text: "Self-hosting was a breeze. Spun it up on our GPU cluster in under an hour.",
  },
] as const;

function Testimonials() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[1200px]">
        <Separator />
        <div className="pt-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            What developers say about ocrbase
          </h2>

          <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {QUOTES.map((q) => (
              <Card
                key={q.name}
                className="mb-4 break-inside-avoid rounded-[20px] border border-border/80 dark:border-muted-foreground/20 py-0 shadow-none ring-0"
              >
                <CardContent className="px-7 py-6">
                  <div className="flex items-center gap-3.5">
                    <Avatar className="size-12">
                      <AvatarFallback className="text-base font-semibold">
                        {q.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-foreground sm:text-base">
                        {q.name}
                      </p>
                      <p className="text-xs text-muted-foreground sm:text-[14px]">
                        {q.handle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-[1.6] text-foreground sm:text-base">
                    {q.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SIMPLE SETUP (code section)                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const SCHEMA_CODE_PLAIN = `import { parse } from "ocrbase";

const { text } = await parse("./invoice.pdf");
console.log(text);`;

const SCHEMA_CODE_HTML = [
  `<span class="syntax-keyword">import</span> { <span class="syntax-fn">parse</span> } <span class="syntax-keyword">from</span> <span class="syntax-string">"ocrbase"</span>;`,
  ``,
  `<span class="syntax-keyword">const</span> { <span class="syntax-fn">text</span> } = <span class="syntax-keyword">await</span> <span class="syntax-fn">parse</span>(<span class="syntax-string">"./invoice.pdf"</span>);`,
  ``,
  `console.<span class="syntax-fn">log</span>(text);`,
].join("\n");

const RESULT_CODE_PLAIN = `# Invoice INV-1234

Vendor: Acme Corp
Total: $1,420.00

- Widget A x10: $42.00
- Widget B x5: $200.00`;

const RESULT_CODE_HTML = [
  `<span class="syntax-heading"># Invoice INV-1234</span>`,
  ``,
  `<span class="syntax-fn">Vendor</span>: <span class="syntax-string">Acme Corp</span>`,
  `<span class="syntax-fn">Total</span>: <span class="syntax-string">$1,420.00</span>`,
  ``,
  `<span class="syntax-keyword">-</span> <span class="syntax-string">Widget A x10: $42.00</span>`,
  `<span class="syntax-keyword">-</span> <span class="syntax-string">Widget B x5: $200.00</span>`,
].join("\n");

function SimpleSetup() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-[1200px]">
        <Separator />
        <div className="pt-16">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Simple setup
              </h2>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
                Parse documents in minutes with one function call.
              </p>
            </div>
            <Link
              to="/docs/$"
              params={{ _splat: "" }}
              className={cn(
                buttonVariants({ size: "default", variant: "outline" }),
                "hidden sm:inline-flex"
              )}
            >
              Read the docs <span className="text-lg">&rarr;</span>
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <CodeBlock
              filename="parse.ts"
              html={SCHEMA_CODE_HTML}
              caption="Parse a document in one line"
            >
              {SCHEMA_CODE_PLAIN}
            </CodeBlock>
            <CodeBlock
              filename="output.md"
              html={RESULT_CODE_HTML}
              caption="Markdown output"
            >
              {RESULT_CODE_PLAIN}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  CTA                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function CTASection() {
  const { copied, copy } = useCopy("bun add ocrbase");

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-300">
        <Separator />
        <div className="flex flex-col items-start justify-between gap-6 pt-16 sm:flex-row sm:items-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Start extracting data today.
          </h2>
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className={cn(
                buttonVariants({ size: "lg", variant: "default" }),
                "h-11 rounded-md px-6 text-[15px]"
              )}
            >
              Try Playground
            </Link>
            <Button
              onClick={copy}
              variant="outline"
              className="h-11 gap-3 rounded-md border-border bg-background px-5 font-code text-[14px] text-muted-foreground shadow-none hover:border-border"
            >
              $ bun add ocrbase
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FOOTER                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const FOOTER_LINKS = [
  {
    heading: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/api", label: "API Reference" },
      { href: "/docs/sdk", label: "SDK" },
    ],
  },
  {
    heading: "Community",
    links: [
      {
        href: "https://github.com/ocrbase-hq/ocrbase",
        icon: Github,
        label: "GitHub",
      },
      {
        href: "https://www.linkedin.com/company/ocrbase/",
        icon: Linkedin,
        label: "LinkedIn",
      },
    ],
  },
] as const;

function Footer() {
  return (
    <footer className="px-6 py-12">
      <div className="mx-auto max-w-[1200px]">
        <Separator className="mb-12" />
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="flex items-start gap-2">
            <span className="text-[17px] font-semibold tracking-tight text-foreground">
              ocrbase
            </span>
          </div>
          <div className="grid grid-cols-2 gap-10">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <p className="mb-4 text-[13px] font-semibold text-foreground">
                  {col.heading}
                </p>
                {col.links.some((l) => "icon" in l) ? (
                  <ul className="flex items-center gap-4">
                    {col.links.map((link) => {
                      const Icon = "icon" in link ? link.icon : null;
                      return (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            aria-label={link.label}
                            {...(link.href.startsWith("http")
                              ? { rel: "noopener noreferrer", target: "_blank" }
                              : {})}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {Icon && <Icon className="h-[18px] w-[18px]" />}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          {...(link.href.startsWith("http")
                            ? { rel: "noopener noreferrer", target: "_blank" }
                            : {})}
                          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  LANDING PAGE                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <LogoBar />
        <ComparisonTable />
        <Testimonials />
        <SimpleSetup />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
