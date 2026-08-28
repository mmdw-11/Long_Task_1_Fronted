// 百炼风格资源页面：市场、快速开始、应用广场、任务中心、Skill 管理和记忆库。
import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from './api';
import type { Application, Run, Skill, Tool } from './types';
import './bailian-pages.css';

type Notify = (text: string, bad?: boolean) => void;
type Go = (page: any) => void;
type MarketItem = { slug: string; name: string; provider?: string; category: string; description: string; installs?: number; cover?: string };

function useData<T>(api: ApiClient, path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api.get<T[]>(path).then(setData).finally(() => setLoading(false)); };
  useEffect(load, [api, path]);
  return { data, loading, load };
}

export function McpMarketplace({ api, notify, go }: { api: ApiClient; notify: Notify; go: Go }) {
  const q = useData<MarketItem>(api, '/api/marketplace/mcp');
  const [query, setQuery] = useState('');
  const install = async (slug: string) => { try { const result = await api.post<any>(`/api/marketplace/mcp/${slug}/install`); notify(result.message); go('tools'); } catch (e) { notify((e as Error).message, true); } };
  const items = q.data.filter(x => `${x.name}${x.category}${x.description}`.toLowerCase().includes(query.toLowerCase()));
  return <ConsolePage title="MCP 广场" action={<button className="icon-round" onClick={q.load}>↻</button>}>
    <div className="market-filter"><button className="selected">精选</button><button>最新</button><button>分类</button><span className="filter-divider"/><label className="market-search">⌕<input placeholder="请输入，支持模糊搜索" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <div className="mcp-grid">{items.map((item, index) => <article className="mcp-card" key={item.slug}><div className={`mcp-cover ${item.cover || 'blue'}`}><b>{['◒', '◐', 'G', '⌁', '▣', 'AI'][index % 6]}</b><span> | One Key</span></div><div className="mcp-body"><h3>{item.name}</h3><p>{item.description}</p><footer><span>提供方：{item.provider || '示例市场'}</span><span>⌁ {item.installs || 0}</span></footer><button className="install-btn" onClick={() => install(item.slug)}>安装到 MCP 管理</button></div></article>)}</div>
    {!q.loading && !items.length && <Empty title="未找到匹配的 MCP" />}
  </ConsolePage>;
}

export function QuickStart({ api, notify, go }: { api: ApiClient; notify: Notify; go: Go }) {
  const q = useData<MarketItem>(api, '/api/marketplace/apps');
  const install = async (slug: string) => { try { await api.post(`/api/marketplace/apps/${slug}/install`); notify('应用模板已创建，可继续配置和调试'); go('apps'); } catch (e) { notify((e as Error).message, true); } };
  return <ConsolePage title="快速开始" subtitle="3分钟完成 Agent 创建、配置与会话发起。全链路 API 驱动，基于现有 Agent Harness、TODO 与上下文防漂移能力。">
    <section className="quick-hero"><div className="quick-steps">{[['1','创建一个智能体','选择模型、编写系统提示词、挂载 MCP 与技能。'],['2','配置一个运行环境','在当前项目中使用已配置的本地或云端模型适配器。'],['3','新增一个密钥库','集中管理 API Key 等敏感信息，供智能体安全调用。'],['4','创建会话并获取响应','启动运行，查看流式过程、工具审批和总结输出。']].map(([n,t,d]) => <div key={n}><em>{n}</em><h3>{t}</h3><p>{d}</p></div>)}</div><button className="violet-btn" onClick={() => install('blank-agent')}>✦ 快速开始</button></section>
    <h3 className="section-title">没有想法？从模板开始</h3><div className="template-grid">{q.data.map((item, index) => <article key={item.slug} onClick={() => install(item.slug)}><span>{['＋','◎','✧','ϟ'][index % 4]}</span><h3>{item.name}</h3><p>{item.description}</p>{index === 0 && <b className="recommend">推荐</b>}</article>)}</div>
  </ConsolePage>;
}

export function AppSquare({ api, notify, go }: { api: ApiClient; notify: Notify; go: Go }) {
  const q = useData<MarketItem>(api, '/api/marketplace/apps');
  const [query, setQuery] = useState('');
  const items = q.data.filter(x => x.name.includes(query) || x.description.includes(query));
  const install = async (slug: string) => { try { await api.post(`/api/marketplace/apps/${slug}/install`); notify('已根据模板创建草稿应用'); go('apps'); } catch (e) { notify((e as Error).message, true); } };
  return <ConsolePage title="应用广场" action={<label className="market-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索应用" /></label>}>
    <div className="showcase"><div className="showcase-banner purple"><b>AI照相馆专区</b><span>以模板方式快速构建你的智能体应用</span></div><div className="showcase-banner sky"><b>智能办公与知识助手</b><span>规划、写作、抽取与分析</span></div></div>
    <h2 className="section-title">基础办公套件</h2><div className="app-square-list">{items.map((item, i) => <article key={item.slug}><span className="app-square-icon">{['✉','◈','⌕','▣'][i % 4]}</span><div><h3>{item.name}</h3><p>{item.description}</p></div><div className="app-square-meta">◉ {Math.max(1261, 6355 - i * 419)}<button onClick={() => install(item.slug)}>使用模板</button></div></article>)}</div>
  </ConsolePage>;
}

