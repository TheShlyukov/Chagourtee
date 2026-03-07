import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { MediaFile } from '../api';

// Импортируем KaTeX CSS
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
  media?: MediaFile[];
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = React.memo(({ content, media }) => {
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
                padding: '0.25em 1em', 
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
      
      {/* Render media files if any */}
      {media && media.length > 0 && (
        <div className="media-container" style={{ marginTop: '10px' }}>
          {media.map((mediaFile) => {
            const isImage = mediaFile.mime_type.startsWith('image/');
            const isVideo = mediaFile.mime_type.startsWith('video/');
            const isAudio = mediaFile.mime_type.startsWith('audio/');
            
            return (
              <div key={mediaFile.id} className="media-item" style={{ marginBottom: '10px' }}>
                {isImage ? (
                  <img
                    src={`/api/media/${mediaFile.encrypted_filename}`}
                    alt={mediaFile.original_name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '4px',
                      objectFit: 'contain'
                    }}
                  />
                ) : isVideo ? (
                  <video
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '4px'
                    }}
                  >
                    <source
                      src={`/api/media/${mediaFile.encrypted_filename}`}
                      type={mediaFile.mime_type}
                    />
                    Your browser does not support the video tag.
                  </video>
                ) : isAudio ? (
                  <audio
                    controls
                    style={{
                      width: '100%'
                    }}
                  >
                    <source
                      src={`/api/media/${mediaFile.encrypted_filename}`}
                      type={mediaFile.mime_type}
                    />
                    Your browser does not support the audio element.
                  </audio>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div><strong>{mediaFile.original_name}</strong></div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>
                        {(mediaFile.file_size / 1024).toFixed(1)} KB • {mediaFile.mime_type}
                      </div>
                    </div>
                    <a
                      href={`/api/media/${mediaFile.encrypted_filename}`}
                      download={mediaFile.original_name}
                      style={{
                        marginLeft: '10px',
                        padding: '5px 10px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      Скачать
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default MarkdownMessage;