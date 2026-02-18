import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-4 text-5xl font-bold tracking-tight">Utterance</h1>
      <p className="mb-8 max-w-lg text-lg text-fd-muted-foreground">
        Client-side semantic endpointing. Know when they&apos;re done talking.
      </p>
      <div className="flex gap-4">
        <Link
          href="/docs"
          className="rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
        >
          Documentation
        </Link>
        <Link
          href="/demo"
          className="rounded-lg border border-fd-border px-6 py-3 font-medium transition-colors hover:bg-fd-accent"
        >
          Live Demo
        </Link>
      </div>
    </main>
  );
}
