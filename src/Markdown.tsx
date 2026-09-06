import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CopyButton } from './CopyButton';
import 'highlight.js/styles/github.css';

function codeText(children: ReactNode): string {
 return Children.toArray(children).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? codeText(child.props.children) : '').join('');
}

/** No raw HTML plugin, no remote images, and only explicit web/mail links. */
export function Markdown({content,className=''}:{content:string;className?:string}) {
 return <div className={`markdown-rendered ${className}`}>
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight,{detect:false}]]}
   urlTransform={url => /^(https?:\/\/|mailto:)/i.test(url) ? url : ''}
   components={{
    a: ({href,children}) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({alt}) => <span>{alt || '[图片]'}</span>,
    pre: ({children}) => <div className="reply-code"><div className="reply-code-toolbar"><span>代码</span><CopyButton label="复制代码" text={codeText(children).replace(/\n$/, '')}/></div><pre>{children}</pre></div>,
    table: ({children}) => <div className="reply-table"><table>{children}</table></div>
   }}>{String(content || '')}</ReactMarkdown>
 </div>;
}
