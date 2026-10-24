import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RichMarkdownContentProps {
  content: string;
  slug?: string;
}

interface Block {
  type: 'text' | 'table';
  content?: string;
  rows?: string[][];
}

export const RichMarkdownContent: React.FC<RichMarkdownContentProps> = ({ content, slug }) => {
  const navigate = useNavigate();

  // 1. Break text into blocks (paragraphs vs markdown tables)
  const blocks = React.useMemo(() => {
    const lines = (content || '').split('\n');
    const result: Block[] = [];
    let currentTable: string[][] | null = null;
    let currentText: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (currentText.length > 0) {
          result.push({ type: 'text', content: currentText.join('\n').trim() });
          currentText = [];
        }
        if (!currentTable) {
          currentTable = [];
        }
        // Skip separator rows like |:---|---:|
        const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(line);
        if (!isSeparator) {
          const cells = line
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
          currentTable.push(cells);
        }
      } else {
        if (currentTable) {
          result.push({ type: 'table', rows: currentTable });
          currentTable = null;
        }
        currentText.push(lines[i]);
      }
    }

    if (currentTable) {
      result.push({ type: 'table', rows: currentTable });
    }
    if (currentText.length > 0) {
      const remaining = currentText.join('\n').trim();
      if (remaining) {
        result.push({ type: 'text', content: remaining });
      }
    }

    return result;
  }, [content]);

  // 2. Helper to render inline formatting (bold, links, route chips)
  const renderInline = (text: string) => {
    // Regex matches bold **text** or route links /path
    const parts: React.ReactNode[] = [];
    let cursor = 0;

    // Pattern matches **bold** or inline code `code` or routes like /analytics, /print
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\/(?:analytics|consultation|print|display|nurse|patients|dashboard|users|profile|about)\b)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > cursor) {
        parts.push(text.slice(cursor, match.index));
      }

      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-bold text-slate-900 dark:text-white">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={match.index} className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-900 dark:text-slate-100 font-mono text-[10px]">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('/')) {
        // Clickable app route chip
        const routePath = slug ? `/${slug}${token === '/' ? '/dashboard' : token}` : token;
        parts.push(
          <button
            key={match.index}
            onClick={(e) => {
              e.stopPropagation();
              navigate(routePath);
            }}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-mono text-[10px] font-semibold transition-colors cursor-pointer"
          >
            {token}
          </button>
        );
      }

      cursor = match.index + token.length;
    }

    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((block, bIdx) => {
        if (block.type === 'table' && block.rows && block.rows.length > 0) {
          const [headerRow, ...dataRows] = block.rows;
          return (
            <div
              key={bIdx}
              className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 shadow-xs backdrop-blur-xs"
            >
              <table className="w-full text-left text-[11px] border-collapse">
                {headerRow && (
                  <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {headerRow.map((cell, cIdx) => (
                        <th key={cIdx} className="px-3 py-2 whitespace-nowrap">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="even:bg-slate-50/50 dark:even:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Text block
        if (!block.content) return null;
        const paragraphs = block.content.split('\n');

        return (
          <div key={bIdx} className="space-y-1">
            {paragraphs.map((p, pIdx) => {
              const trimmed = p.trim();
              if (!trimmed) return <div key={pIdx} className="h-1" />;

              // Bullet item
              if (trimmed.startsWith('• ') || trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                return (
                  <div key={pIdx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold">•</span>
                    <span className="flex-1">{renderInline(trimmed.slice(2))}</span>
                  </div>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
              if (numMatch) {
                return (
                  <div key={pIdx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px]">
                      {numMatch[1]}.
                    </span>
                    <span className="flex-1">{renderInline(numMatch[2])}</span>
                  </div>
                );
              }

              return <p key={pIdx}>{renderInline(p)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};
