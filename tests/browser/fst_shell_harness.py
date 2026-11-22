"""Offline rendering of the actual FST build. Never authenticates or writes remotely."""
from pathlib import Path
import os
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = Path(os.environ.get('FST_ARTIFACT', ROOT / 'web/index.html'))
VIEWPORTS = [(1920,1080),(1440,900),(1366,768),(1200,800),(1024,768),(768,1024),(430,932),(390,844),(360,800)]
STUB = r"""
for(const storage of ['localStorage','sessionStorage']) {
 const values=new Map();Object.defineProperty(window,storage,{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear()}});
}
if(!crypto.randomUUID)crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(Math.floor(Math.random()*1e12)).padStart(12,'0');
window.__fstTest = {reads:[], writes:[], authTrace:[], tables:{}, delay:0, failNext:false};
function fixtureQuery(table) {
 let filters=[], one=false;
 const q=new Proxy({}, {get(t,key){
  if(key==='then')return (resolve,reject)=>{
   __fstTest.reads.push({table,filters:filters.slice()});
   let rows=__fstTest.tables[table]||[];
   for(const [op,k,v] of filters){
    if(op==='eq')rows=rows.filter(r=>r[k]===v);
    if(op==='in')rows=rows.filter(r=>v.includes(r[k]));
   }
   const fail=__fstTest.failNext;__fstTest.failNext=false;
   return new Promise(r=>setTimeout(()=>r({data:one?(rows[0]||null):rows,error:fail?{message:'fixture read failure'}:null,count:rows.length}),__fstTest.delay)).then(resolve,reject);
  };
  if(['insert','upsert','update','delete'].includes(key))return (...args)=>{__fstTest.writes.push({table,op:key,args});throw new Error('Offline fixture forbids mutations');};
  return (...args)=>{if(key==='single'||key==='maybeSingle')one=true;filters.push([key,...args]);return q;};
 }});return q;
}
const fixtureClient={
 from:fixtureQuery,
 rpc:(name,args)=>{__fstTest.reads.push({rpc:name,args});return Promise.resolve({data:[],error:null});},
 channel:()=>({on(){return this;},subscribe(){return this;},unsubscribe(){return Promise.resolve();}}),
 removeChannel:()=>Promise.resolve(),
 auth:{getSession:async()=>({data:{session:null},error:null}), getUser:async()=>({data:{user:null},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),
  mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2',nextLevel:'aal2'},error:null})}},
 functions:{invoke:async(name,args)=>{__fstTest.authTrace.push({name,args});return {data:null,error:{message:'Authentication is not available in offline rendering'}};}}
};
window.supabase={createClient:()=>fixtureClient};
"""

def offline_html(path=ARTIFACT):
    html=Path(path).read_text(encoding='utf-8')
    # Replace only script src nodes, never URLs contained in application strings.
    def script(match):
        src=match.group(1)
        if src.startswith('./'):
            target=Path(path).parent/src[2:]
            if not target.is_file():
                target=ROOT/'web'/src[2:]
            if not target.is_file(): raise FileNotFoundError(src)
            return '<script>\n'+target.read_text(encoding='utf-8')+'\n</script>'
        return ''
    html=re.sub(r'<script\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>\s*</script>',script,html)
    # Pages serves the sidebar logos as ./assets files; inline them because every request is aborted here.
    import base64,mimetypes
    def asset(match):
        target=Path(path).parent/match.group(1)[2:]
        if not target.is_file():target=ROOT/'web'/match.group(1)[2:]
        if not target.is_file():return match.group(0)
        mime=mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        return 'src="data:'+mime+';base64,'+base64.b64encode(target.read_bytes()).decode()+'"'
    html=re.sub(r'src="(\./assets/[^"]+)"',asset,html)
    # External icons may be absent; markup and all business JS remain unmodified.
    html=re.sub(r'<link\b[^>]*href=["\']https?://[^>]+>', '', html)
    return html.replace('<head>','<head><script>'+STUB+'</script>',1)

