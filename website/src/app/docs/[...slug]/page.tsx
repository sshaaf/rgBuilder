import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listDocSlugs, readDoc, rewriteDocLinks } from "@/lib/docs";
import { GITHUB_REPO } from "@/lib/utils";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug[slug.length - 1] ?? "Docs";
  return { title: `${title} · Docs` };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const raw = readDoc(slug);
  if (!raw) notFound();
  const md = rewriteDocLinks(raw);
  const githubPath = `${GITHUB_REPO}/blob/main/docs/${slug.join("/")}.md`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="mb-6 text-sm text-[var(--mute)]">
        <Link href="/docs/" className="underline">
          Docs
        </Link>
        {" / "}
        {slug.join(" / ")}
        {" · "}
        <a href={githubPath} className="underline" target="_blank" rel="noreferrer">
          Edit on GitHub
        </a>
      </p>
      <article className="prose-docs space-y-4 text-[var(--body)] [&_a]:text-[var(--ink)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--canvas-soft)] [&_code]:px-1 [&_h1]:text-3xl [&_h1]:tracking-tight [&_h1]:text-[var(--ink)] [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:text-[var(--ink)] [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:text-[var(--ink)] [&_li]:my-1 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-[4px] [&_pre]:border [&_pre]:border-[var(--hairline)] [&_pre]:bg-[var(--canvas-soft)] [&_pre]:p-3 [&_pre]:text-sm [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-[var(--hairline)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--hairline)] [&_th]:p-2 [&_th]:text-left">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </div>
  );
}
