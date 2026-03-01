import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Импортируем KaTeX CSS
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = React.memo(({ content }) => {
  return (
    <div className="markdown-container">
      <ReactMarkdown
        children={content}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={{
          code({ node, className, children, ...props }: any) {
            const hasLang = /language-(\w+)/.exec(className || '');
            
            // Если это инлайновый код, просто возвращаем стандартный элемент
            if (!hasLang) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            // Это блок кода с указанным языком
            const lang = hasLang[1];
            // Извлекаем фактический код, убирая лишние пробелы
            const codeString = String(children).replace(/\n$/, '');
            
            return (
              <div className="code-block-wrapper" style={{ overflowX: 'auto' }}>
                <div className="code-header">
                  <span className="code-language">{lang}</span>
                </div>
                <SyntaxHighlighter
                  style={oneDark as any}
                  language={lang}
                  PreTag="div"
                  {...props}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0 0 4px 4px',
                    maxHeight: '300px',
                    overflow: 'auto',
                    wordBreak: 'break-word',
                    wordWrap: 'break-word'
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          // Обработка ссылок для обеспечения безопасности
          a: ({ node, className, href, children, ...props }) => {
            // Проверяем, является ли ссылка абсолютной (внешней)
            const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
            
            return (
              <a
                href={href}
                className={className}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                {...props}
                style={{ wordBreak: 'break-word' }}
              >
                {children}
              </a>
            );
          },
          // Обеспечиваем корректное форматирование текста с сохранением переносов строк
          p: ({ node, ...props }) => <p style={{ margin: '0.2em 0', wordBreak: 'break-word' }} {...props} />,
          // Обработка списков
          li: ({ node, ...props }) => <li style={{ margin: '0.2em 0', wordBreak: 'break-word' }} {...props} />,
          // Обработка блоков с ограниченной высотой
          blockquote: ({ node, ...props }) => (
            <blockquote 
              style={{ 
                margin: '0.5em 0', 
                padding: '0.25e 1em', 
                borderLeft: '3px solid var(--border)',
                color: 'var(--text-muted)',
                maxHeight: '200px',
                overflow: 'auto',
                wordBreak: 'break-word'
              }} 
              {...props} 
            />
          ),
          // Обработка таблиц с горизонтальным скроллом
          table: ({ node, ...props }) => (
            <div style={{ overflowX: 'auto', margin: '0.5em 0' }}>
              <table style={{ minWidth: '100%', borderCollapse: 'collapse' }} {...props} />
            </div>
          ),
          // Обработка изображений
          img: ({ node, ...props }) => (
            <img 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '300px',
                borderRadius: '4px',
                objectFit: 'contain'
              }} 
              {...props} 
            />
          ),
          // Обработка математических формул
          div: ({ node, ...props }) => (
            <div 
              style={{ 
                overflowX: 'auto',
                wordBreak: 'break-word'
              }}
              {...props} 
            />
          ),
          span: ({ node, ...props }) => (
            <span 
              style={{ 
                wordBreak: 'break-word'
              }}
              {...props} 
            />
          )
        }}
      />
    </div>
  );
});

export default MarkdownMessage;