export function TaskCenter({ api, go }: { api: ApiClient; go: Go }) {
  const q = useData<Run>(api, '/api/runs');
  const [query, setQuery] = useState('');
  const rows = q.data.filter(item => item.id.includes(query) || JSON.stringify(item.input).includes(query));
  return <ConsolePage title="任务中心" action={<button className="icon-round" onClick={q.load}>↻</button>}>
    <div className="task-toolbar"><label className="market-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 Task ID" /></label><button>⚱ 过滤器</button><button onClick={() => { setQuery(''); q.load(); }}>重置</button></div>
    {rows.length ? <table className="task-table"><thead><tr><th>Task ID</th><th>状态</th><th>输入</th><th>输出</th><th>来源</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{rows.map(run => <tr key={run.id}><td><code>{run.id}</code></td><td><Status value={run.status} /></td><td>{short(JSON.stringify(run.input), 36)}</td><td>{short(String((run.state as any)?.messages?.at?.(-1)?.content || ''), 36)}</td><td>{String(run.metadata?.application_name || '控制台')}</td><td>{format(run.created_at)}</td><td><button onClick={() => go('runs')}>查看</button></td></tr>)}</tbody></table> : <Empty title="你还没有创建过异步任务" subtitle="请先搭建应用，调试运行后将在这里查看全过程和结果。" />}
  </ConsolePage>;
}

export function SkillMarket({ api, notify, go }: { api: ApiClient; notify: Notify; go: Go }) {
  const q = useData<MarketItem>(api, '/api/marketplace/skills');
  const [query, setQuery] = useState('');
  const install = async (slug: string) => { try { const r = await api.post<any>(`/api/marketplace/skills/${slug}/install`); notify(r.message); go('skills'); } catch (e) { notify((e as Error).message, true); } };
  const items = q.data.filter(x => `${x.name}${x.category}${x.description}`.toLowerCase().includes(query.toLowerCase()));
  return <ConsolePage title="Skill 管理" action={<button className="violet-btn" onClick={() => go('skills')}>＋ 自定义 Skill</button>}>
    <div className="market-filter"><button className="selected">全部</button><button>代码开发</button><button>通用办公</button><button>金融</button><button>法律</button><button>教育</button><span className="filter-divider"/><label className="market-search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="请输入，支持模糊搜索" /></label></div>
    <div className="skill-grid">{items.map((item, index) => <article key={item.slug}><span className={`skill-logo l${index % 4}`}>▲</span><h3>{item.name}</h3><p>{item.description}</p><footer>更新于 2026-08-{String(4 + index).padStart(2, '0')}</footer><button className="install-btn" onClick={() => install(item.slug)}>安装 Skill</button></article>)}</div>
  </ConsolePage>;
}

export function MemoryBanks({ api, notify }: { api: ApiClient; notify: Notify }) {
  type Bank={id:string;name:string;description:string;updated_at:string;memory_count:number;scope_counts:Record<string,number>;binding_count:number};
  const q = useData<Bank>(api, '/api/memory-banks');
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [creating, setCreating] = useState(false);const [selected,setSelected]=useState<Bank|null>(null);
  const create = async () => { try { await api.post('/api/memory-banks', { name, description }); setName(''); setDescription(''); setCreating(false); q.load(); notify('记忆库已创建，可设为应用主库或只读参考库'); } catch (e) { notify((e as Error).message, true); } };
  return <ConsolePage title={`记忆库 ${q.data.length}`} action={<button className="violet-btn" onClick={() => setCreating(true)}>＋ 创建记忆库</button>}>
    <div className="info-banner">ⓘ 每个应用可设置一个可读写主库，并绑定多个只读参考库；每个库内部均保留 WORKING / TASK / PROJECT / GLOBAL 四级作用域。</div><div className="memory-search"><label className="market-search">⌕<input placeholder="请输入名称、描述或 ID" /></label><button className="icon-round" onClick={q.load}>↻</button></div>
    <div className="memory-cards">{q.data.map(bank => <article key={bank.id} onClick={()=>setSelected(bank)}><span>☁</span><h3>{bank.name}</h3><p>{bank.description || '尚未填写描述'}</p><p>{bank.memory_count||0} 条记忆 · {bank.binding_count||0} 个应用绑定</p><div className="memory-scope-counts">{['working','task','project','global'].map(scope=><small key={scope}>{scope.toUpperCase()} {bank.scope_counts?.[scope]||0}</small>)}</div><footer>更新于 {format(bank.updated_at)}</footer><button onClick={async event => {event.stopPropagation();if(confirm('确认删除该记忆库？'))try{await api.delete(`/api/memory-banks/${bank.id}`);q.load()}catch(e){notify((e as Error).message,true)}}}>删除</button></article>)}</div>{!q.loading && !q.data.length && <Empty title="还没有记忆库" subtitle="创建后可在应用中设为主库或只读参考库。" />}
    {creating && <div className="overlay"><div className="modal"><div className="modal-head"><h2>创建记忆库</h2><button onClick={() => setCreating(false)}>×</button></div><div className="form-grid"><label className="span">名称<input value={name} onChange={e => setName(e.target.value)} placeholder="例如：客户沟通记忆库" /></label><label className="span">描述<textarea value={description} onChange={e => setDescription(e.target.value)} /></label><div className="form-actions span"><button onClick={() => setCreating(false)}>取消</button><button className="primary" disabled={!name.trim()} onClick={create}>创建</button></div></div></div></div>}
    {selected&&<MemoryDetail bank={selected} api={api} notify={notify} close={()=>{setSelected(null);q.load()}}/>}
  </ConsolePage>;
}

