import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders standard (CommonMark + GFM) markdown for event descriptions. Raw HTML is NOT parsed
 * — react-markdown escapes it — so there's no HTML injection vector even though the content is
 * shown publicly. URLs are sanitized by react-markdown's default transform.
 *
 * Headings follow GitHub's scale: each level is a distinct size/weight (not just bold), and h1/h2
 * carry a bottom border, so a heading never reads as plain bold text. Images (`![alt](url)`) and
 * links open cleanly; external links open in a new tab.
 */

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed",
        // Headings — GitHub-style tiers (size + weight + border), with breathing room above.
        "[&_h1]:mt-6 [&_h1]:mb-1 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight",
        "[&_h2]:mt-6 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight",
        "[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_h4]:mt-4 [&_h4]:text-base [&_h4]:font-semibold",
        "[&_h5]:mt-4 [&_h5]:text-sm [&_h5]:font-semibold",
        "[&_h6]:mt-4 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-muted-foreground",
        // First child never gets a top margin (avoids a gap at the top of the block).
        "[&>*:first-child]:mt-0",
        // Inline + block elements.
        "[&_a]:font-medium [&_a]:text-la-nube-selected [&_a]:underline dark:[&_a]:text-la-nube-secondary",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border",
        "[&_hr]:my-4 [&_hr]:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
