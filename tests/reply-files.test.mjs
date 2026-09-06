import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/reply-files.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {editedFiles}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const call=(name,result,status='succeeded',workspace_id='a')=>({name,result,status,arguments:{workspace_id}});
const event=tool_call=>({type:'tool_result',tool_call});
test('deduplicates repeated actual results and retains creation status',()=>{
 const first=call('workspace_apply_patch',{path:'src/a.ts',created:true});
 assert.deepEqual(editedFiles([event(first),{type:'node_end',tool_calls:[first]},event(call('workspace_apply_patch',{path:'src/a.ts',created:false}))]),[{path:'src/a.ts',workspace:'a',action:'新增'}]);
});
test('does not treat failed tools, model prose, reads or commands as file edits',()=>{
 assert.deepEqual(editedFiles([event(call('workspace_apply_patch',{path:'a'},'failed')),event(call('workspace_read_file',{path:'a'})),event(call('workspace_run_command',{files:['a']})),{type:'answer_delta',text:'Edited 5 files'}]),[]);
});
test('batch writes preserve unknown classification and workspace isolation',()=>{
 const files=editedFiles([event(call('workspace_write_files',{files:['a','a','b']})),event(call('workspace_apply_patch',{path:'a',created:false},'succeeded','b'))]);
 assert.equal(files.length,3);assert.equal(files[0].action,'写入');
});
