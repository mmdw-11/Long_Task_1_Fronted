import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync(new URL('../src/run-actions.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {runActions}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('shows one sequential action for each real model and tool invocation',()=>{
 const actions=runActions([{sequence:1,type:'node_start',node:'agent'},{sequence:2,type:'model_started',generation_id:'g1',model:'deepseek-v4-flash'},{sequence:3,type:'model_finished',generation_id:'g1'},{sequence:4,type:'tool_started',tool_id:'workspace.list',tool_name:'列出工作区文件'},{sequence:5,type:'tool_finished',tool_id:'workspace.list',tool_name:'列出工作区文件',duration_ms:18},{sequence:6,type:'route'}]);
 assert.deepEqual(actions.map(action=>[action.title,action.status]),[['调用模型 · deepseek-v4-flash','succeeded'],['调用工具 · 列出工作区文件','succeeded']]);
 assert.equal(actions[1].meta,'18 ms');
});

test('keeps approval as the state of the corresponding tool action',()=>{
 const actions=runActions([{sequence:1,type:'tool_started',tool_id:'write',tool_name:'写入文件'},{sequence:2,type:'approval_required',tool_id:'write',tool_name:'写入文件'}]);
 assert.equal(actions.length,1);
 assert.deepEqual([actions[0].title,actions[0].detail,actions[0].status],['调用工具 · 写入文件','等待批准','waiting']);
});
