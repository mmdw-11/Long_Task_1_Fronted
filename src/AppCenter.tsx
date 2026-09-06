import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from './api';
import type { Application, Skill, Tool } from './types';
import { imageFileToAvatar } from './avatar';
import { appConfirm, appPrompt } from './dialogs';
import './app-center.css';
import './create-type.css';
import './create-validation.css';
import './avatar-upload.css';

type Props = { api: ApiClient; notify: (s: string, b?: boolean) => void; go: (p: 'builder' | 'tools' | 'system') => void; openEditor?: (appId: string) => void; openWorkflowEditor?: (appId: string) => void; openCreate?: boolean; onCreateOpened?: () => void };
const DEFAULT_PROMPT = '你是一个可靠的业务智能体。请先理解用户目标，再按步骤调用可用工具完成任务，并输出清晰结果。';

export function AppCenter({ api, notify, go, openEditor = (id) => { location.hash = `app-editor/${encodeURIComponent(id)}`; }, openWorkflowEditor = (id) => { location.hash = `workflow-editor/${encodeURIComponent(id)}`; }, openCreate = false, onCreateOpened }: Props) {
  const [apps, setApps] = useState<Application[]>([]), [tools, setTools] = useState<Tool[]>([]), [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true), [modal, setModal] = useState(false);
  const [appType, setAppType] = useState<'all'|'agent'|'workflow'>('all'), [appStatus, setAppStatus] = useState<'all'|'draft'|'published'>('all'), [appQuery, setAppQuery] = useState('');
  const load = () => { setLoading(true); Promise.all([api.get<Application[]>('/api/apps'), api.get<Tool[]>('/api/tools'), api.get<Skill[]>('/api/skills')]).then(([a,t,s]) => { setApps(a); setTools(t); setSkills(s); }).catch(e => notify((e as Error).message, true)).finally(() => setLoading(false)); };
  useEffect(load, [api]);
  useEffect(() => { if (openCreate) { setModal(true); onCreateOpened?.(); } }, [openCreate, onCreateOpened]);
  const create = async (type:'agent'|'workflow', name: string, description: string, avatarUrl: string) => { try { const created = await api.post<Application>('/api/apps', { name, description, app_type:type, system_prompt:type==='agent'?DEFAULT_PROMPT:'', avatar_url:avatarUrl }); setModal(false); notify(type==='agent'?'智能体应用已创建':'工作流应用已创建'); (type==='agent'?openEditor:openWorkflowEditor)(created.id); } catch (e) { notify((e as Error).message, true); throw e; } };
  const counts = useMemo(() => ({ apps:apps.length, published:apps.filter(a => a.status === 'published').length, tools:tools.length, skills:skills.length }), [apps,tools,skills]);
  const filteredApps = useMemo(() => { const query = appQuery.trim().toLowerCase(); return apps.filter(app => (appType === 'all' || app.app_type === appType) && (appStatus === 'all' || app.status === appStatus) && (!query || `${app.name} ${app.description}`.toLowerCase().includes(query))); }, [apps,appType,appStatus,appQuery]);
  const rename = async (app: Application) => { const name = await appPrompt('输入新的应用名称：', app.name); if (!name?.trim() || name.trim() === app.name) return; try { await api.put(`/api/apps/${app.id}`, { name: name.trim() }); notify('应用名称已更新'); load(); } catch (e) { notify((e as Error).message, true); } };
  const remove = async (app: Application) => { const warning = app.status === 'published' ? `删除「${app.name}」会同时下线其已发布版本与调用入口，确认继续吗？` : `确认删除草稿应用「${app.name}」吗？此操作不可恢复。`; if (!(await appConfirm(warning))) return; try { await api.delete(`/api/apps/${app.id}`); notify('应用已删除'); load(); } catch (e) { notify((e as Error).message, true); } };
  return <div className="managed-apps">
    <section className="managed-hero"><div><span>Managed Agents</span><h2>创建、配置并调试你的智能体应用</h2><p>通过提示词、工具、知识库、Skill 与记忆构建可执行的业务智能体。</p></div><button className="primary" onClick={() => setModal(true)}>创建应用</button></section>
    <section className="managed-metrics"><div><b>{counts.apps}</b><span>全部应用</span></div><div><b>{counts.published}</b><span>已发布</span></div><div><b>{counts.tools}</b><span>MCP / 工具</span></div><div><b>{counts.skills}</b><span>Skill</span></div></section>
    <section className="application-filter" aria-label="应用筛选"><div className="application-filter-tabs">{([['all','全部'],['agent','智能体应用'],['workflow','工作流应用']] as const).map(([value,label])=><button key={value} className={appType===value?'active':''} onClick={()=>setAppType(value)}>{label}</button>)}</div><div className="application-filter-status" aria-label="发布状态">{([['all','全部状态'],['draft','草稿'],['published','已发布']] as const).map(([value,label])=><button key={value} className={appStatus===value?'active':''} onClick={()=>setAppStatus(value)}>{label}{value==='published'?` ${counts.published}`:''}</button>)}</div><label className="application-search">⌕<input value={appQuery} onChange={e=>setAppQuery(e.target.value)} placeholder="搜索名称或描述" aria-label="搜索名称或描述"/></label></section>
    <article className="panel app-table"><div className="panel-head"><div><h2>应用管理</h2><p>智能体进入配置与调试，工作流进入可视化编排。</p></div><div className="button-row"><button onClick={() => go('tools')}>MCP 管理</button><button onClick={() => go('system')}>API Key</button></div></div>
      {loading ? <div className="empty"><span className="spinner"/>正在读取应用…</div> : filteredApps.length ? <div className="app-card-grid">{filteredApps.map(app => <section className="managed-card" key={app.id}><div className="managed-card-head"><AgentAvatar app={app}/><span><b>{app.name}</b><small>{app.app_type === 'workflow' ? '工作流应用' : '智能体应用'}</small></span><em className={app.status}>{app.status === 'published' ? '已发布' : '草稿'}</em></div><p>{app.description || '暂无描述'}</p><dl><dt>{app.app_type==='workflow'?'编排':'模型'}</dt><dd>{app.app_type==='workflow'?'可视化工作流':app.model || '自动调度'}</dd><dt>能力</dt><dd>{app.app_type==='workflow'?'节点与条件路径':`${app.tool_ids.length} 工具 · ${app.skill_ids.length} Skill`}</dd></dl><footer><button className="primary" onClick={() => (app.app_type==='workflow'?openWorkflowEditor:openEditor)(app.id)}>{app.status==='published'?'查看 / 调试':'继续编辑'}</button><details className="app-card-menu"><summary aria-label={`${app.name}的更多操作`}>•••</summary><div><button onClick={() => void rename(app)}>重命名</button><button className="danger-link" onClick={() => void remove(app)}>删除应用</button></div></details></footer></section>)}</div> : apps.length ? <div className="api-empty"><b>没有匹配的应用</b><p>请尝试切换应用类型、发布状态或调整搜索关键词。</p></div> : <div className="api-empty"><b>还没有应用</b><p>创建第一个智能体或工作流应用。</p><button className="primary" onClick={() => setModal(true)}>创建应用</button></div>}
    </article>{modal && <CreateAgentModal close={() => setModal(false)} submit={create}/>}
  </div>;
}

