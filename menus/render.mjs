// node menus/render.mjs out.png '<params json>' [css]: the lens (menu-glass.js) over Apple's stripes capture in Chrome at
// 2x, the box where Apple's menu was (one device pixel lower and right: Chromium snaps it to whole CSS pixels).
import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const [out,params='{}',css='']=process.argv.slice(2);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1000,height:580},deviceScaleFactor:2});
p.on('console',m=>console.log('page:',m.text()));p.on('pageerror',e=>console.log('err:',e.message));
await p.goto('file://'+here+'/page.html');
await p.evaluate(([params,css])=>{const s=document.createElement('style');s.textContent=[0,1,2,3].map(i=>`[data-am-glass="${i}"]{backdrop-filter:url(#am-mg-${i})}`).join('')+css;document.head.append(s);
  const g=window.__amMenuGlass(JSON.parse(params));g.attach(document.getElementById('m'));},[params,css]);
await p.waitForTimeout(300);
console.log(await p.evaluate(()=>[matchMedia('(color-gamut: p3)').matches,getComputedStyle(m).backdropFilter,document.querySelector('feImage').getAttribute('width')].join(' ')));
await p.screenshot({path:out});await b.close();
