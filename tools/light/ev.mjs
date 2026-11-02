// node ev.mjs "<expr>"  : evaluates in Spotify's xpui page over CDP 9229 (raw websocket, no playwright)
const expr=process.argv[2];
const list=await (await fetch('http://127.0.0.1:9229/json')).json();
const t=list.find(t=>t.type==='page'&&t.url.includes('xpui'));
const ws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0;const send=(method,params)=>new Promise(res=>{const i=++id;const h=e=>{const m=JSON.parse(e.data);if(m.id===i){ws.removeEventListener('message',h);res(m);}};ws.addEventListener('message',h);ws.send(JSON.stringify({id:i,method,params}));});
const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
const v=r.result?.result?.value;console.log(r.result?.exceptionDetails?JSON.stringify(r.result.exceptionDetails).slice(0,500):typeof v==='string'?v:JSON.stringify(v));
ws.close();
