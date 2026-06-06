import { Router } from "express";
import * as cheerio from "cheerio";
import { InspectUrlBody, FetchResourceBody } from "@workspace/api-zod";
import { detectTechnologies } from "../lib/tech-detector";

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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
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

    // Decode HTML entities in a URL string (&amp; → &, etc.)
    function decodeHtmlEntities(str: string): string {
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/&#([0-9]+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
    }

    const iframeSrcs: string[] = [];
    // Track decoded versions to prevent &amp; vs & duplicates
    const iframeDecoded = new Set<string>();

    function addIframeSrc(raw: string) {
      const decoded = decodeHtmlEntities(raw.replace(/[,"'\\]+$/, "").trim());
      if (decoded && !iframeDecoded.has(decoded)) {
        iframeDecoded.add(decoded);
        iframeSrcs.push(decoded);
      }
    }

    $("iframe[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) addIframeSrc(resolveUrl(finalUrl, src));
    });
    $("iframe[data-src]").each((_, el) => {
      const src = $(el).attr("data-src");
      if (src) addIframeSrc(resolveUrl(finalUrl, src));
    });

    // Extract video/embed URLs from inline scripts and __NEXT_DATA__ JSON
    // Many React/Next.js sites load iframes dynamically, so they won't appear
    // as <iframe> tags in static HTML — but the URLs are in the page data.
    const embedUrlPattern = /https?:\/\/[^\s"'\\]+\/(?:embed|player|e|tv)\/[^\s"'\\<>]{4,}/gi;
    const knownVideoHosts = /youtube|vimeo|dood|streamtape|filemoon|vidmoly|streamwish|uqload|ok\.ru|dailymotion|kwik|mp4upload|sibnet|mixdrop|fembed|emturbovid|vidhide|voe\.sx|upstream|speedvid|gdriveplayer|vidapi/i;

    function extractEmbedUrls(text: string, onlyKnown = false): string[] {
      // Decode HTML entities in the text first so &amp; URLs are found correctly
      const decoded = decodeHtmlEntities(text);
      const found: string[] = [];
      const pat = new RegExp(embedUrlPattern.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = pat.exec(decoded)) !== null) {
        const url = m[0].replace(/[,"'\\]+$/, "");
        if (!onlyKnown || knownVideoHosts.test(url)) {
          const urlDecoded = decodeHtmlEntities(url);
          if (!iframeDecoded.has(urlDecoded) && !found.includes(urlDecoded)) found.push(urlDecoded);
        }
      }
      return found;
    }

    // Search __NEXT_DATA__ JSON (contains ALL server-side props, all video servers)
    const nextDataEl = $('script#__NEXT_DATA__').html();
    if (nextDataEl) {
      for (const u of extractEmbedUrls(nextDataEl)) {
        addIframeSrc(u);
      }
    }

    // Try fetching Next.js data endpoint — this often has ALL video sources pre-loaded
    if (nextDataEl) {
      try {
        const ndParsed = JSON.parse(nextDataEl);
        const buildId: string | undefined = ndParsed?.buildId;
        if (buildId) {
          const parsedTarget = new URL(finalUrl);
          const dataPath = `/_next/data/${buildId}${parsedTarget.pathname}.json${parsedTarget.search}`;
          const dataUrl = `${parsedTarget.origin}${dataPath}`;
          const ndController = new AbortController();
          const ndTimeout = setTimeout(() => ndController.abort(), 8000);
          try {
            const ndRes = await fetch(dataUrl, {
              signal: ndController.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept: "application/json",
              },
            });
            if (ndRes.ok) {
              const ndJson = await ndRes.text();
              for (const u of extractEmbedUrls(ndJson)) {
                addIframeSrc(u);
              }
            }
          } finally {
            clearTimeout(ndTimeout);
          }
        }
      } catch {
        // Non-fatal — Next.js data endpoint is best-effort
      }
    }

    // Search all inline scripts for embed URLs from known video hosts
    $("script:not([src])").each((_, el) => {
      const content = $(el).html() || "";
      for (const u of extractEmbedUrls(content, true)) {
        addIframeSrc(u);
      }
    });

    // Also extract src="..." / src='...' from raw HTML (catches JS string literals with iframe URLs)
    // Run on decoded HTML to catch &amp; versions as well
    const htmlDecoded = decodeHtmlEntities(html);
    const srcAttrPattern = /(?:src|iframe)[=:\s]+["']?(https?:\/\/[^\s"'\\<>]{10,}\/(?:embed|player|e|tv|video)\/[^\s"'\\<>]{4,})/gi;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = srcAttrPattern.exec(htmlDecoded)) !== null) {
      addIframeSrc(srcMatch[1]);
    }

    // ── API Endpoint Discovery ──────────────────────────────────────────────
    // Scan inline scripts and key JS bundles for fetch/axios calls, try to
    // call any video/stream-related API endpoints found.

    interface ApiEndpoint {
      url: string;
      method: string;
      source: string;
      status: number | null;
      iframeSrcs: string[];
      responsePreview: string;
    }

    const apiEndpoints: ApiEndpoint[] = [];
    const seenApiUrls = new Set<string>();

    // Path segments from the inspected URL — used to substitute into templates
    const parsedFinalUrl = new URL(finalUrl);
    const pathSegments = parsedFinalUrl.pathname.split("/").filter(Boolean);

    const BROWSER_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "es-MX,es;q=0.9,en-US;q=0.8",
      "Referer": finalUrl,
      "Origin": parsedFinalUrl.origin,
    };

    // Patterns for detecting API calls in JS source
    // Matches: fetch("/api/..."), axios.get("/api/..."), axios.post("/api/..."),
    //          fetch(`/api/...`), axios({ url: "/api/..." })
    function extractApiPaths(source: string): Array<{ path: string; method: string }> {
      const found: Array<{ path: string; method: string }> = [];
      const patterns: Array<{ re: RegExp; method: string }> = [
        { re: /fetch\s*\(\s*["'`](\/[^"'`\s]{3,}["'`])/g, method: "GET" },
        { re: /axios\.get\s*\(\s*["'`](\/[^"'`\s]{3,})/g, method: "GET" },
        { re: /axios\.post\s*\(\s*["'`](\/[^"'`\s]{3,})/g, method: "POST" },
        { re: /(?:url|endpoint|href|apiUrl)\s*[:=]\s*["'`](\/api\/[^"'`\s]{2,})/g, method: "GET" },
        { re: /["'`](\/api\/[a-z0-9_\-\/]{3,})/gi, method: "GET" },
      ];
      for (const { re, method } of patterns) {
        let m: RegExpExecArray | null;
        const r = new RegExp(re.source, re.flags);
        while ((m = r.exec(source)) !== null) {
          const raw = m[1].replace(/["'`\\]/g, "").replace(/\$\{[^}]+\}/g, "__VAR__");
          if (raw.length > 3 && raw.startsWith("/")) {
            found.push({ path: raw, method });
          }
        }
      }
      return found;
    }

    // Resolve a path template (replaces __VAR__ tokens and [param] with actual URL segments)
    function resolveApiPath(template: string): string | null {
      if (!template.includes("__VAR__") && !template.includes("[")) return template;
      // Replace positional vars with path segments
      let idx = 0;
      const resolved = template
        .replace(/__VAR__/g, () => pathSegments[idx++] ?? "")
        .replace(/\[([^\]]+)\]/g, () => pathSegments[idx++] ?? "");
      if (resolved.includes("__VAR__")) return null; // Not enough segments
      return resolved;
    }

    // Keywords that hint an endpoint may return video/embed data
    const VIDEO_HINT = /video|episode|stream|embed|player|serie|movie|watch|source|server|link|url|src|iframe/i;

    async function tryApiEndpoint(path: string, method: string, source: string) {
      const resolved = resolveApiPath(path);
      if (!resolved) return;
      const fullUrl = `${parsedFinalUrl.origin}${resolved}`;
      if (seenApiUrls.has(fullUrl)) return;
      seenApiUrls.add(fullUrl);

      const ep: ApiEndpoint = { url: fullUrl, method, source, status: null, iframeSrcs: [], responsePreview: "" };
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
          const r = await fetch(fullUrl, {
            method,
            signal: ctrl.signal,
            headers: BROWSER_HEADERS,
          });
          ep.status = r.status;
          if (r.ok) {
            const body = await r.text();
            ep.responsePreview = body.slice(0, 400);
            for (const u of extractEmbedUrls(body)) {
              const udec = decodeHtmlEntities(u);
              if (!ep.iframeSrcs.includes(udec)) ep.iframeSrcs.push(udec);
              addIframeSrc(u);
            }
          }
        } finally {
          clearTimeout(t);
        }
      } catch {
        // Non-fatal
      }
      if (ep.status !== null) apiEndpoints.push(ep);
    }

    // 1. Scan inline scripts
    const inlineSources: string[] = [];
    $("script:not([src])").each((_, el) => {
      const c = $(el).html() || "";
      if (c.length > 30) inlineSources.push(c);
    });

    const inlineApiPaths: Array<{ path: string; method: string; source: string }> = [];
    for (const src of inlineSources) {
      for (const ap of extractApiPaths(src)) {
        if (VIDEO_HINT.test(ap.path)) {
          inlineApiPaths.push({ ...ap, source: "inline-script" });
        }
      }
    }

    // 2. Fetch key JS bundles and scan them for API patterns + embed URLs
    // Scan up to 5 bundles: prioritize named ones, then take others
    const BUNDLE_PRIORITY = /\b(_app|main|index|chunk|pages[/\\]|runtime|app-|layout)\b/i;
    const priorityBundles = jsScripts.filter((s) => BUNDLE_PRIORITY.test(s.url)).slice(0, 3).map((s) => s.url);
    const otherBundles = jsScripts.filter((s) => !BUNDLE_PRIORITY.test(s.url)).slice(0, 2).map((s) => s.url);
    const candidateBundles = [...new Set([...priorityBundles, ...otherBundles])];

    const bundleApiPaths: Array<{ path: string; method: string; source: string }> = [];
    await Promise.all(
      candidateBundles.map(async (bundleUrl) => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 7000);
          try {
            const r = await fetch(bundleUrl, {
              signal: ctrl.signal,
              headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
            });
            if (r.ok) {
              const code = await r.text();
              const bundleName = bundleUrl.split("/").pop() ?? bundleUrl;
              for (const ap of extractApiPaths(code)) {
                if (VIDEO_HINT.test(ap.path)) {
                  bundleApiPaths.push({ ...ap, source: `bundle: ${bundleName}` });
                }
              }
              for (const u of extractEmbedUrls(code, true)) {
                addIframeSrc(u);
              }
            }
          } finally {
            clearTimeout(t);
          }
        } catch { /* Non-fatal */ }
      })
    );

    // 3. Smart common-pattern probing based on the page URL segments
    // This catches sites where API paths mirror the page path structure.
    // e.g. page = /seeCo/mushoku-tensei/1/1 → try /api/seeCo/mushoku-tensei/1/1
    const commonApiTemplates: string[] = [];
    if (pathSegments.length > 0) {
      const seg = pathSegments;
      // Direct path variants
      commonApiTemplates.push(`/api/${seg.join("/")}`,);
      if (seg.length >= 3) {
        commonApiTemplates.push(
          `/api/${seg[0]}/${seg[1]}/${seg[2]}`,
          `/api/video/${seg[seg.length - 2]}/${seg[seg.length - 1]}`,
          `/api/episode/${seg[seg.length - 2]}/${seg[seg.length - 1]}`,
          `/api/stream/${seg[seg.length - 2]}/${seg[seg.length - 1]}`,
          `/api/links/${seg[1]}/${seg[seg.length - 2]}/${seg[seg.length - 1]}`,
          `/api/source/${seg[1]}/${seg[seg.length - 2]}/${seg[seg.length - 1]}`,
        );
      }
      if (seg.length >= 2) {
        commonApiTemplates.push(
          `/api/${seg[0]}/${seg[1]}`,
          `/api/video/${seg[seg.length - 1]}`,
          `/api/embed/${seg[seg.length - 1]}`,
        );
      }
      // Common patterns used by streaming sites
      commonApiTemplates.push(
        "/api/servers",
        "/api/getSources",
        "/api/getServers",
        "/api/getLinks",
        "/api/getEpisode",
        "/api/getStream",
        "/api/streaming",
        "/api/episodes/servers",
      );
    }

    // 4. Try all discovered + common API paths (deduplicated)
    const allApiPaths = [...inlineApiPaths, ...bundleApiPaths,
      ...commonApiTemplates.map((p) => ({ path: p, method: "GET", source: "common-pattern" })),
    ];
    const uniqueApiPaths = allApiPaths.filter(
      (ap, i, arr) => arr.findIndex((x) => x.path === ap.path) === i
    );
    await Promise.all(uniqueApiPaths.map((ap) => tryApiEndpoint(ap.path, ap.method, ap.source)));

    const technologies = detectTechnologies({
      html,
      headers: responseHeaders,
      scriptSrcs: jsScripts.map((s) => s.url),
      cssHrefs: cssLinks.map((c) => c.url),
      metaTags,
      iframeSrcs,
    });

    const result = {
      url: targetUrl,
      finalUrl,
      statusCode: response.status,
      html,
      title,
      technologies,
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
      iframeSrcs,
      apiEndpoints,
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
