interface Props {
  heading: string
  body?: string
}

export function EmptyState({ heading, body }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <h2 className="text-heading text-ctp-text mb-2">{heading}</h2>
      {body && <p className="text-body text-ctp-subtext max-w-md">{body}</p>}
    </div>
  )
}
