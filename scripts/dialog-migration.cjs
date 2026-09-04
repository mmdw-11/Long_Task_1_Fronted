// Read-only codemod: emit a patch for review/application, never modify source directly.
const ts=require('typescript'),fs=require('fs'),path=require('path');
const changes=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,item.name);if(item.isDirectory()){walk(file);continue;}
 if(!/\.tsx?$/.test(file)||file.endsWith('dialogs.tsx'))continue;
 const old=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,old,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const edits=[],functions=new Set(),names=new Set();
 function visit(node){
  if(ts.isCallExpression(node)){
   const expr=node.expression;
   const name=ts.isIdentifier(expr)?expr.text:ts.isPropertyAccessExpression(expr)&&expr.expression.getText(source)==='window'?expr.name.text:'';
   if(['confirm','alert','prompt'].includes(name)){
    const replacement='app'+name[0].toUpperCase()+name.slice(1);names.add(replacement);
    edits.push({start:node.getStart(source),end:node.end,text:'(await '+replacement+old.slice(expr.end,node.end)+')'});
    let parent=node.parent;while(parent&&!ts.isFunctionLike(parent))parent=parent.parent;
    if(!parent)throw Error('No function for '+file);
    if(!parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))functions.add(parent);
   }
  }ts.forEachChild(node,visit);
 }visit(source);
 if(!edits.length)continue;
 for(const fn of functions)edits.push({start:fn.getStart(source),end:fn.getStart(source),text:'async '});
 let updated=old;for(const edit of edits.sort((a,b)=>b.start-a.start))updated=updated.slice(0,edit.start)+edit.text+updated.slice(edit.end);
 let rel=path.relative(path.dirname(file),path.join('src','dialogs')).replaceAll('\\','/');if(!rel.startsWith('.'))rel='./'+rel;
 updated='import { '+[...names].join(', ')+' } from '+JSON.stringify(rel)+';\n'+updated;
 changes.push({file:path.resolve(file),old,updated});
}}walk('src');process.stdout.write(JSON.stringify(changes));
