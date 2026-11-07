import { memo, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Step } from '@shared/domain';

// T069 / FR-021: render every step kind. Code is highlighted with Shiki (bundled locally, FR-082).

let highlighter: Promise<(code: string, lang: string) => string> | null = null;
function getHighlighter() {
  highlighter ??= import('shiki/bundle/web').then(async ({ createHighlighter }) => {
    const h = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['ts', 'tsx', 'js', 'json', 'bash', 'python', 'html', 'css', 'markdown', 'yaml'],
    });
    const loaded = new Set(h.getLoadedLanguages());
    return (code: string, lang: string) =>
      h.codeToHtml(code, {
        lang: loaded.has(lang) ? lang : 'text',
        themes: { light: 'github-light', dark: 'github-dark' },
      });
  });
  return highlighter;
}

function Code({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getHighlighter()
      .then((hl) => alive && setHtml(hl(code, lang)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [code, lang]);
  if (html) return <div className="code" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <pre className="code">
      <code>{code}</code>
    </pre>
  );
}

function Md({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const m = /language-(\w+)/.exec(className ?? '');
          const code = String(children).replace(/\n$/, '');
          return m || code.includes('\n') ? <Code code={code} lang={m?.[1] ?? 'text'} /> : <code className="inline">{children}</code>;
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </Markdown>
  );
}

function Collapsible({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="collapsible" open={open}>
      <summary>{title}</summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}

const TOOL_LABEL: Record<string, string> = {
  read_file: 'Đọc file',
  view_file: 'Đọc file',
  run_command: 'Chạy lệnh',
  write_to_file: 'Ghi file',
  replace_file_content: 'Sửa file',
  grep_search: 'Tìm kiếm',
  list_dir: 'Xem thư mục',
  search_web: 'Tìm trên web',
};

export const StepView = memo(function StepView({ step }: { step: Step }) {
  const generating = step.status === 'GENERATING' || step.status === 'RUNNING';
  switch (step.kind) {
    case 'user':
      return (
        <div className="msg msg-user">
          <div className="bubble">
            {step.text}
            {step.mentions.length > 0 && (
              <div className="mentions">
                {step.mentions.map((m) => (
                  <span key={m.uri} className="chip">
                    @{m.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    case 'agent':
      return (
        <div className="msg msg-agent">
          {step.thinking && (
            <Collapsible title={generating ? 'Đang suy nghĩ…' : 'Suy nghĩ'} open={generating && !step.text}>
              <div className="thinking">{step.thinking}</div>
            </Collapsible>
          )}
          {step.text && (
            <div className="bubble">
              <Md text={step.text} />
            </div>
          )}
          {step.toolCalls.map((c) => (
            <div key={c.id} className="tool-call">
              🔧 {TOOL_LABEL[c.name] ?? c.name}
            </div>
          ))}
          {generating && !step.text && !step.thinking && <div className="typing">…</div>}
        </div>
      );
    case 'command':
      return (
        <div className="msg msg-tool">
          <Collapsible title={`$ ${step.command?.commandLine || 'lệnh'}${step.command?.exitCode != null ? ` (mã thoát ${step.command.exitCode})` : ''}`}>
            <pre className="code">{step.command?.output || '(không có kết quả)'}</pre>
          </Collapsible>
        </div>
      );
    case 'file_view':
      return <div className="msg msg-tool small">📄 Đã đọc {step.file?.summary}</div>;
    case 'file_change':
      return (
        <div className="msg msg-tool small">
          ✏️ Đã thay đổi <span title={step.file?.uri}>{step.file?.summary}</span>{' '}
          <span className="muted">(xem diff trong Antigravity App)</span>
        </div>
      );
    case 'system':
      return <div className="msg msg-system">{step.text}</div>;
    case 'error':
      return <div className="msg msg-error">⚠ Agent gặp lỗi ({step.rawType})</div>;
    case 'permission_request':
      return <div className="msg msg-system">Agent đang xin quyền: {step.permission?.description}</div>;
    default:
      return (
        <div className="msg msg-tool small">
          <Collapsible title={`Bước ${step.rawType.toLowerCase()}`}>
            <span className="muted">Trạng thái: {step.status}</span>
          </Collapsible>
        </div>
      );
  }
});
