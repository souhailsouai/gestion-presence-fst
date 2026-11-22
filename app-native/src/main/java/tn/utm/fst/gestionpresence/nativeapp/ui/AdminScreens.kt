package tn.utm.fst.gestionpresence.nativeapp.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tn.utm.fst.gestionpresence.nativeapp.core.model.Student
import tn.utm.fst.gestionpresence.nativeapp.feature.admin.AdminTools
import tn.utm.fst.gestionpresence.nativeapp.feature.admin.ImportRow
import tn.utm.fst.gestionpresence.nativeapp.feature.admin.Notice
import tn.utm.fst.gestionpresence.nativeapp.feature.admin.ReportPdf
import tn.utm.fst.gestionpresence.nativeapp.feature.admin.TeacherAccount
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainViewModel
import tn.utm.fst.gestionpresence.nativeapp.ui.theme.Uphf
import java.time.LocalDate

@Composable
private fun Box(title: String, subtitle: String? = null, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Uphf.Muted) }
            content()
        }
    }
}

/* -------- Comptes enseignants (administration) -------- */
@Composable
fun AccountsScreen(state: MainUiState, viewModel: MainViewModel) {
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf<List<TeacherAccount>?>(null) }
    var msg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var edit by remember { mutableStateOf<TeacherAccount?>(null) }
    var del by remember { mutableStateOf<TeacherAccount?>(null) }
    fun run(ok: String, block: suspend () -> Unit) = scope.launch {
        try { block(); list = viewModel.admin.teachers(); msg = false to ok } catch (e: CancellationException) { throw e } catch (e: Throwable) { msg = true to (e.message ?: "Opération refusée.") }
    }
    LaunchedEffect(Unit) { runCatching { list = viewModel.admin.teachers() }.onFailure { msg = true to (it.message ?: "Chargement impossible.") } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        msg?.let { (e, m) -> item { Text(m, color = if (e) Uphf.Bad else Uphf.Teal) } }
        val l = list
        if (l == null) item { CircularProgressIndicator(color = Uphf.Teal) }
        else items(l, key = { it.id }) { t ->
            Box(t.fullName, "${t.username}${if (t.email.isNotBlank()) " · ${t.email}" else ""} · ${if (t.role == "admin") "Admin + Enseignant" else "Enseignant"} · ${if (t.state == "disabled") "Désactivé" else "Actif"}") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { edit = t }, shape = RoundedCornerShape(50)) { Text("Modifier") }
                    if (t.id != state.profile?.id) OutlinedButton(onClick = { del = t }, shape = RoundedCornerShape(50)) { Text("Supprimer", color = Uphf.Bad) }
                }
            }
        }
    }
    edit?.let { t ->
        var name by remember { mutableStateOf(t.fullName) }; var user by remember { mutableStateOf(t.username) }; var mail by remember { mutableStateOf(t.email) }
        var active by remember { mutableStateOf(t.state != "disabled") }; var pin by remember { mutableStateOf("") }
        val self = t.id == state.profile?.id
        AlertDialog(onDismissRequest = { edit = null }, title = { Text("Modifier le compte") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Nom complet") }, singleLine = true)
                OutlinedTextField(user, { user = it }, label = { Text("Nom d’utilisateur") }, singleLine = true)
                OutlinedTextField(mail, { mail = it }, label = { Text("Email") }, singleLine = true)
                OutlinedTextField(pin, { if (it.length <= 6) pin = it.filter(Char::isDigit) }, label = { Text("Nouveau PIN (6 chiffres, facultatif)") }, singleLine = true)
                if (!self) Row { FilterChip(active, { active = true }, label = { Text("Actif") }); androidx.compose.foundation.layout.Spacer(Modifier.padding(4.dp)); FilterChip(!active, { active = false }, label = { Text("Désactivé") }) }
            } },
            confirmButton = { TextButton(onClick = { edit = null; run("Compte modifié.") { viewModel.admin.saveTeacher(t, name, user, mail, if (active) "active" else "disabled", pin.ifBlank { null }, self) } }) { Text("Enregistrer") } },
            dismissButton = { TextButton(onClick = { edit = null }) { Text("Annuler") } }, containerColor = Color.White)
    }
    del?.let { t ->
        AlertDialog(onDismissRequest = { del = null }, title = { Text("Supprimer ${t.fullName} ?") },
            text = { Text("Le compte et toutes ses données seront supprimés définitivement. Cette action est irréversible.") },
            confirmButton = { TextButton(onClick = { del = null; run("Compte enseignant supprimé.") { viewModel.admin.deleteTeacher(t.id) } }) { Text("Supprimer", color = Uphf.Bad) } },
            dismissButton = { TextButton(onClick = { del = null }) { Text("Annuler") } }, containerColor = Color.White)
    }
}

