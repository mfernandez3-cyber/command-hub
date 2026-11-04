/** Finds a GitHub repo named in a task: a github.com link, or "repo: owner/name". */
export function repoFromText(text: string): string | null {
  const link = text.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?=[\s/#?)]|$)/i);
  if (link) return `${link[1]}/${link[2]}`;
  const named = text.match(/\brepo(?:sitory)?\s*[:=]?\s*([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (named) return `${named[1]}/${named[2]}`;
  return null;
}