class Harness:
    def __init__(self,width=1366,height=768,path=ARTIFACT):
        self.p=sync_playwright().start()
        exe=os.environ.get('FST_CHROMIUM')
        if not exe and Path('/usr/bin/chromium').exists(): exe='/usr/bin/chromium'
        self.browser=self.p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
        self.context=self.browser.new_context(viewport={'width':width,'height':height})
        self.context.route('**/*',lambda route:route.abort())
        self.page=self.context.new_page()
        self.page.set_default_timeout(5000)
        self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.set_content(offline_html(path),wait_until='domcontentloaded')
        self.page.wait_for_timeout(80)
    def login_fixture(self,owner=True,admin=True,mode='admin',name='Enseignant de test'):
        self.page.evaluate('''async ({owner,admin,mode,name})=>{
          if(typeof renderAuthScreen==='function') await renderAuthScreen();
          const id=owner?window.V30LPC3.OWNER_ID:'00000000-0000-4000-8000-000000000001';
          const user={id,name,isAdmin:admin,activeMode:mode,role:admin?'admin':'teacher'};
          currentTeacher=user;window.currentTeacher=user;
          data={classes:[],students:[],sessions:[],attendance:[]};
          document.body.classList.add('app-active');
          document.getElementById('app-container').style.display='block';
          document.getElementById('auth-overlay').style.display='none';
          for(const key of ['utm','fst']){
            const from=document.querySelector('.institutional-logos .'+key+'-logo');
            const to=document.getElementById('internal-'+key+'-logo');if(from&&to)to.src=from.src;
          }
          const pill=document.getElementById('current-user-pill');pill.style.display='flex';
          document.getElementById('current-user-label').textContent=name+(mode==='admin'?' (mode administrateur)':' (mode enseignant)');
          document.getElementById('sync-status').textContent='Synchronis\u00e9';
          window.V16ActiveRole?.configure({isAdmin:admin,initialRole:mode});
          window.V30LPC3?.syncAccess();
          window.FSTShell?.syncAccess();
          if(typeof updateDashboard==='function') await updateDashboard();
          window.dispatchEvent(new CustomEvent('fst:auth-changed',{detail:{userId:id,activeMode:mode}}));
        }''',dict(owner=owner,admin=admin,mode=mode,name=name))
        self.page.wait_for_timeout(120)
        self.page.evaluate('Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{})))')
    def close(self):
        self.context.close();self.browser.close();self.p.stop()

def measure_layout(page):
    return page.evaluate(r'''()=>{
      const app=document.getElementById('app-container');
      const title=app.querySelector('#fst-page-title')||app.querySelector('.internal-brand-title h1');
      const header=app.querySelector('#fst-topbar')||app.querySelector('.header');
      const actions=app.querySelector('.header-actions');
      const rect=e=>e.getBoundingClientRect();
      const inside=e=>{const r=rect(e);if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return false;
        if(r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5)return false;
        for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=rect(p);
          if(/hidden|clip/.test(s.overflowX)&&(r.left<b.left-.5||r.right>b.right+.5))return false;
          if(/hidden|clip/.test(s.overflowY)&&(r.top<b.top-.5||r.bottom>b.bottom+.5))return false;}return true;};
      const tr=rect(title),ar=rect(actions);
      const intersection=Math.max(0,Math.min(tr.right,ar.right)-Math.max(tr.left,ar.left))*Math.max(0,Math.min(tr.bottom,ar.bottom)-Math.max(tr.top,ar.top));
      const range=document.createRange();range.selectNodeContents(title);
      const lineTops=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top));
      const lineHeight=parseFloat(getComputedStyle(title).lineHeight)||parseFloat(getComputedStyle(title).fontSize)*1.2;
      const titleLineCount=Math.max(1,Math.round(tr.height/lineHeight));
      const logos=[...app.querySelectorAll('#internal-utm-logo,#internal-fst-logo')].map(e=>({loaded:e.complete&&e.naturalWidth>0,visible:rect(e).width>0&&rect(e).height>0,insideViewport:inside(e)}));
      const modalBoxes=[...document.querySelectorAll('.pin-modal.show .pin-modal-box,.modal.show .modal-content,.modal.active .modal-content,[role="dialog"][aria-modal="true"]:not(#fst-sidebar)')].filter(e=>rect(e).width>0&&rect(e).height>0&&getComputedStyle(e).visibility!=='hidden');
      const brandTitle=app.querySelector('#fst-brand h1');
      const brandVisible=brandTitle&&rect(brandTitle).width>2&&rect(brandTitle).height>2;
      const brandLineHeight=brandTitle?(parseFloat(getComputedStyle(brandTitle).lineHeight)||24):24;
      const controls=[...header.querySelectorAll('button')].filter(e=>rect(e).width>0&&rect(e).height>0&&getComputedStyle(e).visibility!=='hidden');
      return {titleLineCount,headerOverlapAreaPx2:intersection,headerHeight:rect(header).height,titleWidth:tr.width,rootOverflowPx:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
        essentialControlsInsideViewport:controls.every(inside),modalInsideViewport:modalBoxes.every(inside),modalCount:modalBoxes.length,appTitleLineCount:brandVisible?Math.round(rect(brandTitle).height/brandLineHeight):0,logos,
        navCount:document.querySelectorAll('#fst-sidebar-nav').length,viewport:{width:innerWidth,height:innerHeight}};
    }''')
