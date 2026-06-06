import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInspectUrl, useFetchResource } from "@workspace/api-client-react";
import {
  Search, Terminal, AlertTriangle, Code, Globe, FileCode2,
  FileJson, Image as ImageIcon, Link as LinkIcon, FormInput,
  ExternalLink, ShieldCheck, Cpu, ChevronRight, MonitorPlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  url: z.string().min(1, "URL requerida"),
});

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-green-400",
  medium: "text-yellow-400",
  low: "text-orange-400",
};

export default function Home() {
  const [selectedResource, setSelectedResource] = useState<{
    url: string; content: string; type: string;
  } | null>(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  const inspectMutation = useInspectUrl();
  const fetchResourceMutation = useFetchResource();

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    let url = values.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    inspectMutation.mutate({ data: { url } });
  };

  const handleResourceClick = (url: string, type: string) => {
    setSelectedResource({ url, content: "", type });
    setResourceModalOpen(true);
    fetchResourceMutation.mutate(
      { data: { url } },
      {
        onSuccess: (data) => {
          setSelectedResource({ url, content: data.content, type });
        },
      }
    );
  };

  const results = inspectMutation.data;
  const isLoading = inspectMutation.isPending;
  const isError = inspectMutation.isError;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center bg-background text-foreground font-mono p-4 md:p-8"
      translate="no"
    >
      <div className="w-full max-w-6xl space-y-8">

        {/* Header */}
        <header className="flex flex-col items-center space-y-3 pt-10 pb-6 border-b border-border/40">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="w-10 h-10" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase">WEB_INSPECTOR</h1>
          </div>
          <p className="text-muted-foreground text-xs max-w-xl text-center">
            Target a URL to extract raw HTML, internal architectures, styles, scripts, and asset topologies.
          </p>
        </header>

        {/* Input Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-2xl mx-auto gap-2">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-primary text-xs select-none">$&gt;</span>
                      <Input
                        placeholder="https://example.com"
                        className="pl-9 h-11 border-primary/40 focus-visible:ring-primary focus-visible:border-primary bg-black/60 font-mono text-sm rounded-none text-green-300 placeholder:text-muted-foreground/50"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-destructive font-mono text-xs mt-1" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 px-6 rounded-none border border-primary bg-primary/10 hover:bg-primary hover:text-black text-primary font-bold uppercase text-xs transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 animate-pulse" />
                  SCANNING...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  INSPECT
                </span>
              )}
            </Button>
          </form>
        </Form>

        {/* Error */}
        {isError && (
          <div className="w-full max-w-2xl mx-auto p-3 border border-destructive bg-destructive/10 text-destructive flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs uppercase">ERROR</span>
              <p className="text-xs opacity-90 mt-1 font-mono">
                {inspectMutation.error?.data?.error ?? "No se pudo alcanzar el objetivo. Verifica la URL."}
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="w-full max-w-2xl mx-auto space-y-2 py-8">
            {["Resolviendo DNS...", "Estableciendo conexión...", "Descargando HTML...", "Analizando estructura...", "Detectando tecnologías..."].map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                <ChevronRight className="w-3 h-3 text-primary" />
                {msg}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && !isLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Status bar */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono mb-4 pb-3 border-b border-border/30">
              <span>
                <span className="text-muted-foreground">status</span>
                <span className="text-primary ml-1">{results.statusCode}</span>
              </span>
              <span>
                <span className="text-muted-foreground">size</span>
                <span className="text-primary ml-1">{(results.byteSize / 1024).toFixed(1)}kb</span>
              </span>
              <span>
                <span className="text-muted-foreground">words</span>
                <span className="text-primary ml-1">{results.wordCount}</span>
              </span>
              <span>
                <span className="text-muted-foreground">techs</span>
                <span className="text-primary ml-1">{results.technologies.length}</span>
              </span>
              <span className="text-muted-foreground truncate max-w-xs">{results.finalUrl}</span>
            </div>

            <Tabs defaultValue="tech" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto rounded-none bg-transparent border-b border-border/40 p-0 h-auto flex-nowrap">
                {[
                  { value: "tech", label: `techs (${results.technologies.length})` },
                  { value: "iframes", label: `iframes (${results.iframeSrcs?.length ?? 0})` },
                  { value: "html", label: "html" },
                  { value: "headers", label: `headers (${results.responseHeaders.length})` },
                  { value: "meta", label: `meta (${results.metaTags.length})` },
                  { value: "css", label: `css (${results.cssLinks.length})` },
                  { value: "js", label: `js (${results.jsScripts.length})` },
                  { value: "links", label: `links (${results.links.length})` },
                  { value: "forms", label: `forms (${results.forms.length})` },
                  { value: "images", label: `img (${results.images.length})` },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-2.5 font-mono text-xs lowercase text-muted-foreground data-[state=active]:text-primary whitespace-nowrap"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="mt-0 border border-border/40 border-t-0 bg-black/40">

                {/* TECHNOLOGIES */}
                <TabsContent value="tech" className="mt-0 p-4">
                  {results.technologies.length === 0 ? (
                    <EmptyState msg="// no technologies detected" />
                  ) : (
                    <div className="space-y-1">
                      <CodeComment text={`// ${results.technologies.length} technologies detected on ${new URL(results.finalUrl).hostname}`} />
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.technologies.map((tech, i) => (
                          <div key={i} className="flex items-start gap-3 border border-border/30 bg-black/30 p-3 hover:border-primary/30 transition-colors">
                            <Cpu className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-green-300 text-xs font-bold">
                                  {tech.name}
                                  {tech.version && <span className="text-muted-foreground font-normal">@{tech.version}</span>}
                                </span>
                                <span className="text-[10px] text-muted-foreground border border-border/50 px-1.5 py-0.5">{tech.category}</span>
                                <span className={`text-[10px] ${CONFIDENCE_COLOR[tech.confidence]}`}>{tech.confidence}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1 truncate"># {tech.evidence}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/20">
                        <CodeBlock>
                          {`const stack = {\n` +
                            Object.entries(
                              results.technologies.reduce<Record<string, string[]>>((acc, t) => {
                                if (!acc[t.category]) acc[t.category] = [];
                                acc[t.category].push(t.version ? `${t.name}@${t.version}` : t.name);
                                return acc;
                              }, {})
                            )
                              .map(([cat, names]) => `  "${cat}": [${names.map((n) => `"${n}"`).join(", ")}]`)
                              .join(",\n") +
                            `\n};`}
                        </CodeBlock>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* IFRAMES */}
                <TabsContent value="iframes" className="mt-0 p-4">
                  <CodeComment text={`// iframes & embedded players detected (${results.iframeSrcs?.length ?? 0}) — includes dynamic sources from scripts`} />
                  {!results.iframeSrcs || results.iframeSrcs.length === 0 ? (
                    <EmptyState msg="// no iframes or embedded players found" />
                  ) : (
                    <div className="mt-3 space-y-2">
                      {results.iframeSrcs.map((src, i) => {
                        let host = "";
                        try { host = new URL(src).hostname; } catch { host = "unknown"; }
                        return (
                          <div key={i} className="flex items-start gap-3 border border-border/30 bg-black/30 p-3 hover:border-primary/30 transition-colors">
                            <MonitorPlay className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] border border-primary/40 text-primary px-1.5 py-0.5">{`Servidor ${i + 1}`}</span>
                                <span className="text-[10px] text-muted-foreground border border-border/50 px-1.5 py-0.5">{host}</span>
                              </div>
                              <div className="text-[11px] text-green-300/80 break-all leading-relaxed">{src}</div>
                            </div>
                            <a
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                            </a>
                          </div>
                        );
                      })}
                      <div className="mt-4 pt-3 border-t border-border/20">
                        <CodeBlock>
                          {results.iframeSrcs.map((src, i) => `// Servidor ${i + 1}\n<iframe src="${src}" />`).join("\n\n")}
                        </CodeBlock>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* HTML */}
                <TabsContent value="html" className="mt-0">
                  <div className="p-2 pb-0">
                    <CodeComment text={`// raw html — ${results.byteSize.toLocaleString()} bytes — ${results.html.split("\n").length} lines`} />
                  </div>
                  <ScrollArea className="h-[600px] w-full">
                    <pre className="text-[11px] font-mono text-green-300/80 p-4 leading-relaxed" translate="no">
                      <code>{results.html}</code>
                    </pre>
                  </ScrollArea>
                </TabsContent>

                {/* HEADERS */}
                <TabsContent value="headers" className="mt-0 p-4">
                  <CodeComment text={`// response headers (${results.responseHeaders.length})`} />
                  <CodeBlock className="mt-3">
                    {`HTTP/1.1 ${results.statusCode}\n` +
                      results.responseHeaders.map((h) => `${h.name}: ${h.value}`).join("\n")}
                  </CodeBlock>
                </TabsContent>

                {/* META */}
                <TabsContent value="meta" className="mt-0 p-4">
                  <CodeComment text={`// meta tags (${results.metaTags.length})`} />
                  {results.metaTags.length === 0 ? (
                    <EmptyState msg="// no meta tags found" />
                  ) : (
                    <CodeBlock className="mt-3">
                      {results.metaTags.map((m) => `<meta name="${m.name}" content="${m.content}">`).join("\n")}
                    </CodeBlock>
                  )}
                </TabsContent>

                {/* CSS */}
                <TabsContent value="css" className="mt-0 p-4">
                  <CodeComment text={`// stylesheets (${results.cssLinks.length}) — click to view source`} />
                  {results.cssLinks.length === 0 ? (
                    <EmptyState msg="// no external stylesheets found" />
                  ) : (
                    <div className="mt-3 space-y-1">
                      {results.cssLinks.map((css, i) => (
                        <button
                          key={i}
                          onClick={() => handleResourceClick(css.url, "css")}
                          className="w-full flex items-center gap-2 p-2.5 border border-border/30 bg-black/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
                        >
                          <FileCode2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] text-green-300/80 truncate flex-1">{css.url}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* JS */}
                <TabsContent value="js" className="mt-0 p-4">
                  <CodeComment text={`// javascript files (${results.jsScripts.length}) — click to view source`} />
                  {results.jsScripts.length === 0 ? (
                    <EmptyState msg="// no external scripts found" />
                  ) : (
                    <div className="mt-3 space-y-1">
                      {results.jsScripts.map((js, i) => (
                        <button
                          key={i}
                          onClick={() => handleResourceClick(js.url, "javascript")}
                          className="w-full flex items-center gap-2 p-2.5 border border-border/30 bg-black/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
                        >
                          <FileJson className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] text-green-300/80 truncate flex-1">{js.url}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* LINKS */}
                <TabsContent value="links" className="mt-0 p-4">
                  <CodeComment text={`// hyperlinks (${results.links.length}) — int=internal, ext=external`} />
                  <ScrollArea className="h-[560px] mt-3">
                    <div className="space-y-1 pr-2">
                      {results.links.length === 0 ? (
                        <EmptyState msg="// no links found" />
                      ) : results.links.map((link, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] font-mono border border-border/20 px-2.5 py-2 hover:bg-white/5">
                          <span className={`shrink-0 text-[10px] border px-1 py-0.5 ${link.isInternal ? "border-primary/40 text-primary" : "border-muted-foreground/30 text-muted-foreground"}`}>
                            {link.isInternal ? "int" : "ext"}
                          </span>
                          <div className="min-w-0 flex-1">
                            {link.text && <div className="text-muted-foreground truncate"># {link.text}</div>}
                            <div className="text-green-300/70 break-all leading-tight">{link.href}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* FORMS */}
                <TabsContent value="forms" className="mt-0 p-4">
                  <CodeComment text={`// forms detected (${results.forms.length})`} />
                  {results.forms.length === 0 ? (
                    <EmptyState msg="// no forms found" />
                  ) : (
                    <div className="mt-3 space-y-4">
                      {results.forms.map((form, i) => (
                        <div key={i} className="border border-border/30 bg-black/30">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-black/40">
                            <FormInput className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] border border-primary/40 text-primary px-1">{form.method}</span>
                            <span className="text-[11px] text-green-300/70 truncate">{form.action || "(no action)"}</span>
                          </div>
                          <CodeBlock className="border-0 rounded-none">
                            {form.fields.length === 0
                              ? "// no input fields"
                              : form.fields.map((f) => `<input type="${f.type}" name="${f.name}">`).join("\n")}
                          </CodeBlock>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* IMAGES */}
                <TabsContent value="images" className="mt-0 p-4">
                  <CodeComment text={`// images (${results.images.length})`} />
                  {results.images.length === 0 ? (
                    <EmptyState msg="// no images found" />
                  ) : (
                    <CodeBlock className="mt-3">
                      {results.images.map((img) => `<img src="${img.url}">`).join("\n")}
                    </CodeBlock>
                  )}
                </TabsContent>

              </div>
            </Tabs>
          </div>
        )}
      </div>

      {/* Resource Modal */}
      <Dialog open={resourceModalOpen} onOpenChange={setResourceModalOpen}>
        <DialogContent className="max-w-4xl border-primary/40 bg-black rounded-none max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-3 border-b border-border/40 bg-black/80 flex-row items-center gap-2 space-y-0">
            {selectedResource?.type === "css"
              ? <FileCode2 className="w-4 h-4 text-primary shrink-0" />
              : <FileJson className="w-4 h-4 text-primary shrink-0" />}
            <DialogTitle className="font-mono text-xs truncate text-green-300/80 font-normal">
              {selectedResource?.url}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden relative">
            {fetchResourceMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
                <span className="text-xs font-mono text-primary flex items-center gap-2">
                  <Terminal className="w-3 h-3 animate-pulse" />
                  fetching resource...
                </span>
              </div>
            )}
            <ScrollArea className="h-full max-h-[75vh]">
              <pre className="text-[11px] font-mono text-green-300/80 p-4 leading-relaxed" translate="no">
                <code>{selectedResource?.content || (fetchResourceMutation.isError ? fetchResourceMutation.error?.data?.error : "")}</code>
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeComment({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground font-mono mb-1">{text}</p>;
}

function CodeBlock({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre className={`text-[11px] font-mono text-green-300/80 bg-black/60 border border-border/30 p-3 overflow-x-auto leading-relaxed ${className}`} translate="no">
      <code>{children}</code>
    </pre>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-10 text-center">
      <span className="text-xs text-muted-foreground font-mono">{msg}</span>
    </div>
  );
}
