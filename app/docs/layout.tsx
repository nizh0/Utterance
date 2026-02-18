import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: "Utterance",
        url: "/",
      }}
      links={[
        {
          text: "Playground",
          url: "/playground",
        },
      ]}
      githubUrl="https://github.com/nizh0/Utterance"
    >
      {children}
    </DocsLayout>
  );
}
