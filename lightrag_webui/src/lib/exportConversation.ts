import type { MessageWithError } from '@/components/retrieval/ChatMessage'

const LIGHT_CSS = `:root {
    --bg-primary: #eff1f5;
    --bg-secondary: #e6e9ef;
    --bg-tertiary: #dce0e8;
    --bg-code: #eff1f5;
    --text-primary: #4c4f69;
    --text-secondary: #5c5f77;
    --text-muted: #9ca0b0;
    --text-code: #4c4f69;
    --accent-blue: #1e66f5;
    --accent-teal: #179299;
    --accent-purple: #8839ef;
    --accent-orange: #fe640b;
    --accent-green: #40a02b;
    --accent-red: #d20f39;
    --border-light: #dce0e8;
    --border-medium: #ccd0da;
    --border-dark: #bcc0cc;
    --shadow-subtle: 0 1px 3px rgba(76, 79, 105, 0.08);
    --shadow-medium: 0 2px 8px rgba(76, 79, 105, 0.12);
    --bg-color: var(--bg-primary);
    --text-color: var(--text-primary);
    --primary-color: var(--accent-blue);
    --monospace: "JetBrains Mono", "JetBrains Mono NL", monospace;
    --search-select-bg-color: rgba(30, 102, 245, 0.15);
    --select-text-bg-color: rgba(30, 102, 245, 0.15);
}
html { font-size: 16px; }
html, body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif;
    font-weight: 400;
    line-height: 1.8;
    -webkit-font-smoothing: antialiased;
}
#write { max-width: min(92%, 81rem); padding: 3rem 2rem; margin: 0 auto; }
#write h1, #write h2, #write h3, #write h4, #write h5, #write h6 {
    font-weight: 600; line-height: 1.3; margin: 2.5rem 0 0 0; padding: 0;
    color: var(--text-primary); letter-spacing: -0.02em;
}
#write h1 { font-size: 2.2rem; font-weight: 700; color: rgba(30,102,245,0.85); margin: 3.5rem 0 0 0; }
#write h1:first-child { margin-top: 0; }
#write h2 { font-size: 1.8rem; font-weight: 600; color: rgba(30,102,245,0.65); margin: 3rem 0 0 0; }
#write h3 { font-size: 1.5rem; font-weight: 500; color: rgba(30,102,245,0.45); }
#write h4 { font-size: 1.3rem; color: var(--text-primary); }
#write h5 { font-size: 1.15rem; color: var(--text-secondary); }
#write h6 { font-size: 1rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
#write p { margin: 0.8rem 0; line-height: 1.8; }
#write a { color: var(--accent-blue); text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s ease; }
#write a:hover { color: var(--accent-teal); border-bottom-color: var(--accent-teal); }
#write strong, #write b { color: var(--text-primary); font-weight: 600; }
#write em, #write i { color: var(--text-secondary); font-style: italic; }
#write ul, #write ol { padding-left: 2rem; margin: 1.2rem 0; }
#write ul li, #write ol li { margin: 0.15rem 0; line-height: 1.5; }
#write ul li::marker { color: var(--accent-blue); }
#write ol li::marker { color: var(--accent-blue); font-weight: 600; }
#write pre, #write code {
    background: #e6e9ef; border: 1px solid rgba(76,79,105,0.08);
    color: var(--text-code); font-family: var(--monospace); font-size: 0.875rem; border-radius: 6px;
}
#write pre { padding: 1.5rem 2rem; margin: 1.5rem 0; overflow-x: auto; white-space: pre; }
#write code { padding: 0.2em 0.5em; }
#write blockquote {
    border-left: 4px solid var(--accent-blue); background: var(--bg-tertiary);
    padding: 1rem 1.5rem; margin: 2rem 0; color: var(--text-secondary); border-radius: 0 4px 4px 0;
}
#write blockquote p { margin: 0.5rem 0; }
#write blockquote p:first-child { margin-top: 0; }
#write blockquote p:last-child { margin-bottom: 0; }
#write hr { border: none; height: 1px; background: var(--border-light); margin: 3rem 0; }
#write table { border-collapse: collapse; width: 100%; margin: 2rem 0; background: rgba(255,255,255,0.4); border: 1px solid rgba(76,79,105,0.1); border-radius: 6px; }
#write th, #write td { border: 1px solid rgba(76,79,105,0.06); padding: 0.75rem 1rem; text-align: left; }
#write th { background: rgba(255,255,255,0.3); color: var(--text-primary); font-weight: 600; }
#write tr:nth-child(even) { background: rgba(76,79,105,0.03); }
mark { background: rgba(223,142,29,0.2); color: var(--text-primary); padding: 0.1rem 0.3rem; border-radius: 2px; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-medium); border-radius: 5px; }
`

