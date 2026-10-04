"""Build the shared frame around existing FST tabs. No business code is rebuilt.

The source HTML and its historical assets stay intact in Git. Only explicitly
identified frame blocks are replaced in the generated deliverable.
"""
from dataclasses import dataclass, field
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import re

VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
@dataclass
class Element:
    tag: str
    attrs: dict
    start: int
    open_end: int
    close_start: int = 0
    end: int = 0
    parent: object = None

class Index(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text=text;self.nodes=[];self.stack=[]
        self.lines=[0]
        self.lines.extend(m.end() for m in re.finditer('\n',text))
        self.feed(text)
    def pos(self):
        line,col=self.getpos();return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        start=self.pos();end=start+len(self.get_starttag_text())
        node=Element(tag,dict(attrs),start,end,parent=self.stack[-1] if self.stack else None)
        self.nodes.append(node)
        if tag in VOID: node.close_start=node.end=end
        else:self.stack.append(node)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:
            n=self.stack.pop();n.close_start=n.end=n.open_end
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i].tag==tag:
                n=self.stack[i];n.close_start=self.pos();n.end=self.text.find('>',self.pos())+1
                del self.stack[i:];break
    def by_id(self,ident):
        matches=[n for n in self.nodes if n.attrs.get('id')==ident]
        if len(matches)!=1:raise ValueError(f'Expected one #{ident}, found {len(matches)}')
        return matches[0]
    def with_class(self,cls,within):
        matches=[n for n in self.nodes if cls in n.attrs.get('class','').split() and n.start>within.start and n.end<=within.end]
        if not matches:raise ValueError('Missing frame class: '+cls)
        return matches[0]

def _replace_ranges(text,replacements):
    for start,end,new in sorted(replacements,reverse=True):text=text[:start]+new+text[end:]
    return text


def _hydrate_brand_logos(brand_html: str, source_html: str) -> str:
    """Reuse the exact existing login logos before any authentication runs.

    A restored session skips renderAuthScreen(), so doLogin() cannot copy images
    from that form. Supplying their original bytes here also avoids network/path
    dependencies in Pages and in the single-file Windows/Web deliverable.
    """
    originals = {'utm': set(), 'fst': set()}
    for match in re.finditer(r'<img\b[^>]*>', source_html):
        node = Index(match.group()).nodes[0]
        classes = node.attrs.get('class', '').split()
        src = node.attrs.get('src', '')
        for key in originals:
            if key + '-logo' in classes and src.startswith('data:image/'):
                originals[key].add(src)
    tree = Index(brand_html)
    replacements = []
    for key, sources in originals.items():
        if len(sources) != 1:
            raise ValueError('Expected one original embedded ' + key.upper() + ' logo')
        node = tree.by_id('internal-' + key + '-logo')
        if not node.attrs.get('src'):
            opening = brand_html[node.start:node.open_end]
            opening = opening[:-1] + ' src="' + escape(next(iter(sources)), quote=True) + '">'
            replacements.append((node.start, node.open_end, opening))
    return _replace_ranges(brand_html, replacements)


def _login_only_css(css):
    """Keep the approved login styling; legacy frame rules no longer affect the app."""
    out=[];pos=0
    while pos<len(css):
        start=css.find('{',pos)
        if start<0:break
        depth=1;end=start+1
        while end<len(css) and depth:
            if css[end]=='{':depth+=1
            elif css[end]=='}':depth-=1
            end+=1
        head=css[pos:start].strip();body=css[start+1:end-1]
        if head.startswith('@media') or head.startswith('@supports'):
            value=_login_only_css(body)
            if value:out.append(head+'{'+value+'}')
        elif head.startswith('@'):
            out.append(head+'{'+body+'}')
        else:
            selectors=[]
            for s in head.split(','):
                s=s.strip()
                if not s:continue
                if s==':root':selectors.append(s)
                elif s.startswith('html'):selectors.append(s.replace('html','html:not(:has(body.app-active))',1))
                elif s.startswith('body'):selectors.append(s.replace('body','body:not(.app-active)',1))
                else:selectors.append('body:not(.app-active) '+s)
            if selectors:out.append(','.join(selectors)+'{'+body+'}')
        pos=end
    return '\n'.join(out)

