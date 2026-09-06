import { appConfirm } from "./dialogs";
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from './api';
import type { ModelConnection } from './types';
import './model-manager.css';

type Preset = { provider: string; name: string; base_url?: string };
type Tier = 'device' | 'edge' | 'cloud';
const tiers: Array<[Tier,string]> = [['device','端侧'],['edge','边侧'],['cloud','云侧']];
const runnable = (m:ModelConnection) => m.enabled && m.configured && m.test_status==='succeeded';
const blank = {name:'',provider:'openai-compatible',model_id:'',base_url:'',api_key:''};
const assignedTo = (m:ModelConnection,t:Tier) => m.auto_tiers?.includes(t) || (!m.auto_tiers?.length && m.auto_default && m.tier===t);

export function ModelConnectionPanel({api,models,presets,done}:{api:ApiClient;models:ModelConnection[];presets:Preset[];done:()=>unknown}) {
  const [query,setQuery]=useState(''),[status,setStatus]=useState('');
  const [opened,setOpened]=useState(false),[editing,setEditing]=useState<ModelConnection|null>(null);
  const [form,setForm]=useState(blank),[initial,setInitial]=useState(''),[clearKey,setClearKey]=useState(false);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [results,setResults]=useState<Record<string,{ok:boolean;text:string;time:string}>>({});
  const nameRef=useRef<HTMLInputElement>(null),opener=useRef<HTMLElement|null>(null);
  const dirty=opened&&(JSON.stringify(form)!==initial||clearKey);
  const close=async ()=>{if(busy)return;if(dirty&&!(await appConfirm('修改尚未保存，确定放弃吗？')))return;setOpened(false);opener.current?.focus();};
  useEffect(()=>{if(!opened)return;nameRef.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[opened,dirty,busy]);
  useEffect(()=>{if(!dirty)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  const open=(model:ModelConnection|null)=>{opener.current=document.activeElement as HTMLElement;const next=model?{name:model.name,provider:model.provider,model_id:model.model_id,base_url:model.base_url,api_key:''}:{...blank};setEditing(model);setForm(next);setInitial(JSON.stringify(next));setClearKey(false);setError('');setOpened(true);};
  const update=(key:keyof typeof blank,value:string)=>setForm(f=>({...f,[key]:value}));
  const action=async(id:string,fn:()=>Promise<unknown>)=>{setBusy(id);setError('');try{await fn();await done();}catch(e){setError((e as Error).message);}finally{setBusy('');}};
  const test=(m:ModelConnection)=>action(m.id,async()=>{try{const r=await api.post<any>(`/api/model-connections/${m.id}/test`);setResults(x=>({...x,[m.id]:{ok:true,text:`推理成功 · ${r.test_result?.latency_ms??0} ms`,time:new Date().toLocaleString()}}));}catch(e){setResults(x=>({...x,[m.id]:{ok:false,text:(e as Error).message,time:new Date().toLocaleString()}}));await done();throw e;}});
  const save=()=>action('save',async()=>{const {api_key,...fields}=form;const payload={...fields,...(clearKey?{api_key:'',api_key_env:''}:api_key.trim()?{api_key:api_key.trim()}:{}),...(!editing?{tier:'general'}:{})};const saved=editing?await api.put<ModelConnection>(`/api/model-connections/${editing.id}`,payload):await api.post<ModelConnection>('/api/model-connections',payload);setOpened(false);setNotice(`“${saved.name}”已保存${saved.test_status==='succeeded'?'，原测试状态保留':'，请执行连接测试'}。`);});
  const missing=tiers.filter(([t])=>!models.some(m=>assignedTo(m,t)&&runnable(m))).map(([,label])=>label);
  const rows=models.filter(m=>(!status||(status==='disabled'?!m.enabled:status==='ready'?runnable(m):m.enabled&&!runnable(m)))&&`${m.name} ${m.model_id} ${m.provider}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="mm">
    <header className="mm-toolbar"><div><h3>连接管理</h3><p>添加连接、测试可用性，再为应用选择模型。</p></div><button className="primary" disabled={!!busy} onClick={()=>open(null)}>＋ 添加模型</button></header>
    <section className="mm-auto"><div className="mm-toolbar"><h3>自动调度配置</h3><span className={missing.length?'mm-warning':'mm-success'}>{missing.length?'未就绪':'已就绪'}</span></div>
      <div className="mm-tiers">{tiers.map(([t,label])=>{const current=models.find(m=>assignedTo(m,t));return <label key={t}>{label}调度模型<select disabled={!!busy} value={current?.id||''} onChange={e=>{const connection_id=e.target.value;void action('default',()=>api.put(`/api/model-connections/auto-routing/${t}`,{connection_id}));}}><option value="">请选择已测试模型</option>{models.filter(runnable).map(m=><option key={m.id} value={m.id}>{m.name} · {m.model_id}</option>)}</select></label>;})}</div>
      <p>{missing.length?`尚缺：${missing.join('、')}可用默认连接。端、边、云全部就绪后才能使用 AUTO。`:'端、边、云默认模型均已就绪，应用可以使用 AUTO 调度。'}</p>
    </section>
    {notice&&<div className="mm-success" role="status">{notice}</div>}
    {error&&!opened&&<div className="mm-error" role="alert">{error}</div>}
    <div className="mm-filters"><input aria-label="搜索模型" placeholder="搜索连接名称、模型 ID、提供商" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="状态筛选" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="ready">可用</option><option value="pending">待测试 / 测试失败</option><option value="disabled">已停用</option></select><span>{rows.length} 个连接</span></div>
    <div className="mm-table"><table><thead><tr><th>连接名称</th><th>模型 / 提供商</th><th>状态 / 最近测试</th><th>AUTO 调度</th><th>操作</th></tr></thead><tbody>{rows.map(m=>{const autoLabels=tiers.filter(([t])=>assignedTo(m,t)).map(([,label])=>label);return <tr key={m.id}><td><button className="mm-name" onClick={()=>open(m)}>{m.name}</button></td><td><b>{m.model_id}</b><small>{m.provider}</small></td><td><span className={runnable(m)?'mm-success':'mm-warning'}>{!m.enabled?'已停用':m.test_status==='succeeded'?'测试成功':m.test_status==='failed'?'测试失败':'待测试'}</span>{results[m.id]&&<small className={results[m.id].ok?'':'mm-error'}>{results[m.id].text}<br/>{results[m.id].time}</small>}</td><td>{autoLabels.length?autoLabels.join('、'):'—'}</td><td><div className="mm-actions"><button disabled={!!busy} onClick={()=>open(m)}>编辑</button><button disabled={!!busy||!m.enabled} onClick={()=>test(m)}>{busy===m.id?'测试中…':'测试'}</button><select aria-label={`${m.name}的更多操作`} disabled={!!busy} value="" onChange={async e=>{const command=e.target.value;if(!command)return;if(!(await appConfirm(`${command==='delete'?'删除':'更改启用状态'}“${m.name}”？${autoLabels.length?`该连接用于 AUTO 的${autoLabels.join('、')}调度，操作会影响自动调度。`:''}已引用应用可能受影响，请先替换连接。`)))return;void action(m.id,()=>command==='delete'?api.delete(`/api/model-connections/${m.id}`):api.put(`/api/model-connections/${m.id}`,{enabled:!m.enabled}));}}><option value="">更多</option><option value="toggle">{m.enabled?'停用':'启用'}</option><option value="delete">删除</option></select></div></td></tr>})}</tbody></table>{!rows.length&&<p className="mm-empty">{models.length?'没有符合筛选条件的连接':'还没有模型连接，点击“添加模型”开始配置。'}</p>}</div>
    {opened&&<div className="mm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section className="mm-drawer" role="dialog" aria-modal="true" aria-labelledby="mm-title" onKeyDown={e=>{if(e.key!=='Tab')return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}>
      <header><div><h2 id="mm-title">{editing?'编辑模型连接':'添加模型连接'}</h2><p>{dirty?'有未保存的修改':'配置实际模型服务的连接信息'}</p></div><button aria-label="关闭" disabled={!!busy} onClick={close}>×</button></header>
      <form onSubmit={e=>{e.preventDefault();void save();}}><div className="mm-form">
        <h3>基本信息</h3><label>连接名称<input ref={nameRef} required maxLength={100} value={form.name} onChange={e=>update('name',e.target.value)}/></label>
        <label>提供商<select value={form.provider} onChange={e=>{const provider=e.target.value;setForm(f=>({...f,provider,...(!editing?{base_url:presets.find(p=>p.provider===provider)?.base_url||''}:{})}));}}><option value="openai-compatible">自定义兼容服务</option>{!presets.some(p=>p.provider===form.provider)&&form.provider!=='openai-compatible'&&<option value={form.provider}>{form.provider}</option>}{presets.map(p=><option key={p.provider} value={p.provider}>{p.name}</option>)}</select></label>
        <h3>连接配置</h3><label>模型 ID<input required value={form.model_id} onChange={e=>update('model_id',e.target.value)} placeholder="服务商实际支持的模型 ID"/></label><label>OpenAI 兼容 Base URL<input required type="url" value={form.base_url} onChange={e=>update('base_url',e.target.value)} placeholder="https://api.example.com/v1"/><small>填写基础地址，不包含 /chat/completions。</small></label>
        <label>API Key {editing&&(editing.has_api_key||editing.api_key_env)&&<small>已配置 · 留空保留原密钥</small>}<input type="password" autoComplete="new-password" disabled={clearKey} value={form.api_key} onChange={e=>update('api_key',e.target.value)} placeholder={editing?'输入新密钥以替换；留空不修改':'无需鉴权的本地服务可留空'}/></label>
        {editing&&<label className="mm-checkbox"><input type="checkbox" checked={clearKey} onChange={e=>setClearKey(e.target.checked)}/>清除已保存的密钥及环境变量引用</label>}
        <p className="mm-tip">模型连接无需选择端、边、云层级；测试成功后，可在页面上方将它分配给任意 AUTO 调度槽位。仅改名保留测试状态，修改模型 ID、地址或密钥后需重新测试。密钥不会回显。</p>
        {error&&<div className="mm-error" role="alert">{error}</div>}
      </div><footer><button type="button" disabled={!!busy} onClick={close}>取消</button><button type="submit" className="primary" disabled={!!busy||!form.name.trim()||!form.model_id.trim()||!form.base_url.trim()}>{busy==='save'?'保存中…':'保存连接'}</button></footer></form>
    </section></div>}
  </div>;
}
