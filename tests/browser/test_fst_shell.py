import unittest
from fst_shell_harness import Harness,measure_layout

class ShellLayout(unittest.TestCase):
    def test_header_does_not_overlap_and_title_is_at_most_two_lines(self):
        h=Harness();self.addCleanup(h.close);h.login_fixture()
        m=measure_layout(h.page)
        self.assertLessEqual(m['titleLineCount'],2,m)
        self.assertLessEqual(m['headerOverlapAreaPx2'],1,m)
    def test_mobile_logos_are_visible_with_drawer_closed(self):
        h=Harness(390,844);self.addCleanup(h.close);h.login_fixture()
        m=measure_layout(h.page)
        self.assertEqual(len(m['logos']),2)
        self.assertTrue(all(x['loaded'] and x['visible'] and x['insideViewport'] for x in m['logos']),m)


class ShellNavigation(unittest.TestCase):
    def fixture(self,width=390,owner=True,admin=True,mode='admin'):
        h=Harness(width,844 if width<768 else 900);self.addCleanup(h.close)
        h.login_fixture(owner=owner,admin=admin,mode=mode)
        h.page.evaluate('''()=>{
          const owner=V30LPC3.OWNER_ID;
          __fstTest.tables={classes:[{id:'fixture-class',teacher_id:owner,name:'LPC3-G1',module:'TP Ondes et Vibrations'}],
            students:[{id:'fixture-student',class_id:'fixture-class',last_name:'Exemple',first_name:'Test'}],
            sessions:[{id:'fixture-session',class_id:'fixture-class',teacher_id:owner,session_date:'2026-10-05',start_time:'08:30',end_time:'11:30'}],
            session_plans:[{session_id:'fixture-session',manipulation:'M1'}],attendance:[]};
          __fstTest.reads=[];
        }''')
        return h
    def test_single_activation_and_lpc3_lives_inside_main(self):
        h=self.fixture();p=h.page
        p.evaluate('''()=>{window.__navigationCalls=[];const old=window.switchTab;window.switchTab=function(...args){__navigationCalls.push(args[0]);return old.apply(this,args);};}''')
        p.locator('#fst-sidebar-toggle').click()
        p.locator('#lpc3-nav-tab').click()
        p.wait_for_timeout(250)
        self.assertEqual(p.evaluate('__navigationCalls'),['presence-lpc3'])
        self.assertEqual(p.locator('#fst-main #presence-lpc3').count(),1)
        self.assertEqual(p.evaluate("__fstTest.reads.filter(x=>x.table==='classes').length"),1)
        self.assertIn('Exemple',p.locator('#lpc3-students').inner_text())
    def test_owner_and_other_teacher_route_matrix(self):
        for width in [390,1366]:
            for owner,admin,mode in [(True,True,'admin'),(True,True,'teacher'),(False,False,'teacher'),(False,True,'admin')]:
                with self.subTest(width=width,owner=owner,admin=admin,mode=mode):
                    h=self.fixture(width,owner,admin,mode);p=h.page
                    self.assertEqual(p.locator('#lpc3-nav-tab').evaluate('(e)=>e.hidden'),not owner)
                    self.assertEqual(p.locator('#admin-nav-tab').evaluate('(e)=>e.hidden'),not (admin and mode=='admin'))
                    result=p.evaluate("FSTShell.activateTab('presence-lpc3')")
                    self.assertEqual(result,owner)
                    if not owner:
                        self.assertFalse(p.evaluate("window.switchTab('presence-lpc3')"))
                        self.assertFalse(p.locator('#presence-lpc3').evaluate("e=>e.classList.contains('active')"))
                    h.close();self._cleanups.pop()
    def test_repeat_mount_resize_and_escape_restore_focus(self):
        h=self.fixture();p=h.page
        p.evaluate('for(let i=0;i<5;i++)FSTShell.init()')
        self.assertEqual(p.locator('#fst-sidebar-nav').count(),1)
        self.assertEqual(p.locator('.mobile-bottom-nav,.mobile-more-sheet').count(),0)
        p.locator('#fst-sidebar-toggle').click()
        self.assertEqual(p.locator('#fst-sidebar').get_attribute('aria-modal'),'true')
        p.keyboard.press('Escape')
        self.assertEqual(p.evaluate('document.activeElement.id'),'fst-sidebar-toggle')
        p.locator('#fst-sidebar-toggle').click();p.set_viewport_size({'width':1366,'height':900})
        p.wait_for_function("document.getElementById('fst-workspace').inert === false")
        self.assertFalse(p.locator('#fst-workspace').evaluate('(e)=>e.inert'))
        p.set_viewport_size({'width':390,'height':844});p.wait_for_function("document.getElementById('fst-sidebar').inert === true")
        self.assertTrue(p.locator('#fst-sidebar').evaluate('(e)=>e.inert'))
    def test_lpc3_inflight_is_coalesced_and_old_account_response_discarded(self):
        h=self.fixture();p=h.page
        p.evaluate('''()=>{__fstTest.delay=70;__fstTest.reads=[];window.__pendingLoads=[V30LPC3.refresh(),V30LPC3.refresh()];}''')
        p.evaluate('Promise.all(__pendingLoads)')
        self.assertEqual(p.evaluate("__fstTest.reads.filter(x=>x.table==='classes').length"),1)
        p.evaluate('''()=>{__fstTest.delay=80;window.__oldLoad=V30LPC3.refresh();currentTeacher={id:'another-user',isAdmin:false,activeMode:'teacher',name:'Other fixture'};window.currentTeacher=currentTeacher;FSTShell.syncAccess();}''')
        self.assertFalse(p.evaluate('__oldLoad'))
        self.assertEqual(p.evaluate('V30LPC3.state.students.length'),0)
        self.assertNotIn('Exemple',p.locator('#lpc3-students').inner_text())
    def test_read_error_reenables_refresh_and_allows_retry(self):
        h=self.fixture();p=h.page
        p.evaluate('__fstTest.failNext=true')
        self.assertFalse(p.evaluate('V30LPC3.refresh()'))
        self.assertFalse(p.locator('#lpc3-refresh').is_disabled())
        self.assertIn('fixture read failure',p.locator('#lpc3-sheet').inner_text())
        self.assertTrue(p.evaluate('V30LPC3.refresh()'))
        self.assertIn('Exemple',p.locator('#lpc3-students').inner_text())
        self.assertEqual(h.errors,[])
    def test_real_unsaved_lpc3_fields_survive_shell_actions(self):
        h=self.fixture(1366);p=h.page
        p.evaluate("FSTShell.activateTab('presence-lpc3')")
        p.locator('#lpc3-session option[value=fixture-session]').wait_for(state='attached')
        p.locator('#lpc3-session').select_option('fixture-session')
        p.locator('.lpc3-status').wait_for()
        p.locator('.lpc3-status').select_option('retard')
        p.locator('.lpc3-grade').fill('0')
        p.locator('.lpc3-comment').fill('Observation non sauvegardee')
        p.evaluate("window.__inputNodes=[...document.querySelectorAll('.lpc3-status,.lpc3-grade,.lpc3-comment')];__fstTest.writes=[];__fstTest.reads=[]")
        p.locator('#fst-sidebar-toggle').click();p.locator('#fst-user-toggle').click();p.keyboard.press('Escape')
        p.set_viewport_size({'width':390,'height':844});p.wait_for_function("document.getElementById('fst-sidebar').inert === true")
        p.locator('#fst-sidebar-toggle').click();p.keyboard.press('Escape')
        self.assertEqual(p.locator('.lpc3-status').input_value(),'retard')
        self.assertEqual(p.locator('.lpc3-grade').input_value(),'0')
        self.assertEqual(p.locator('.lpc3-comment').input_value(),'Observation non sauvegardee')
        self.assertTrue(p.evaluate("__inputNodes.every(x=>x.isConnected)"))
        self.assertEqual(p.evaluate('__fstTest.writes.length'),0)
        self.assertEqual(p.evaluate('__fstTest.reads.length'),0)
    def test_drawer_tab_loop_and_backdrop_restore_focus(self):
        h=self.fixture();p=h.page
        p.locator('#fst-sidebar-toggle').click()
        visible=p.locator('#fst-sidebar-nav button:visible')
        visible.first.focus();p.keyboard.press('Shift+Tab')
        self.assertTrue(visible.last.evaluate('e=>e===document.activeElement'))
        p.keyboard.press('Tab');self.assertTrue(visible.first.evaluate('e=>e===document.activeElement'))
        p.locator('#fst-drawer-backdrop').click(position={'x':385,'y':400},force=True)
        self.assertEqual(p.evaluate('document.activeElement.id'),'fst-sidebar-toggle')

    def test_failed_lpc3_refresh_never_exports_stale_data(self):
        h=self.fixture(1366);p=h.page
        p.evaluate("FSTShell.activateTab('presence-lpc3')")
        p.locator('#lpc3-session option[value=fixture-session]').wait_for(state='attached')
        p.evaluate("window.__exports=[];FSTV31TrackingXlsx.generate=(...args)=>__exports.push(args);__fstTest.failNext=true")
        p.locator('#v31-lpc3-export [data-v31-export=global]').click()
        p.wait_for_function("document.getElementById('lpc3-refresh').disabled === false")
        self.assertEqual(p.evaluate('__exports.length'),0)

    def test_export_mount_is_idempotent_without_polling(self):
        h=self.fixture(1366);p=h.page
        p.evaluate('for(let i=0;i<4;i++){FSTV31ExportUi.mount();FSTShell.init();}')
        self.assertEqual(p.locator('#v31-mpi-export').count(),1)
        self.assertEqual(p.locator('#v31-lpc3-export').count(),1)
        self.assertEqual(p.locator('#v31-lpc3-export [data-v31-export=global]').count(),1)

    def test_navigation_returns_focus_from_closed_drawer(self):
        h=self.fixture();p=h.page
        p.locator('#fst-sidebar-toggle').click();p.locator('#lpc3-nav-tab').click()
        self.assertEqual(p.evaluate('document.activeElement.id'),'fst-sidebar-toggle')
    def test_pin_modal_receives_focus_from_account_disclosure(self):
        h=self.fixture();p=h.page
        p.locator('#fst-user-toggle').click()
        p.locator('#fst-user-menu [onclick="openPinModal()"] ').click()
        self.assertEqual(p.evaluate('document.activeElement.id'),'current-pin')


