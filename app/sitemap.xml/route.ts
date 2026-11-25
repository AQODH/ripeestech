export const dynamic = "force-dynamic";

// Public pages only. Add a line here whenever a new public page is created.
const PAGES = ["/", "/privacy", "/terms"];

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const urls = PAGES.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
