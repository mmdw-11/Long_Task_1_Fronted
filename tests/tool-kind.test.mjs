import {test} from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../src/tool-kind.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {toolKind}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('workspace adapter is shown as code even when its storage source is builtin',()=>assert.equal(toolKind({category:'workspace',metadata:{source:'builtin',adapter:'workspace_read_file'}}),'code'));
test('keeps actual platform, MCP and OpenAPI classifications',()=>{assert.equal(toolKind({category:'system',metadata:{source:'builtin'}}),'builtin');assert.equal(toolKind({category:'mcp',metadata:{source:'mcp'}}),'mcp');assert.equal(toolKind({category:'openapi',metadata:{source:'openapi'}}),'openapi')});
