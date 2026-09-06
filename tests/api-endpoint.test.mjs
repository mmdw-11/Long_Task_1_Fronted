import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { ApiClient } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

for (const [method, path] of [
  ['post', '/api/apps/a/runs'],
  ['post', '/api/runs/r/approvals/1/approve'],
  ['get', '/api/runs/r'],
  ['get', '/api/system/runtime'],
]) {
  test(`${method} ${path} never silently switches to another backend`, async t => {
    const previousWindow = globalThis.window;
    globalThis.window = { location: { hostname: 'localhost' } };
    t.after(() => { globalThis.window = previousWindow });
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => { calls.push(url); throw new TypeError('network interrupted') });
    const client = new ApiClient('https://configured.example', { adminKey:'',actor:'test',token:'test-only' });
    await assert.rejects(client[method](path));
    assert.deepEqual(calls, [`https://configured.example${path}`]);
  });
}
