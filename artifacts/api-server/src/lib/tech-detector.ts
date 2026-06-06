interface TechDetection {
  name: string;
  category: string;
  version: string | null;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

interface DetectionInput {
  html: string;
  headers: Array<{ name: string; value: string }>;
  scriptSrcs: string[];
  cssHrefs: string[];
  metaTags: Array<{ name: string; content: string }>;
}

type Rule = {
  name: string;
  category: string;
  confidence: "high" | "medium" | "low";
  check: (input: DetectionInput) => { matched: boolean; version?: string | null; evidence: string };
};

const rules: Rule[] = [
  // ── Servers ──────────────────────────────────────────────────────────────
  {
    name: "nginx",
    category: "Server",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "server");
      if (!h) return { matched: false, evidence: "" };
      const m = h.value.match(/nginx(?:\/(\S+))?/i);
      return m
        ? { matched: true, version: m[1] ?? null, evidence: `Server: ${h.value}` }
        : { matched: false, evidence: "" };
    },
  },
  {
    name: "Apache",
    category: "Server",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "server");
      if (!h) return { matched: false, evidence: "" };
      const m = h.value.match(/Apache(?:\/(\S+))?/i);
      return m
        ? { matched: true, version: m[1] ?? null, evidence: `Server: ${h.value}` }
        : { matched: false, evidence: "" };
    },
  },
  {
    name: "Cloudflare",
    category: "CDN / Proxy",
    confidence: "high",
    check: ({ headers }) => {
      const cf = headers.find((h) => h.name.toLowerCase() === "cf-ray");
      const server = headers.find((h) => h.name.toLowerCase() === "server");
      if (cf) return { matched: true, version: null, evidence: "Header: cf-ray" };
      if (server?.value.toLowerCase().includes("cloudflare"))
        return { matched: true, version: null, evidence: `Server: ${server.value}` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Vercel",
    category: "Hosting",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "x-vercel-id");
      const server = headers.find((h) => h.name.toLowerCase() === "server");
      if (h) return { matched: true, version: null, evidence: "Header: x-vercel-id" };
      if (server?.value.toLowerCase() === "vercel")
        return { matched: true, version: null, evidence: `Server: ${server.value}` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "AWS",
    category: "Hosting",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "x-amz-cf-id" || h.name.toLowerCase() === "x-amzn-requestid");
      if (h) return { matched: true, version: null, evidence: `Header: ${h.name}` };
      const server = headers.find((h) => h.name.toLowerCase() === "server");
      if (server?.value.toLowerCase().includes("awselb") || server?.value.toLowerCase().includes("amazon"))
        return { matched: true, version: null, evidence: `Server: ${server.value}` };
      return { matched: false, evidence: "" };
    },
  },

  // ── CMS ──────────────────────────────────────────────────────────────────
  {
    name: "WordPress",
    category: "CMS",
    confidence: "high",
    check: ({ html, metaTags, scriptSrcs, cssHrefs }) => {
      if (html.includes("/wp-content/") || html.includes("/wp-includes/"))
        return { matched: true, version: null, evidence: "HTML: /wp-content/ or /wp-includes/ path" };
      const gen = metaTags.find((m) => m.name.toLowerCase() === "generator" && m.content.toLowerCase().includes("wordpress"));
      if (gen) {
        const v = gen.content.match(/WordPress\s+([\d.]+)/i);
        return { matched: true, version: v?.[1] ?? null, evidence: `Meta generator: ${gen.content}` };
      }
      if (scriptSrcs.some((s) => s.includes("/wp-content/")) || cssHrefs.some((c) => c.includes("/wp-content/")))
        return { matched: true, version: null, evidence: "Asset path: /wp-content/" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Drupal",
    category: "CMS",
    confidence: "high",
    check: ({ html, metaTags }) => {
      const gen = metaTags.find((m) => m.name.toLowerCase() === "generator" && m.content.toLowerCase().includes("drupal"));
      if (gen) return { matched: true, version: null, evidence: `Meta generator: ${gen.content}` };
      if (html.includes("Drupal.settings") || html.includes("/sites/default/files/"))
        return { matched: true, version: null, evidence: "HTML: Drupal.settings or /sites/default/files/" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Joomla",
    category: "CMS",
    confidence: "high",
    check: ({ html, metaTags }) => {
      const gen = metaTags.find((m) => m.name.toLowerCase() === "generator" && m.content.toLowerCase().includes("joomla"));
      if (gen) return { matched: true, version: null, evidence: `Meta generator: ${gen.content}` };
      if (html.includes("/components/com_") || html.includes("Joomla!"))
        return { matched: true, version: null, evidence: "HTML: Joomla component paths" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Shopify",
    category: "E-commerce",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (html.includes("Shopify.") || scriptSrcs.some((s) => s.includes("cdn.shopify.com")))
        return { matched: true, version: null, evidence: "HTML: Shopify global or cdn.shopify.com script" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Wix",
    category: "Website Builder",
    confidence: "high",
    check: ({ html }) => {
      if (html.includes("wixsite.com") || html.includes("X-Wix-"))
        return { matched: true, version: null, evidence: "HTML: wixsite.com reference" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Squarespace",
    category: "Website Builder",
    confidence: "high",
    check: ({ html }) => {
      if (html.includes("squarespace") || html.includes("sqsp"))
        return { matched: true, version: null, evidence: "HTML: Squarespace pattern" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Webflow",
    category: "Website Builder",
    confidence: "high",
    check: ({ html, metaTags }) => {
      const gen = metaTags.find((m) => m.name.toLowerCase() === "generator" && m.content.toLowerCase().includes("webflow"));
      if (gen) return { matched: true, version: null, evidence: `Meta generator: ${gen.content}` };
      if (html.includes("webflow.com")) return { matched: true, version: null, evidence: "HTML: webflow.com reference" };
      return { matched: false, evidence: "" };
    },
  },

  // ── JavaScript Frameworks ─────────────────────────────────────────────────
  {
    name: "React",
    category: "JS Framework",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => /react(\.min)?\.js|react-dom/i.test(s)))
        return { matched: true, version: null, evidence: "Script src: react or react-dom" };
      if (html.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__") || html.includes("data-reactroot") || html.includes("data-reactid"))
        return { matched: true, version: null, evidence: "HTML: React-specific DOM attribute" };
      if (html.includes("_next/static") || html.includes("__NEXT_DATA__"))
        return { matched: true, version: null, evidence: "HTML: Next.js bundle (__NEXT_DATA__)" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Next.js",
    category: "JS Framework",
    confidence: "high",
    check: ({ html, headers, scriptSrcs }) => {
      if (html.includes("__NEXT_DATA__") || html.includes("_next/static"))
        return { matched: true, version: null, evidence: "HTML: __NEXT_DATA__ or _next/static" };
      const h = headers.find((h) => h.name.toLowerCase() === "x-powered-by");
      if (h?.value.toLowerCase().includes("next.js"))
        return { matched: true, version: null, evidence: `Header x-powered-by: ${h.value}` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Vue.js",
    category: "JS Framework",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => /vue(\.min)?\.js|vue@/i.test(s)))
        return { matched: true, version: null, evidence: "Script src: vue.js" };
      if (html.includes("__vue__") || html.includes("data-v-"))
        return { matched: true, version: null, evidence: "HTML: Vue-specific attribute (data-v-)" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Nuxt.js",
    category: "JS Framework",
    confidence: "high",
    check: ({ html, headers }) => {
      if (html.includes("__NUXT__") || html.includes("_nuxt/"))
        return { matched: true, version: null, evidence: "HTML: __NUXT__ or _nuxt/ path" };
      const h = headers.find((h) => h.name.toLowerCase() === "x-powered-by");
      if (h?.value.toLowerCase().includes("nuxt"))
        return { matched: true, version: null, evidence: `Header x-powered-by: ${h.value}` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Angular",
    category: "JS Framework",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (html.includes("ng-version") || html.includes("_nghost") || html.includes("ng-app"))
        return { matched: true, version: null, evidence: "HTML: Angular attribute (ng-version, _nghost)" };
      if (scriptSrcs.some((s) => /angular(\.min)?\.js/i.test(s)))
        return { matched: true, version: null, evidence: "Script src: angular.js" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Svelte",
    category: "JS Framework",
    confidence: "medium",
    check: ({ html }) => {
      if (html.includes("__svelte") || html.includes("svelte-"))
        return { matched: true, version: null, evidence: "HTML: Svelte-specific class prefix" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Gatsby",
    category: "JS Framework",
    confidence: "high",
    check: ({ html }) => {
      if (html.includes("___gatsby") || html.includes("gatsby-"))
        return { matched: true, version: null, evidence: "HTML: ___gatsby or gatsby- prefix" };
      return { matched: false, evidence: "" };
    },
  },

  // ── Libraries ─────────────────────────────────────────────────────────────
  {
    name: "jQuery",
    category: "JS Library",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      const match = scriptSrcs.find((s) => /jquery[.-]?([\d.]+)?(\.min)?\.js/i.test(s));
      if (match) {
        const v = match.match(/jquery[.-]([\d.]+)/i);
        return { matched: true, version: v?.[1] ?? null, evidence: `Script src: ${match}` };
      }
      if (html.includes("jQuery") || html.includes("$.fn"))
        return { matched: true, version: null, evidence: "HTML: jQuery global reference" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Bootstrap",
    category: "CSS Framework",
    confidence: "high",
    check: ({ html, scriptSrcs, cssHrefs }) => {
      const match =
        cssHrefs.find((c) => /bootstrap(\.min)?\.css/i.test(c)) ||
        scriptSrcs.find((s) => /bootstrap(\.min)?\.js/i.test(s));
      if (match) {
        const v = match.match(/bootstrap[.-]([\d.]+)/i);
        return { matched: true, version: v?.[1] ?? null, evidence: `Asset: ${match}` };
      }
      if (html.includes('class="container"') && (html.includes('class="row"') || html.includes('class="col-')))
        return { matched: true, version: null, evidence: "HTML: Bootstrap grid classes" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Tailwind CSS",
    category: "CSS Framework",
    confidence: "medium",
    check: ({ html, cssHrefs }) => {
      if (cssHrefs.some((c) => c.includes("tailwind")))
        return { matched: true, version: null, evidence: "CSS href: tailwind" };
      const tailwindClasses = ["text-sm", "flex", "items-center", "justify-between", "font-bold", "rounded-lg"];
      const matchCount = tailwindClasses.filter((cls) => html.includes(`"${cls}"`)).length;
      if (matchCount >= 4)
        return { matched: true, version: null, evidence: `HTML: ${matchCount} Tailwind utility classes detected` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Lodash",
    category: "JS Library",
    confidence: "high",
    check: ({ scriptSrcs, html }) => {
      const match = scriptSrcs.find((s) => /lodash(\.min)?\.js/i.test(s));
      if (match) return { matched: true, version: null, evidence: `Script src: ${match}` };
      if (html.includes("window._") || html.includes("_.debounce") || html.includes("_.throttle"))
        return { matched: true, version: null, evidence: "HTML: Lodash globals" };
      return { matched: false, evidence: "" };
    },
  },

  // ── Analytics & Marketing ─────────────────────────────────────────────────
  {
    name: "Google Analytics",
    category: "Analytics",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (
        scriptSrcs.some((s) => s.includes("google-analytics.com") || s.includes("googletagmanager.com")) ||
        html.includes("ga('") ||
        html.includes("gtag(") ||
        html.includes("UA-") ||
        html.includes("G-")
      )
        return { matched: true, version: null, evidence: "Script/HTML: Google Analytics tag" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Google Tag Manager",
    category: "Analytics",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (
        scriptSrcs.some((s) => s.includes("googletagmanager.com/gtm")) ||
        html.includes("GTM-")
      )
        return { matched: true, version: null, evidence: "Script/HTML: GTM container ID" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Hotjar",
    category: "Analytics",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => s.includes("hotjar.com")) || html.includes("hjSiteSettings") || html.includes("_hjSettings"))
        return { matched: true, version: null, evidence: "Script/HTML: Hotjar tag" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Facebook Pixel",
    category: "Marketing",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => s.includes("connect.facebook.net")) || html.includes("fbq(") || html.includes("fbevents"))
        return { matched: true, version: null, evidence: "Script/HTML: Facebook Pixel (fbq)" };
      return { matched: false, evidence: "" };
    },
  },

  // ── Backend Frameworks ─────────────────────────────────────────────────────
  {
    name: "PHP",
    category: "Backend Language",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "x-powered-by");
      if (h?.value.toLowerCase().includes("php")) {
        const v = h.value.match(/PHP\/([\d.]+)/i);
        return { matched: true, version: v?.[1] ?? null, evidence: `Header x-powered-by: ${h.value}` };
      }
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Express",
    category: "Backend Framework",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "x-powered-by");
      if (h?.value.toLowerCase().includes("express"))
        return { matched: true, version: null, evidence: `Header x-powered-by: ${h.value}` };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "ASP.NET",
    category: "Backend Framework",
    confidence: "high",
    check: ({ headers }) => {
      const h = headers.find((h) => h.name.toLowerCase() === "x-powered-by" || h.name.toLowerCase() === "x-aspnet-version");
      if (h && (h.value.toLowerCase().includes("asp.net") || h.name.toLowerCase() === "x-aspnet-version"))
        return { matched: true, version: null, evidence: `Header: ${h.name}: ${h.value}` };
      return { matched: false, evidence: "" };
    },
  },

  // ── Security Headers ───────────────────────────────────────────────────────
  {
    name: "reCAPTCHA",
    category: "Security",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => s.includes("recaptcha")) || html.includes("grecaptcha"))
        return { matched: true, version: null, evidence: "Script/HTML: Google reCAPTCHA" };
      return { matched: false, evidence: "" };
    },
  },
  {
    name: "Cloudflare Turnstile",
    category: "Security",
    confidence: "high",
    check: ({ html, scriptSrcs }) => {
      if (scriptSrcs.some((s) => s.includes("challenges.cloudflare.com")) || html.includes("cf-turnstile"))
        return { matched: true, version: null, evidence: "Script/HTML: Cloudflare Turnstile" };
      return { matched: false, evidence: "" };
    },
  },
];

export function detectTechnologies(input: DetectionInput): TechDetection[] {
  const results: TechDetection[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const result = rule.check(input);
    if (result.matched && !seen.has(rule.name)) {
      seen.add(rule.name);
      results.push({
        name: rule.name,
        category: rule.category,
        version: result.version ?? null,
        confidence: rule.confidence,
        evidence: result.evidence,
      });
    }
  }

  return results.sort((a, b) => {
    const order = ["high", "medium", "low"];
    return order.indexOf(a.confidence) - order.indexOf(b.confidence);
  });
}
