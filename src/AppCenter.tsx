import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from './api';
import type { Application, Skill, Tool } from './types';
import './app-center.css';
import './create-type.css';
import './create-validation.css';

type Props = { api: ApiClient; notify: (s: string, b?: boolean) => void; go: (p: 'builder' | 'tools' | 'system') => void; openEditor?: (appId: string) => void; openWorkflowEditor?: (appId: string) => void; openCreate?: boolean; onCreateOpened?: () => void };
const DEFAULT_PROMPT = '你是一个可靠的业务智能体。请先理解用户目标，再按步骤调用可用工具完成任务，并输出清晰结果。';

export function AppCenter({ api, notify, go, openEditor = (id) => { location.hash = `app-editor/${encodeURIComponent(id)}`; }, openWorkflowEditor = (id) => { location.hash = `workflow-editor/${encodeURIComponent(id)}`; }, openCreate = false, onCreateOpened }: Props) {
  const [apps, setApps] = useState<Application[]>([]), [tools, setTools] = useState<Tool[]>([]), [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true), [modal, setModal] = useState(false);
  const load = () => { setLoading(true); Promise.all([api.get<Application[]>('/api/apps'), api.get<Tool[]>('/api/tools'), api.get<Skill[]>('/api/skills')]).then(([a,t,s]) => { setApps(a); setTools(t); setSkills(s); }).catch(e => notify((e as Error).message, true)).finally(() => setLoading(false)); };
  useEffect(load, [api]);
  useEffect(() => { if (openCreate) { setModal(true); onCreateOpened?.(); } }, [openCreate, onCreateOpened]);
  const create = async (type:'agent'|'workflow', name: string, description: string) => { try { const created = await api.post<Application>('/api/apps', { name, description, app_type:type, system_prompt:type==='agent'?DEFAULT_PROMPT:'', avatar_url:'' }); setModal(false); notify(type==='agent'?'智能体应用已创建':'工作流应用已创建'); (type==='agent'?openEditor:openWorkflowEditor)(created.id); } catch (e) { notify((e as Error).message, true); throw e; } };
  const counts = useMemo(() => ({ apps:apps.length, published:apps.filter(a => a.status === 'published').length, tools:tools.length, skills:skills.length }), [apps,tools,skills]);
  return <div className="managed-apps">
    <section className="managed-hero"><div><span>Managed Agents</span><h2>创建、配置并调试你的智能体应用</h2><p>通过提示词、工具、知识库、Skill 与记忆构建可执行的业务智能体。</p></div><button className="primary" onClick={() => setModal(true)}>创建应用</button></section>
    <section className="managed-metrics"><div><b>{counts.apps}</b><span>全部应用</span></div><div><b>{counts.published}</b><span>已发布</span></div><div><b>{counts.tools}</b><span>MCP / 工具</span></div><div><b>{counts.skills}</b><span>Skill</span></div></section>
    <section className="application-kinds"><button className="application-kind active" onClick={() => setModal(true)}><i>AI</i><span><b>智能体应用</b><small>通过模型自主规划并调用工具完成开放式任务</small></span><em>立即创建</em></button><button className="application-kind" onClick={() => setModal(true)}><i>⌘</i><span><b>工作流应用</b><small>通过画布编排确定性的多步骤执行流程</small></span><em>立即创建</em></button></section>
    <article className="panel app-table"><div className="panel-head"><div><h2>应用管理</h2><p>从应用卡片进入配置、编排和发布。</p></div><div className="button-row"><button onClick={() => go('tools')}>MCP 管理</button><button onClick={() => go('system')}>API Key</button></div></div>
      {loading ? <div className="empty"><span className="spinner"/>正在读取应用…</div> : apps.length ? <div className="app-card-grid">{apps.map(app => <section className="managed-card" key={app.id}><div className="managed-card-head"><AgentAvatar app={app}/><span><b>{app.name}</b><small>{app.app_type === 'workflow' ? '工作流应用' : '智能体应用'}</small></span><em className={app.status}>{app.status === 'published' ? '已发布' : '草稿'}</em></div><p>{app.description || '暂无描述'}</p><dl><dt>{app.app_type==='workflow'?'编排':'模型'}</dt><dd>{app.app_type==='workflow'?'可视化工作流':app.model || '自动调度'}</dd><dt>能力</dt><dd>{app.app_type==='workflow'?'节点与条件路径':`${app.tool_ids.length} 工具 · ${app.skill_ids.length} Skill`}</dd></dl><footer><button className="primary" onClick={() => (app.app_type==='workflow'?openWorkflowEditor:openEditor)(app.id)}>{app.app_type==='workflow'?'进入编排':'配置与调试'}</button>{app.app_type!=='workflow'&&<button onClick={() => go('builder')}>编排</button>}</footer></section>)}</div> : <div className="api-empty"><b>还没有应用</b><p>创建第一个智能体或工作流应用。</p><button className="primary" onClick={() => setModal(true)}>创建应用</button></div>}
    </article>{modal && <CreateAgentModal close={() => setModal(false)} submit={create}/>}
  </div>;
}

