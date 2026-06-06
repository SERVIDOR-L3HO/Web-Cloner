import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInspectUrl, useFetchResource } from "@workspace/api-client-react";
import { Search, Terminal, AlertTriangle, Code, Globe, FileCode2, FileJson, Image as ImageIcon, Link as LinkIcon, FormInput, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formSchema = z.object({
  url: z.string().min(1, "URL is required").url("Must be a valid URL. Don't forget https://"),
});

export default function Home() {
  const [selectedResource, setSelectedResource] = useState<{ url: string; content: string; type: string } | null>(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  const inspectMutation = useInspectUrl();
  const fetchResourceMutation = useFetchResource();

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    inspectMutation.mutate({ data: { url: values.url } });
  };

  const handleResourceClick = (url: string, type: string) => {
    fetchResourceMutation.mutate(
      { data: { url } },
      {
        onSuccess: (data) => {
          setSelectedResource({ url, content: data.content, type });
          setResourceModalOpen(true);
        },
      }
    );
  };

  const results = inspectMutation.data;
  const isLoading = inspectMutation.isPending;
  const isError = inspectMutation.isError;

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground font-mono p-4 md:p-8 selection:bg-primary selection:text-primary-foreground">
      <div className="w-full max-w-6xl space-y-8">
        
        <header className="flex flex-col items-center justify-center space-y-4 pt-12 pb-8 border-b border-border/50">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="w-12 h-12" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase">WEB_INSPECTOR</h1>
          </div>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl text-center">
            Target a URL to extract raw HTML, internal architectures, styles, scripts, and asset topologies.
          </p>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-2xl mx-auto gap-2">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <div className="relative">
                      <Terminal className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <Input
                        placeholder="https://example.com"
                        className="pl-10 h-12 border-primary/50 focus-visible:ring-primary focus-visible:border-primary bg-background/50 font-mono text-base rounded-none"
                        {...field}
                        data-testid="input-url"
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
              className="h-12 px-8 rounded-none border border-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary font-bold uppercase transition-colors"
              data-testid="button-inspect"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 animate-pulse" />
                  INITIATING
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  INSPECT
                </span>
              )}
            </Button>
          </form>
        </Form>

        {isError && (
          <div className="w-full max-w-2xl mx-auto p-4 border border-destructive bg-destructive/10 text-destructive flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold uppercase text-sm">Inspection Failed</h3>
              <p className="text-xs opacity-90 mt-1">
                {inspectMutation.error?.error || "Could not analyze the target URL. Verify the target is reachable."}
              </p>
            </div>
          </div>
        )}

        {results && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto rounded-none bg-transparent border-b border-border p-0 h-auto flex-wrap">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">Overview</TabsTrigger>
                <TabsTrigger value="html" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">HTML Source</TabsTrigger>
                <TabsTrigger value="headers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">Headers & Meta</TabsTrigger>
                <TabsTrigger value="css" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">CSS ({results.cssLinks.length})</TabsTrigger>
                <TabsTrigger value="js" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">JS ({results.jsScripts.length})</TabsTrigger>
                <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">Links ({results.links.length})</TabsTrigger>
                <TabsTrigger value="forms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">Forms ({results.forms.length})</TabsTrigger>
                <TabsTrigger value="images" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-4 py-3 font-mono text-xs uppercase data-[state=active]:text-primary">Images ({results.images.length})</TabsTrigger>
              </TabsList>

              <div className="mt-6 border border-border/50 bg-card p-6">
                <TabsContent value="overview" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Target URL" value={results.finalUrl} icon={Globe} className="md:col-span-2 lg:col-span-4" truncate />
                    <StatCard label="Status Code" value={results.statusCode.toString()} icon={ShieldCheck} highlight={results.statusCode >= 200 && results.statusCode < 300} error={results.statusCode >= 400} />
                    <StatCard label="Page Title" value={results.title || "No title"} icon={Code} truncate />
                    <StatCard label="Byte Size" value={`${(results.byteSize / 1024).toFixed(2)} KB`} icon={FileCode2} />
                    <StatCard label="Word Count" value={results.wordCount.toString()} icon={Terminal} />
                  </div>
                </TabsContent>

                <TabsContent value="html" className="mt-0">
                  <ScrollArea className="h-[600px] w-full border border-border bg-black/50 p-4">
                    <pre className="text-xs font-mono text-muted-foreground">
                      <code>{results.html}</code>
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="headers" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-primary font-bold uppercase border-b border-border/50 pb-2">Response Headers</h3>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50 hover:bg-transparent">
                          <TableHead className="w-1/3 text-primary">Name</TableHead>
                          <TableHead className="text-primary">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.responseHeaders.map((header, i) => (
                          <TableRow key={i} className="border-border/20 hover:bg-white/5">
                            <TableCell className="font-mono text-xs text-muted-foreground">{header.name}</TableCell>
                            <TableCell className="font-mono text-xs break-all">{header.value}</TableCell>
                          </TableRow>
                        ))}
                        {results.responseHeaders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">NO HEADERS FOUND</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-primary font-bold uppercase border-b border-border/50 pb-2">Meta Tags</h3>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50 hover:bg-transparent">
                          <TableHead className="w-1/3 text-primary">Name / Property</TableHead>
                          <TableHead className="text-primary">Content</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.metaTags.map((meta, i) => (
                          <TableRow key={i} className="border-border/20 hover:bg-white/5">
                            <TableCell className="font-mono text-xs text-muted-foreground">{meta.name}</TableCell>
                            <TableCell className="font-mono text-xs break-all">{meta.content}</TableCell>
                          </TableRow>
                        ))}
                        {results.metaTags.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground py-8">NO META TAGS FOUND</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="css" className="mt-0">
                  <div className="grid grid-cols-1 gap-2">
                    {results.cssLinks.map((css, i) => (
                      <button
                        key={i}
                        onClick={() => handleResourceClick(css.url, 'css')}
                        className="flex items-center justify-between p-3 border border-border/50 hover:border-primary bg-background/50 hover:bg-primary/5 transition-colors text-left group"
                        data-testid={`btn-css-${i}`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <FileCode2 className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs truncate">{css.url}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-4" />
                      </button>
                    ))}
                    {results.cssLinks.length === 0 && (
                      <div className="text-center text-muted-foreground py-12 border border-dashed border-border">
                        NO CSS LINKS DETECTED
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="js" className="mt-0">
                  <div className="grid grid-cols-1 gap-2">
                    {results.jsScripts.map((js, i) => (
                      <button
                        key={i}
                        onClick={() => handleResourceClick(js.url, 'javascript')}
                        className="flex items-center justify-between p-3 border border-border/50 hover:border-primary bg-background/50 hover:bg-primary/5 transition-colors text-left group"
                        data-testid={`btn-js-${i}`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <FileJson className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs truncate">{js.url}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-4" />
                      </button>
                    ))}
                    {results.jsScripts.length === 0 && (
                      <div className="text-center text-muted-foreground py-12 border border-dashed border-border">
                        NO JAVASCRIPT SCRIPTS DETECTED
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="links" className="mt-0">
                  <ScrollArea className="h-[600px] border border-border bg-background/50">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b border-border">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="text-primary w-24">Type</TableHead>
                          <TableHead className="text-primary w-1/3">Text</TableHead>
                          <TableHead className="text-primary">HREF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.links.map((link, i) => (
                          <TableRow key={i} className="border-border/20 hover:bg-white/5">
                            <TableCell>
                              <Badge variant="outline" className={`rounded-none text-[10px] ${link.isInternal ? 'border-primary/50 text-primary' : 'border-muted-foreground text-muted-foreground'}`}>
                                {link.isInternal ? 'INTERNAL' : 'EXTERNAL'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs truncate max-w-[200px]">{link.text || '-'}</TableCell>
                            <TableCell className="font-mono text-xs break-all text-muted-foreground">{link.href}</TableCell>
                          </TableRow>
                        ))}
                        {results.links.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">NO LINKS FOUND</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="forms" className="mt-0">
                  <div className="space-y-6">
                    {results.forms.map((form, i) => (
                      <div key={i} className="border border-border/50 p-4 bg-background/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <Badge className="rounded-none bg-primary/20 text-primary border border-primary/50">
                              {form.method.toUpperCase() || 'GET'}
                            </Badge>
                            <span className="font-mono text-sm break-all">{form.action || '# (No Action)'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <FormInput className="w-4 h-4" />
                            {form.fields.length} Fields
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {form.fields.map((field, j) => (
                            <div key={j} className="flex items-center gap-2 bg-black/40 p-2 border border-border/20">
                              <Badge variant="outline" className="rounded-none text-[10px] bg-black">
                                {field.type || 'text'}
                              </Badge>
                              <span className="font-mono text-xs truncate" title={field.name}>{field.name || '(unnamed)'}</span>
                            </div>
                          ))}
                        </div>
                        {form.fields.length === 0 && (
                          <div className="text-xs text-muted-foreground italic">No identifiable input fields found.</div>
                        )}
                      </div>
                    ))}
                    {results.forms.length === 0 && (
                      <div className="text-center text-muted-foreground py-12 border border-dashed border-border">
                        NO FORMS DETECTED
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="images" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.images.map((img, i) => (
                      <div key={i} className="border border-border/50 p-3 bg-background/30 flex flex-col gap-3">
                        <div className="flex items-start gap-2">
                          <ImageIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-mono text-xs break-all leading-tight">{img.url}</div>
                            {img.size !== null && (
                              <div className="text-[10px] text-muted-foreground mt-1">Size: {img.size} bytes</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {results.images.length === 0 && (
                      <div className="col-span-full text-center text-muted-foreground py-12 border border-dashed border-border">
                        NO IMAGES DETECTED
                      </div>
                    )}
                  </div>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={resourceModalOpen} onOpenChange={setResourceModalOpen}>
        <DialogContent className="max-w-4xl border-primary/50 bg-card rounded-none max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border bg-black/40">
            <DialogTitle className="font-mono text-sm truncate flex items-center gap-2 text-primary">
              {selectedResource?.type === 'css' ? <FileCode2 className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
              {selectedResource?.url}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden relative">
            {fetchResourceMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-primary font-mono text-sm">
                  <Terminal className="w-4 h-4 animate-pulse" />
                  FETCHING RESOURCE...
                </div>
              </div>
            )}
            <ScrollArea className="h-full w-full p-4 bg-black/90">
              <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
                <code>{selectedResource?.content || fetchResourceMutation.error?.error || "Empty response"}</code>
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, className = "", truncate = false, highlight = false, error = false }: any) {
  return (
    <div className={`p-4 border bg-background/50 flex flex-col gap-2 ${error ? 'border-destructive/50' : highlight ? 'border-primary/50' : 'border-border/50'} ${className}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-bold tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`font-mono text-sm ${truncate ? 'truncate' : 'break-all'} ${error ? 'text-destructive' : highlight ? 'text-primary' : ''}`} title={truncate ? value : undefined}>
        {value}
      </div>
    </div>
  );
}
