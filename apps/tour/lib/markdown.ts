// Render a news post body written in Discord-flavored Markdown (bold/italic/strikethrough,
// inline code + code blocks, block quotes, lists, headings, links) to HTML. Content is pasted
// straight from Discord and rendered as-is. Authors are admins only, so the resulting HTML is
// trusted (rendered via dangerouslySetInnerHTML).
import { marked } from "marked";

export function renderPostMarkdown(body: string): string {
  // breaks: single newline -> <br> (Discord treats a lone newline as a line break);
  // gfm: strikethrough, autolinks, etc.
  return marked.parse(body, { async: false, breaks: true, gfm: true }) as string;
}
