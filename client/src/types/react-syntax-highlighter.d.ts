declare module 'react-syntax-highlighter' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface SyntaxHighlighterProps {
    children: ReactNode;
    style?: Record<string, any>;
    language?: string;
    customStyle?: Record<string, any>;
    codeTagProps?: Record<string, any>;
    useInlineStyles?: boolean;
    className?: string;
    [key: string]: any;
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>;
  export default Prism;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, any>;
}