function AgentAvatar({ app }: { app: Application }) { return app.avatar_url ? <img className="agent-avatar" src={app.avatar_url} alt=""/> : <span className="agent-avatar default">AI</span>; }
function CreateAgentModal({ close, submit }: { close:()=>void; submit:(type:'agent'|'workflow',name:string,description:string)=>Promise<void> }) {
  const [type,setType]=useState<'agent'|'workflow'>('agent'),[name,setName]=useState(''), [description,setDescription]=useState(''), [submitting,setSubmitting]=useState(false), [error,setError]=useState('');
  const send=async(e:React.FormEvent)=>{e.preventDefault();if(submitting)return;if(!name.trim()){setError('请输入应用名称');return}setError('');setSubmitting(true);try{await submit(type,name.trim(),description.trim())}catch(e){setError((e as Error).message||'创建失败，请稍后重试')}finally{setSubmitting(false)}};
  return <div className="overlay create-agent-overlay" onMouseDown={e => e.target === e.currentTarget && close()}><div className="create-agent-modal"><header><div><h2>创建应用</h2><p>选择智能体或可视化工作流开始构建</p></div><button type="button" onClick={close}>×</button></header><form onSubmit={send}>
    <section className="create-type-picker"><button type="button" className={type==='agent'?'selected':''} onClick={()=>setType('agent')}><i>AI</i><span><b>智能体应用</b><small>模型自主规划并调用工具</small></span></button><button type="button" className={type==='workflow'?'selected':''} onClick={()=>setType('workflow')}><i>⌘</i><span><b>工作流应用</b><small>拖拽节点编排确定性流程</small></span></button></section>
    <section className="create-agent-intro"><span className="agent-avatar large default">{type==='agent'?'AI':'⌘'}</span><div><h3>{type==='agent'?'创建智能体应用':'创建工作流应用'}</h3><p>{type==='agent'?'连接知识、工具、Skill 与记忆，适用于智能助理和开放式任务场景。':'通过节点、连线和条件路径构建可测试、可发布的业务流程。'}</p></div></section>
    <label><span>应用名称 <em>*</em></span><div className="counted-input"><input autoFocus aria-invalid={!!error} maxLength={50} value={name} onChange={e=>{setName(e.target.value);if(error)setError('')}} placeholder="请输入应用名称"/><small>{name.length} / 50</small></div></label>
    <label><span>描述信息</span><textarea rows={4} maxLength={300} value={description} onChange={e=>setDescription(e.target.value)} placeholder="请输入应用描述"/></label>
    <label><span>应用头像</span><div className="avatar-placeholder"><span className="agent-avatar large default">AI</span><small>头像上传将在后续版本开放</small></div></label>
    {error&&<p className="create-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={close}>取消</button><button type="submit" className="primary" disabled={submitting}>{submitting?'正在创建…':'立即创建'}</button></footer>
  </form></div></div>;
}
