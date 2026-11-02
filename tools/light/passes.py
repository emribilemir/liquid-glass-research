import json,sys,collections
ev=json.load(open(sys.argv[1]))
n=collections.Counter(e['name'] for e in ev if e.get('ph') in ('X','B') and e['name'] in ('SkCanvas::saveLayer','DirectRenderer::DrawFrame','Display::DrawAndSwap','TaskList::addCommands'))
print(dict(n), 'saveLayer/frame %.1f'%(n['SkCanvas::saveLayer']/max(1,n['DirectRenderer::DrawFrame'])))
