import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'cancelled' | 'error'

interface Props {
  markdown: string
  status: StreamStatus
}

const PLACEHOLDER_TEXT = 'Paste a job URL above and click Evaluate to begin.'

export function StreamingReportView({ markdown, status }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastLenRef = useRef(0)

  // Auto-scroll when streaming IF user is near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (status !== 'streaming') return
    if (markdown.length <= lastLenRef.current) return
    lastLenRef.current = markdown.length
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 100) {
      el.scrollTop = el.scrollHeight
    }
  }, [markdown, status])

  const content =
    status === 'cancelled' ? `${markdown}\n\n*— Evaluation cancelled —*` : markdown

  if (status === 'idle' && markdown.length === 0) {
    return (
      <div
        className="streaming-report streaming-report--empty"
        data-testid="streaming-report"
      >
        <p className="streaming-report__placeholder">{PLACEHOLDER_TEXT}</p>
      </div>
    )
  }

  return (
    <div
      className="streaming-report"
      ref={scrollRef}
      data-testid="streaming-report"
      data-status={status}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