class ShellContent(unittest.TestCase):
    def test_nine_viewports_and_breakpoint_edges(self):
        from fst_shell_harness import VIEWPORTS
        h=Harness();self.addCleanup(h.close);h.login_fixture(name='Nom enseignant de test suffisamment long pour une troncature accessible')
        for width,height in VIEWPORTS+[(767,900),(1199,900)]:
            with self.subTest(width=width,height=height):
                h.page.set_viewport_size({'width':width,'height':height})
                h.page.wait_for_timeout(180)
                m=measure_layout(h.page)
                self.assertLessEqual(m['rootOverflowPx'],1,m)
                self.assertLessEqual(m['titleLineCount'],2,m)
                self.assertLessEqual(m['headerOverlapAreaPx2'],1,m)
                self.assertTrue(m['essentialControlsInsideViewport'],m)
                self.assertTrue(all(x['loaded'] and x['visible'] and x['insideViewport'] for x in m['logos']),m)
        self.assertEqual(h.errors,[])
    def test_local_table_scroll_and_reachable_pin_modal(self):
        h=Harness(390,844);self.addCleanup(h.close);h.login_fixture()
        p=h.page
        p.evaluate("""()=>{
          const div=document.createElement('div');div.className='table-responsive';div.id='fixture-wide-table';
          div.innerHTML='<table><thead><tr>'+Array.from({length:12},(_,i)=>'<th>Manipulation '+(i+1)+'</th>').join('')+'</tr></thead><tbody><tr>'+Array.from({length:12},(_,i)=>'<td>Note en fixture '+i+'</td>').join('')+'</tr></tbody></table>';
          document.getElementById('dashboard').appendChild(div);
        }""")
        self.assertLessEqual(measure_layout(p)['rootOverflowPx'],1)
        self.assertTrue(p.locator('#fixture-wide-table').evaluate('(e)=>e.scrollWidth>e.clientWidth'))
        p.locator('#fixture-wide-table').evaluate('(e)=>e.scrollLeft=e.scrollWidth')
        self.assertGreater(p.locator('#fixture-wide-table').evaluate('(e)=>e.scrollLeft'),0)
        p.locator('#fst-user-toggle').click();p.locator('#fst-user-menu [onclick="openPinModal()"] ').click()
        self.assertTrue(p.locator('.pin-modal-box').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}'))
        for i in range(4):p.keyboard.press('Tab')
        self.assertTrue(p.evaluate('!!document.activeElement.closest("#pin-modal")'))
    def test_unsaved_inputs_survive_frame_actions(self):
        h=Harness(1366,900);self.addCleanup(h.close);h.login_fixture()
        p=h.page
        p.evaluate("""()=>{const host=document.getElementById('dashboard');const input=document.createElement('input');input.id='fixture-unsaved';input.value='Texte non enregistre';host.appendChild(input);window.__originalInput=input;__fstTest.writes=[];}""")
        p.locator('#fixture-unsaved').fill('Note manuelle 0 et commentaire non sauvegarde')
        p.locator('#fst-sidebar-toggle').click();p.locator('#fst-user-toggle').click();p.keyboard.press('Escape')
        p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(100)
        self.assertTrue(p.evaluate('document.getElementById("fixture-unsaved")===__originalInput'))
        self.assertEqual(p.locator('#fixture-unsaved').input_value(),'Note manuelle 0 et commentaire non sauvegarde')
        self.assertEqual(p.evaluate('__fstTest.writes.length'),0)
    def test_storage_denied_and_reduced_motion_do_not_break_navigation(self):
        h=Harness(1366,900);self.addCleanup(h.close);h.login_fixture()
        p=h.page;p.emulate_media(reduced_motion='reduce')
        p.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('storage blocked by fixture')}})")
        p.locator('#fst-sidebar-toggle').click()
        self.assertEqual(p.locator('#app-container').get_attribute('data-collapsed'),'true')
        p.set_viewport_size({'width':683,'height':768});p.wait_for_function("document.getElementById('fst-sidebar').inert === true")
        p.locator('#fst-sidebar-toggle').click();p.keyboard.press('Escape')
        self.assertLessEqual(measure_layout(p)['rootOverflowPx'],1)
        self.assertEqual(h.errors,[])

if __name__=='__main__':unittest.main()
