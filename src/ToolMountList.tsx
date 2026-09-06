import { useMemo, useState } from 'react';
import type { Tool } from './types';
import { toolKind, type ToolKind } from './tool-kind';
import './tool-mount-list.css';

type Props = { tools:Tool[]; selected:string[]; toggle:(id:string)=>void; changeMany:(ids:string[],add:boolean)=>void; emptyText?:string };
type Group={key:string;name:string;kind:ToolKind;tools:Tool[]};

/** Only groups containing mounted tools are rendered; children can be removed independently. */
export function ToolMountList({tools,selected,toggle}:Props) {
  const [expanded,setExpanded]=useState<string[]>([]);
  const groups=useMemo(()=>groupMountedTools(selected.map(id=>tools.find(tool=>tool.id===id)).filter((tool):tool is Tool=>Boolean(tool))),[tools,selected]);
  if(!groups.length)return null;
  const flip=(key:string)=>setExpanded(items=>items.includes(key)?items.filter(item=>item!==key):[...items,key]);
  return <div className="tool-mount-list">{groups.map(group=>{const open=expanded.includes(group.key);
    return <article className="tool-mount-item" key={group.key}>
      <button type="button" className="tool-mount-head" onClick={()=>flip(group.key)} aria-expanded={open}>
        <i aria-hidden="true">{open?'⌄':'›'}</i>
        <span><b>{group.name}</b><small>已添加 {group.tools.length} 个工具</small></span>
        <em className={group.kind}>{kindBadge(group.kind)}</em>
      </button>
      {open&&<div className="tool-mount-children">{group.tools.map(tool=>{const meta=(tool.metadata||{}) as Record<string,any>,schema=meta.input_schema||meta.schema;
        return <details className={!tool.enabled?'disabled':''} key={tool.id}>
          <summary><span><b>{tool.display_name||tool.name}</b><small>{tool.description||'暂无描述'}</small></span><button type="button" onClick={event=>{event.preventDefault();event.stopPropagation();toggle(tool.id)}}>移除</button></summary>
          <div className="tool-mount-detail"><dl><div><dt>工具标识</dt><dd>{tool.name}</dd></div><div><dt>风险级别</dt><dd>{riskLabel(String(meta.risk||'low'))}</dd></div></dl>{schema&&<><b>输入参数</b><pre>{JSON.stringify(schema,null,2)}</pre></>}</div>
        </details>})}</div>}
    </article>})}</div>;
}

function groupMountedTools(tools:Tool[]):Group[]{
 const groups=new Map<string,Group>();
 for(const tool of tools){const meta=(tool.metadata||{}) as Record<string,unknown>,kind=toolKind(tool);
  const connection=String(meta.connection_id||meta.mcp_server_id||meta.mcp_url||meta.operation_url||'default');
  const key=kind==='code'?'code':kind==='builtin'?'builtin':`${kind}:${connection}`;
  const name=kind==='code'?'代码工作区工具':kind==='builtin'?'平台内置工具':String(meta.connection_name||meta.mcp_name||(kind==='mcp'?'MCP 服务':'OpenAPI 服务'));
  if(!groups.has(key))groups.set(key,{key,name,kind,tools:[]});groups.get(key)!.tools.push(tool);
 }
 return [...groups.values()];
}
function kindBadge(kind:ToolKind){return kind==='code'?'代码':kind==='builtin'?'内置':kind.toUpperCase()}
function riskLabel(risk:string){return ['high','write'].includes(risk)?'需审批':risk==='read'?'只读':'低风险'}
