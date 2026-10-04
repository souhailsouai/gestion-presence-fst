const assert = require('node:assert/strict');
// Inspect the real emitted menu, not entries synthesized from its configuration.
function navEntries(html) {
  const nav = html.match(/<nav\b[^>]*\bid="fst-sidebar-nav"[^>]*>([\s\S]*?)<\/nav>/i);
  assert.ok(nav, 'Shared navigation block must exist');
  return [...nav[1].matchAll(/<button\b[^>]*\bdata-tab="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi)].map(([,id,body]) => ({
    id, text: body.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  }));
}
const NAV_IDS = ['dashboard','presence','classes','emploi','seances','planning-v16','enseignants','etudiants','rapports','presence-lpc3','administration'];
const NAV_LABELS = ['Tableau de bord','Pr\u00e9sence','Classes & Groupes','Emploi du temps','S\u00e9ances','Planning des s\u00e9ances','Enseignants','\u00c9tudiants','Rapports','LPC3','Administration'];
module.exports = {navEntries,NAV_IDS,NAV_LABELS};
