// 应用管理页面，复刻百炼 Managed Agents 的创建、配置和调试入口流程。
import { useEffect, useState } from 'react';
import type { ApiClient } from './api';
import type { Application, Skill, Tool } from './types';
import './app-center.css';

type Props = { api: ApiClient; notify: (s: string, b?: boolean) => void; go: (p: 'agents' | 'runs' | 'tools' | 'system') => void };

const templates = [
  { type: 'agent', title: '智能体应用', desc: '选择模型、编写系统提示词、挂载 MCP 与技能。' },
  { type: 'workflow', title: '工作流应用', desc: '通过可视化节点编排多 Agent 和工具调用路径。' },
  { type: 'chat', title: '对话助手', desc: '面向业务会话的单入口 Agent，适合快速验证。' },
  { type: 'task', title: '长任务应用', desc: '保留上下文防漂移、TODO 和运行总结机制。' },
];

export function AppCenter({ api, notify, go }: Props) {
  const [apps, setApps] = useState<Application[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [template, setTemplate] = useState(templates[0]);

  const load = () => {
    setLoading(true);
    Promise.all([api.get<Application[]>('/api/apps'), api.get<Tool[]>('/api/tools'), api.get<Skill[]>('/api/skills')])
      .then(([a, t, s]) => { setApps(a); setTools(t); setSkills(s); })
      .catch((e) => notify((e as Error).message, true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [api]);

  const create = async (payload: unknown) => {
    try {
      await api.post('/api/apps', payload);
      setModal(false);
      notify('应用已创建，并自动生成工作流草稿');
      load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const publish = async (app: Application) => {
    try {
      await api.post(`/api/apps/${app.id}/publish`);
      notify('应用已发布');
      load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const run = async (app: Application) => {
    try {
      await api.post('/api/runs', { workflow_id: app.workflow_id, input: { input: `请运行应用：${app.name}` }, recursion_limit: 50 });
      notify('调试任务已启动');
      go('runs');
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  return (
    <div className="managed-apps">
      <section className="managed-hero">
        <div>
          <span>Managed Agents</span>
          <h2>3分钟完成 Agent 创建、配置与会话发起。</h2>
          <p>全链路 API 驱动，创建应用后自动落到后端工作流，并继续使用你们已有的上下文防漂移和运行总结能力。</p>
        </div>
        <button className="primary" onClick={() => { setTemplate(templates[0]); setModal(true); }}>创建应用</button>
      </section>
      <section className="managed-steps">
        <div><b>1</b><span>创建应用</span><small>选择应用类型和模板</small></div>
        <div><b>2</b><span>配置 Agent</span><small>模型、系统提示词、技能</small></div>
        <div><b>3</b><span>挂载 MCP</span><small>从工具目录授权给应用</small></div>
        <div><b>4</b><span>调试发布</span><small>运行、观测、发布</small></div>
      </section>
      <section className="template-grid">
        {templates.map((item) => (
          <button key={item.type} onClick={() => { setTemplate(item); setModal(true); }}>
            <i>{item.type === 'workflow' ? '⌘' : 'AI'}</i>
            <b>{item.title}</b>
            <small>{item.desc}</small>
          </button>
        ))}
      </section>
      <article className="panel app-table">
        <div className="panel-head">
          <div><h2>应用管理</h2><p>{apps.length ? '管理已创建应用，继续编排或发起调试。' : '暂无应用，请先创建一个 Agent 应用。'}</p></div>
          <div className="button-row"><button onClick={() => go('tools')}>MCP 管理</button><button onClick={() => go('system')}>API Key</button></div>
        </div>
        {loading ? <div className="empty"><span className="spinner" />正在读取应用…</div> : apps.length ? (
          <div className="app-card-grid">
            {apps.map((app) => (
              <section className="managed-card" key={app.id}>
                <div><span>{app.app_type}</span><em>{app.status === 'published' ? '已发布' : '草稿'}</em></div>
                <h3>{app.name}</h3>
                <p>{app.description || '暂无描述'}</p>
                <dl>
                  <dt>模型</dt><dd>{app.model || '自动调度'}</dd>
                  <dt>MCP/工具</dt><dd>{app.tool_ids.length} 个</dd>
                  <dt>技能</dt><dd>{app.skill_ids.length} 个</dd>
                </dl>
                <footer>
                  <button onClick={() => go('agents')}>编排</button>
                  <button onClick={() => run(app)}>调试</button>
                  <button className="primary" onClick={() => publish(app)}>发布</button>
                </footer>
              </section>
            ))}
          </div>
        ) : <div className="api-empty"><b>暂无应用</b><p>从模板创建应用后，会自动生成可运行的后端工作流。</p><button className="primary" onClick={() => setModal(true)}>创建应用</button></div>}
      </article>
      {modal && <CreateAppModal template={template} tools={tools} skills={skills} close={() => setModal(false)} submit={create} />}
    </div>
  );
}

function CreateAppModal({ template, tools, skills, close, submit }: { template: typeof templates[number]; tools: Tool[]; skills: Skill[]; close: () => void; submit: (v: unknown) => void }) {
  const [name, setName] = useState(template.title);
  const [desc, setDesc] = useState(template.desc);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('你是一个可靠的业务智能体。请先理解用户目标，再按步骤调用可用工具完成任务，并输出清晰结果。');
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const toggle = (list: string[], value: string, set: (v: string[]) => void) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  return (
    <div className="overlay">
      <div className="modal wide">
        <div className="modal-head"><h2>创建应用</h2><button onClick={close}>×</button></div>
        <form className="create-app-form" onSubmit={(e) => { e.preventDefault(); submit({ name, app_type: template.type, description: desc, model, system_prompt: prompt, tool_ids: toolIds, skill_ids: skillIds }); }}>
          <section>
            <h3>{template.title}</h3>
            <p>{template.desc}</p>
            <label>应用名称<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>应用描述<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
            <label>模型<select value={model} onChange={(e) => setModel(e.target.value)}><option value="">自动调度</option><option value="device">端侧优先</option><option value="edge">边缘优先</option><option value="cloud">云端优先</option></select></label>
            <label>系统提示词<textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></label>
          </section>
          <section>
            <h3>挂载 MCP 与技能</h3>
            <p>这里选择的工具会写入入口 Agent 的授权配置，运行时由后端适配器决定是否真正调用。</p>
            <div className="choose-list">{tools.map((tool) => <label key={tool.id}><input type="checkbox" checked={toolIds.includes(tool.id)} onChange={() => toggle(toolIds, tool.id, setToolIds)} /><span><b>{tool.display_name}</b><small>{tool.description || tool.name}</small></span></label>)}{!tools.length && <small>暂无工具，可先到 MCP 管理添加。</small>}</div>
            <div className="choose-list">{skills.map((skill) => <label key={skill.id}><input type="checkbox" checked={skillIds.includes(skill.id)} onChange={() => toggle(skillIds, skill.id, setSkillIds)} /><span><b>{skill.name}</b><small>{skill.description || skill.status}</small></span></label>)}{!skills.length && <small>暂无技能。</small>}</div>
          </section>
          <div className="form-actions"><button type="button" onClick={close}>取消</button><button className="primary">创建并进入配置</button></div>
        </form>
      </div>
    </div>
  );
}
