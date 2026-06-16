import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const siteName = "Loot Games Legal";
const siteUrl = "https://legal.loot-games.workers.dev";

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const pages = findPolicyFiles(rootDir).map((sourcePath) => {
  const appSlug = basename(dirname(sourcePath));
  const fileName = basename(sourcePath, ".md");
  const route = `/${appSlug}/${fileName}`;
  const markdown = readFileSync(sourcePath, "utf8");
  const title = extractTitle(markdown);
  const lang = fileName.endsWith("-en") ? "en" : "ja";
  const html = renderPage({ body: renderMarkdown(markdown), lang, route, title });
  const pageDir = join(distDir, appSlug, fileName);

  mkdirSync(pageDir, { recursive: true });
  writeFileSync(join(pageDir, "index.html"), html);
  writeFileSync(join(distDir, appSlug, `${fileName}.html`), html);

  return { appSlug, fileName, lang, route, title };
});

writeFileSync(join(distDir, "index.html"), renderIndex(pages));

const appAdsPath = join(rootDir, "app-ads.txt");
writeFileSync(join(distDir, "app-ads.txt"), readFileSync(appAdsPath, "utf8"));

console.log(`Built ${pages.length} legal pages into ${relative(rootDir, distDir)}`);

function findPolicyFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "dist" && entry.name !== "node_modules")
    .flatMap((entry) => {
      const appDir = join(dir, entry.name);
      return readdirSync(appDir, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.startsWith("privacy-policy") && file.name.endsWith(".md"))
        .map((file) => join(appDir, file.name));
    })
    .sort();
}

function extractTitle(markdown) {
  return markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim() || "Legal";
}

function renderIndex(pages) {
  const links = pages
    .map((page) => `<li><a href="${page.route}">${escapeHtml(page.appSlug)} / ${escapeHtml(page.title)} (${page.lang})</a></li>`)
    .join("\n");

  return renderPage({
    body: `<h1>Loot Games Legal</h1>\n<ul>${links}</ul>`,
    lang: "en",
    route: "/",
    title: "Loot Games Legal"
  });
}

function renderPage({ body, lang, route, title }) {
  const canonical = `${siteUrl}${route}`;
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | ${siteName}</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="${siteName}" />
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #233130;
        background: #eef5f1;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      body {
        margin: 0;
        background:
          linear-gradient(135deg, rgba(113, 214, 166, 0.16) 0 24%, transparent 24% 100%),
          linear-gradient(315deg, rgba(114, 189, 241, 0.12) 0 22%, transparent 22% 100%),
          #eef5f1;
      }
      main {
        width: min(100% - 32px, 820px);
        margin: 0 auto;
        padding: 48px 0 64px;
      }
      article {
        border: 1px solid rgba(35, 49, 48, 0.12);
        border-radius: 8px;
        padding: clamp(22px, 5vw, 42px);
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 24px 64px rgba(35, 49, 48, 0.12);
      }
      a {
        color: #ef5f4d;
        font-weight: 800;
      }
      h1,
      h2 {
        line-height: 1.12;
        letter-spacing: 0;
      }
      h1 {
        margin: 0 0 20px;
        font-size: clamp(2rem, 7vw, 3.15rem);
      }
      h2 {
        margin: 30px 0 12px;
        font-size: 1.35rem;
      }
      p,
      li {
        color: #40504d;
        font-size: 1rem;
        line-height: 1.72;
      }
      ul {
        padding-left: 1.25rem;
      }
      strong {
        color: #233130;
      }
      .home-link {
        display: inline-flex;
        margin-bottom: 14px;
        color: #71817d;
        font-size: 0.86rem;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <a class="home-link" href="/">Loot Games Legal</a>
      <article>${body}</article>
    </main>
  </body>
</html>
`;
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      closeParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(trimmed.slice(2))}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();

  return html.join("\n");

  function closeParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) {
      return;
    }
    html.push("</ul>");
    inList = false;
  }
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
