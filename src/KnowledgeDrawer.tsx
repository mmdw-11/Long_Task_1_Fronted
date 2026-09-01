import {useMemo,useState} from 'react';
import './skill-drawer.css';
import './knowledge-drawer.css';

type KnowledgeItem={id:string;name:string;description:string;status:string;document_count?:number;chunk_count?:number};

export function KnowledgeDrawer({items,selected,close,toggle}:{items:KnowledgeItem[];selected:string[];close:()=>void;toggle:(id:string)=>void}){
  const [query,setQuery]=useState('');
  const available=useMemo(()=>items.filter(item=>item.status==='ready'&&`${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())),[items,query]);
  return <div className="skill-drawer-layer" onMouseDown={event=>event.target===event.currentTarget&&close()}><aside className="skill-drawer knowledge-drawer"><header><div><h2>添加知识库</h2><p>只展示已完成解析并可用于检索的知识库。</p></div><button aria-label="关闭" onClick={close}>×</button></header><div className="skill-drawer-toolbar"><label>⌕<input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索可用知识库"/></label></div><div className="knowledge-drawer-summary">可用知识库 <b>{available.length}</b> 个 · 已添加 <b>{selected.length}</b> 个</div><div className="knowledge-drawer-list">{available.map(item=>{const checked=selected.includes(item.id);return <article key={item.id}><span className="knowledge-drawer-icon">▤</span><div><h3>{item.name}</h3><p>{item.description||'暂无描述'}</p><small>{item.document_count??0} 个文档 · {item.chunk_count??0} 个切片 · 可用</small></div><button className={checked?'selected':''} onClick={()=>toggle(item.id)}>{checked?'已添加':'添加'}</button></article>})}{!available.length&&<div className="skill-drawer-empty">没有匹配的可用知识库。请先在知识库页面创建并上传、解析文档。</div>}</div></aside></div>;
}
