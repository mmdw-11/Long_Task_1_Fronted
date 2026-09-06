import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {outputFiles}=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {Markdown} from './src/Markdown';export const render=(content)=>renderToStaticMarkup(React.createElement(Markdown,{content}));`,resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},external:['react','react-dom/server']});
const module={exports:{}};
new Function('require','module','exports',outputFiles[0].text)(require,module,module.exports);
const {render}=module.exports;
test('renders GFM tables and highlighted code with copy control',()=>{
 const html=render('| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst value = 1;\n```');
 assert.match(html,/<table>/);assert.match(html,/hljs-keyword/);assert.match(html,/复制代码/);
});
test('raw HTML and dangerous links cannot execute',()=>{
 const html=render('<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n[safe](https://example.com)');
 assert.doesNotMatch(html,/<script|href="javascript:/);assert.match(html,/https:\/\/example.com/);
});
test('unfinished streaming fence renders readable code',()=>{
 assert.match(render('```python\nprint("hello")'),/<pre>/);
});
