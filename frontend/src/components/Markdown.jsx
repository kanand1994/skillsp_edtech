import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const components = {
  code({ inline, className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          language={match[1]}
          style={oneDark}
          PreTag="div"
          customStyle={{ borderRadius: 8, fontSize: 13, margin: "12px 0", border: "1px solid rgba(255,255,255,0.06)" }}
          {...rest}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 font-mono text-[0.9em]" {...rest}>
        {children}
      </code>
    );
  },
  a({ children, ...rest }) {
    return <a {...rest} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline">{children}</a>;
  },
  ul({ children }) { return <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>; },
  ol({ children }) { return <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>; },
  blockquote({ children }) { return <blockquote className="border-l-2 border-indigo-500/40 pl-4 my-3 text-zinc-400 italic">{children}</blockquote>; },
  h1({ children }) { return <h1 className="font-heading text-2xl font-semibold mt-4 mb-2">{children}</h1>; },
  h2({ children }) { return <h2 className="font-heading text-xl font-semibold mt-4 mb-2">{children}</h2>; },
  h3({ children }) { return <h3 className="font-heading text-lg font-semibold mt-3 mb-1">{children}</h3>; },
  p({ children }) { return <p className="my-2 leading-relaxed">{children}</p>; },
  table({ children }) { return <div className="overflow-x-auto my-3"><table className="text-sm border-collapse">{children}</table></div>; },
  th({ children }) { return <th className="text-left px-3 py-1.5 border-b border-white/10 font-semibold">{children}</th>; },
  td({ children }) { return <td className="px-3 py-1.5 border-b border-white/5">{children}</td>; },
  hr() { return <hr className="my-4 border-white/10" />; },
};

export default function Markdown({ children = "" }) {
  return (
    <div className="prose prose-invert max-w-none text-zinc-300 text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