function AgentAvatar({ app }: { app: Application }) { return app.avatar_url ? <img className="agent-avatar" src={app.avatar_url} alt=""/> : <span className="agent-avatar default">AI</span>; }
function CreateAgentModal({ close, submit }: { close:()=>void; submit:(type:'agent'|'workflow',name:string,description:string,avatarUrl:string)=>Promise<void> }) {
  const [type,setType]=useState<'agent'|'workflow'>('agent'),[name,setName]=useState(''), [description,setDescription]=useState(''), [avatarUrl,setAvatarUrl]=useState(''), [submitting,setSubmitting]=useState(false), [error,setError]=useState(''), [avatarError,setAvatarError]=useState('');
  const chooseAvatar=async(file?:File)=>{if(!file)return;setAvatarError('');try{setAvatarUrl(await imageFileToAvatar(file))}catch(e){setAvatarError((e as Error).message)}};
  const send=async(e:React.FormEvent)=>{e.preventDefault();if(submitting)return;if(!name.trim()){setError('请输入应用名称');return}setError('');setSubmitting(true);try{await submit(type,name.trim(),description.trim(),avatarUrl)}catch(e){setError((e as Error).message||'创建失败，请稍后重试')}finally{setSubmitting(false)}};
  return <div className="overlay create-agent-overlay" onMouseDown={e => e.target === e.currentTarget && close()}><div className="create-agent-modal"><header><div><h2>创建应用</h2><p>选择智能体或可视化工作流开始构建</p></div><button type="button" onClick={close}>×</button></header><form onSubmit={send}>
    <section className="create-type-picker"><button type="button" className={type==='agent'?'selected':''} onClick={()=>setType('agent')}><i>AI</i><span><b>智能体应用</b><small>模型自主规划并调用工具</small></span></button><button type="button" className={type==='workflow'?'selected':''} onClick={()=>setType('workflow')}><i>⌘</i><span><b>工作流应用</b><small>拖拽节点编排确定性流程</small></span></button></section>
    <section className="create-agent-intro"><span className="agent-avatar large default">{type==='agent'?'AI':'⌘'}</span><div><h3>{type==='agent'?'创建智能体应用':'创建工作流应用'}</h3><p>{type==='agent'?'连接知识、工具、Skill 与记忆，适用于智能助理和开放式任务场景。':'通过节点、连线和条件路径构建可测试、可发布的业务流程。'}</p></div></section>
    <label><span>应用名称 <em>*</em></span><div className="counted-input"><input autoFocus aria-invalid={!!error} maxLength={50} value={name} onChange={e=>{setName(e.target.value);if(error)setError('')}} placeholder="请输入应用名称"/><small>{name.length} / 50</small></div></label>
    <label><span>描述信息</span><textarea rows={4} maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} placeholder="请输入应用描述"/></label>
    <div className="avatar-field"><span>应用头像</span><div className="avatar-upload-row">{avatarUrl?<img className="agent-avatar large" src={avatarUrl} alt="头像预览"/>:<span className="agent-avatar large default">{type==='agent'?'AI':'⌘'}</span>}<div><label className="avatar-upload-button">选择图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void chooseAvatar(e.target.files?.[0])}/></label>{avatarUrl&&<button type="button" onClick={()=>setAvatarUrl('')}>移除</button>}<small>支持 JPG、PNG、WebP，最大 5 MB；自动缩放为头像尺寸。</small>{avatarError&&<span className="avatar-upload-error" role="alert">{avatarError}</span>}</div></div></div>
    {error&&<p className="create-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={close}>取消</button><button type="submit" className="primary" disabled={submitting}>{submitting?'正在创建…':'立即创建'}</button></footer>
  </form></div></div>;
}
