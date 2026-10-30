// The player's Liquid Glass lens from mcloud (theme.js on claude/liquid-glass-research-e10174, 13478f5), unchanged:
// glassStates.focused is the glass fitted to macOS's own (research/RESEARCH.md), glassFilter() builds the SVG filter,
// glassLens() draws its maps at the element's size and device resolution (one change: it reads the fractional size from
// getBoundingClientRect, as the buttons' face resizes by fractions of a pixel while pressed). lgLens(node) gives an element its own
// filter (part 'all', with the player's exact bilinear bend on whole-pixel screens) and sets it as the element's backdrop-filter; the dark hairline
// outside the round ends is CSS (.lg-glass-rim), as on the player.
(() => {
  const glass=document.createElementNS('http://www.w3.org/2000/svg','svg');
  glass.setAttribute('aria-hidden','true');glass.setAttribute('width','0');glass.setAttribute('height','0');glass.style.position='absolute';
  const glassStates={
    focused:{pre:.4,darken:.7,darkenBlur:13.5,gain:1.05,lensA:1.01,lensH:.495,
      // Highlight along the top and bottom edges, every 0.5px from the edge, mixed toward 2x white (fitted to Apple
      // Music's own frames: stronger and it overshoots over bright artwork).
      highlight:[.13,.085,.032,.019,.014,.011,.009,.007,.005,.004,.003,.002,.001,.0005,0],highlightTo:2,highlightPow:3.5,
      // Edge line inside the glass (the toast): the glass times 1 - line*(1 - smoothstep(0, lineW, d))*|n_x|, d in
      // device pixels. Music's ends also darken gradually where the page beside the bar is dark: its blur reaches
      // outside the bar, which a backdrop-filter cannot. Page mix: the outermost pixels show the page right under
      // them by pageMix*(1 - d/pageMixW) (d in device pixels; a light halo where the bar's edge lies on bright
      // content). Rim smoothing: blur (px) mixed in by (1/compression - 1)/smoothDiv where the bend
      // magnifies; rim darkening: the darken result mixed in by rimDark, fading out by rimDarkW (px).
      line:.9,lineW:1,pageMix:.65,pageMixW:2.2,smooth:1,smoothDiv:2,rimDark:.6,rimDarkW:12,thin:1,thinMix:.3,
      tone:[32,36,45,56,65,71,78,86,90,96,102,109,116,120,122,125,130,135,141,147,152,156,156,157,161,167,170,170,174,178,179,181,185]},
  };
  // On wide-gamut (P3) Macs Chromium converts the recombined map from sRGB to P3 before displacing, and that
  // mixes channels: red took ~18% of green, so a vertical shift also shifted the page up to ~2.7px sideways. The
  // map therefore arrives as two grey images (greys survive the conversion) recombined as R=G=x shift and B=y
  // shift: red gains nothing when green equals it, and blue's ~9% share of x is compensated in glassLens().
  // The tone is stored as the offset to add at each luminance, (out-in+1)/2, so colours move with their luminance
  // instead of each channel on its own curve.
  // part: 'bend' (the page bent at the rim), 'face' (the rest, reading the bent page as its backdrop, with the rim
  // darkening) or 'all' (one filter without the rim steps, which would multiply its cost: the toast). The buttons split
  // 'face' further: 'mid' (thin lines, darken halo, edge read) and 'tone' (colour and highlight, which read their input
  // several times: as a filter's own backdrop that input is a texture, not a chain recomputed per reader). exact: the
  // bend samples bilinearly (4 taps); otherwise one tap, and the face blurs where the bend magnifies.
  const glassFilter=(id,state,part,exact)=>{
    const tone=`type="table" tableValues="${state.tone.map((t,k)=>((t/255-state.gain*k/32+1)/2).toFixed(4)).join(' ')}"`,img=name=>`<feImage result="${name}" preserveAspectRatio="none"/>`;
    const map=(x,y,result)=>`${img(x)}${img(y)}<feColorMatrix in="${x}" values="1 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="${x}c"/><feColorMatrix in="${y}" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 1" result="${y}c"/><feComposite in="${x}c" in2="${y}c" operator="arithmetic" k2="1" k3="1" result="${result}"/>`;
    const shift=(m,result)=>`<feDisplacementMap in="soft" in2="${m}" xChannelSelector="R" yChannelSelector="B" result="${result}"/>`,soft=`<feGaussianBlur in="SourceGraphic" stdDeviation="${state.pre}" edgeMode="duplicate" result="soft"/>`;
    // Taps 0-3 hit the page pixels left/right (fx) and above/below (fy) the source point; each reads only its own map.
    const bend=exact?soft+[0,1,2,3].map(j=>map('bx'+j,'by'+j,'bm'+j)+shift('bm'+j,'tp'+j)).join('')+`${img('fx')}${img('fy')}<feComposite in="tp1" in2="fx" operator="in" result="t1"/><feComposite in="t1" in2="tp0" operator="over" result="row0"/><feComposite in="tp3" in2="fx" operator="in" result="t3"/><feComposite in="t3" in2="tp2" operator="over" result="row1"/><feComposite in="row1" in2="fy" operator="in" result="row1f"/><feComposite in="row1f" in2="row0" operator="over" result="core"/>`
      :map('mx','my','map')+soft+shift('map','core');
    // Outside the glass (buttons, state.margin > 0): the outermost pixels read the page outerDist beyond the edge,
    // blurred (taps 'om', weight 'me', outerEnd of it where the edge faces sideways, at the round ends), and the whole glass takes the colour of a wide blur of the page around it, both
    // from the margin of page the element's larger box gives the backdrop-filter. macOS's glass does both; a
    // backdrop-filter the size of the glass never sees past its edge.
    // They come after the darken halo (which would pull the read page toward the glass's grey) and before the tone.
    const outer=state.margin?`${map('ox','oy','om')}<feGaussianBlur in="SourceGraphic" stdDeviation="${state.outerBlur}" edgeMode="none" result="ob"/><feDisplacementMap in="ob" in2="om" xChannelSelector="R" yChannelSelector="B" result="out"/>${img('me')}<feComposite in="out" in2="me" operator="in" result="oe"/><feComposite in="oe" in2="glass" operator="over" result="glass"/>`
      // The wash tints the glass with the colour of the page around it, without its luminance (a green page above the
      // glass leaves its brightness unchanged) and only where that colour differs from the page under it (on a flat
      // colour Apple's glass adds nothing): the chroma (R-L, G-L, B-L) of a wide blur minus that of the bent page,
      // added at washMix (washLocal scales the subtracted part: 0 is the plain chroma of the blur).
      +(state.washMix?`<feGaussianBlur in="SourceGraphic" stdDeviation="${state.washBlur}" edgeMode="none" result="wb"/><feColorMatrix in="wb" values=".7874 -.7152 -.0722 0 .5 -.2126 .2848 -.0722 0 .5 -.2126 -.7152 .9278 0 .5 0 0 0 1 0" result="wc"/><feColorMatrix in="core" values=".7874 -.7152 -.0722 0 .5 -.2126 .2848 -.0722 0 .5 -.2126 -.7152 .9278 0 .5 0 0 0 1 0" result="cc"/><feComposite in="wc" in2="cc" operator="arithmetic" k2="1" k3="${-(state.washLocal??1)}" k4="${((state.washLocal??1)/2).toFixed(4)}" result="wd"/><feComposite in="glass" in2="wd" operator="arithmetic" k2="1" k3="${state.washMix}" k4="${(-state.washMix/2).toFixed(4)}" result="glass"/>`:''):'';
    // Rim smoothing along the edge normal: a vertical and a sideways blur, each mixed in through its mask's alpha.
    const smooth=`${img('mv')}${img('mz')}<feGaussianBlur in="SourceGraphic" stdDeviation="0 ${state.smooth}" edgeMode="duplicate" result="bv"/><feGaussianBlur in="SourceGraphic" stdDeviation="${state.smooth} 0" edgeMode="duplicate" result="bz"/><feComposite in="bv" in2="mv" operator="in" result="sv"/><feComposite in="bz" in2="mz" operator="in" result="sz"/><feComposite in="sv" in2="SourceGraphic" operator="over" result="s1"/><feComposite in="sz" in2="s1" operator="over" result="core"/>`;
    // Thin bright detail dims (a min with a 1px blur, mixed in): Apple's 1pt lines carry ~75% of ours, flat colour is equal.
    const thin=src=>`<feGaussianBlur in="${src}" stdDeviation="${state.thin}" edgeMode="duplicate" result="tb"/><feBlend in="${src}" in2="tb" mode="darken" result="td"/><feComposite in="${src}" in2="td" operator="arithmetic" k2="${1-state.thinMix}" k3="${state.thinMix}" result="core"/>`;
    const darken=`<feGaussianBlur in="core" stdDeviation="${state.darkenBlur}" edgeMode="duplicate" result="halo"/><feBlend in="core" in2="halo" mode="darken" result="dk"/><feComposite in="core" in2="dk" operator="arithmetic" k2="${(1-state.darken).toFixed(2)}" k3="${state.darken}" result="glass"/>`
      +(part==='face'?`${img('md')}<feComposite in="dk" in2="md" operator="in" result="rd"/><feComposite in="rd" in2="glass" operator="over" result="glass"/>`:'');
    const peakHighlight=state.highlight[0];
    // gainL (buttons): the colour gain by luminance, a table like tone (macOS's glass boosts dark colours more: purple
    // 1.25, red 1.17, orange 1.04): out = tone(L) + (in - L) * gainL(L), as (in + 2*tone1 - 1) + chroma*(gainL - 1).
    const tone1=state.gainL&&`type="table" tableValues="${state.tone.map((t,k)=>((t/255-k/32+1)/2).toFixed(4)).join(' ')}"`,gl=state.gainL&&`type="table" tableValues="${state.gainL.map(g=>Math.min(1,Math.max(0,(g-1)*2)).toFixed(4)).join(' ')}"`;
    const colour=state.gainL?`<feColorMatrix in="glass" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="lum"/><feComponentTransfer in="lum" result="tone"><feFuncR ${tone1}/><feFuncG ${tone1}/><feFuncB ${tone1}/></feComponentTransfer><feComponentTransfer in="lum" result="gl"><feFuncR ${gl}/><feFuncG ${gl}/><feFuncB ${gl}/></feComponentTransfer><feComposite in="glass" in2="lum" operator="arithmetic" k2="1" k3="-1" k4=".5" result="chroma"/><feComposite in="chroma" in2="gl" operator="arithmetic" k1=".5" k3="-.25" k4=".5" result="boost"/><feComposite in="glass" in2="tone" operator="arithmetic" k2="1" k3="2" k4="-1" result="toned"/><feComposite in="toned" in2="boost" operator="arithmetic" k2="1" k3="1" k4="-.5"/>`
      :`<feColorMatrix in="glass" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/><feComponentTransfer result="tone"><feFuncR ${tone}/><feFuncG ${tone}/><feFuncB ${tone}/></feComponentTransfer><feComposite in="glass" in2="tone" operator="arithmetic" k2="${state.gain}" k3="2" k4="-1"/>`;
    // hlHue: the highlight raises the luminance as it does on grey (L + peak*mh*(highlightTo - L)) but keeps the hue,
    // scaling the three channels alike (Music's player: orange edge 255,176,65 where mixing toward white gave
    // 255,180,99): out = c * (1 + peak*mh*(highlightTo - L)/L), the ratio from a table on L capped at hlCap.
    const hlCap=16,hlRatio=`type="table" tableValues="${Array.from({length:65},(_,k)=>{const L=Math.max(k/64,1e-3);return Math.min(1,(state.highlightTo-L)/L/hlCap).toFixed(4);}).join(' ')}"`;
    const highlight=state.hlHue?`<feMerge result="tn"><feMergeNode/></feMerge><feColorMatrix in="tn" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="hll"/><feComponentTransfer in="hll" result="hlt"><feFuncR ${hlRatio}/><feFuncG ${hlRatio}/><feFuncB ${hlRatio}/></feComponentTransfer><feComposite in="hlt" in2="mh" operator="arithmetic" k1="1" result="hlf"/><feComposite in="tn" in2="hlf" operator="arithmetic" k1="${(hlCap*peakHighlight).toFixed(4)}" k2="1"/>`
      :`<feComposite in2="mh" operator="arithmetic" k1="${state.hlK1??-peakHighlight}" k2="1" k3="${state.hlK3??(state.highlightTo*peakHighlight).toFixed(4)}"/>`;
    const face=`${img('mh')}${img('ml')}${colour}${highlight}<feBlend in2="ml" mode="multiply"/>`;
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${part==='bend'?bend:part==='face'?(exact?thin('SourceGraphic'):smooth+thin('core'))+darken+outer+face:part==='mid'?(exact?thin('SourceGraphic'):smooth+thin('core'))+darken+outer+'<feMerge><feMergeNode in="glass"/></feMerge>':part==='tone'?'<feMerge result="glass"><feMergeNode in="SourceGraphic"/></feMerge>'+face:bend+darken+outer+face}</filter>`;
  };
  // The sidebar glow (user.css) saturates and brightens hard so that small covers reach its edge; this soft
  // ceiling keeps large coloured areas, such as playlist headers under the sidebar, from blowing out.
  const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,encode=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
  const wideGamut=matchMedia('(color-gamut: p3)').matches;
  // build (optional) rebuilds the filters before each redraw: the player's change with the screen scale.
  function glassLens(node,state,filterIds,build) {
    let glassSize='';
    const hl=state.highlight,highlightAt=edge=>{const f=edge/.5;if(f>=hl.length-1)return 0;const i=Math.floor(f);return (hl[i]+(hl[i+1]-hl[i])*(f-i))/hl[0];},fade=u=>1-u*u*(3-2*u);
    const draw=()=>{
      // Drawn at device resolution and redrawn only on resize or a change of screen: the bend and the highlight
      // live in the outermost few pixels. Scrolling frame times were measured unchanged against a CSS-size map.
      const {width:w,height:h}=node.getBoundingClientRect(),k=devicePixelRatio||1;if(!w||!h||glassSize===w+'x'+h+'@'+k)return;glassSize=w+'x'+h+'@'+k;
      build?.();const maps=filterIds.flatMap(id=>[...glass.querySelectorAll(`#${id} feImage`)]),shifts=filterIds.flatMap(id=>[...glass.querySelectorAll(`#${id} feDisplacementMap`)]);
      // margin: the glass is the box inset by M on every side; the rest is page the filter may read (clipped away).
      const M=state.margin||0,gw=w-2*M,gh=h-2*M,W=Math.round(w*k),H=Math.round(h*k),r=gh/2,A=state.lensA*r,L=state.lensH*r,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      // Inward shift (px) by distance from the edge, and how much the bend squeezes (> 1) or magnifies (< 1) the page.
      const shiftAt=d=>{const t=Math.min(1,d/L);return A*(1-Math.sqrt((2-t)*t));},squeeze=d=>{const t=d/L;return t>=1?1:Math.abs(1-A/L*(1-t)/Math.sqrt(Math.max(1e-4,t*(2-t))));};
      const context=canvas.getContext('2d'),data={};for(const map of maps)data[map.getAttribute('result')]??=context.createImageData(W,H);
      const {mx,my,mh,ml,mv,mz,md,fx,fy,me}=Object.fromEntries(Object.entries(data).map(([n,image])=>[n,image.data]));
      // Bilinear taps: per pixel, offsets (px) to the 4 page pixels around its source point; one scale for all four.
      const taps=fx?[0,1,2,3].map(j=>[data['bx'+j].data,data['by'+j].data]):null,offsets=taps&&new Float32Array(W*H*8),outs=me&&new Float32Array(W*H*2);let reach=me?state.outerDist:1;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        // The vector to the pill's centre line is the rim's inward normal; the maps hold its x/y shift. Masks are
        // white with their weight in alpha (alpha survives the P3 conversion of feImage; greys survive it too).
        const px=(x+.5)/k-M,py=(y+.5)/k-M,dx=Math.min(gw-r,Math.max(r,px))-px,dy=r-py,length=Math.hypot(dx,dy)||1,edge=Math.max(0,r-length),ny2=(dy/length)**2,i=(y*W+x)*4;
        if(me){const u=length>r+1/k?0:state.outerMix*(ny2+(1-ny2)*(state.outerEnd??1))*Math.max(0,1-edge*k/state.outerW);me[i]=me[i+1]=me[i+2]=255;me[i+3]=Math.round(255*u);
          outs[(y*W+x)*2]=-state.outerDist*dx/length;outs[(y*W+x)*2+1]=-state.outerDist*dy/length;}
        if(mx){const t=shiftAt(edge)/A/length,xv=Math.round(128+127*t*dx),yv=(128+127*t*dy)/255;
          mx[i]=mx[i+1]=mx[i+2]=xv;my[i]=my[i+1]=my[i+2]=Math.round(255*(wideGamut?encode(Math.min(1,Math.max(0,(linear(yv)-.0895*linear(xv/255))/.9108))):yv));mx[i+3]=my[i+3]=255;}
        if(mh){mh[i]=mh[i+1]=mh[i+2]=Math.round(255*highlightAt(edge)*Math.sqrt(ny2)**state.highlightPow);mh[i+3]=255;}
        if(ml){ml[i]=ml[i+1]=ml[i+2]=Math.round(255*(1-state.line*fade(Math.min(1,edge*k/state.lineW))*Math.sqrt(1-ny2)));ml[i+3]=255;}
        if(mv){const m=Math.min(1,Math.max(0,(1/Math.max(squeeze(edge),.05)-1)/state.smoothDiv));mv[i]=mv[i+1]=mv[i+2]=mz[i]=mz[i+1]=mz[i+2]=255;mv[i+3]=Math.round(255*m*ny2);mz[i+3]=Math.round(255*m*(1-ny2));}
        if(md){md[i]=md[i+1]=md[i+2]=255;md[i+3]=Math.round(255*state.rimDark*fade(Math.min(1,edge/state.rimDarkW)));}
        if(taps){const s=shiftAt(edge),sx=(px+M+s*dx/length)*k-.5,sy=(py+M+s*dy/length)*k-.5,ix=Math.floor(sx),iy=Math.floor(sy),q=(y*W+x)*8,
            u=state.pageMix*(1-edge*k/state.pageMixW);
          fx[i]=fx[i+1]=fx[i+2]=fy[i]=fy[i+1]=fy[i+2]=255;fx[i+3]=Math.round(255*(u>0?1-u:sx-ix));fy[i+3]=u>0?0:Math.round(255*(sy-iy));
          // Where the page mixes in, taps 0 and 2 read the pixel itself and taps 1 and 3 the nearest bent one.
          for(let j=0;j<4;j++){const ox=u>0?j%2&&(Math.round(sx)-x)/k:(ix+j%2-x)/k,oy=u>0?j%2&&(Math.round(sy)-y)/k:(iy+(j>>1)-y)/k;offsets[q+2*j]=ox;offsets[q+2*j+1]=oy;reach=Math.max(reach,Math.abs(ox),Math.abs(oy));}}
      }
      // Each tap's offset in its own pair of grey maps, aimed at the target pixel's centre: Chromium takes the pixel
      // nearest to the displaced point, and the 8-bit step (scale/255) stays under a device pixel.
      const scale=taps?2*(reach+1):2*A;
      const grey=(tx,ty,i,ox,oy)=>{const xv=Math.round(255*(ox/scale+.5)),yv=oy/scale+.5;tx[i]=tx[i+1]=tx[i+2]=xv;ty[i]=ty[i+1]=ty[i+2]=Math.round(255*(wideGamut?encode(Math.min(1,Math.max(0,(linear(yv)-.0895*linear(xv/255))/.9108))):yv));tx[i+3]=ty[i+3]=255;};
      if(outs)for(let p=0;p<W*H;p++)grey(data.ox.data,data.oy.data,p*4,outs[p*2],outs[p*2+1]);
      if(taps)for(let p=0;p<W*H;p++)for(let j=0;j<4;j++){const i=p*4,[tx,ty]=taps[j],xv=Math.round(255*(offsets[p*8+2*j]/scale+.5)),yv=offsets[p*8+2*j+1]/scale+.5;
        tx[i]=tx[i+1]=tx[i+2]=xv;ty[i]=ty[i+1]=ty[i+2]=Math.round(255*(wideGamut?encode(Math.min(1,Math.max(0,(linear(yv)-.0895*linear(xv/255))/.9108))):yv));tx[i+3]=ty[i+3]=255;}
      const urls={};for(const [n,image] of Object.entries(data)){context.putImageData(image,0,0);urls[n]=canvas.toDataURL();}
      for(const map of maps){map.setAttribute('href',urls[map.getAttribute('result')]);map.setAttribute('width',w);map.setAttribute('height',h);}
      for(const shift of shifts)shift.setAttribute('scale',scale);
    };
    if(typeof ResizeObserver==='function')new ResizeObserver(draw).observe(node);draw();
    const watchResolution=()=>matchMedia(`(resolution: ${devicePixelRatio||1}dppx)`).addEventListener('change',()=>{draw();watchResolution();},{once:true});watchResolution();
  }
  // lgRim(box): Apple's hairline, the page at ~0.4 in the one device pixel just outside the glass (BtnLab: grey 64 ->
  // 26, 192 -> 99), strongest at the round ends (CSS mask on .lg-glass-rim). An SVG stroke of 1/dpr along the shape
  // grown by half that: Chromium drops sub-pixel box-shadow spreads and rounds thin borders up to 1px. It goes over
  // the glass (after it, z-index 0): under it, the glass's antialiased edge covered the line unevenly row to row.
  window.lgRim=box=>{
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),rect=document.createElementNS(ns,'rect');
    svg.setAttribute('class','lg-glass-rim');svg.setAttribute('aria-hidden','true');rect.setAttribute('fill','none');svg.append(rect);box.append(svg);
    // --lg-rim-w: the stroke's width and --lg-rim-o its centre's distance outside the glass, both in device pixels.
    const fit=()=>{const {width:w,height:h}=svg.getBoundingClientRect(),k=devicePixelRatio||1,cs=getComputedStyle(svg),pad=1;if(!w)return;
      const t=(parseFloat(cs.getPropertyValue('--lg-rim-w'))||1)/k,o=(parseFloat(cs.getPropertyValue('--lg-rim-o'))||.5)/k;
      rect.setAttribute('x',pad-o);rect.setAttribute('y',pad-o);rect.setAttribute('width',w-2*pad+2*o);rect.setAttribute('height',h-2*pad+2*o);rect.setAttribute('rx',(h-2*pad+2*o)/2);rect.setAttribute('stroke-width',t);};
    if(typeof ResizeObserver==='function')new ResizeObserver(fit).observe(svg);fit();return svg;
  };
  // The toolbar buttons' glass (research/RESEARCH.md, "Toolbar glass buttons"): fitted to BtnLab's 36pt and 73pt glass
  // with the tone and colour gain by luminance measured on flat colours, the page read past the edge, a hue-keeping
  // highlight (research/buttons/params-button.json).
  glassStates.button={...glassStates.focused,pre:0.35,darken:0.7984,darkenBlur:15.2999,lensA:1.01,lensH:0.497,highlightPow:4.091,highlight:[0.1105,0.07225,0.0272,0.01615,0.0119,0.00935,0.00765,0.00595,0.00425,0.0034,0.00255,0.0017,0.00085,0.00042,0.0],tone:[31.6,39.3,46.9,54.3,61.5,68.5,75.3,81.9,88.3,94.5,100.6,106.4,112,117.4,122.7,127.7,132.6,137.2,141.6,145.9,149.9,153.7,157.4,160.8,164,167.1,170,172.7,175.2,177.4,179.5,181.4,183],gainL:[1.2962,1.2833,1.2705,1.2576,1.2447,1.2319,1.219,1.2062,1.1933,1.1805,1.1676,1.1547,1.1419,1.129,1.1162,1.1033,1.0905,1.0776,1.0647,1.0519,1.039,1.0262,1.0133,1.0005,1,1,1,1,1,1,1,1,1],margin:12,outerDist:11.5,outerBlur:3,outerMix:0.7234,outerEnd:0.75,outerW:2.091,washBlur:10,washMix:0.0697,washLocal:1.0427,hlHue:true,pageMix:0};
  // For player.mjs, which builds mcloud's two-layer player glass from these same functions.
  window.lgGlassInternals={glassFilter,glassLens,glassStates,svg:glass};
  // lgRimF(box, {w, s}): the hairline as macOS draws it, from the page under it: the luminance through a table
  // measured on flat greys (BtnLab: 128 -> 68, 255 -> 123) and ~0.8 of the colour around it kept (pink 230,120,170 ->
  // 166,60,104), so the line takes the page's hue instead of greying it. A backdrop-filter on the shape grown by 1px,
  // its weight a map of the 1-device-pixel band outside the glass (4x4 samples per pixel) fading as (1 - x/r)^3 from
  // each end; over the glass. w: the line's strength (1 at 36pt, lighter on the player).
  const rimT=[0.0, 0.0098, 0.0208, 0.0326, 0.0453, 0.0591, 0.0743, 0.0904, 0.1069, 0.1238, 0.1412, 0.1595, 0.1787, 0.1996, 0.2221, 0.245, 0.2669, 0.288, 0.3089, 0.3286, 0.3462, 0.3612, 0.3747, 0.3873, 0.3996, 0.412, 0.4242, 0.4359, 0.4467, 0.4567, 0.4662, 0.475, 0.4831];let rimN=0;
  window.lgRimF=(box,{w=1,s=.8}={})=>{
    const id='lg-rimf-'+(++rimN),el=document.createElement('div');el.className='lg-glass-rimf';box.append(el);
    const tt=`type="table" tableValues="${rimT.join(' ')}"`;
    glass.insertAdjacentHTML('beforeend',`<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="rl"/><feComponentTransfer in="rl" result="rt"><feFuncR ${tt}/><feFuncG ${tt}/><feFuncB ${tt}/></feComponentTransfer><feComposite in="SourceGraphic" in2="rl" operator="arithmetic" k2="1" k3="-1" k4=".5" result="rc"/><feComposite in="rt" in2="rc" operator="arithmetic" k2="1" k3="${s}" k4="${(-s/2).toFixed(3)}" result="rd"/><feImage result="rm" preserveAspectRatio="none"/><feComposite in="rd" in2="rm" operator="in" result="rdm"/><feComposite in="rdm" in2="SourceGraphic" operator="over"/></filter>`);
    if(!glass.isConnected)document.body.append(glass);
    el.style.backdropFilter=el.style.webkitBackdropFilter=`url(#${id})`;
    const map=glass.querySelector(`#${id} feImage`);let size='';
    const draw=()=>{const {width:bw,height:bh}=el.getBoundingClientRect(),k=devicePixelRatio||1;if(!bw||size===bw+'x'+bh+'@'+k)return;size=bw+'x'+bh+'@'+k;
      const W=Math.round(bw*k),H=Math.round(bh*k),gw=bw-2,gh=bh-2,r=gh/2,c=document.createElement('canvas');c.width=W;c.height=H;
      const ctx=c.getContext('2d'),img=ctx.createImageData(W,H),dd=img.data;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){let cov=0;
        for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){const px=(x+(sx+.5)/4)/k-1,py=(y+(sy+.5)/4)/k-1,cx=Math.min(gw-r,Math.max(r,px)),d=(Math.hypot(px-cx,py-r)-r)*k;if(d>=0&&d<1)cov++;}
        const px=(x+.5)/k-1,fade=Math.max(0,1-Math.min(px,gw-px)/r)**3,i=(y*W+x)*4;dd[i]=dd[i+1]=dd[i+2]=255;dd[i+3]=Math.round(255*Math.min(1,w*cov/16*fade));}
      ctx.putImageData(img,0,0);map.setAttribute('href',c.toDataURL());map.setAttribute('width',bw);map.setAttribute('height',bh);};
    if(typeof ResizeObserver==='function')new ResizeObserver(draw).observe(el);draw();return el;
  };
  let n=0;
  // over: overrides of glassStates.focused (fitlens.mjs fits them at button sizes).
  // node: the glass's box grown by state.margin; it gets three layers, each a backdrop-filter clipped to the glass
  // (bend, mid, tone), as siblings so each reads the one before as a texture. The node itself must not clip or filter
  // (that would make it the layers' backdrop root).
  window.lgLens=(node,over)=>{
    const state={...glassStates[over?.state||'focused'],...over},id='lg-lens-'+(++n),exact=Number.isInteger(devicePixelRatio||1),parts=['bend','mid','tone'];
    glass.insertAdjacentHTML('beforeend',parts.map(p=>glassFilter(`${id}-${p}`,state,p,exact)).join(''));
    if(!glass.isConnected)document.body.append(glass);
    node.style.setProperty('--lg-hair',1/(devicePixelRatio||1)+'px');node.style.setProperty('--lg-m',(state.margin||0)+'px');
    node.style.backdropFilter=node.style.webkitBackdropFilter='none';
    const layers=parts.map(p=>{const l=document.createElement('div');l.className='lg-glass-layer';
      Object.assign(l.style,{position:'absolute',inset:'0',pointerEvents:'none',clipPath:`inset(${state.margin||0}px round 999px)`});
      l.style.backdropFilter=l.style.webkitBackdropFilter=`url(#${id}-${p})`;return l;});
    node.prepend(...layers);
    glassLens(layers[0],{...state,line:0},parts.map(p=>`${id}-${p}`));
    return id;
  };
})();
