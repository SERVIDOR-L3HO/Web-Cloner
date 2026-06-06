import { Router } from "express";
import * as cheerio from "cheerio";
import { InspectUrlBody, FetchResourceBody } from "@workspace/api-zod";

const router = Router();

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function isInternal(base: string, href: string): boolean {
  try {
    const baseHost = new URL(base).hostname;
    const hrefHost = new URL(href, base).hostname;
    return baseHost === hrefHost;
  } catch {
    return false;
  }
}

router.post("/inspect", async (req, res) => {
  const parsed = InspectUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { url } = parsed.data;

  let targetUrl = url.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL provided" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WebInspector/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    const finalUrl = response.url || targetUrl;
    const html = await response.text();
    const byteSize = Buffer.byteLength(html, "utf8");

    const rawCookies = response.headers.getSetCookie?.() ?? [];
    const responseHeaders: Array<{ name: string; value: string }> = [];
    response.headers.forEach((value, name) => {
      responseHeaders.push({ name, value });
    });

    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || "";

    const metaTags: Array<{ name: string; content: string }> = [];
    $("meta").each((_, el) => {
      const name =
        $(el).attr("name") ||
        $(el).attr("property") ||
        $(el).attr("http-equiv") ||
        "";
      const content = $(el).attr("content") || "";
      if (name) {
        metaTags.push({ name, content });
      }
    });

    const cssLinks: Array<{ url: string; type: string; size: number | null }> = [];
    $('link[rel="stylesheet"], link[type="text/css"]').each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        cssLinks.push({ url: resolveUrl(finalUrl, href), type: "css", size: null });
      }
    });

    $("style[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        cssLinks.push({ url: resolveUrl(finalUrl, src), type: "css", size: null });
      }
    });

    const jsScripts: Array<{ url: string; type: string; size: number | null }> = [];
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        jsScripts.push({ url: resolveUrl(finalUrl, src), type: "js", size: null });
      }
    });

    const images: Array<{ url: string; type: string; size: number | null }> = [];
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("data:")) {
        images.push({ url: resolveUrl(finalUrl, src), type: "image", size: null });
      }
    });

    const links: Array<{ href: string; text: string; isInternal: boolean }> = [];
    const seenLinks = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
        const resolved = resolveUrl(finalUrl, href);
        if (!seenLinks.has(resolved)) {
          seenLinks.add(resolved);
          links.push({
            href: resolved,
            text: $(el).text().trim().slice(0, 120),
            isInternal: isInternal(finalUrl, href),
          });
        }
      }
    });

    const forms: Array<{ action: string; method: string; fields: Array<{ name: string; type: string }> }> = [];
    $("form").each((_, el) => {
      const action = resolveUrl(finalUrl, $(el).attr("action") || "");
      const method = ($(el).attr("method") || "GET").toUpperCase();
      const fields: Array<{ name: string; type: string }> = [];

      $(el).find("input, select, textarea").each((__, field) => {
        const name = $(field).attr("name") || $(field).attr("id") || "";
        const type = $(field).attr("type") || field.name || "text";
        if (name) {
          fields.push({ name, type });
        }
      });

      forms.push({ action, method, fields });
    });

    const textContent = $("body").text().replace(/\s+/g, " ").trim();
    const wordCount = textContent ? textContent.split(/\s+/).length : 0;

    const result = {
      url: targetUrl,
      finalUrl,
      statusCode: response.status,
      html,
      title,
      responseHeaders,
      metaTags,
      cssLinks,
      jsScripts,
      images,
      links,
      forms,
      cookies: rawCookies,
      wordCount,
      byteSize,
      inspectedAt: new Date().toISOString(),
    };

    res.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out (15s limit)"
          : err.message
        : "Unknown error";
    req.log.error({ err }, "Failed to inspect URL");
    res.status(500).json({ error: message });
  }
});

router.post("/fetch-resource", async (req, res) => {
  const parsed = FetchResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { url } = parsed.data;

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL provided" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WebInspector/1.0)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    const content = await response.text();

    res.json({ url, content, contentType });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out"
          : err.message
        : "Unknown error";
    req.log.error({ err }, "Failed to fetch resource");
    res.status(500).json({ error: message });
  }
});

export default router;
