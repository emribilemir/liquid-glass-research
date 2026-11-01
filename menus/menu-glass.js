// The menu lens in Chromium (prototype of what mcloud ships as menuGlass in theme.js). Fitted to macOS 27's NSMenu over
// 45-degree stripes (research/RESEARCH.md, "Menus"): a blur bent near the rim, the bend's direction turning over the
// last ~40pt before each corner, an optional darken halo (off: shipped without it), then Apple's tone by
// luminance (tone:false leaves it to a CSS fill such as rgba(100,100,100,.39)); the rim is CSS shadows. Works in a page or injected over CDP.
// window.__amMenuGlass(params) installs or re-tunes it; returns {attach, detach, params}.
window.__amMenuGlass=(over={})=>{
  const g=window.__amMG||(window.__amMG={slots:[],cache:new Map()});
  const P=g.P=Object.assign(g.P||{blur:6.8,radius:13,turn:40,lensAt:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,15,18],lens:[46,41,34,29,24.2,20.6,17.5,14.8,12.35,10.1,8.2,6.5,5.15,3.9,1.95,0],strength:1,darken:0,darkenBlur:30,tone:true},over);
  if(over.lens||over.lensAt||over.radius||over.turn||over.strength)g.cache.clear();
  const NS='http://www.w3.org/2000/svg';
  if(!g.svg){g.svg=document.createElementNS(NS,'svg');g.svg.setAttribute('aria-hidden','true');g.svg.setAttribute('width','0');g.svg.setAttribute('height','0');g.svg.style.position='absolute';document.body.append(g.svg);}
  const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,encode=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055,wideGamut=matchMedia('(color-gamut: p3)').matches;
  const pieces=['tl','t','tr','l','r','bl','b','br'],peak=()=>Math.max(...P.lens)*P.strength;
  const shiftAt=d=>{const a=P.lensAt,s=P.lens;if(d>=a[a.length-1])return 0;if(d<=0)return s[0]*P.strength;let i=0;while(d>a[i+1])i++;return P.strength*(s[i]+(s[i+1]-s[i])*(d-a[i])/(a[i+1]-a[i]));};
  // The pieces of a virtual box 2C + 1 device px wide and high: the corners (C x C) and the one-pixel edges between them.
  const tiles=(k,C)=>{
    const key=k+'/'+C;if(g.cache.has(key))return g.cache.get(key);
    const N=Math.round(C*k),S=2*N+1,w=S/k,r=P.radius,pk=peak(),canvas=document.createElement('canvas'),cx=canvas.getContext('2d'),img=cx.createImageData(S,S),m=img.data;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      const px=(x+.5)/k,py=(y+.5)/k,qx=Math.abs(px-w/2)-(w/2-r),qy=Math.abs(py-w/2)-(w/2-r);
      const d=-(Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r);
      // Inward: toward the box inset by C, so the direction turns over the last C before a corner.
      let nx=Math.min(w-C,Math.max(C,px))-px,ny=Math.min(w-C,Math.max(C,py))-py;const l=Math.hypot(nx,ny);
      const s=l?shiftAt(Math.max(0,d))/pk:0;nx=l?nx/l:0;ny=l?ny/l:0;
      const i=(y*S+x)*4,xv=Math.round(128+127*s*nx),yv=(128+127*s*ny)/255;
      m[i]=m[i+1]=xv;m[i+2]=Math.round(255*(wideGamut?encode(Math.min(1,Math.max(0,(linear(yv)-.0895*linear(xv/255))/.9108))):yv));m[i+3]=255;
    }
    // putImageData, not drawImage: Chrome left the last rows of a 1px-wide drawImage cut transparent.
    const cut=(sx,sy,sw,sh)=>{canvas.width=sw;canvas.height=sh;cx.putImageData(img,-sx,-sy,sx,sy,sw,sh);return canvas.toDataURL();};
    const t={N,tl:cut(0,0,N,N),t:cut(N,0,1,N),tr:cut(N+1,0,N,N),l:cut(0,N,N,1),r:cut(N+1,N,N,1),bl:cut(0,N+1,N,N),b:cut(N,N+1,1,N),br:cut(N+1,N+1,N,N)};
    g.cache.set(key,t);return t;
  };
  // Apple's menu tone (research/RESEARCH.md, "Menus", tone): colour steps only, folded by Skia into one pass.
  const toneXML=(()=>{
    const pts=[[0,32],[31,57],[63,82],[95,105],[127,122],[159,135],[191,143],[223,147],[255,146]],k=[.2126,.7152,.0722],g=1.05;
    const T=L=>{let i=0;while(i<pts.length-2&&L>pts[i+1][0])i++;const [a,ta]=pts[i],[b,tb]=pts[i+1];return ta+(tb-ta)*(L-a)/(b-a);};
    const U=Array.from({length:65},(_,i)=>{const L=Math.max(0,2*i/64-1)*255;return (T(L)-L)/255;}),lo=Math.min(...U),s=Math.max(...U)-lo;
    const row=c=>[0,1,2].map(j=>((j===c?g:0)+(1-g)*k[j]).toFixed(4)).join(' ')+' 0 0';
    const floor=`type="table" tableValues="${[32/255,32/255,...Array.from({length:7},(_,i)=>(i+2)/8)].map(v=>v.toFixed(4)).join(' ')}"`;
    return `<feColorMatrix values="${row(0)} ${row(1)} ${row(2)} ${k.map(v=>(v/2).toFixed(4)).join(' ')} 0 .5"/>`
      // alpha stays in [.5, 1] after the table too: a colour stored premultiplied by an alpha near 0 is lost
      +`<feComponentTransfer><feFuncA type="table" tableValues="${U.map(u=>(.5+.5*(u-lo)/s).toFixed(4)).join(' ')}"/></feComponentTransfer>`
      +`<feColorMatrix values="1 0 0 ${(2*s).toFixed(4)} ${(lo-s).toFixed(4)} 0 1 0 ${(2*s).toFixed(4)} ${(lo-s).toFixed(4)} 0 0 1 ${(2*s).toFixed(4)} ${(lo-s).toFixed(4)} 0 0 0 0 1"/>`
      +`<feComponentTransfer><feFuncR ${floor}/><feFuncG ${floor}/><feFuncB ${floor}/></feComponentTransfer>`;
  })();
  const filterXML=id=>`<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(128,128,128)" result="n"/>${pieces.map(p=>`<feImage data-piece="${p}" result="${p}" preserveAspectRatio="none"/>`).join('')}<feMerge result="map"><feMergeNode in="n"/>${pieces.map(p=>`<feMergeNode in="${p}"/>`).join('')}</feMerge><feGaussianBlur in="SourceGraphic" stdDeviation="${P.blur}" edgeMode="duplicate" result="soft"/><feDisplacementMap in="soft" in2="map" xChannelSelector="R" yChannelSelector="B" scale="${(2*peak()).toFixed(2)}" result="core"/>${P.darken?`<feGaussianBlur in="core" stdDeviation="${P.darkenBlur}" edgeMode="duplicate" result="halo"/><feBlend in="core" in2="halo" mode="darken" result="dk"/><feComposite in="core" in2="dk" operator="arithmetic" k2="${(1-P.darken).toFixed(3)}" k3="${P.darken}"/>`:''}${P.tone?toneXML:''}</filter>`;
  const place=slot=>{
    const node=slot.node;if(!node)return;const w=node.offsetWidth,h=node.offsetHeight,k=devicePixelRatio||1;if(!w||!h)return;
    const C=Math.max(1,Math.min(P.turn,Math.floor(Math.min(w,h)/2*k)/k)),t=tiles(k,C),c=t.N/k,f=slot.filter;
    const box={tl:[0,0,c,c],t:[c,0,w-2*c,c],tr:[w-c,0,c,c],l:[0,c,c,h-2*c],r:[w-c,c,c,h-2*c],bl:[0,h-c,c,c],b:[c,h-c,w-2*c,c],br:[w-c,h-c,c,c]};
    for(const img of f.querySelectorAll('feImage')){const p=img.dataset.piece,[x,y,bw,bh]=box[p];img.setAttribute('href',t[p]);img.setAttribute('x',x);img.setAttribute('y',y);img.setAttribute('width',Math.max(0,bw));img.setAttribute('height',Math.max(0,bh));}
  };
  const rebuild=slot=>{slot.filter?.remove();g.svg.insertAdjacentHTML('beforeend',filterXML('am-mg-'+slot.i));slot.filter=g.svg.lastElementChild;place(slot);};
  const attach=node=>{
    if(node.dataset.amGlass)return;let slot=g.slots.find(s=>!s.node);if(!slot){slot={i:g.slots.length};g.slots.push(slot);rebuild(slot);}
    slot.node=node;node.dataset.amGlass=slot.i;slot.ro=new ResizeObserver(()=>place(slot));slot.ro.observe(node);place(slot);
  };
  const detach=node=>{const slot=g.slots.find(s=>s.node===node);if(!slot)return;slot.ro.disconnect();slot.node=null;delete node.dataset.amGlass;};
  g.slots.forEach(rebuild);
  // Spotify's menus: each [data-tippy-root] (a child of body) holding ul[role=menu]; sweep the slots of removed ones.
  if(!g.mo){
    const scan=()=>{for(const ul of document.querySelectorAll('body > [data-tippy-root] ul[role="menu"]'))attach(ul);for(const s of g.slots)if(s.node&&!s.node.isConnected)detach(s.node);};
    g.mo=new MutationObserver(records=>{if(records.some(r=>r.removedNodes.length))scan();for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('[data-tippy-root]')){let f=0;const look=()=>{scan();if(!n.querySelector('ul[role="menu"]')&&++f<30)requestAnimationFrame(look);};look();}});
    g.mo.observe(document.body,{childList:true});scan();
    for(const id of ['am-popover','am-popover-sub']){const n=document.getElementById(id);if(n)attach(n);}
  }
  return {attach,detach,params:P};
};
