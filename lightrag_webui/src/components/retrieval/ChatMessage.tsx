import { ReactNode, useEffect, useMemo, useRef, memo, useState } from 'react' // Import useMemo
import { Message } from '@/api/lightrag'
import useTheme from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeReact from 'rehype-react'
import rehypeRaw from 'rehype-raw'
import remarkMath from 'remark-math'
import mermaid from 'mermaid'
import { remarkFootnotes } from '@/utils/remarkFootnotes'


import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import { LoaderIcon, ChevronDownIcon, FileTextIcon, FileIcon, BookOpenIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Collapse blank lines that sit between Markdown table rows.
// LLMs sometimes emit GFM tables with an empty line between every row; a blank
// line breaks the table into separate paragraphs, so remark-gfm renders the raw
// pipes as text instead of a table. Removing those interior blanks restores a
// contiguous table block that remark-gfm parses correctly.
const normalizeMarkdownTables = (md: string): string => {
  if (!md || md.indexOf('|') === -1) return md
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
  const lines = md.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      const prev = out.length ? out[out.length - 1] : ''
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const next = j < lines.length ? lines[j] : ''
      if (isRow(prev) && isRow(next)) {
        continue // drop blank line(s) between two table rows
      }
    }
    out.push(lines[i])
  }
  return out.join('\n')
}

// KaTeX configuration options interface
interface KaTeXOptions {
  errorColor?: string;
  throwOnError?: boolean;
  displayMode?: boolean;
  strict?: boolean;
  trust?: boolean;
  errorCallback?: (error: string, latex: string) => void;
}

export type MessageWithError = Message & {
  id: string // Unique identifier for stable React keys
  isError?: boolean
  isThinking?: boolean // Flag to indicate if the message is in a "thinking" state
  /**
   * Indicates if the mermaid diagram in this message has been rendered.
   * Used to persist the rendering state across updates and prevent flickering.
   */
  mermaidRendered?: boolean
  /**
   * Indicates if the LaTeX formulas in this message are complete and ready for rendering.
   * Used to prevent red error text during streaming of incomplete LaTeX formulas.
   */
  latexRendered?: boolean
  /**
   * Knowledge graph insights including entities, relationships, and LLM reasoning.
   * Populated when enableKGInsights is enabled in query settings.
   */
  knowledgeInsights?: KnowledgeInsights
  /**
   * Flag to indicate if LLM reasoning is being generated for this message.
   */
  isGeneratingReasoning?: boolean
}

