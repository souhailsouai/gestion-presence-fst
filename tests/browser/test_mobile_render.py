import unittest
import test_fst_shell as shell_tests
from fst_shell_harness import measure_layout


class MobileRenderRegression(unittest.TestCase):
    """Actual restored-session and dashboard rendering; no manual logo repair."""
    def restored(self, width=390):
        h=shell_tests.ShellAuthentication.fixture(self,width=width,role='admin',owner=True)
        p=h.page
        # A returning user may never render the login form. Use the production
        # restore function, not the older login_fixture's manual image copy.
        p.evaluate("""async ()=>{
          document.getElementById('auth-overlay').replaceChildren();
          __fstTest.session={user:{id:V30LPC3.OWNER_ID}};
          localStorage.setItem('presence_active_mode','admin');
          await restorePersistentSession();
        }""")
        p.wait_for_function("currentTeacher && document.body.classList.contains('app-active')")
        return h

    def test_logos_load_on_session_restore_without_rendering_login(self):
        for width in [390,1366]:
            with self.subTest(width=width):
                h=self.restored(width);p=h.page
                try:
                    self.assertEqual(p.locator('.institutional-logos').count(),0)
                    p.evaluate("Promise.all([...document.querySelectorAll('#fst-brand img')].map(i=>i.decode().catch(()=>{})))")
                    m=measure_layout(p)
                    self.assertEqual(len(m['logos']),2)
                    self.assertTrue(all(x['loaded'] and x['insideViewport'] for x in m['logos']),m)
                    self.assertEqual(h.errors,[])
                    self.assertEqual(p.evaluate('__fstTest.writes.length'),0)
                finally:
                    h.close();self._cleanups.pop()

    def test_real_summary_cards_remain_styled_after_async_dashboard_load(self):
        h=self.restored();p=h.page
        # Let the actual restore -> renderAll chain finish. V21Dashboard.load
        # itself may be wrapped by the analytics module, so do not replace the
        # application's final asynchronous render with a manually chosen one.
        p.wait_for_function("document.querySelectorAll('#dashboard-stats > .stat-card,#dashboard-stats > .stats-card').length >= 4")
        values=p.evaluate("""()=>{
          const grid=document.getElementById('dashboard-stats');
          const cards=[...grid.querySelectorAll(':scope > .stat-card,:scope > .stats-card')];
          return {display:getComputedStyle(grid).display,cards:cards.map(el=>{
            const n=el.querySelector('.stat-value,.number'),r=el.getBoundingClientRect(),s=getComputedStyle(el);
            return {padding:parseFloat(s.paddingLeft),radius:parseFloat(s.borderRadius),font:parseFloat(getComputedStyle(n).fontSize),inside:r.left>=0&&r.right<=innerWidth};
          })};
        }""")
        self.assertGreaterEqual(len(values['cards']),4,values)
        self.assertEqual(values['display'],'grid',values)
        self.assertTrue(all(x['padding']>=12 and x['radius']>=8 and x['font']>=24 and x['inside'] for x in values['cards']),values)
        self.assertLessEqual(measure_layout(p)['rootOverflowPx'],1)
        self.assertEqual(h.errors,[])