const DARK_CSS = `:root {
    --bg-primary: #1e1e2e;
    --bg-secondary: #181825;
    --bg-tertiary: #313244;
    --bg-code: #1e1e2e;
    --text-primary: #cdd6f4;
    --text-secondary: #bac2de;
    --text-muted: #6c7086;
    --text-code: #cdd6f4;
    --accent-blue: #89b4fa;
    --accent-teal: #94e2d5;
    --accent-purple: #cba6f7;
    --accent-orange: #fab387;
    --accent-green: #a6e3a1;
    --accent-red: #f38ba8;
    --border-light: #313244;
    --border-medium: #45475a;
    --border-dark: #585b70;
    --shadow-subtle: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-medium: 0 2px 8px rgba(0,0,0,0.4);
    --bg-color: var(--bg-primary);
    --text-color: var(--text-primary);
    --primary-color: var(--accent-blue);
    --monospace: 'JetBrains Mono', 'JetBrains Mono NL', monospace;
    --search-select-bg-color: rgba(137,180,250,0.2);
    --select-text-bg-color: rgba(137,180,250,0.2);
}
html { font-size: 16px; }
html, body {
    background: var(--bg-primary); color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    font-weight: 400; line-height: 1.8; -webkit-font-smoothing: antialiased;
}
#write { max-width: min(92%, 81rem); padding: 3rem 2rem; margin: 0 auto; }
#write h1, #write h2, #write h3, #write h4, #write h5, #write h6 {
    font-weight: 600; line-height: 1.3; margin: 2.5rem 0 0 0; padding: 0;
    color: var(--text-primary); letter-spacing: -0.02em;
}
#write h1 { font-size: 2.2rem; font-weight: 700; color: var(--accent-blue); margin: 3.5rem 0 0 0; }
#write h1:first-child { margin-top: 0; }
#write h2 { font-size: 1.8rem; font-weight: 600; color: var(--accent-blue); filter: brightness(0.85); margin: 3rem 0 0 0; }
#write h3 { font-size: 1.5rem; font-weight: 500; color: var(--accent-blue); filter: brightness(0.7); }
#write h4 { font-size: 1.3rem; color: var(--text-primary); }
#write h5 { font-size: 1.15rem; color: var(--text-secondary); }
#write h6 { font-size: 1rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
#write p { margin: 0.8rem 0; line-height: 1.8; }
#write a { color: var(--accent-blue); text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s ease; }
#write a:hover { color: var(--accent-teal); border-bottom-color: var(--accent-teal); }
#write strong, #write b { color: var(--text-primary); font-weight: 600; }
#write em, #write i { color: var(--text-secondary); font-style: italic; }
#write ul, #write ol { padding-left: 2rem; margin: 1.2rem 0; }
#write ul li, #write ol li { margin: 0.15rem 0; line-height: 1.5; }
#write ul li::marker { color: var(--accent-blue); }
#write ol li::marker { color: var(--accent-blue); font-weight: 600; }
#write pre, #write code {
    background: #181825; border: 1px solid rgba(205,214,244,0.06);
    color: var(--text-code); font-family: var(--monospace); font-size: 0.875rem; border-radius: 6px;
}
#write pre { padding: 1.5rem 2rem; margin: 1.5rem 0; overflow-x: auto; white-space: pre; }
#write code { padding: 0.2em 0.5em; }
#write blockquote {
    border-left: 4px solid var(--accent-blue); background: var(--bg-tertiary);
    padding: 1rem 1.5rem; margin: 2rem 0; color: var(--text-secondary); border-radius: 0 4px 4px 0;
}
#write blockquote p { margin: 0.5rem 0; }
#write blockquote p:first-child { margin-top: 0; }
#write blockquote p:last-child { margin-bottom: 0; }
#write hr { border: none; height: 1px; background: var(--border-light); margin: 3rem 0; }
#write table { border-collapse: collapse; width: 100%; margin: 1rem 0 2rem 0; background: rgba(0,0,0,0.12); border: 1px solid rgba(205,214,244,0.06); border-radius: 6px; }
#write th, #write td { border: 1px solid rgba(205,214,244,0.03); padding: 0.75rem 1rem; text-align: left; }
#write th { background: rgba(0,0,0,0.1); color: var(--text-primary); font-weight: 600; }
#write tr:nth-child(even) { background: rgba(0,0,0,0.05); }
#write tr:hover { background: rgba(137,180,250,0.05); }
mark { background: rgba(249,226,175,0.25); color: var(--text-primary); padding: 0.1rem 0.3rem; border-radius: 2px; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--border-medium); border-radius: 5px; }
`

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMd(raw: string): string {
  // Protect inline code from further processing
  const codeSlots: string[] = []
  let s = raw.replace(/`([^`]+)`/g, (_, code) => {
    const i = codeSlots.length
    codeSlots.push(`<code>${esc(code)}</code>`)
    return `\x00${i}\x00`
  })
  // Escape HTML in non-code text
  s = esc(s)
  // Bold-italic, bold, italic
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
  s = s.replace(/_([^_\n]+?)_/g, '<em>$1</em>')
  // Restore code slots
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => codeSlots[parseInt(i)])
  return s
}

function mdToHtml(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inCode = false
  const codeLines: string[] = []

  const flushLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const line of lines) {
    // Fenced code block
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`)
        codeLines.length = 0
        inCode = false
      } else {
        flushLists()
        inCode = true
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.+)$/)
    if (hm) {
      flushLists()
      const lvl = hm[1].length
      out.push(`<h${lvl}>${inlineMd(hm[2])}</h${lvl}>`)
      continue
    }

    // Unordered list item
    const ulm = line.match(/^[-*+]\s+(.+)$/)
    if (ulm) {
      if (!inUl) { if (inOl) { out.push('</ol>'); inOl = false } out.push('<ul>'); inUl = true }
      out.push(`<li>${inlineMd(ulm[1])}</li>`)
      continue
    }

    // Ordered list item
    const olm = line.match(/^\d+\.\s+(.+)$/)
    if (olm) {
      if (!inOl) { if (inUl) { out.push('</ul>'); inUl = false } out.push('<ol>'); inOl = true }
      out.push(`<li>${inlineMd(olm[1])}</li>`)
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushLists()
      out.push('<hr>')
      continue
    }

    // Empty line — close open lists, add spacing
    if (line.trim() === '') {
      flushLists()
      out.push('')
      continue
    }

    // Normal paragraph line
    flushLists()
    out.push(`<p>${inlineMd(line)}</p>`)
  }

  flushLists()
  if (inCode) out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`)

  return out.join('\n')
}

export function buildExportHtml(
  messages: MessageWithError[],
  theme: 'light' | 'dark',
  title = 'DocForge — Conversation Export'
): string {
  const css = theme === 'dark' ? DARK_CSS : LIGHT_CSS

  // Group into QA pairs: user message followed by (optional) assistant reply
  const pairs: Array<{ question: MessageWithError; answer?: MessageWithError }> = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'user') {
      const next = messages[i + 1]
      if (next && next.role === 'assistant') {
        pairs.push({ question: msg, answer: next })
        i++ // skip the assistant message
      } else {
        pairs.push({ question: msg })
      }
    }
  }

  const qaBlocks = pairs
    .map((pair, idx) => {
      const q = pair.question
      const a = pair.answer
      let html = `<h2>Q${idx + 1}: ${esc(q.content)}</h2>\n`

      if (a) {
        const displayText = a.displayContent || a.content
        html += `<div class="answer">\n${mdToHtml(displayText)}\n</div>\n`

        // Chain-of-thought reasoning
        if (a.thinkingContent) {
          html += `<blockquote>\n<p><strong>Reasoning</strong></p>\n${mdToHtml(a.thinkingContent)}\n</blockquote>\n`
        }

        // KG reasoning
        if (a.knowledgeInsights?.reasoning) {
          html += `<blockquote>\n<p><strong>Knowledge Graph Reasoning</strong></p>\n${mdToHtml(a.knowledgeInsights.reasoning)}\n</blockquote>\n`
        }

        // Source chunks
        const chunks = a.knowledgeInsights?.chunks
        if (chunks && chunks.length > 0) {
          html += `<h4>Sources</h4>\n<ul>\n`
          chunks.forEach((chunk) => {
            const src = chunk.file_path ? `<em>${esc(chunk.file_path)}</em> — ` : ''
            const snippet = esc(chunk.content.slice(0, 200)) + (chunk.content.length > 200 ? '…' : '')
            html += `<li>${src}${snippet}</li>\n`
          })
          html += `</ul>\n`
        }

        // Entities + keywords
        const ki = a.knowledgeInsights
        if (ki) {
          const kwHigh = ki.keywords?.high_level?.join(', ')
          const kwLow = ki.keywords?.low_level?.join(', ')
          const entityNames = ki.entities?.slice(0, 10).map((e) => esc(e.entity_name)).join(', ')

          if (kwHigh || kwLow || entityNames) {
            html += `<h4>Knowledge</h4>\n<ul>\n`
            if (entityNames) html += `<li><strong>Entities:</strong> ${entityNames}</li>\n`
            if (kwHigh) html += `<li><strong>High-level keywords:</strong> ${esc(kwHigh)}</li>\n`
            if (kwLow) html += `<li><strong>Low-level keywords:</strong> ${esc(kwLow)}</li>\n`
            html += `</ul>\n`
          }
        }
      }

      return html
    })
    .join('\n<hr>\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
${css}
</style>
</head>
<body>
<div id="write">
<h1>${esc(title)}</h1>
${qaBlocks || '<p><em>No conversation yet.</em></p>'}
</div>
</body>
</html>`
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
