import type { ReactNode } from 'react';

type Props={content:string;className?:string};

/** Safe lightweight Markdown renderer; raw HTML remains escaped text. */
export function Markdown({content,className=''}:Props){
 const lines=String(content||'').replace(/\r\n?/g,'\n').split('\n'),blocks:ReactNode[]=[];let index=0,key=0;
 while(index<lines.length){const line=lines[index];if(!line.trim()){index++;continue}
  if(line.trim().startsWith('```')){const language=line.trim().slice(3).trim(),code:string[]=[];index++;while(index<lines.length&&!lines[index].trim().startsWith('```'))code.push(lines[index++]);if(index<lines.length)index++;blocks.push(<pre key={key++}><code data-language={language||undefined}>{code.join('\n')}</code></pre>);continue}
  const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){const level=heading[1].length,children=inline(heading[2],`${key}-h`);blocks.push(level===1?<h1 key={key++}>{children}</h1>:level===2?<h2 key={key++}>{children}</h2>:level===3?<h3 key={key++}>{children}</h3>:<h4 key={key++}>{children}</h4>);index++;continue}
  if(/^\s*[-*+]\s+/.test(line)){const items:ReactNode[]=[];while(index<lines.length&&/^\s*[-*+]\s+/.test(lines[index]))items.push(<li key={items.length}>{inline(lines[index++].replace(/^\s*[-*+]\s+/,''),`${key}-u-${items.length}`)}</li>);blocks.push(<ul key={key++}>{items}</ul>);continue}
  if(/^\s*\d+[.)]\s+/.test(line)){const items:ReactNode[]=[];while(index<lines.length&&/^\s*\d+[.)]\s+/.test(lines[index]))items.push(<li key={items.length}>{inline(lines[index++].replace(/^\s*\d+[.)]\s+/,''),`${key}-o-${items.length}`)}</li>);blocks.push(<ol key={key++}>{items}</ol>);continue}
  if(/^>\s?/.test(line)){const quote:string[]=[];while(index<lines.length&&/^>\s?/.test(lines[index]))quote.push(lines[index++].replace(/^>\s?/,''));blocks.push(<blockquote key={key++}>{inline(quote.join(' '),`${key}-q`)}</blockquote>);continue}
  const paragraph=[line.trim()];index++;while(index<lines.length&&lines[index].trim()&&!/^(#{1,6})\s|^\s*([-*+]\s+|\d+[.)]\s+)|^```|^>\s?/.test(lines[index]))paragraph.push(lines[index++].trim());blocks.push(<p key={key++}>{inline(paragraph.join(' '),`${key}-p`)}</p>)}
 return <div className={`markdown-rendered ${className}`.trim()}>{blocks}</div>
}

function inline(text:string,prefix:string):ReactNode[]{const result:ReactNode[]=[];let cursor=0,index=0;const pattern=/(\*\*|__)(.+?)\1|(`)(.+?)\3|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;let match:RegExpExecArray|null;while((match=pattern.exec(text))){if(match.index>cursor)result.push(text.slice(cursor,match.index));if(match[1])result.push(<strong key={`${prefix}-${index++}`}>{match[2]}</strong>);else if(match[3])result.push(<code key={`${prefix}-${index++}`}>{match[4]}</code>);else result.push(<a key={`${prefix}-${index++}`} href={match[6]} target="_blank" rel="noreferrer">{match[5]}</a>);cursor=pattern.lastIndex}if(cursor<text.length)result.push(text.slice(cursor));return result}
