import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { Logo } from "../shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <>
            <Logo />
            <span className="font-medium text-[15px] tracking-tight">
              Utterance
            </span>
          </>
        ),
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
