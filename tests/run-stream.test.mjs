import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/run-stream.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { subscribeRun, streamingAnswer, modelOutputs, requireStreamingRuntime } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

class FakeSource {
  static all = [];
  constructor(url) { this.url = url; this.listeners = {}; this.closed = false; FakeSource.all.push(this) }
  addEventListener(type, fn) { this.listeners[type] = fn }
  close() { this.closed = true }
  async emit(type, data) { await this.listeners[type]?.({ data: JSON.stringify(data) }) }
}
const run = { id: 'r1', events: [], status: 'running' };

test('keeps every model generation while the visible answer follows the latest',()=>{
 const events=[{type:'model_started',generation_id:'a',model:'one',node:'plan'},{type:'answer_delta',generation_id:'a',delta:'阶段一'},{type:'model_finished',generation_id:'a'},{type:'model_started',generation_id:'b',model:'two',node:'answer'},{type:'answer_delta',generation_id:'b',delta:'最终'}];
 assert.deepEqual(modelOutputs(events).map(x=>[x.text,x.node,x.complete,x.stage]),[['阶段一','plan',true,'第 1 步 · 任务分析'],['最终','answer',false,'第 2 步 · 内容生成']]);
 assert.equal(streamingAnswer(events),'最终');
});
test('names tool planning and post-tool summary generations',()=>{
 const outputs=modelOutputs([{type:'model_started',generation_id:'a'},{type:'answer_delta',generation_id:'a',delta:'我要调用工具'},{type:'model_finished',generation_id:'a',message:'模型已选择工具，准备执行'},{type:'tool_finished',tool_name:'列出工作区文件'},{type:'model_started',generation_id:'b'},{type:'answer_delta',generation_id:'b',delta:'执行完成'}]);
 assert.deepEqual(outputs.map(x=>x.stage),['第 1 步 · 列出工作区文件','第 2 步 · 整理工具结果']);
});
function fake(t, status = 'succeeded') {
  const previous = globalThis.EventSource;
  globalThis.EventSource = FakeSource;
  FakeSource.all = [];
  t.after(() => { globalThis.EventSource = previous });
  const updates = [], completions = [], errors = [], gets = [];
  const api = { baseUrl: '/gateway/', getAuthToken: () => 'test-token', get: async path => { gets.push(path); return { ...run, status } } };
  const handlers = { update: events => updates.push(events), complete: done => completions.push(done), error: error => errors.push(error) };
  return { api, handlers, updates, completions, errors, gets };
}

test('each generation replaces rather than appends previous model text', () => {
  assert.equal(streamingAnswer([
    { type: 'model_started', generation_id: 'a' }, { type: 'answer_delta', generation_id: 'a', delta: 'old' },
    { type: 'model_started', generation_id: 'b' }, { type: 'answer_delta', generation_id: 'b', delta: 'new' },
    { type: 'answer_delta', generation_id: 'b', delta: ' answer' },
  ]), 'new answer');
});

test('replayed events are deduplicated; completion fetches the authoritative result', async t => {
  const x = fake(t), subscription = subscribeRun(x.api, run, x.handlers);
  const source = FakeSource.all[0];
  await source.emit('run_event', { sequence: 1, type: 'answer_delta', delta: 'hello' });
  await source.emit('run_event', { sequence: 1, type: 'answer_delta', delta: 'hello' });
  assert.equal(x.updates.at(-1).length, 1);
  await source.emit('run_completed', { status: 'succeeded' });
  assert.equal(x.completions.length, 1);
  assert.equal(source.closed, true);
  assert.deepEqual(x.gets, ['/api/runs/r1']);
  subscription.close();
});

test('network reconnect uses last sequence and never creates another Run', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fake(t), subscription = subscribeRun(x.api, run, x.handlers);
  const source = FakeSource.all[0];
  await source.emit('run_event', { sequence: 5, type: 'answer_delta', delta: 'partial' });
  source.onerror();
  t.mock.timers.tick(1000);
  assert.equal(FakeSource.all.length, 2);
  assert.match(FakeSource.all[1].url, /after=5&/);
  assert.deepEqual(x.gets, []);
  await source.emit('run_event', { sequence: 6, delta: 'stale' });
  assert.equal(x.updates.at(-1).length, 1);
  subscription.close();
});

test('closing the editor cancels pending reconnect timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fake(t), subscription = subscribeRun(x.api, run, x.handlers);
  FakeSource.all[0].onerror(); subscription.close();
  t.mock.timers.tick(10000);
  assert.equal(FakeSource.all.length, 1);
});

test('approval subscription waits for the existing run to resume', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fake(t), subscription = subscribeRun(x.api, { ...run, status: 'waiting_approval' }, x.handlers, true);
  await FakeSource.all[0].emit('run_completed', { status: 'waiting_approval' });
  assert.equal(x.completions.length, 0);
  t.mock.timers.tick(1000);
  const resumed = FakeSource.all[1];
  await resumed.emit('run_event', { sequence: 1, type: 'approval_decision' });
  await resumed.emit('run_completed', { status: 'succeeded' });
  assert.equal(x.completions.length, 1);
  subscription.close();
});

test('exhausted retries preserve text and offer reconnection, not re-execution', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fake(t), subscription = subscribeRun(x.api, run, x.handlers);
  await FakeSource.all[0].emit('run_event', { sequence: 1, type: 'answer_delta', delta: 'saved' });
  for (let i = 0; i < 6; i++) { FakeSource.all.at(-1).onerror(); t.mock.timers.tick(8000) }
  assert.equal(x.errors.length, 1);
  assert.equal(x.updates.at(-1)[0].delta, 'saved');
  assert.equal(x.completions.length, 0);
  subscription.close();
});

test('an approval decision event followed by stale waiting status does not pause UI again', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const x = fake(t);
  const initial = { ...run, status: 'waiting_approval', events: [{ sequence: 1, type: 'approval_required' }] };
  const subscription = subscribeRun(x.api, initial, x.handlers, true);
  await FakeSource.all[0].emit('run_event', { sequence: 2, type: 'approval_decision', approval_sequence: 1, approved: true });
  await FakeSource.all[0].emit('run_completed', { status: 'waiting_approval' });
  assert.equal(x.completions.length, 0);
  t.mock.timers.tick(1000);
  assert.match(FakeSource.all[1].url, /after=2&/);
  subscription.close();
});

test('a genuinely new approval request can pause the resumed run', async t => {
  const x = fake(t, 'waiting_approval');
  const initial = { ...run, events: [{ sequence: 1, type: 'approval_required' }] };
  const events = [...initial.events, {sequence: 2,type:'approval_decision',approval_sequence:1}, {sequence:3,type:'approval_required'}];
  x.api.get = async () => ({...run,status:'waiting_approval',events});
  const subscription = subscribeRun(x.api, initial, x.handlers, true);
  await FakeSource.all[0].emit('run_event', events[1]);
  await FakeSource.all[0].emit('run_event', events[2]);
  await FakeSource.all[0].emit('run_completed', {status:'waiting_approval'});
  assert.equal(x.completions.length, 1);
  subscription.close();
});

test('old backend is detected before running a task', async () => {
  await assert.rejects(requireStreamingRuntime({get:async()=>{throw {status:404}}}), /重启后端/);
  await assert.rejects(requireStreamingRuntime({get:async()=>({run_stream_protocol:1})}), /版本过旧/);
  await requireStreamingRuntime({get:async()=>({run_stream_protocol:2})});
});
