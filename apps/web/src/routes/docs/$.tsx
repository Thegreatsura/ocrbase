import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import browserCollections from "fumadocs-mdx:collections/browser";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense } from "react";

import { CopyPageButton } from "@/components/copy-page-button";
import { Nav } from "@/components/nav";
import { DocsPre } from "@/components/ui/code-block";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) {
      throw notFound();
    }

    return {
      pageTree: await source.serializePageTree(source.getPageTree()),
      path: page.path,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: Mdx }, _props: undefined) {
    return (
      <DocsPage toc={toc}>
        <div className="flex items-center justify-end -mb-2">
          <CopyPageButton />
        </div>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <Mdx
            components={{
              ...defaultMdxComponents,
              Step,
              Steps,
              Tab,
              Tabs,
              pre: DocsPre,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const data = useFumadocsLoader(Route.useLoaderData());

  return (
    <>
      <Nav />
      <DocsLayout
        {...baseOptions()}
        tree={data.pageTree}
        sidebar={{ collapsible: false }}
        containerProps={{
          className: "max-w-300 mx-auto",
          style: { "--fd-banner-height": "4rem" } as React.CSSProperties,
        }}
      >
        <Suspense>{clientLoader.useContent(data.path)}</Suspense>
      </DocsLayout>
    </>
  );
}

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});
