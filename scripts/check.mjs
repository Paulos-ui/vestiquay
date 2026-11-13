import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {forwardRhea} from '../server/rhea.mjs'
const base='https://vestiquay.example/rhea'
assert.equal((await forwardRhea(new Request(base+'/api/v2/swap/quote',{method:'POST'}))).status,503)
assert.equal((await forwardRhea(new Request(base+'/api/v2/swap/quote',{method:'POST',headers:{Origin:'https://elsewhere.example'}}),'demo')).status,403)
assert.equal((await forwardRhea(new Request(base+'/unlisted'))).status,404)
const {default:worker}=await import('../dist/server/index.js')
for(const resource of ['/','/desk','/desk/','/recovery.html','/ref-inspector.html']){
 const r=await worker.fetch(new Request('https://vestiquay.example'+resource),{})
 assert.equal(r.status,200);assert.match(await r.text(),/Vestiquay/i)
}
const client=await fs.readFile('out/recovery.html','utf8')
assert.equal(/<script\s+src=/i.test(client),false)
console.log('Main page, bundled client, original Ref inspector and credential boundary passed.')