/* -------- Rapport PDF filtré -------- */
@Composable
fun ReportPdfScreen(state: MainUiState) {
    val data = state.data ?: return
    val context = LocalContext.current
    val families = remember(data) { data.classes.map { it.name.substringBeforeLast("-G") }.distinct().sorted() }
    var family by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf("") }
    var teacher by rememberSaveable { mutableStateOf("") }
    var from by rememberSaveable { mutableStateOf("") }
    var to by rememberSaveable { mutableStateOf("") }
    var msg by remember { mutableStateOf<String?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Box("Rapport de présence (PDF)", "Résumé par groupe puis détail par étudiant, comme l’onglet Rapports du site.") {
                Text("Classe", fontWeight = FontWeight.Bold)
                Chips(listOf("" to "Toutes") + families.map { it to it }, family) { family = it; group = "" }
                if (family.isNotBlank()) { Text("Groupe", fontWeight = FontWeight.Bold)
                    Chips(listOf("" to "Tous") + data.classes.filter { it.name.startsWith("$family-G") }.sortedBy { it.name }.map { it.id to it.name.substringAfterLast("-") }, group) { group = it } }
                Text("Intervenant", fontWeight = FontWeight.Bold)
                Chips(listOf("" to "Tous") + data.teacherNames.entries.sortedBy { it.value }.map { it.key to it.value.removePrefix("Dr. ") }, teacher) { teacher = it }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(from, { from = it.trim() }, label = { Text("Du (AAAA-MM-JJ)") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(to, { to = it.trim() }, label = { Text("Au") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                val valid = listOf(from, to).all { it.isBlank() || runCatching { LocalDate.parse(it) }.isSuccess }
                Button(enabled = valid, onClick = {
                    msg = null
                    val f = ReportPdf.Filters(family.ifBlank { null }, group.ifBlank { null }, teacher.ifBlank { null }, from.ifBlank { null }, to.ifBlank { null })
                    val file = runCatching { ReportPdf.build(context, data, f) { id -> id?.let { data.teacherNames[it] }.orEmpty() } }.getOrElse { msg = it.message; null }
                    if (file == null) { if (msg == null) msg = "Aucune séance pour ces filtres." } else AdminTools.share(context, file, "application/pdf", "Rapport de présence")
                }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Générer le PDF") }
                msg?.let { Text(it, color = Uphf.Bad) }
            }
        }
    }
}

@Composable
private fun Chips(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(options) { (k, l) -> FilterChip(k == selected, { onSelect(k) }, label = { Text(l) },
            colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White)) }
    }
}

/* -------- Exports administrateur : sauvegarde JSON et CSV des présences -------- */
@Composable
fun AdminExportsPanel(viewModel: MainViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }
    fun go(mime: String, title: String, block: suspend () -> java.io.File) = scope.launch {
        busy = true; msg = null
        try { AdminTools.share(context, block(), mime, title) } catch (e: CancellationException) { throw e } catch (e: Throwable) { msg = "Export impossible : ${e.message}" } finally { busy = false }
    }
    Box("Sauvegardes (administrateur)", "Mêmes fichiers que les boutons de l’onglet Administration du site.") {
        OutlinedButton(onClick = { go("application/json", "Sauvegarde complète") { viewModel.admin.exportJson(context) } }, enabled = !busy, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Sauvegarde complète (JSON)") }
        OutlinedButton(onClick = { go("text/csv", "Toutes les présences") { viewModel.admin.exportCsv(context) } }, enabled = !busy, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Export CSV — toutes les présences") }
        if (busy) Text("Préparation du fichier…", color = Uphf.Muted)
        msg?.let { Text(it, color = Uphf.Bad) }
        Text("La restauration globale reste désactivée, comme sur le site, pour protéger la base.", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
    }
}

/* -------- Avis officiels (accueil) -------- */
@Composable
fun NoticesCard(viewModel: MainViewModel) {
    var list by remember { mutableStateOf<List<Notice>>(emptyList()) }
    LaunchedEffect(Unit) { list = runCatching { viewModel.admin.notices() }.getOrDefault(emptyList()) }
    if (list.isEmpty()) return
    Card(colors = CardDefaults.cardColors(containerColor = Uphf.OchreSoft), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Avis officiels", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
            list.forEach { n ->
                Text(n.title, fontWeight = FontWeight.Bold, color = Uphf.Title)
                Text(n.body.replace(Regex("<[^>]+>"), " ").replace(Regex("\\s+"), " ").trim(), color = Uphf.Text, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

/* -------- Étudiant : modifier / supprimer (administrateur) -------- */
@Composable
fun StudentAdminActions(student: Student, viewModel: MainViewModel, onDeleted: () -> Unit) {
    var edit by remember { mutableStateOf(false) }
    var del by remember { mutableStateOf(false) }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { edit = true }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Modifier") }
        OutlinedButton(onClick = { del = true }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Supprimer", color = Uphf.Bad) }
    }
    if (edit) {
        var last by remember { mutableStateOf(student.lastName) }; var first by remember { mutableStateOf(student.firstName) }; var mail by remember { mutableStateOf(student.email.orEmpty()) }
        AlertDialog(onDismissRequest = { edit = false }, title = { Text("Modifier l’étudiant") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(last, { last = it }, label = { Text("Nom") }, singleLine = true)
                OutlinedTextField(first, { first = it }, label = { Text("Prénom") }, singleLine = true)
                OutlinedTextField(mail, { mail = it }, label = { Text("Email (facultatif)") }, singleLine = true)
                Text("Pour changer de groupe, utilisez « Changer de groupe ».", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
            } },
            confirmButton = { TextButton(onClick = { edit = false; viewModel.s2Action("Étudiant modifié.") { viewModel.admin.updateStudent(student.id, last, first, mail) } }) { Text("Enregistrer") } },
            dismissButton = { TextButton(onClick = { edit = false }) { Text("Annuler") } }, containerColor = Color.White)
    }
    if (del) AlertDialog(onDismissRequest = { del = false }, title = { Text("Suppression définitive") },
        text = { Text("${student.displayName} : les présences, notes, commentaires et appartenances liés seront supprimés. Cette action est irréversible.") },
        confirmButton = { TextButton(onClick = { del = false; viewModel.deleteStudent(student.id); onDeleted() }) { Text("Supprimer", color = Uphf.Bad) } },
        dismissButton = { TextButton(onClick = { del = false }) { Text("Annuler") } }, containerColor = Color.White)
}

/* -------- Import d'étudiants (CSV / Excel) -------- */
@Composable
fun ImportStudentsButton(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var rows by remember { mutableStateOf<List<ImportRow>?>(null) }
    var msg by remember { mutableStateOf<String?>(null) }
    var fallback by remember { mutableStateOf(data.classes.minByOrNull { it.name }?.id.orEmpty()) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val name = uri.lastPathSegment.orEmpty()
        rows = runCatching { viewModel.admin.parseImport(name, context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }) }.getOrElse { msg = "Fichier illisible."; null }
        if (rows?.isEmpty() == true) { msg = "Aucune ligne « Nom ; Prénom ; Email ; Classe/Groupe » trouvée."; rows = null }
    }
    OutlinedButton(onClick = { msg = null; picker.launch(arrayOf("text/*", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream")) },
        shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Importer des étudiants (Excel / CSV)") }
    msg?.let { Text(it, color = Uphf.Muted, style = MaterialTheme.typography.bodySmall) }
    rows?.let { list ->
        val resolve: (String) -> String? = { label -> val l = label.trim().uppercase().replace(" ", ""); data.classes.firstOrNull { it.name.uppercase() == l || it.name.uppercase().endsWith("-$l") }?.id }
        val unknown = list.count { resolve(it.classLabel) == null }
        AlertDialog(onDismissRequest = { rows = null }, title = { Text("${list.size} étudiant(s) à ajouter") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                list.take(6).forEach { Text("• ${it.lastName} ${it.firstName} — ${it.classLabel.ifBlank { "?" }}", style = MaterialTheme.typography.bodySmall) }
                if (list.size > 6) Text("… et ${list.size - 6} autre(s)", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                if (unknown > 0) { Text("$unknown ligne(s) sans classe reconnue : groupe par défaut", color = Uphf.Ochre)
                    Chips(data.classes.sortedBy { it.name }.map { it.id to it.name }, fallback) { fallback = it } }
            } },
            confirmButton = { TextButton(onClick = { rows = null; scope.launch {
                val (ok, errs) = runCatching { viewModel.admin.importStudents(list, resolve, fallback.ifBlank { null }) }.getOrElse { 0 to listOf(it.message ?: "erreur") }
                msg = "$ok étudiant(s) ajouté(s)." + if (errs.isNotEmpty()) " ${errs.size} refus : ${errs.take(3).joinToString(" ; ")}" else ""
                viewModel.reloadData()
            } }) { Text("Importer") } },
            dismissButton = { TextButton(onClick = { rows = null }) { Text("Annuler") } }, containerColor = Color.White)
    }
}


/* -------- Intervenants du S1 par jour et par manipulation (administrateur) -------- */
@Composable
fun S1ConfigScreen(state: MainUiState, viewModel: MainViewModel) {
    val scope = rememberCoroutineScope()
    val teachers = state.data?.teacherNames.orEmpty().entries.sortedBy { it.value }
    var cfg by remember { mutableStateOf<Map<Pair<Int, String>, String>?>(null) }
    var msg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var ask by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { runCatching { cfg = viewModel.admin.s1Config() }.onFailure { msg = true to (it.message ?: "Chargement impossible.") } }
    val days = listOf(1 to "Lundi", 4 to "Jeudi", 5 to "Vendredi")
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Chaque enseignant a une manipulation fixe par jour ; la rotation des groupes se fait automatiquement. Même enregistrement que l’onglet Administration du site.", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall) }
        msg?.let { (e, m) -> item { Text(m, color = if (e) Uphf.Bad else Uphf.Teal) } }
        val c = cfg
        if (c == null) item { CircularProgressIndicator(color = Uphf.Teal) } else {
            days.forEach { (d, label) ->
                item {
                    Box(label) {
                        (1..6).forEach { i -> val code = "M$i"
                            var open by remember { mutableStateOf(false) }
                            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                Text(code, fontWeight = FontWeight.ExtraBold, color = Uphf.Teal, modifier = Modifier.padding(end = 10.dp))
                                androidx.compose.foundation.layout.Box(Modifier.weight(1f)) {
                                    OutlinedButton(onClick = { open = true }, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                                        Text(c[d to code]?.let { id -> teachers.firstOrNull { it.key == id }?.value } ?: "Choisir", color = Uphf.Title)
                                    }
                                    androidx.compose.material3.DropdownMenu(open, { open = false }) {
                                        teachers.forEach { (id, n) -> androidx.compose.material3.DropdownMenuItem(text = { Text(n) }, onClick = { cfg = c + ((d to code) to id); open = false }) }
                                    }
                                }
                            }
                        }
                        val dup = (1..6).mapNotNull { c[d to "M$it"] }.groupBy { it }.filter { it.value.size > 1 }
                        if (dup.isNotEmpty()) Text("Un enseignant a deux manipulations ce jour-là.", color = Uphf.Bad, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            item {
                Button(onClick = { ask = true }, enabled = c.size == 18, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Enregistrer les affectations") }
            }
        }
    }
    if (ask) AlertDialog(onDismissRequest = { ask = false }, title = { Text("Enregistrer les affectations ?") },
        text = { Text("Le planning non encore ouvert sera mis à jour avec ces enseignants. Les séances déjà ouvertes et l’historique de présence ne changent pas.") },
        confirmButton = { TextButton(onClick = { ask = false; scope.launch {
            try { viewModel.admin.saveS1Config(cfg!!); cfg = viewModel.admin.s1Config(); msg = false to "Affectations enregistrées."; viewModel.reloadData() }
            catch (e: CancellationException) { throw e } catch (e: Throwable) { msg = true to (e.message ?: "Enregistrement refusé.") }
        } }) { Text("Enregistrer") } },
        dismissButton = { TextButton(onClick = { ask = false }) { Text("Annuler") } }, containerColor = Color.White)
}

/* -------- Aide -------- */
@Composable
fun HelpScreen() {
    val topics = listOf(
        "Faire l’appel" to "Séances → touchez la séance → choisissez Présent, Absent, Retard ou Justifié pour chaque étudiant (« Tous présents » pour aller vite) → « Enregistrer l’appel ». Touchez le nom d’un étudiant pour ajouter un commentaire ou une note.",
        "Rattrapage" to "Sur une absence enregistrée, touchez « Marquer rattrapé » et choisissez la date : l’absence compte alors comme une présence. On peut l’annuler depuis la fiche de l’étudiant.",
        "Semestres S1 / S2" to "Planning → choisissez le semestre, puis « Par classe » ou « Mes créneaux ». Le S2 commence le 11/01/2027 et se termine le 30/04/2027.",
        "Dates et semaines exclues (S2)" to "Plus → Gestion du S2 → Dates exclues. Touchez une semaine pour l’exclure ; le planning est recalculé automatiquement à partir de cette date. Les séances verrouillées ne bougent pas.",
        "Une case vide n’est pas une absence" to "Seuls les appels enregistrés comptent. Taux de présence = (présents + retards) / appels enregistrés.",
        "Empreinte et rapidité" to "Plus → Connexion par empreinte. « Verrouiller » ferme l’application sans vous déconnecter.",
        "Mises à jour" to "L’application propose elle-même les nouvelles versions (« Mettre à jour »). Plus → Rechercher une mise à jour.",
        "Exports" to "Plus → Exports : Excel du suivi des TP ; Plus → Rapport de présence (PDF) ; Gestion du S2 → Générer & PDF pour le planning.",
        "Besoin d’aide" to "Coordinateur des TP : Souhail Souai — souhail.souai@fst.utm.tn"
    )
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(topics) { (t, b) -> Box(t) { Text(b, color = Uphf.Text) } }
    }
}
