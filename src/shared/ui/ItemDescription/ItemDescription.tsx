import { Fragment, ReactNode } from 'react'

interface ItemDescriptionProps {
  text: string
  className?: string
}

interface Segment {
  color?: string
  text: string
}

function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = []
  const regex = /\^([0-9a-fA-F]{6})/g
  let lastIndex = 0
  let currentColor: string | undefined
  let match: RegExpExecArray | null

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ color: currentColor, text: raw.slice(lastIndex, match.index) })
    }
    currentColor = match[1]
    lastIndex = regex.lastIndex
  }
  if (lastIndex < raw.length) {
    segments.push({ color: currentColor, text: raw.slice(lastIndex) })
  }
  return segments
}

function renderWithLineBreaks(text: string): ReactNode[] {
  const parts = text.split(/\\r|\r\n|\r|\n/)
  const nodes: ReactNode[] = []
  parts.forEach((part, idx) => {
    if (idx > 0) nodes.push(<br key={`br-${idx}`} />)
    if (part) nodes.push(<Fragment key={`t-${idx}`}>{part}</Fragment>)
  })
  return nodes
}

export function ItemDescription({ text, className }: ItemDescriptionProps) {
  const segments = parseSegments(text)

  return (
    <div className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ color: seg.color ? `#${seg.color}` : undefined }}>
          {renderWithLineBreaks(seg.text)}
        </span>
      ))}
    </div>
  )
}