function MemoryDetail({bank,api,notify,close}:{bank:{id:string;name:string;description:string};api:ApiClient;notify:Notify;close:()=>void}){type Item={id:string;content:unknown;scope:string;scope_id?:string;tags:string[];ts:number;metadata:Record<string,unknown>};const [items,setItems]=useState<Item[]>([]),[query,setQuery]=useState(''),[scope,setScope]=useState(''),[content,setContent]=useState(''),[newScope,setNewScope]=useState('project'),[adding,setAdding]=useState(false);const load=()=>api.get<{items:Item[]}>(`/api/memory-banks/${bank.id}/memories?query=${encodeURIComponent(query)}&scope=${scope}`).then(value=>setItems(value.items));useEffect(()=>{load()},[bank.id,scope]);const add=async()=>{try{await api.post(`/api/memory-banks/${bank.id}/memories`,{content,scope:newScope,tags:['manual']});setContent('');setAdding(false);load();notify('记忆已添加')}catch(e){notify((e as Error).message,true)}};return <div className="skill-drawer-layer"><aside className="skill-drawer memory-detail"><header><div><h2>{bank.name}</h2><p>{bank.description||'查看和管理四级记忆内容'}</p></div><button onClick={close}>×</button></header><div className="memory-detail-tools"><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="搜索记忆内容"/></label><select value={scope} onChange={e=>setScope(e.target.value)}><option value="">全部层级</option>{['working','task','project','global'].map(value=><option value={value} key={value}>{value.toUpperCase()}</option>)}</select><button className="primary" onClick={()=>setAdding(true)}>＋ 添加记忆</button></div><div className="memory-item-list">{items.map(item=><article key={item.id}><header><b>{item.scope.toUpperCase()}</b><time>{new Date(item.ts*1000).toLocaleString('zh-CN')}</time></header><p>{typeof item.content==='string'?item.content:JSON.stringify(item.content)}</p><small>{item.scope_id||'无作用域 ID'} {item.tags?.length?`· ${item.tags.join(' / ')}`:''}</small><button onClick={async()=>{if(confirm('删除这条记忆？')){await api.delete(`/api/memory-banks/${bank.id}/memories/${item.id}`);load()}}}>删除</button></article>)}{!items.length&&<div className="skill-drawer-empty">暂无匹配记忆</div>}</div>{adding&&<div className="memory-add"><h3>人工添加记忆</h3><select value={newScope} onChange={e=>setNewScope(e.target.value)}>{['working','task','project','global'].map(value=><option value={value} key={value}>{value.toUpperCase()}</option>)}</select><textarea rows={5} value={content} onChange={e=>setContent(e.target.value)} placeholder="输入需要记住的内容"/><footer><button onClick={()=>setAdding(false)}>取消</button><button className="primary" disabled={!content.trim()} onClick={add}>保存</button></footer></div>}</aside></div>}

function ConsolePage({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) { return <div className="bailian-content"><div className="bailian-page-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</div>; }
function Empty({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="bailian-empty"><div>◇</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>; }
function short(value: string, n: number) { return value.length > n ? `${value.slice(0, n)}…` : value; }
function format(value?: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'; }
function Status({ value }: { value: string }) { const text: Record<string, string> = { succeeded: '成功', failed: '失败', running: '运行中', queued: '排队中', canceled: '已取消' }; return <span className={`run-status ${value}`}>{text[value] || value}</span>; }
