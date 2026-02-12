'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Code, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DocumentationPage() {
  const [businessDoc, setBusinessDoc] = useState('');
  const [technicalDoc, setTechnicalDoc] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<'business' | 'technical'>('business');

  useEffect(() => {
    fetch('/api/documentation')
      .then((res) => res.json())
      .then((data) => {
        setBusinessDoc(data.business);
        setTechnicalDoc(data.technical);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const docs = [
    {
      id: 'business' as const,
      title: 'Business Logic',
      subtitle: 'How the optimizer works — step by step',
      icon: BookOpen,
      badge: 'Non-Technical',
      badgeVariant: 'default' as const,
      content: businessDoc,
    },
    {
      id: 'technical' as const,
      title: 'Technical Reference',
      subtitle: 'API endpoints, data models, calculations',
      icon: Code,
      badge: 'For AI Agents',
      badgeVariant: 'secondary' as const,
      content: technicalDoc,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar — document selector */}
      <div className="w-72 shrink-0 border-r border-border bg-card/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-4">
          Documentation
        </h2>
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setActiveDoc(doc.id)}
            className={cn(
              'w-full text-left rounded-lg p-3 transition-colors',
              activeDoc === doc.id
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-muted/50 border border-transparent'
            )}
          >
            <div className="flex items-start gap-3">
              <doc.icon
                className={cn(
                  'h-5 w-5 mt-0.5 shrink-0',
                  activeDoc === doc.id ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      activeDoc === doc.id ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {doc.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {doc.subtitle}
                </p>
                <Badge variant={doc.badgeVariant} className="mt-1.5 text-[10px] px-1.5 py-0">
                  {doc.badge}
                </Badge>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Right content — markdown display */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-8">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  {activeDoc === 'business' ? (
                    <BookOpen className="h-5 w-5 text-primary" />
                  ) : (
                    <Code className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <CardTitle className="text-xl">
                      {docs.find((d) => d.id === activeDoc)?.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {docs.find((d) => d.id === activeDoc)?.subtitle}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-foreground mt-8 mb-3 pb-2 border-b border-border">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-medium text-foreground mt-6 mb-2">
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-base font-medium text-foreground mt-4 mb-2">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="text-sm text-muted-foreground space-y-1 mb-4 ml-4 list-disc">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="text-sm text-muted-foreground space-y-1 mb-4 ml-4 list-decimal">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm text-muted-foreground leading-relaxed">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-foreground font-semibold">{children}</strong>
                      ),
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return (
                            <code className={cn('text-xs', className)}>{children}</code>
                          );
                        }
                        return (
                          <code className="text-xs bg-muted/50 text-primary px-1.5 py-0.5 rounded">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-muted/30 border border-border rounded-lg p-4 overflow-x-auto mb-4 text-xs">
                          {children}
                        </pre>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-4 rounded-lg border border-border">
                          <table className="w-full text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-muted/30">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="text-left text-xs font-semibold text-foreground px-3 py-2 border-b border-border">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="text-sm text-muted-foreground px-3 py-2 border-b border-border/50">
                          {children}
                        </td>
                      ),
                      hr: () => <hr className="border-border my-6" />,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/50 pl-4 italic text-muted-foreground mb-4">
                          {children}
                        </blockquote>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          className="text-primary underline underline-offset-2 hover:text-primary/80"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {activeDoc === 'business' ? businessDoc : technicalDoc}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
