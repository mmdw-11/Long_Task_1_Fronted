import { useRef, useState } from 'react';
import type { ApiClient } from './api';
import { FilePreview } from './FilePreview';
import type { EditedFile } from './reply-files';
import { Markdown } from './Markdown';
import { CopyButton } from './CopyButton';
import { editedFiles } from './reply-files';
import { modelOutputs } from './run-stream';

function plainText(element: HTMLElement | null, fallback: string) {
 if (!element) return fallback;
 const clone = element.cloneNode(true) as HTMLElement;
 clone.querySelectorAll('.reply-code-toolbar').forEach(el => el.remove());
 clone.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
 clone.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr').forEach(el => el.append('\n'));
 clone.querySelectorAll('td,th').forEach(el => el.append('\t'));
 return (clone.textContent || fallback).trim();
}

type BatchResult = { index: number; status: string; output?: unknown; error?: unknown };

function parseBatchResults(text: string): BatchResult[] | null {
 try {
  const value = JSON.parse(text);
  if (!Array.isArray(value) || !value.length) return null;
  if (!value.every(item => item && typeof item === 'object' && typeof item.index === 'number' && typeof item.status === 'string' && ('output' in item || 'error' in item))) return null;
  return value as BatchResult[];
 } catch {
  return null;
 }
}

function BatchResults({items}:{items:BatchResult[]}) {
 const succeeded = items.filter(item => item.status === 'succeeded').length;
 return <section className="batch-result-output" aria-label="批处理结果">
  <header><b>批处理结果</b><small>{succeeded}/{items.length} 项成功</small></header>
  {items.map(item => {
   const success = item.status === 'succeeded';
   const preview = success && item.output && typeof item.output === 'object' && 'item' in item.output ? String((item.output as {item?:unknown}).item ?? '') : '';
   const detail = success ? item.output : { error: item.error ?? '未知错误' };
   return <details key={item.index} className={success ? 'succeeded' : 'failed'}>
    <summary><span>#{item.index + 1}</span><b>{success ? '处理成功' : '处理失败'}</b>{preview && <small>{preview}</small>}</summary>
    <pre>{JSON.stringify(detail, null, 2)}</pre>
   </details>;
  })}
 </section>;
}

export function QuestionContent({text}:{text:string}) {
 return <div className="question-content"><div>{text}</div><CopyButton text={text} label="复制提问"/></div>;
}

export function ReplyContent({text,events=[],running=false,api,runId,showNodeNames=false}:{text:string;events?:Record<string,any>[];running?:boolean;api:ApiClient;runId?:string;showNodeNames?:boolean}) {
 const [selectedFile,setSelectedFile]=useState<EditedFile|null>(null);
 const body = useRef<HTMLDivElement>(null), files = editedFiles(events), outputs=modelOutputs(events), intermediate=outputs.slice(0,-1), batchResults=parseBatchResults(text);
 return <section className="reply-content">
  {!!intermediate.length&&<div className="model-stage-outputs"><b>阶段输出 · {intermediate.length}</b>{intermediate.map(output=><details key={output.id} open={running}><summary><span>{showNodeNames&&output.node?`${output.node} · ${output.stage}`:output.stage}</span><small>{output.model}{output.complete?' · 已完成':' · 生成中'}</small></summary><Markdown content={output.text}/></details>)}</div>}
  <div ref={body} className={running ? 'reply-streaming' : ''}>{batchResults ? <BatchResults items={batchResults}/> : <Markdown content={text}/>}</div>
  {!!files.length && <details className="reply-files"><summary>本次已编辑 {files.length} 个文件</summary><small>点击文件名查看当前内容。仅统计工具确认的写入。</small>{files.map(file => <div key={file.workspace+':'+file.path}><span>{file.action}</span><button className="file-preview-link" disabled={!runId||!file.workspace} title={!file.workspace?'旧记录缺少工作区信息，无法预览':'查看文件'} onClick={()=>setSelectedFile(file)}>{file.path}</button><CopyButton text={file.path} label="复制路径"/></div>)}</details>}
  {selectedFile&&runId&&<FilePreview api={api} runId={runId} file={selectedFile} close={()=>setSelectedFile(null)}/>}
  {!!text && <div className="reply-actions"><CopyButton label="复制文本" getText={() => plainText(body.current,text)}/><CopyButton text={text} label="复制 Markdown"/>{running && <small>正在生成…</small>}</div>}
 </section>;
}
