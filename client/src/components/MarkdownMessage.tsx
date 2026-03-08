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
                    className="document-banner"
                  >
                    <div className="document-banner-header">
                      <div className="document-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                      <div className="document-info">
                        <div 
                          className="document-name"
                          title={mediaFile.original_name}
                        >
                          {mediaFile.original_name}
                        </div>
                        <div className="document-meta">
                          {(mediaFile.file_size / 1024).toFixed(1)} KB • {mediaFile.mime_type.split('/')[1] || mediaFile.mime_type}
                        </div>
                      </div>
                    </div>
                    <div className="document-actions">
                      <a
                        href={`/api/media/${mediaFile.encrypted_filename}`}
                        download={mediaFile.original_name}
                        className="download-button"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Скачать
                      </a>
                    </div>
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