ICONS={
 'dashboard':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 'check':'<path d="m8 12 3 3 5-6"/><rect x="4" y="3" width="16" height="18" rx="2"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
 'groups':'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/>',
 'teacher':'<path d="M4 4h17v12H11M16 16v5m-4 0h8"/><circle cx="5" cy="12" r="3"/><path d="M1 22v-3a4 4 0 0 1 8 0v3"/>',
 'report':'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h8"/>',
 'wave':'<path d="M2 12h4l2-8 4 16 3-12 2 4h5"/>',
 'settings':'<path d="M12 3 3 7v6c0 4 6 8 9 9 3-1 9-5 9-9V7z"/><path d="m8 12 3 3 5-6"/>',
 'menu':'<path d="M4 6h16M4 12h16M4 18h16"/>',
 'user':'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
 'chevron':'<path d="m8 10 4 4 4-4"/>',
}
def icon(name):
    return '<svg class="fst-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+ICONS[name]+'</svg>'

def _fix_teacher_write_paths(html: str) -> str:
    """Fix legacy teacher write calls without weakening RLS.

    The generated legacy student form requested INSERT ... RETURNING through
    supabase-js (.select('id')), which causes the otherwise-authorized teacher
    insert to fail under RLS. The generated attendance loader also filtered rows
    by legacy attendance.teacher_id instead of trusting session-scoped RLS,
    hiding editable records after teacher reassignment.
    """
    student_pattern = re.compile(
        r"const \{data:inserted,error\}=await supabaseClient\.from\('students'\)\.insert\((\{id,teacher_id:currentTeacher\.id,class_id:classId,last_name:lastname,first_name:firstname,email:email\|\|null\})\)\.select\('id'\);"
    )
    html, student_count = student_pattern.subn(
        r"const {error}=await supabaseClient.from('students').insert(\1);",
        html,
        count=1,
    )
    if student_count != 1:
        raise ValueError('Expected one legacy teacher student INSERT ... RETURNING path')
    html, result_count = re.subn(
        r"if\(error\|\|inserted\?\.length!==1\)return showAlert\('Ajout impossible : '\+\(error\?\.message\|\|'écriture refusée'\),'danger'\);",
        "if(error)return showAlert('Ajout impossible : '+(error?.message||'écriture refusée'),'danger');",
        html,
        count=1,
    )
    if result_count != 1:
        raise ValueError('Expected one legacy student insert result check')

    attendance_filter = "const attendanceQ=isAdmin?supabaseClient.from('attendance').select('*'):supabaseClient.from('attendance').select('*').eq('teacher_id',currentTeacher.id);"
    if html.count(attendance_filter) != 1:
        raise ValueError('Expected one teacher_id-filtered attendance fetch')
    html = html.replace(
        attendance_filter,
        "const attendanceQ=supabaseClient.from('attendance').select('*');",
        1,
    )
    return html


