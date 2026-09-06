import type { ApiClient } from './api';
import type { Run } from './types';

export type RunSubscription = { close: () => void };
type Event = Record<string, any>;

export async function requireStreamingRuntime(api: ApiClient) {
  let info: {run_stream_protocol?: number};
  try { info = await api.get('/api/system/runtime') }
  catch (error) {
    if ((error as {status?: number}).status === 404) throw new Error('当前连接的后端尚未加载流式版本。请在 Long_Task_1 目录重启后端，并确认连接设置；本次没有发起任务。');
    throw error;
  }
  if ((info.run_stream_protocol || 0) < 2) throw new Error('后端流式协议版本过旧，请重启正确的后端服务；本次没有发起任务。');
}

export function pendingApprovals(events: Event[]) {
  const decided = new Set(events.filter(e => e.type === 'approval_decision').map(e => Number(e.approval_sequence)));
  return events.filter(e => e.type === 'approval_required' && !decided.has(Number(e.sequence)));
}

/** A generation is one provider request, not the entire multi-node run. */
export function streamingAnswer(events: Event[]): string {
  const started = events.filter(e => e.type === 'model_started').at(-1);
  return events.filter(e => e.type === 'answer_delta' && (!started || e.generation_id === started.generation_id)).map(e => e.delta || '').join('');
}

export type ModelOutput = { id:string; text:string; model:string; node:string; complete:boolean; stage:string };
/** Keeps every provider generation so intermediate model output is never replaced. */
export function modelOutputs(events: Event[]): ModelOutput[] {
  const outputs = new Map<string, ModelOutput & {start:number}>(), order:string[]=[];
  for (const [eventIndex,event] of events.entries()) {
    const id=String(event.generation_id||'');if(!id)continue;
    if(event.type==='model_started'&&!outputs.has(id)){order.push(id);outputs.set(id,{id,text:'',model:String(event.model||''),node:String(event.node||''),complete:false,stage:'',start:eventIndex})}
    const output=outputs.get(id);if(!output)continue;
    if(event.type==='answer_delta')output.text+=String(event.delta||'');
    if(['model_finished','model_failed'].includes(event.type))output.complete=true;
  }
  return order.map((id,index)=>{const output=outputs.get(id)!,next=outputs.get(order[index+1]||'')?.start??events.length;
    const during=events.slice(output.start,next),before=events.slice(index?outputs.get(order[index-1])!.start:0,output.start);
    const toolNames=[...new Set(during.flatMap(event=>{
      const call=event.tool_call||{};
      const name=event.tool_name||call.display_name||call.name;
      return name?[String(name)]:[];
    }))];
    const followsTool=before.some(event=>['tool_result','tool_finished','approval_decision','approval_resumed'].includes(event.type));
    const step=`第 ${index+1} 步`;
    output.stage=toolNames.length?`${step} · ${toolNames.join('、')}`:followsTool?`${step} · 整理工具结果`:index===0?`${step} · 任务分析`:`${step} · 内容生成`;
    const {start:_,...publicOutput}=output;return publicOutput;
  }).filter(output=>output.text);
}

export function subscribeRun(api: ApiClient, run: Run, handlers: {
  update: (events: Event[]) => void;
  complete: (run: Run) => void;
  error: (message: string) => void;
  reconnect?: (reconnecting: boolean) => void;
}, waitForResume = false): RunSubscription {
  let events: Event[] = [...run.events] as Event[], cursor = events.reduce((n, e) => Math.max(n, Number(e.sequence) || 0), 0);
  const initialPending = new Set(pendingApprovals(events).map(e => Number(e.sequence)));
  const differentPending = (items: Event[]) => {
    const pending = pendingApprovals(items);
    return pending.length > 0 && (pending.length < initialPending.size || pending.some(e => !initialPending.has(Number(e.sequence))));
  };
  let source: EventSource | null = null, timer: ReturnType<typeof setTimeout> | undefined, stopped = false, retries = 0;
  const close = () => { stopped = true; source?.close(); if (timer) clearTimeout(timer) };
  const retry = () => {
    source?.close();
    if (stopped) return;
    if (timer) clearTimeout(timer);
    if (++retries > 5) { close(); handlers.error('实时连接中断。已保留输出，可重新连接当前运行；不会重新执行工具。'); return }
    handlers.reconnect?.(true);
    timer = setTimeout(connect, Math.min(1000 * 2 ** (retries - 1), 8000));
  };
  const connect = () => {
    if (stopped) return;
    const current = new EventSource(`${api.baseUrl.replace(/\/$/, '')}/api/runs/${encodeURIComponent(run.id)}/events?after=${cursor}&access_token=${encodeURIComponent(api.getAuthToken())}`);
    source = current;
    current.addEventListener('run_event', event => {
      if (stopped || source !== current) return;
      try {
        const item = JSON.parse((event as MessageEvent).data) as Event;
        if (Number(item.sequence) <= cursor) return;
        cursor = Number(item.sequence); events = [...events, item]; retries = 0;
        handlers.reconnect?.(false); handlers.update(events);
      } catch { close(); handlers.error('运行事件格式异常，已保留当前输出。') }
    });
    current.addEventListener('run_completed', async event => {
      if (stopped || source !== current) return;
      current.close();
      try {
        const status = JSON.parse((event as MessageEvent).data).status;
        // The subscription may arrive just before the approval POST starts.
        if (waitForResume && status === 'waiting_approval' && !differentPending(events)) { retry(); return }
        const done = await api.get<Run>(`/api/runs/${run.id}`);
        if (waitForResume && done.status === 'waiting_approval' && !differentPending(done.events as Event[])) { retry(); return }
        if (['running', 'created', 'cancel_requested'].includes(done.status)) { retry(); return }
        if (!stopped) { close(); handlers.reconnect?.(false); handlers.complete(done) }
      } catch { retry() }
    });
    current.onerror = () => { if (source === current && !stopped) retry() };
  };
  handlers.update(events); connect(); return { close };
}
