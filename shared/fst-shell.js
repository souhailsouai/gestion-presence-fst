(function(root){
 'use strict';
 if(root.FSTShell)return;
 const doc=root.document;
 const state={initialized:false,userKey:null,preference:null,mobile:false,config:[],lastFocus:null,scheduled:false};
 const $=id=>doc.getElementById(id);
 const runtimeUser=()=>{try{return typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher||null;}catch(_){return null;}};
 function isAdmin(){
   const u=runtimeUser();if(!u)return false;
   if(root.V21AdminAccess?.isStrictAdminMode)return root.V21AdminAccess.isStrictAdminMode()===true;
   return u.isAdmin===true&&u.activeMode==='admin'&&root.V16ActiveRole?.canUseAdminControls?.()===true;
 }
 function allowed(item){
   if(!runtimeUser()||!$(item.tabId))return false;
   if(item.permission==='lpc3')return root.V30LPC3?.isOwner?.()===true;
   if(item.permission==='admin')return isAdmin();
   return true;
 }
 function routeItem(id){return state.config.find(x=>x.tabId===id);}
 function safeFocus(el){if(el&&el.isConnected&&!el.closest('[inert]'))el.focus({preventScroll:true});}
 function closePanels(restore=true){
   const app=$('app-container');if(!app)return;
   const drawer=app.dataset.drawerOpen==='true';
   const menuOpen=$('fst-user-menu')?.hidden===false;
   app.dataset.drawerOpen='false';$('fst-drawer-backdrop').hidden=true;
   $('fst-sidebar').inert=state.mobile;
   $('fst-sidebar').removeAttribute('aria-modal');$('fst-sidebar').removeAttribute('role');
   $('fst-workspace').inert=false;
   $('fst-user-menu').hidden=true;$('fst-user-toggle').setAttribute('aria-expanded','false');
   $('fst-sidebar-toggle').setAttribute('aria-expanded',state.mobile?'false':String(app.dataset.collapsed!=='true'));
   if(restore&&drawer)safeFocus($('fst-sidebar-toggle'));
   else if(restore&&menuOpen)safeFocus($('fst-user-toggle'));
 }
 function updateActive(id){
   const item=routeItem(id);if(!item)return;
   if($('fst-page-title').textContent!==item.label)$('fst-page-title').textContent=item.label;
   for(const b of $('fst-sidebar-nav').querySelectorAll('[data-tab]')){
     const active=b.dataset.tab===id;b.classList.toggle('active',active);
     if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
   }
 }
 function syncAccess(){
   if(!state.initialized)return;
   const u=runtimeUser();const key=u?[u.id,u.activeMode,u.isAdmin].join('|'):'';
   const changed=state.userKey!==key;
   if(changed){state.userKey=key;closePanels(false);root.V30LPC3?.invalidate?.();}
   for(const item of state.config){
     const button=$('fst-sidebar-nav').querySelector('[data-tab="'+item.tabId+'"]');
     if(!button)continue;
     const ok=allowed(item);button.hidden=!ok;button.style.display=ok?'':'none';button.setAttribute('aria-hidden',String(!ok));
   }
   for(const group of $('fst-sidebar-nav').querySelectorAll('.fst-nav-group'))group.hidden=![...group.querySelectorAll('[data-tab]')].some(b=>!b.hidden);
   const pin=$('admin-pin-button');if(pin){pin.hidden=!isAdmin();pin.style.display=isAdmin()?'':'none';}
   if(u){
     const name=u.name||u.full_name||u.username||'Compte';
     const role=isAdmin()?'Administrateur':'Enseignant';
     if($('current-user-label').textContent!==name)$('current-user-label').textContent=name;
     $('fst-user-role').textContent=role;$('fst-user-full-name').textContent=name+' \u2014 '+role;
     $('fst-user-toggle').setAttribute('aria-label','Mon compte : '+name+', '+role);
   }else{
     $('current-user-label').textContent='';$('fst-user-role').textContent='';$('fst-user-full-name').textContent='';
   }
   const active=$('fst-main').querySelector('.tab-content.active');
   if(active){
     const entry=routeItem(active.id);
     if(u&&entry&&!allowed(entry))activateTab('dashboard');else updateActive(active.id);
   }
   if(changed)root.dispatchEvent(new root.CustomEvent('fst:auth-changed',{detail:{userId:u?.id||null,activeMode:u?.activeMode||null}}));
 }
 function queueSync(){if(state.scheduled)return;state.scheduled=true;root.requestAnimationFrame(()=>{state.scheduled=false;syncAccess();});}
 function installRouter(){
   for(const name of ['switchTab','switchTabProgrammatically']){
     const old=root[name];if(typeof old!=='function'||old.__fstShellGuard)continue;
     const wrapped=function(id){
       const item=routeItem(id);if(!item||!allowed(item))return false;
       const drawerWasOpen=$('app-container').dataset.drawerOpen==='true';
       const result=old.apply(this,arguments);
       if(result!==false){updateActive(id);closePanels(drawerWasOpen);root.dispatchEvent(new root.CustomEvent('fst:tab-activated',{detail:{tabId:id}}));}
       return result;
     };
     wrapped.__fstShellGuard=true;root[name]=wrapped;
   }
 }
 function activateTab(id){
   const item=routeItem(id);if(!item||!allowed(item))return false;
   if(typeof root.switchTab!=='function')return false;
   const result=root.switchTab(id);return result!==false;
 }
 function adjustLayout(){
   const mobile=root.matchMedia('(max-width:767px)').matches;
   const tablet=!mobile&&root.matchMedia('(max-width:1199px)').matches;
   state.mobile=mobile;closePanels(false);
   const app=$('app-container');
   app.dataset.collapsed=String(!mobile&&(state.preference===null?tablet:state.preference));
   const brand=$('fst-brand'),brandHost=$(mobile?'fst-mobile-brand':'fst-sidebar-brand');
   if(brand.parentElement!==brandHost)brandHost.appendChild(brand);
   const quick=doc.querySelector('.fst-quick-actions');
   const host=mobile?$('fst-user-menu'):$('fst-topbar').querySelector('.header-actions');
   if(quick.parentElement!==host){if(mobile)host.insertBefore(quick,host.children[1]||null);else host.insertBefore(quick,host.querySelector('.fst-account'));}
   $('fst-sidebar-toggle').setAttribute('aria-label',mobile?'Ouvrir la navigation':app.dataset.collapsed==='true'?'D\u00e9velopper la navigation':'R\u00e9duire la navigation');
   $('fst-sidebar-toggle').setAttribute('aria-expanded',mobile?'false':String(app.dataset.collapsed!=='true'));
 }
 function toggleSidebar(){
   const app=$('app-container');
   if(state.mobile){
     if(app.dataset.drawerOpen==='true'){closePanels();return;}
     closePanels(false);app.dataset.drawerOpen='true';$('fst-drawer-backdrop').hidden=false;
     $('fst-sidebar').inert=false;$('fst-sidebar').setAttribute('role','dialog');$('fst-sidebar').setAttribute('aria-modal','true');
     $('fst-sidebar-toggle').setAttribute('aria-expanded','true');$('fst-workspace').inert=true;
     safeFocus($('fst-sidebar-nav').querySelector('[data-tab]:not([hidden])'));
   }else{
     state.preference=app.dataset.collapsed!=='true';
     try{root.localStorage.setItem('fst_ui_sidebar_collapsed',String(state.preference));}catch(_){/* Preference storage is optional. */}
     adjustLayout();safeFocus($('fst-sidebar-toggle'));
   }
 }
 function keyboard(event){
   const drawer=$('app-container').dataset.drawerOpen==='true';const menu=!$('fst-user-menu').hidden;
   if(event.key==='Escape'&&(drawer||menu)){event.preventDefault();closePanels();return;}
   if(event.key==='Tab'&&drawer){
     const controls=[...$('fst-sidebar').querySelectorAll('button:not([hidden]),a[href]')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
     const first=controls[0],last=controls.at(-1);
     if(!first)return;
     if(event.shiftKey&&doc.activeElement===first){event.preventDefault();safeFocus(last);}
     else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();safeFocus(first);}
   }
 }
 function init(){
   if(!doc||!$('fst-sidebar-nav'))return;
   if(state.initialized){queueSync();return;}
   state.initialized=true;
   state.config=JSON.parse($('fst-nav-config').textContent).groups.flatMap(g=>g.items);
   try{const p=root.localStorage.getItem('fst_ui_sidebar_collapsed');state.preference=p==='true'?true:p==='false'?false:null;}catch(_){state.preference=null;}
   // Capture before the preserved inline onclick callback and invoke the router once.
   $('fst-sidebar-nav').addEventListener('click',event=>{
     const button=event.target.closest('[data-tab]');if(!button)return;
     event.preventDefault();event.stopImmediatePropagation();activateTab(button.dataset.tab);
   },true);
   $('fst-sidebar-toggle').addEventListener('click',toggleSidebar);
   $('fst-drawer-backdrop').addEventListener('click',()=>closePanels());
   $('fst-user-toggle').addEventListener('click',()=>{
     const menu=$('fst-user-menu');menu.hidden=!menu.hidden;$('fst-user-toggle').setAttribute('aria-expanded',String(!menu.hidden));
     if(!menu.hidden)safeFocus(menu.querySelector('button:not([hidden])'));
   });
   doc.addEventListener('keydown',keyboard);
   doc.addEventListener('click',event=>{if(!$('fst-user-menu').hidden&&!event.target.closest('.fst-account')){$('fst-user-menu').hidden=true;$('fst-user-toggle').setAttribute('aria-expanded','false');}});
   $('fst-user-menu').addEventListener('click',event=>{if(event.target.closest('button')){$('fst-user-menu').hidden=true;$('fst-user-toggle').setAttribute('aria-expanded','false');if($('pin-modal')?.classList.contains('show'))safeFocus($('current-pin'));}});
   for(const query of ['(max-width:767px)','(max-width:1199px)'])root.matchMedia(query).addEventListener('change',adjustLayout);
   root.addEventListener('v16:role-changed',queueSync);
   for(const name of ['doLogin','logoutTeacher','switchAccount','restorePersistentSession']){
     const old=root[name];if(typeof old!=='function')continue;
     root[name]=function(){
       const result=old.apply(this,arguments);
       if(result&&typeof result.then==='function')return result.then(value=>{syncAccess();return value;},error=>{syncAccess();throw error;});
       syncAccess();return result;
     };
   }
   new MutationObserver(queueSync).observe(doc.body,{attributes:true,attributeFilter:['class']});
   new MutationObserver(queueSync).observe($('current-user-label'),{childList:true});
   new MutationObserver(records=>{if(records.some(r=>r.target.classList?.contains('tab-content')))queueSync();}).observe($('fst-main'),{attributes:true,subtree:true,attributeFilter:['class']});
   installRouter();adjustLayout();syncAccess();
   root.openMoreSheet=()=>{if(state.mobile&&$('app-container').dataset.drawerOpen!=='true')toggleSidebar();};
   root.closeMoreSheet=()=>closePanels();root.openAccountSheet=()=>{$('fst-user-toggle').click();};
   root.dispatchEvent(new root.CustomEvent('fst:shell-ready'));
 }
 root.FSTShell={init,syncAccess,activateTab,closePanels};
 if(doc?.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