def apply_fst_shell(html: str, *, target: str, root: Path) -> str:
    html = _fix_teacher_write_paths(html)
    if target not in {'pages','online','standalone'}:raise ValueError('Invalid build target')
    if 'data-fst-shell="shared"' in html:
        # Online -> standalone adds inlined business modules. Keep the frame
        # controller last so it wraps the final effective router/auth functions.
        assert html.count('id="fst-sidebar-nav"')==1
        pattern=r'\n?<script data-fst-shell-js="inline">[\s\S]*?</script>\n?'
        matches=list(re.finditer(pattern,html))
        if len(matches)!=1:raise ValueError('Expected one frame controller')
        m=matches[0];block=m.group().strip()
        html=html[:m.start()]+html[m.end():]
        end=html.rfind('</body>')
        if end<0:raise ValueError('Missing document body')
        return html[:end]+'\n'+block+'\n'+html[end:]
    # Programmatic restoration and route guards have no implicit mouse event.
    # Replace only active-button lookup; keep the legacy router's side effects.
    event_lookup = "event.target.closest('.nav-tab').classList.add('active');"
    if html.count(event_lookup) != 1:
        raise ValueError('Expected one legacy active-navigation lookup')
    html = html.replace(event_lookup,
        "document.querySelectorAll('.nav-tab').forEach(button => { "
        "if (button.dataset.tab === tabName) button.classList.add('active'); });", 1)
    root=Path(root)
    registry=json.loads((root/'shared/fst-navigation.json').read_text(encoding='utf-8'))
    # Both historical mobile scripts redefine auth; preserve the last effective
    # definition at exactly its old position before removing their visual code.
    mobile=re.compile(r'<script\b[^>]*(?:data-shared-mobile-v2="js"|data-fst-mobile-js="inline")[^>]*>[\s\S]*?</script>')
    matches=list(mobile.finditer(html))
    if not matches:raise ValueError('No recognized mobile controller; review auth order before building')
    adapter=(root/'shared/fst-auth-compat.js').read_text(encoding='utf-8').strip()
    replacements=[]
    for i,m in enumerate(matches):
        replacements.append((m.start(),m.end(),'<script data-fst-auth-compat="inline">\n'+adapter+'\n</script>' if i==len(matches)-1 else ''))
    html=_replace_ranges(html,replacements)
    # Legacy login layout stays scoped to logged-out state. Remove only known
    # competing application layouts; all other business styles remain.
    replacements=[];login_css=[]
    pattern=r'<style\b([^>]*)>([\s\S]*?)</style>'
    for m in re.finditer(pattern,html):
        attrs=m.group(1)
        if any(k in attrs for k in ['data-shared-mobile-v2','data-fst-mobile-css','data-corrected-html-v3']):
            login_css.append(_login_only_css(m.group(2)));replacements.append((m.start(),m.end(),''))
        elif any(k in attrs for k in ['data-fst-v22-pc-layout-fix','data-fst-v22-flex-clear']):
            replacements.append((m.start(),m.end(),''))
    html=_replace_ranges(html,replacements)
    tree=Index(html);app=tree.by_id('app-container')
    header=tree.with_class('header',app);nav=tree.with_class('nav-tabs',app);content=tree.with_class('content',app)
    brand=tree.with_class('internal-brand-wrap',header)
    brand_html=html[brand.start:brand.end].replace('class="internal-brand-wrap"','id="fst-brand" class="internal-brand-wrap"',1)
    # Preserve the original image bytes and IDs, including on session restore.
    brand_html = _hydrate_brand_logos(brand_html, html)
    # Reserve intrinsic logo boxes before the images finish decoding.
    brand_html=brand_html.replace('class="utm-mini"','class="utm-mini" width="48" height="48"').replace('class="fst-mini"','class="fst-mini" width="80" height="48"')
    def raw(node):return html[node.start:node.end]
    buttons=[n for n in tree.nodes if n.tag=='button' and header.start<n.start<n.end<header.end]
    def command(name):
        found=[n for n in buttons if n.attrs.get('onclick')==name+'()']
        if len(found)!=1:raise ValueError('Expected preserved command '+name)
        return raw(found[0]).replace('<button ','<button type="button" ',1)
    sync=raw(tree.by_id('sync-status'));user=raw(tree.by_id('current-user-pill'))
    nav_buttons=[n for n in tree.nodes if n.tag=='button' and nav.start<n.start<n.end<nav.end]
    original={}
    for n in nav_buttons:
        match=re.search(r"switchTab\(['\"]([^'\"]+)",n.attrs.get('onclick',''))
        if match:original[match[1]]=n
    registered={item['tabId'] for g in registry['groups'] for item in g['items']}
    if set(original)-registered:raise ValueError('Unregistered business tabs: '+str(set(original)-registered))
    menu=[]
    for g in registry['groups']:
        items=[]
        for item in g['items']:
            tid=item['tabId']; old=original.get(tid)
            ident=item.get('id') or (old.attrs.get('id') if old else None)
            attrs=(' id="'+ident+'"') if ident else ''
            if item.get('permission'):attrs+=' hidden'
            active=' active' if tid=='dashboard' else ''
            # The historical onclick attribute is retained for existing selector
            # contracts. A single capturing controller handles UI activation and
            # stops delivery to the inline handler before invoking the router.
            attrs+=' onclick="switchTab(\''+tid+'\')"'
            items.append('<button type="button" class="nav-tab fst-nav-item'+active+'" data-tab="'+tid+'" title="'+escape(item['label'])+'" aria-label="'+escape(item['label'])+'"'+attrs+'>'+icon(item['icon'])+'<span class="fst-nav-label">'+escape(item['label'])+'</span></button>')
        menu.append('<section class="fst-nav-group"><h2 class="fst-nav-group-label">'+escape(g['label'])+'</h2>'+''.join(items)+'</section>')
    sidebar='<aside id="fst-sidebar" aria-label="Navigation principale"><div id="fst-sidebar-brand">'+brand_html+'</div><nav id="fst-sidebar-nav" class="nav-tabs" data-v16-navigation="true">'+''.join(menu)+'</nav></aside>'
    topbar='<header id="fst-topbar"><div id="fst-mobile-brand"></div><div class="fst-heading"><button id="fst-sidebar-toggle" type="button" aria-controls="fst-sidebar" aria-expanded="true" aria-label="R\u00e9duire la navigation">'+icon('menu')+'</button><h2 id="fst-page-title">Tableau de bord</h2></div><div class="header-actions">'+sync+'<div class="fst-quick-actions">'+command('exportData')+command('showHelp')+'</div><div class="fst-account"><button id="fst-user-toggle" type="button" aria-expanded="false" aria-controls="fst-user-menu" aria-label="Mon compte">'+icon('user')+user+'<span id="fst-user-role"></span>'+icon('chevron')+'</button><div id="fst-user-menu" hidden><div id="fst-user-full-name"></div>'+command('openPinModal')+command('setAdminPin')+command('logoutTeacher')+'</div></div></div></header>'
    replacement=sidebar+'<button id="fst-drawer-backdrop" type="button" tabindex="-1" aria-label="Fermer la navigation" hidden></button><div id="fst-workspace">'+topbar
    app_open=html[app.start:app.open_end].replace('class="container"','class="container fst-shell"').replace(' id="app-container"',' id="app-container" data-fst-shell="shared"')
    html=_replace_ranges(html,[(header.start,header.end,replacement),(nav.start,nav.end,''),(content.start,content.open_end,'<main class="content" id="fst-main" tabindex="-1">'),(content.close_start,content.end,'</main></div>'),(app.start,app.open_end,app_open)])
    config='<script type="application/json" id="fst-nav-config">'+json.dumps(registry,ensure_ascii=True).replace('</','<\\/')+'</script>'
    css=(root/'shared/fst-shell.css').read_text(encoding='utf-8')
    js=(root/'shared/fst-shell.js').read_text(encoding='utf-8')
    html=html.replace('</head>','<style data-fst-auth-presentation="inline">\n'+'\n'.join(login_css)+'\n</style>\n<style data-fst-shell-css="inline">\n'+css+'\n</style>\n</head>',1)
    end=html.rfind('</body>')
    if end<0:raise ValueError('Missing document body')
    html=html[:end]+config+'\n<script data-fst-shell-js="inline">\n'+js+'\n</script>\n'+html[end:]
    assert html.count('id="fst-sidebar-nav"')==1
    assert html.count('data-fst-auth-compat="inline"')==1
    assert not mobile.search(html)
    return html
