import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import hljs from 'highlight.js/lib/common';
import type { ApiClient } from './api';
import type { EditedFile } from './reply-files';
import { CopyButton } from './CopyButton';
import './file-preview.css';

type Preview = { path:string; content:string; bytes:number; notice:string; diff_available:boolean };
const languages:Record<string,string>={ts:'typescript',tsx:'typescript',js:'javascript',jsx:'javascript',py:'python',sh:'bash',yml:'yaml',md:'markdown',html:'xml',vue:'xml',cs:'csharp',ps1:'powershell'};

export function FilePreview({api,runId,file,close}:{api:ApiClient;runId:string;file:EditedFile;close:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),[data,setData]=useState<Preview|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close()},[]);
 useEffect(()=>{let active=true;setData(null);setError('');const query=new URLSearchParams({workspace_id:file.workspace,path:file.path});
  api.get<Preview>(`/api/runs/${encodeURIComponent(runId)}/files/preview?${query}`).then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError(e.message||'文件读取失败')});
  return()=>{active=false};
 },[api,runId,file.workspace,file.path,reload]);
 const highlighted=useMemo(()=>{if(!data)return null;const ext=data.path.split('.').at(-1)?.toLowerCase()||'',language=languages[ext]||ext;
  return hljs.getLanguage(language)?hljs.highlight(data.content,{language,ignoreIllegals:true}).value:null;
 },[data]);
 return createPortal(<dialog ref={dialog} className="file-preview-dialog" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}} aria-labelledby="file-preview-title">
  <header><div><h2 id="file-preview-title">文件预览</h2><p title={file.path}>{file.path}</p></div><button type="button" onClick={close} aria-label="关闭文件预览" autoFocus>×</button></header>
  <div className="file-preview-toolbar"><b>当前内容</b><span title="未保存完整修改前后快照">修改对比 · 暂无历史快照</span><button onClick={()=>setReload(x=>x+1)}>刷新</button><CopyButton text={file.path} label="复制路径"/>{data&&<CopyButton text={data.content} label="复制内容"/>}</div>
  {error?<div className="file-preview-state" role="alert"><b>暂时无法预览</b><p>{error}</p><button onClick={()=>setReload(x=>x+1)}>重试读取</button></div>:!data?<div className="file-preview-state" role="status">正在读取文件…</div>:<><p className="file-preview-notice">{data.notice} · {data.bytes.toLocaleString()} 字节</p><div className="file-preview-code"><pre aria-hidden="true" className="file-preview-lines">{data.content.split('\n').map((_,i)=>i+1).join('\n')}</pre><pre className="file-preview-source">{highlighted!==null?<code dangerouslySetInnerHTML={{__html:highlighted}}/>:<code>{data.content}</code>}</pre></div></>}
 </dialog>,document.body);
}
