// 百炼侧边栏中组件、数据与权限区域的可操作页面，统一调用本地资源目录接口。
import { useEffect, useState } from 'react';
import type { ApiClient } from './api';
import './console-resource-pages.css';

type Notify = (message: string, bad?: boolean) => void;
type Item = { id: string; name: string; description: string; status: string; metadata: Record<string, unknown>; updated_at: string };
const config: Record<string, { title: string; hint: string; create: string; empty: string }> = {
  'knowledge-bases': { title: '知识库', hint: '将可检索资料作为应用知识源；实际向量检索仍由你的后端技能与上下文模块承接。', create: '创建知识库', empty: '还没有知识库' },
  'data-connections': { title: '数据连接', hint: '登记外部数据源的连接配置。不会在浏览器中保存密码或自动授予外部权限。', create: '创建数据连接', empty: '还没有数据连接' },
  evaluations: { title: '应用评测', hint: '建立可复用评测集和运行回归记录，帮助比较 Agent 版本效果。', create: '创建评测', empty: '还没有评测任务' },
  observability: { title: '应用观测', hint: '查看可观测性配置与运行追踪入口；运行事件仍由运行中心完整保存。', create: '创建观测规则', empty: '还没有观测规则' },
  permissions: { title: '权限管理', hint: '管理控制台资源角色说明。实际接口保护仍由现有登录、API Key 和管理员密钥机制执行。', create: '新增角色', empty: '还没有权限角色' },
  'ui-designs': { title: 'UI 设计器', hint: '创建应用的对话界面草稿，并将界面配置保存在项目后端。', create: '新建设计稿', empty: '还没有 UI 设计稿' },
  components: { title: '组件管理', hint: '已安装的工作流组件会在此保存；可在编排和应用配置中引用。', create: '自定义组件', empty: '还没有已安装组件' },
};

function useItems(api: ApiClient, kind: string) { const [items,setItems]=useState<Item[]>([]); const [loading,setLoading]=useState(true); const load=()=>{setLoading(true);api.get<Item[]>(`/api/resources/${kind}`).then(setItems).finally(()=>setLoading(false));}; useEffect(load,[api,kind]); return {items,loading,load}; }

export function ResourcePage({ api, notify, kind }: { api: ApiClient; notify: Notify; kind: string }) {
  const c=config[kind]; const q=useItems(api,kind); const [show,setShow]=useState(false); const [name,setName]=useState('');const [description,setDescription]=useState('');
  const [query,setQuery]=useState(''); const normalizedQuery=query.trim().toLowerCase(); const visibleItems=q.items.filter(item=>!normalizedQuery||`${item.name} ${item.description} ${item.id}`.toLowerCase().includes(normalizedQuery));
  const create=async()=>{try{await api.post(`/api/resources/${kind}`,{name,description});setShow(false);setName('');setDescription('');q.load();notify(`${c.title}已创建`)}catch(e){notify((e as Error).message,true)}};
  return <div className="resource-page"><div className="resource-head"><div><h2>{c.title}</h2><p>{c.hint}</p></div><button className="violet-btn" onClick={()=>setShow(true)}>＋ {c.create}</button></div><div className="resource-toolbar"><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索名称、描述或 ID" /></label><button aria-label="刷新" title="刷新" onClick={q.load}>↻</button></div>{visibleItems.length?<div className="resource-grid">{visibleItems.map(item=><article key={item.id}><span className="resource-icon">{kind==='permissions'?'♙':kind==='data-connections'?'⌁':kind==='knowledge-bases'?'▤':'◈'}</span><h3>{item.name}</h3><p>{item.description||'尚未填写描述'}</p><small>状态：{item.status}　更新于 {new Date(item.updated_at).toLocaleString('zh-CN')}</small><button className="remove" onClick={async()=>{if(confirm(`删除「${item.name}」？`)){try{await api.delete(`/api/resources/${kind}/${item.id}`);q.load();notify('已删除')}catch(e){notify((e as Error).message,true)}}}}>删除</button></article>)}</div>:!q.loading&&q.items.length?<div className="resource-empty"><b>没有匹配的结果</b><p>请尝试调整搜索关键词。</p></div>:!q.loading&&<div className="resource-empty"><b>{c.empty}</b><p>点击右上角“{c.create}”开始配置。</p></div>}{show&&<Editor title={c.create} name={name} description={description} setName={setName} setDescription={setDescription} close={()=>setShow(false)} submit={create}/>}</div>;
}

export function ComponentMarket({api,notify,go}:{api:ApiClient;notify:Notify;go:(page:any)=>void}){const [items,setItems]=useState<Array<{slug:string;name:string;category:string;description:string}>>([]);useEffect(()=>{api.get<Array<{slug:string;name:string;category:string;description:string}>>('/api/components/market').then(setItems)},[api]);const install=async(slug:string)=>{try{const x=await api.post<any>(`/api/components/${slug}/install`);notify(x.message);go('component-manage')}catch(e){notify((e as Error).message,true)}};return <div className="resource-page"><div className="resource-head"><div><h2>组件广场</h2><p>选择可复用节点模板，安装到当前项目后端，再在应用编排中使用。</p></div></div><div className="component-market-grid">{items.map((item,i)=><article key={item.slug}><span>{['⌁','✓','▤','☷'][i%4]}</span><b>{item.category}</b><h3>{item.name}</h3><p>{item.description}</p><button className="violet-btn" onClick={()=>install(item.slug)}>安装组件</button></article>)}</div></div>}

function Editor({title,name,description,setName,setDescription,close,submit}:{title:string;name:string;description:string;setName:(x:string)=>void;setDescription:(x:string)=>void;close:()=>void;submit:()=>void}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal resource-editor-modal"><div className="modal-head"><div><h2>{title}</h2><p>填写基本信息，创建后可在应用配置中绑定使用。</p></div><button onClick={close}>×</button></div><div className="form-grid resource-editor-form"><label className="span"><span>名称 <em>*</em></span><input autoFocus maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder={`请输入${title}名称`}/></label><label className="span"><span>描述</span><textarea rows={6} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="介绍用途、内容范围或使用说明"/></label><div className="form-actions span"><button onClick={close}>取消</button><button className="primary" disabled={!name.trim()} onClick={submit}>确认创建</button></div></div></div></div>}
