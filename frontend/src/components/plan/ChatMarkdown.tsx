import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Props {
  text: string;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <button
      className="chat-md__copy"
      onClick={handleCopy}
      aria-label="Copy code"
      type="button"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

export default function ChatMarkdown({ text }: Props) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre(props) {
            // Extract text content for the copy button
            const codeText = extractTextContent(props.children);
            return (
              <div className="chat-md__pre-wrap">
                <CopyButton code={codeText} />
                <pre className="chat-md__pre" {...props} />
              </div>
            );
          },
          code(props: any) {
            const { children, className, ...rest } = props;
            // inline code has no className (no language- prefix)
            const isInline = !className;
            return isInline ? (
              <code className="chat-md__inline" {...rest}>
                {children}
              </code>
            ) : (
              <code className={`chat-md__code ${className || ''}`} {...rest}>
                {children}
              </code>
            );
          },
          p(props) {
            return <p className="chat-md__p" {...props} />;
          },
          ul(props) {
            return <ul className="chat-md__ul" {...props} />;
          },
          ol(props) {
            return <ol className="chat-md__ol" {...props} />;
          },
          li(props) {
            return <li className="chat-md__li" {...props} />;
          },
          strong(props) {
            return <strong className="chat-md__strong" {...props} />;
          },
          h1(props) {
            return <h3 className="chat-md__heading" {...props} />;
          },
          h2(props) {
            return <h3 className="chat-md__heading" {...props} />;
          },
          h3(props) {
            return <h3 className="chat-md__heading" {...props} />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Recursively extract text from React children for the copy button. */
function extractTextContent(children: any): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  if (children?.props?.children) return extractTextContent(children.props.children);
  return '';
}
