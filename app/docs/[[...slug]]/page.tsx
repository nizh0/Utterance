import { source } from "@/lib/source";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import defaultMdxComponents from "fumadocs-ui/mdx";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBody>
        <MDXContent components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const slug = params.slug?.join("/") || "";
  const url = `https://utterance.dev/docs${slug ? `/${slug}` : ""}`;

  return {
    title: page.data.title,
    description:
      page.data.description ||
      `${page.data.title} — Utterance SDK documentation.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${page.data.title} — Utterance Docs`,
      description:
        page.data.description ||
        `${page.data.title} — Utterance SDK documentation.`,
      url,
      type: "article",
    },
  };
}
