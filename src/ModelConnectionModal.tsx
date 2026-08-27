import { useState } from 'react';
import type { ApiClient } from './api';
import type { ModelConnection } from './types';

type Preset = { provider: string; name: string };

export function ModelConnectionModal({ api, models, presets, close, done }: {
  api: ApiClient;
  models: ModelConnection[];
  presets: Preset[];
  close: () => void;
  done: () => Promise<unknown>;
}) {
  const [form, setForm] = useState({
    name: '', provider: presets[0]?.provider || 'openai', model_id: '',
    base_url: '', api_key_env: '', tier: 'cloud', enabled: true,
  });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (key: string, value: string | boolean) => setForm(old => ({ ...old, [key]: value }));
  const create = async () => {
    setBusy('create'); setError('');
    try {
      await api.post('/api/model-connections', form);
      await done();
      setForm(old => ({ ...old, name: '', model_id: '', base_url: '' }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const test = async (id: string) => {
    setBusy(id); setError('');
    try { await api.post(`/api/model-connections/${id}/test`); await done(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  return <div className="overlay"><div className="external-import-modal model-connection-modal">
    <header><div><h2>模型连接管理</h2><p>指定模型只有连接测试成功后才可在智能体中选择。</p></div><button onClick={close}>×</button></header>
    <div className="model-connection-list">{models.map(model => <div key={model.id}>
      <span><b>{model.name}</b><small>{model.provider} · {model.model_id || '未填写 model_id'}</small></span>
      <em className={model.test_status}>{model.test_status === 'succeeded' ? '测试成功' : model.test_status === 'failed' ? '测试失败' : '待测试'}</em>
      <button disabled={busy === model.id} onClick={() => test(model.id)}>{busy === model.id ? '测试中…' : '连接测试'}</button>
    </div>)}</div>
    <div className="import-form model-connection-form">
      <label>连接名称<input value={form.name} onChange={e => set('name', e.target.value)} placeholder="例如：生产 DeepSeek" /></label>
      <label>提供商<select value={form.provider} onChange={e => set('provider', e.target.value)}>{presets.map(p => <option key={p.provider} value={p.provider}>{p.name}</option>)}</select></label>
      <label>模型 ID<input value={form.model_id} onChange={e => set('model_id', e.target.value)} placeholder="以服务商实际 model_id 为准" /></label>
      <label>OpenAI 兼容 Base URL<input value={form.base_url} onChange={e => set('base_url', e.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label>API Key 环境变量<input value={form.api_key_env} onChange={e => set('api_key_env', e.target.value)} placeholder="例如 DEEPSEEK_API_KEY" /><small>平台仅保存变量名，接口不会回显密钥。</small></label>
      <label>资源层级<select value={form.tier} onChange={e => set('tier', e.target.value)}><option value="device">端</option><option value="edge">边</option><option value="cloud">云</option></select></label>
      {error && <div className="import-error">{error}</div>}
      <footer><button onClick={close}>关闭</button><button className="primary" disabled={busy === 'create' || !form.name.trim() || !form.model_id.trim() || !form.base_url.trim()} onClick={create}>{busy === 'create' ? '创建中…' : '创建连接'}</button></footer>
    </div>
  </div></div>;
}