// Restore original component definition and export
export const ChatMessage = ({
  message,
  isTabActive = true
}: {
  message: MessageWithError
  isTabActive?: boolean
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const [katexPlugin, setKatexPlugin] = useState<((options?: KaTeXOptions) => any) | null>(null)
  const [isThinkingExpanded, setIsThinkingExpanded] = useState<boolean>(false)
  const [expandedRefs, setExpandedRefs] = useState<Set<number>>(new Set())

  // Toggle function for expandable references
  const toggleExpanded = (idx: number) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Directly use props passed from the parent.
  const { thinkingContent, displayContent, thinkingTime, isThinking } = message

  // Reset expansion state when new thinking starts
  useEffect(() => {
    if (isThinking) {
      // When thinking starts, always reset to collapsed state
      setIsThinkingExpanded(false)
    }
  }, [isThinking, message.id])

  // The content to display is now non-ambiguous.
  const finalThinkingContent = thinkingContent
  // For user messages, displayContent will be undefined, so we fall back to content.
  // For assistant messages, we prefer displayContent but fallback to content for backward compatibility
  const finalDisplayContent = message.role === 'user'
    ? message.content
    : (displayContent !== undefined ? displayContent : (message.content || ''))

  // Repair tables that arrive with blank lines between rows so remark-gfm renders them,
  // then turn inline [n] citation markers into links to the matching Sources card entry.
  const renderedDisplayContent = useMemo(() => {
    let md = normalizeMarkdownTables(finalDisplayContent)
    const refCount = message.references?.length ?? 0
    if (refCount > 0) {
      // [n] (not a footnote [^n], not already a markdown link [n](...)) -> [n](#source-n)
      md = md.replace(/\[(\d{1,3})\](?!\()/g, (m, n) => {
        const idx = parseInt(n, 10)
        return idx >= 1 && idx <= refCount ? `[${n}](#source-${n})` : m
      })
    }
    return md
  }, [finalDisplayContent, message.references])

  // Load KaTeX rehype plugin dynamically
  // Note: KaTeX extensions (mhchem, copy-tex) are imported statically in main.tsx
  useEffect(() => {
    const loadKaTeX = async () => {
      try {
        const { default: rehypeKatex } = await import('rehype-katex');
        setKatexPlugin(() => rehypeKatex);
      } catch (error) {
        console.error('Failed to load KaTeX plugin:', error);
        setKatexPlugin(null);
      }
    };

    loadKaTeX();
  }, []);

  const mainMarkdownComponents = useMemo(() => ({
    code: (props: any) => {
      const { inline, className, children, ...restProps } = props;
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;

      // Handle math blocks ($$...$$) - provide better container and styling
      if (language === 'math' && !inline) {
        return (
          <div className="katex-display-wrapper my-4 overflow-x-auto">
            <div className="text-current">{children}</div>
          </div>
        );
      }

      // Handle inline math ($...$) - ensure proper inline display
      if (language === 'math' && inline) {
        return (
          <span className="katex-inline-wrapper">
            <span className="text-current">{children}</span>
          </span>
        );
      }

      // Handle all other code (inline and block)
      return (
        <CodeHighlight
          inline={inline}
          className={className}
          {...restProps}
          renderAsDiagram={message.mermaidRendered ?? false}
          messageRole={message.role}
        >
          {children}
        </CodeHighlight>
      );
    },
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      // Inline citation marker -> scrolls to the matching Sources card entry
      if (href && href.startsWith('#source-')) {
        const targetId = href.slice(1)
        return (
          <sup
            role="button"
            tabIndex={0}
            title="Jump to source"
            className="citation-marker cursor-pointer text-primary font-semibold mx-0.5 hover:underline"
            onClick={(e) => {
              e.preventDefault()
              const el = document.getElementById(targetId)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('ring-2', 'ring-primary')
                setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1600)
              }
            }}
          >
            [{children}]
          </sup>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline break-words">
          {children}
        </a>
      )
    },
    p: ({ children }: { children?: ReactNode }) => <div className="my-2">{children}</div>,
    h1: ({ children }: { children?: ReactNode }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
    h2: ({ children }: { children?: ReactNode }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
    h3: ({ children }: { children?: ReactNode }) => <h3 className="text-base font-bold mt-3 mb-2">{children}</h3>,
    h4: ({ children }: { children?: ReactNode }) => <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
    li: ({ children }: { children?: ReactNode }) => <li className="my-1">{children}</li>,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => (
      <thead className="bg-primary/8 dark:bg-primary/10">{children}</thead>
    ),
    tbody: ({ children }: { children?: ReactNode }) => (
      <tbody className="divide-y divide-border/40">{children}</tbody>
    ),
    tr: ({ children }: { children?: ReactNode }) => (
      <tr className="transition-colors hover:bg-muted/40">{children}</tr>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50 whitespace-nowrap">{children}</th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="px-3 py-2 text-foreground/90 border-r border-border/30 last:border-r-0">{children}</td>
    ),
  }), [message.mermaidRendered, message.role]);

  const thinkingMarkdownComponents = useMemo(() => ({
    code: (props: any) => (<CodeHighlight {...props} renderAsDiagram={message.mermaidRendered ?? false} messageRole={message.role} />)
  }), [message.mermaidRendered, message.role]);

  return (
    <div
      className={`${
        message.role === 'user'
          ? 'max-w-[80%] lumen-user-bubble'
          : message.isError
            ? 'w-[95%] rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
            : 'w-[95%] lumen-glass lumen-answer text-foreground'
      } px-4 py-3`}
    >
      {/* Thinking process display - only for assistant messages */}
      {/* Always render to prevent layout shift when switching tabs */}
      {message.role === 'assistant' && (isThinking || thinkingTime !== null) && (
        <div className={cn(
          'mb-2',
          // Reduce visual priority in inactive tabs while maintaining layout
          !isTabActive && 'opacity-50'
        )}>
          <div
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200 text-sm cursor-pointer select-none"
            onClick={() => {
              // Allow expansion when there's thinking content, even during thinking process
              if (finalThinkingContent && finalThinkingContent.trim() !== '') {
                setIsThinkingExpanded(!isThinkingExpanded)
              }
            }}
          >
            {isThinking ? (
              <>
                {/* Only show spinner animation in active tab to save resources */}
                {isTabActive && <LoaderIcon className="mr-2 size-4 animate-spin" />}
                <span>{t('retrievePanel.chatMessage.thinking')}</span>
              </>
            ) : (
              typeof thinkingTime === 'number' && <span>{t('retrievePanel.chatMessage.thinkingTime', { time: thinkingTime })}</span>
            )}
            {/* Show chevron when there's thinking content, even during thinking process */}
            {finalThinkingContent && finalThinkingContent.trim() !== '' && <ChevronDownIcon className={`ml-2 size-4 shrink-0 transition-transform ${isThinkingExpanded ? 'rotate-180' : ''}`} />}
          </div>
          {/* Show thinking content when expanded and content exists, even during thinking process */}
          {isThinkingExpanded && finalThinkingContent && finalThinkingContent.trim() !== '' && (
            <div className="mt-2 pl-4 border-l-2 border-primary/20 dark:border-primary/40 text-sm prose dark:prose-invert max-w-none break-words prose-p:my-1 prose-headings:my-2 [&_sup]:text-[0.75em] [&_sup]:align-[0.1em] [&_sup]:leading-[0] [&_sub]:text-[0.75em] [&_sub]:align-[-0.2em] [&_sub]:leading-[0] [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_u]:underline [&_del]:line-through [&_ins]:underline [&_ins]:decoration-green-500 [&_.footnotes]:mt-6 [&_.footnotes]:pt-3 [&_.footnotes]:border-t [&_.footnotes]:border-border [&_.footnotes_ol]:text-xs [&_.footnotes_li]:my-0.5 [&_a[href^='#fn']]:text-primary [&_a[href^='#fn']]:no-underline [&_a[href^='#fn']]:hover:underline [&_a[href^='#fnref']]:text-primary [&_a[href^='#fnref']]:no-underline [&_a[href^='#fnref']]:hover:underline text-foreground">
              {isThinking && (
                <div className="mb-2 text-xs text-gray-400 dark:text-gray-300 italic">
                  {t('retrievePanel.chatMessage.thinkingInProgress', 'Thinking in progress...')}
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkFootnotes, remarkMath]}
                rehypePlugins={[
                  rehypeRaw,
                  ...((katexPlugin && (message.latexRendered ?? true)) ? [[katexPlugin, {
                    errorColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                    throwOnError: false,
                    displayMode: false,
                    strict: false,
                    trust: true,
                    // Add silent error handling to avoid console noise
                    errorCallback: (error: string, latex: string) => {
                      // Only show detailed errors in development environment
                      if (process.env.NODE_ENV === 'development') {
                        console.warn('KaTeX rendering error in thinking content:', error, 'for LaTeX:', latex);
                      }
                    }
                  }] as any] : []),
                  rehypeReact
                ]}
                skipHtml={false}
                components={thinkingMarkdownComponents}
              >
                {finalThinkingContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
      {/* Main content display */}
      {finalDisplayContent && (
        <div className="relative">
          <ReactMarkdown
            className={`prose dark:prose-invert max-w-none text-sm break-words prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 [&_.katex]:text-current [&_.katex-display]:my-4 [&_.katex-display]:max-w-full [&_.katex-display_>.base]:overflow-x-auto [&_sup]:text-[0.75em] [&_sup]:align-[0.1em] [&_sup]:leading-[0] [&_sub]:text-[0.75em] [&_sub]:align-[-0.2em] [&_sub]:leading-[0] [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_u]:underline [&_del]:line-through [&_ins]:underline [&_ins]:decoration-green-500 [&_.footnotes]:mt-8 [&_.footnotes]:pt-4 [&_.footnotes]:border-t [&_.footnotes_ol]:text-sm [&_.footnotes_li]:my-1 ${
              message.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
            } ${
              message.role === 'user'
                ? '[&_.footnotes]:border-primary-foreground/30 [&_a[href^="#fn"]]:text-primary-foreground [&_a[href^="#fn"]]:no-underline [&_a[href^="#fn"]]:hover:underline [&_a[href^="#fnref"]]:text-primary-foreground [&_a[href^="#fnref"]]:no-underline [&_a[href^="#fnref"]]:hover:underline'
                : '[&_.footnotes]:border-border [&_a[href^="#fn"]]:text-primary [&_a[href^="#fn"]]:no-underline [&_a[href^="#fn"]]:hover:underline [&_a[href^="#fnref"]]:text-primary [&_a[href^="#fnref"]]:no-underline [&_a[href^="#fnref"]]:hover:underline'
            }`}
            remarkPlugins={[remarkGfm, remarkFootnotes, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
              ...((katexPlugin && (message.latexRendered ?? true)) ? [[
                katexPlugin,
                {
                  errorColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  throwOnError: false,
                  displayMode: false,
                  strict: false,
                  trust: true,
                  // Add silent error handling to avoid console noise
                  errorCallback: (error: string, latex: string) => {
                    // Only show detailed errors in development environment
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('KaTeX rendering error in main content:', error, 'for LaTeX:', latex);
                    }
                  }
                }
              ] as any] : []),
              rehypeReact
            ]}
            skipHtml={false}
            components={mainMarkdownComponents}
          >
            {renderedDisplayContent}
          </ReactMarkdown>
        </div>
      )}
      {/* Citations/References Section */}
      {message.role === 'assistant' && message.references && message.references.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="text-xs font-semibold text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <BookOpenIcon className="w-3.5 h-3.5" />
            <span>Sources ({message.references.length})</span>
          </div>
          <div className="space-y-2">
            {message.references.map((ref, idx) => {
              const rawName = ref.file_path.split('/').pop() || ref.file_path
              const ext = rawName.split('.').pop()?.toLowerCase() ?? ''
              // Human-readable title: strip extension, replace underscores/hyphens with spaces
              const docTitle = rawName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
              const isExpanded = expandedRefs.has(idx)
              const hasContent = !!(ref.content && ref.content.length > 0)
              const allPassages = ref.content ?? []
              const firstPassage = allPassages[0] ?? null
              const EXCERPT_LEN = 240
              const excerpt = firstPassage ? firstPassage.slice(0, EXCERPT_LEN) : null
              const hasMore = hasContent && (firstPassage!.length > EXCERPT_LEN || allPassages.length > 1)

              const FileTypeIcon = ext === 'pdf' ? FileTextIcon : FileIcon

              const refNum = ref.reference_id || String(idx + 1)
              return (
                <div key={ref.reference_id || idx} id={`source-${refNum}`} className="scroll-mt-4 rounded-xl border border-border/40 bg-muted/15 overflow-hidden text-xs transition-shadow">

                  {/* ── Header ── */}
                  <div className="flex items-start gap-2.5 px-3 py-2.5">
                    {/* Citation number */}
                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
                      {refNum}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Document title row */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileTypeIcon className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                        <span className="font-semibold text-foreground truncate flex-1" title={rawName}>
                          {docTitle}
                        </span>
                        {ext && (
                          <span className="flex-shrink-0 text-[9px] uppercase font-bold tracking-wide text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                            {ext}
                          </span>
                        )}
                        {allPassages.length > 1 && (
                          <span className="flex-shrink-0 text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">
                            {allPassages.length} passages
                          </span>
                        )}
                      </div>

                      {/* Always-visible excerpt */}
                      {excerpt && !isExpanded && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed border-l-2 border-primary/25 pl-2">
                          {excerpt}{firstPassage!.length > EXCERPT_LEN ? '…' : ''}
                          {hasMore && (
                            <button
                              onClick={() => toggleExpanded(idx)}
                              className="ml-1.5 text-primary/70 hover:text-primary font-medium transition-colors"
                            >
                              read more
                            </button>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Expand/collapse toggle */}
                    {hasMore && (
                      <button
                        onClick={() => toggleExpanded(idx)}
                        className="flex-shrink-0 self-start mt-0.5 p-1 rounded hover:bg-muted/60 transition-colors"
                        title={isExpanded ? 'Collapse' : 'Read more'}
                      >
                        <ChevronDownIcon className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* ── Expanded passages ── */}
                  {hasContent && isExpanded && (
                    <div className="border-t border-border/30 divide-y divide-border/20">
                      {allPassages.map((passage, pi) => (
                        <div key={pi} className="px-3 py-2.5">
                          {allPassages.length > 1 && (
                            <div className="mb-1.5 text-[10px] font-semibold text-primary/60 uppercase tracking-wide">
                              Passage {pi + 1} of {allPassages.length}
                            </div>
                          )}
                          <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-2.5">
                            {passage}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Loading indicator - only show in active tab */}
      {isTabActive && (() => {
        // More comprehensive loading state check
        const hasVisibleContent = finalDisplayContent && finalDisplayContent.trim() !== '';
        const isLoadingState = !hasVisibleContent && !isThinking && !thinkingTime;
        return isLoadingState && <LoaderIcon className="animate-spin duration-2000" />
      })()}
    </div>
  )
}

// Remove the incorrect memo export line

interface CodeHighlightProps {
  inline?: boolean
  className?: string
  children?: ReactNode
  renderAsDiagram?: boolean // Flag to indicate if rendering as diagram should be attempted
  messageRole?: 'user' | 'assistant' // Message role for context-aware styling
}



// Check if it is a large JSON
const isLargeJson = (language: string | undefined, content: string | undefined): boolean => {
  if (!content || language !== 'json') return false;
  return content.length > 5000; // JSON larger than 5KB is considered large JSON
};

// Memoize the CodeHighlight component
const CodeHighlight = memo(({ inline, className, children, renderAsDiagram = false, messageRole, ...props }: CodeHighlightProps) => {
  const { theme } = useTheme();
  const [hasRendered, setHasRendered] = useState(false); // State to track successful render
  const match = className?.match(/language-(\w+)/);
  const language = match ? match[1] : undefined;
  const mermaidRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Use ReturnType for better typing

  // Get the content string, check if it is a large JSON
  const contentStr = String(children || '').replace(/\n$/, '');
  const isLargeJsonBlock = isLargeJson(language, contentStr);

  // Handle Mermaid rendering with debounce
  useEffect(() => {
    // Effect should run when renderAsDiagram becomes true or hasRendered changes.
    // The actual rendering logic inside checks language and hasRendered state.
    if (renderAsDiagram && !hasRendered && language === 'mermaid' && mermaidRef.current) {
      const container = mermaidRef.current; // Capture ref value

      // Clear previous timer if dependencies change before timeout (e.g., renderAsDiagram flips quickly)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (!container) return; // Container might have unmounted

        // Double check hasRendered state inside timeout, in case it changed rapidly
        if (hasRendered) return;

        try {
          // Initialize mermaid config
          mermaid.initialize({
            startOnLoad: false,
            theme: theme === 'dark' ? 'dark' : 'default',
            securityLevel: 'loose',
            suppressErrorRendering: true,
          });

          // Show loading indicator
          container.innerHTML = '<div class="flex justify-center items-center p-4"><svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

          // Preprocess mermaid content
          const rawContent = String(children).replace(/\n$/, '').trim();

          // Heuristic check for potentially complete graph definition
          const looksPotentiallyComplete = rawContent.length > 10 && (
            rawContent.startsWith('graph') ||
            rawContent.startsWith('sequenceDiagram') ||
            rawContent.startsWith('classDiagram') ||
            rawContent.startsWith('stateDiagram') ||
            rawContent.startsWith('gantt') ||
            rawContent.startsWith('pie') ||
            rawContent.startsWith('flowchart') ||
            rawContent.startsWith('erDiagram')
          );

          if (!looksPotentiallyComplete) {
            console.log('Mermaid content might be incomplete, skipping render attempt:', rawContent);
            // Optionally keep loading indicator or show a message
            // container.innerHTML = '<p class="text-sm text-muted-foreground">Waiting for complete diagram...</p>';
            return;
          }

          const processedContent = rawContent
            .split('\n')
            .map(line => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('subgraph')) {
                const parts = trimmedLine.split(' ');
                if (parts.length > 1) {
                  const title = parts.slice(1).join(' ').replace(/["']/g, '');
                  return `subgraph "${title}"`;
                }
              }
              return trimmedLine;
            })
            .filter(line => !line.trim().startsWith('linkStyle'))
            .join('\n');

          const mermaidId = `mermaid-${Date.now()}`;
          mermaid.render(mermaidId, processedContent)
            .then(({ svg, bindFunctions }) => {
              // Check ref and hasRendered state again inside async callback
              if (mermaidRef.current === container && !hasRendered) {
                container.innerHTML = svg;
                setHasRendered(true); // Mark as rendered successfully
                if (bindFunctions) {
                  try {
                    bindFunctions(container);
                  } catch (bindError) {
                    console.error('Mermaid bindFunctions error:', bindError);
                    container.innerHTML += '<p class="text-orange-500 text-xs">Diagram interactions might be limited.</p>';
                  }
                }
              } else if (mermaidRef.current !== container) {
                console.log('Mermaid container changed before rendering completed.');
              }
            })
            .catch(error => {
              console.error('Mermaid rendering promise error (debounced):', error);
              console.error('Failed content (debounced):', processedContent);
              if (mermaidRef.current === container) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorPre = document.createElement('pre');
                errorPre.className = 'text-red-500 text-xs whitespace-pre-wrap break-words';
                errorPre.textContent = `Mermaid diagram error: ${errorMessage}\n\nContent:\n${processedContent}`;
                container.innerHTML = '';
                container.appendChild(errorPre);
              }
            });

        } catch (error) {
          console.error('Mermaid synchronous error (debounced):', error);
          console.error('Failed content (debounced):', String(children));
          if (mermaidRef.current === container) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorPre = document.createElement('pre');
            errorPre.className = 'text-red-500 text-xs whitespace-pre-wrap break-words';
            errorPre.textContent = `Mermaid diagram setup error: ${errorMessage}`;
            container.innerHTML = '';
            container.appendChild(errorPre);
          }
        }
      }, 300); // Debounce delay
    }

    // Cleanup function to clear the timer on unmount or before re-running effect
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  // Dependencies: renderAsDiagram ensures effect runs when diagram should be shown.
  // Dependencies include all values used inside the effect to satisfy exhaustive-deps.
  // The !hasRendered check prevents re-execution of render logic after success.
  }, [renderAsDiagram, hasRendered, language, children, theme]); // Add children and theme back

  // For large JSON, skip syntax highlighting completely and use a simple pre tag
  if (isLargeJsonBlock) {
    return (
      <pre className="whitespace-pre-wrap break-words bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
        {contentStr}
      </pre>
    );
  }

  // Render based on language type
  // If it's a mermaid language block and rendering as diagram is not requested (e.g., incomplete stream), display as plain text
  if (language === 'mermaid' && !renderAsDiagram) {
    return (
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        PreTag="div"
        language="text" // Use text as language to avoid syntax highlighting errors
        {...props}
      >
        {contentStr}
      </SyntaxHighlighter>
    );
  }

  // If it's a mermaid language block and the message is complete, render as diagram
  if (language === 'mermaid') {
    // Container for Mermaid diagram
    return <div className="mermaid-diagram-container my-4 overflow-x-auto" ref={mermaidRef}></div>;
  }


  // ReactMarkdown determines inline vs block based on markdown syntax
  // Inline code: `code` (no className with language)
  // Block code: ```language (has className like "language-js")
  // If there's no language className and no explicit inline prop, it's likely inline code
  const isInline = inline ?? !className?.startsWith('language-');

  // Generate dynamic inline code styles based on message role and theme
  const getInlineCodeStyles = () => {
    if (messageRole === 'user') {
      // User messages have dark background (bg-primary), need light inline code
      return theme === 'dark'
        ? 'bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30'
        : 'bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30';
    } else {
      // Assistant messages have light background (bg-muted), need contrasting inline code
      return theme === 'dark'
        ? 'bg-muted-foreground/20 text-muted-foreground border border-muted-foreground/30'
        : 'bg-slate-200 text-slate-800 border border-slate-300';
    }
  };

  // Handle non-Mermaid code blocks
  return !isInline ? (
    <SyntaxHighlighter
      style={theme === 'dark' ? oneDark : oneLight}
      PreTag="div"
      language={language}
      {...props}
    >
      {contentStr}
    </SyntaxHighlighter>
  ) : (
    // Handle inline code with context-aware styling
    <code
      className={cn(
        className,
        'mx-1 rounded-sm px-1 py-0.5 font-mono text-sm',
        getInlineCodeStyles()
      )}
      {...props}
    >
      {children}
    </code>
  );
});

// Assign display name for React DevTools
CodeHighlight.displayName = 'CodeHighlight';
