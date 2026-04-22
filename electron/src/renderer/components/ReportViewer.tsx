import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

interface Props {
  path: string
  refreshKey: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; content: string }

function basename(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx >= 0 ? p.slice(idx + 1) : p
}

const components = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-display text-ctp-text mb-3" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-heading text-ctp-text mt-4 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-label text-ctp-text uppercase tracking-wider mt-3 mb-1" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-body text-ctp-text mb-2" {...props}>{children}</p>
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-ctp-blue hover:underline" {...props}>{children}</a>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-ctp-text" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic text-ctp-text" {...props}>{children}</em>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc list-inside my-2 text-body text-ctp-text" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside my-2 text-body text-ctp-text" {...props}>{children}</ol>
  ),
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-ctp-overlay pl-3 my-2 italic text-ctp-subtext" {...props}>{children}</blockquote>
  ),
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { className?: string }) => (
    <code className={`font-mono text-body bg-ctp-surface px-1 rounded ${className ?? ''}`} {...props}>{children}</code>
  ),
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="bg-ctp-surface border border-ctp-overlay rounded p-3 overflow-x-auto my-2" {...props}>{children}</pre>
  ),
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-3">
      <table className="text-body w-full border-collapse" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="text-label text-left px-2 py-1 bg-ctp-surface border-b border-ctp-overlay" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="text-body px-2 py-1 border-b border-ctp-overlay" {...props}>{children}</td>
  ),
}

export function ReportViewer({ path, refreshKey }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    window.api.readReport(path)
      .then(content => {
        if (!cancelled) setState({ kind: 'ready', content })
      })
      .catch(err => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => { cancelled = true }
  }, [path, refreshKey])

  if (state.kind === 'loading') {
    return <EmptyState heading="Loading report..." />
  }
  if (state.kind === 'error') {
    return (
      <ErrorState
        heading="Could not read report"
        body={`Could not read ${basename(path)}. Check that the file exists and is readable.`}
      />
    )
  }
  return (
    <div className="p-6 text-ctp-text h-full overflow-y-auto">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {state.content}
      </Markdown>
    </div>
  )
}
