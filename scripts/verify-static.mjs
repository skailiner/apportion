import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import assert from 'node:assert/strict';
// Token boundaries matter: Tailwind's mask-* utilities contain the letters "sk-".
const credentialPattern=/(?<![A-Za-z0-9_-])(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,})/;
assert.equal(credentialPattern.test('"mask-linear-from-transparent"'),false);
assert.equal(credentialPattern.test('"sk-proj-'+ 'a'.repeat(32)+'"'),true);
assert.equal(credentialPattern.test('"hf_'+ 'a'.repeat(32)+'"'),true);
const project=resolve(import.meta.dirname,'..'),root=resolve(project,'dist/client');
const config=JSON.parse(readFileSync(resolve(project,'.openai/hosting.json'),'utf8'));
assert.equal(config.static.directory,'dist/client');
const files=[];function walk(dir){for(const name of readdirSync(dir)){const path=resolve(dir,name);if(statSync(path).isDirectory())walk(path);else files.push(path);}}
walk(root);
assert.ok(files.some(f=>relative(root,f)==='index.html'));
for(const file of files){
  const rel=relative(root,file),parts=rel.split(sep);
  assert.ok(!parts.some(p=>['node_modules','server','.wrangler','.git'].includes(p)||p.startsWith('.env')),rel);
  assert.ok(!/\.map$/.test(rel),'Do not publish source maps.');
  if(/\.(html|js|json|rsc|css)$/.test(file)){
    const text=readFileSync(file,'utf8');
    assert.ok(!credentialPattern.test(text),'Credential-like content in '+rel);
    assert.ok(!/C:\\\\Users\\\\user/.test(text),'Private machine path in '+rel);
  }
}
const html=readFileSync(resolve(root,'index.html'),'utf8');
assert.ok(html.includes('APPORTION'));
for(const [,url]of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)){
  if(!url.startsWith('/')||url==='/')continue;
  const file=resolve(root,'.'+decodeURIComponent(url));
  assert.ok(file.startsWith(root+sep));
  assert.ok(existsSync(file),'Missing public asset: '+url);
}
console.log('Static-only artifact verified: '+files.length+' files; linked assets exist; no server directories, source maps or credential-like strings.');
