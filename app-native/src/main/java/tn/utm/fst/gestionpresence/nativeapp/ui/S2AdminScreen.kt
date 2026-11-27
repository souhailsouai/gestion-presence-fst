package tn.utm.fst.gestionpresence.nativeapp.ui

import tn.utm.fst.gestionpresence.nativeapp.feature.s2.groupsOf
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoFixHigh
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainViewModel
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.ClassSlot
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.DAY_LABEL
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.Excluded
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.KIND_LABEL
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2Admin
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2Snapshot
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2_MIN
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.Station
import tn.utm.fst.gestionpresence.nativeapp.feature.s2.Manip
import tn.utm.fst.gestionpresence.nativeapp.ui.theme.Uphf
import java.time.LocalDate

private fun f(d: String) = S2Admin.fmt(d)

@Composable
fun S2AdminScreen(state: tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState, viewModel: MainViewModel) {
    val scope = rememberCoroutineScope()
    var snap by remember { mutableStateOf<S2Snapshot?>(null) }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var tab by rememberSaveable { mutableStateOf("dates") }
    var othersOn by rememberSaveable { mutableStateOf(false) }

    fun run(success: String?, reloadPlan: Boolean, action: suspend () -> String?) {
        scope.launch {
            busy = true
            try {
                val msg = action()
                snap = viewModel.s2.load()
                notice = false to (msg ?: success ?: "Enregistré.")
                if (reloadPlan) viewModel.reloadData()
            } catch (e: CancellationException) { throw e } catch (e: Throwable) {
                notice = true to (e.message ?: "Échec de l’opération.")
            } finally { busy = false }
        }
    }
    // Section choisie en haut de l'application : l'administration S2 s'ouvre sur cet espace, sans les autres.
    val section = state.data?.mySpaces?.singleOrNull()
    LaunchedEffect(section) { if (section != null && viewModel.s2.space != section) { viewModel.s2.openSection(section); snap = null }; run(null, false) { null }; notice = null }

    val s = snap
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val sup = s?.isSuper == true
        // Administrateur de l'espace affiché : super administrateur, administrateur de l'application pour MPI1 · PC1, ou administrateur de l'espace.
        val canAdmin = s != null && (sup || (state.isAdmin && s.space == tn.utm.fst.gestionpresence.nativeapp.feature.s2.DEFAULT_SPACE) || s.myRoles[s.space] == "admin")
        val def = s?.space == tn.utm.fst.gestionpresence.nativeapp.feature.s2.DEFAULT_SPACE
        if (s != null && s.spaces.size > 1) item {
            // Mes espaces par défaut ; « Autres espaces » au choix (lecture seule).
            val mine = s.spaces.filter { it.id in s.myRoles || sup || (state.isAdmin && it.id == tn.utm.fst.gestionpresence.nativeapp.feature.s2.DEFAULT_SPACE) }.map { it.id }.toSet()
            val shown = s.spaces.filter { if (section != null) (it.id == section || (othersOn && it.id !in mine)) else (othersOn || it.id in mine || it.id == s.space) }
            Text("Espace", color = Uphf.Muted, style = MaterialTheme.typography.labelMedium)
            if (shown.size > 1) AdminTabs(shown.map { it.id to (if (it.id in mine) it.name else "${it.name} · lecture") }, s.space) { id -> if (id != s.space) { viewModel.s2.space = id; snap = null; run(null, false) { null } } }
            if (s.spaces.any { it.id !in mine }) TextButton(onClick = {
                othersOn = !othersOn
                if (!othersOn && (s.space !in mine || (section != null && s.space != section))) (section ?: mine.firstOrNull())?.let { id -> viewModel.s2.space = id; snap = null; run(null, false) { null } }
            }) { Text(if (othersOn) "Mes espaces seulement" else "Autres espaces") }
            if (!canAdmin && s.myPerms.isEmpty()) Text("Lecture seule : vous n’administrez pas cet espace.", color = Uphf.Ochre, style = MaterialTheme.typography.bodySmall)
        }
        item {
            val tabs = buildList {
                if (sup) add("acces" to "Rôles et accès")
                if (sup) add("espaces" to "Espaces")
                if (s != null && !def) add("classes" to "Classes & étudiants")
                if (s != null && !def && (canAdmin || "team.edit" in s.myPerms || "accounts.manage" in s.myPerms)) add("equipe" to "Équipe")
                addAll(listOf("dates" to "Dates exclues", "groupes" to "Groupes", "creneaux" to "Créneaux", "postes" to "Enseignants", "manips" to "Manipulations", "planning" to "Générer & PDF", "historique" to "Historique"))
            }
            // Espace consulté sans en être administrateur : planning et PDF, manipulations (lecture).
            // Permissions choisies par le super administrateur : chaque onglet s'ouvre avec la permission correspondante.
            val tabPerm = mapOf("dates" to listOf("planning.settings"), "creneaux" to listOf("planning.settings", "classes.edit"), "groupes" to listOf("groups.edit"),
                "postes" to listOf("planning.stations"), "manips" to listOf("planning.manips"), "planning" to listOf("planning.generate", "planning.sessions"),
                "historique" to listOf("planning.generate"), "classes" to listOf("classes.edit", "students.edit"), "equipe" to listOf("team.edit", "accounts.manage"))
            val mine = s?.myPerms.orEmpty()
            val shownTabs = if (canAdmin) tabs else tabs.filter { it.first in setOf("planning", "manips", "postes") || tabPerm[it.first].orEmpty().any { p -> p in mine } }
            if (shownTabs.none { it.first == tab }) tab = shownTabs.first().first
            AdminTabs(shownTabs, tab) { tab = it }
        }
        notice?.let { (err, msg) ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = if (err) Uphf.BadSoft else Uphf.TealSoft), shape = RoundedCornerShape(24.dp)) {
                    Text(msg, color = Uphf.Title, modifier = Modifier.padding(12.dp))
                }
            }
        }
        if (s == null) {
            item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Uphf.Teal) } }
            return@LazyColumn
        }
        if (busy) item { androidx.compose.material3.LinearProgressIndicator(Modifier.fillMaxWidth(), color = Uphf.Teal, trackColor = Uphf.TealSoft) }
        item {
            Text(
                "S2 du ${f(s.settings.startDate)} au ${s.settings.endDate?.let(::f) ?: "—"} · ${s.sessionCount} séance(s) planifiée(s)",
                color = Uphf.Muted, style = MaterialTheme.typography.bodySmall
            )
        }
        when (tab) {
            "dates" -> { item { ImportCalendarButton(::run, viewModel) }; datesTab(s, ::run, viewModel) }
            "groupes" -> groupsTab(s, ::run, viewModel)
            "creneaux" -> item { SlotsEditor(s) { rows ->
                val moved = rows.filter { r -> s.slots.firstOrNull { it.className == r.className }?.let { it.start != r.start || it.end != r.end } == true }.map { it.className }
                // Nouvel horaire : le serveur l'applique aux séances à venir (planning, appel, PDF) ; on recharge aussi l'accueil.
                run(if (moved.isEmpty()) "Créneaux enregistrés." else "Créneaux enregistrés. Nouvel horaire appliqué aux séances à venir de ${moved.joinToString()}.", moved.isNotEmpty()) { viewModel.s2.saveSlots(rows); null } } }
            "postes" -> {
                item { StationsEditor(s, { day -> viewModel.s2.stationsFromS1(day) }) { rows -> run("Enseignants enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveStations(rows); null } } }
                item { RecapIntervenants(s) { rows -> run("Intervenants enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveStations(rows); null } } }
            }
            "manips" -> item { ManipsEditor(s) { rows -> run("Manipulations enregistrées : les PDF et les cahiers reprennent les nouveaux intitulés.", false) { viewModel.s2.saveManips(rows); null } } }
            "historique" -> item { HistoryPanel(viewModel) }
            "espaces" -> item { SpacesPanel(viewModel) { id -> viewModel.s2.space = id; tab = "classes"; snap = null; run(null, false) { null } } }
            "classes" -> item { ClassesPanel(s, ::run, viewModel) }
            "acces" -> item { AccessPanel(s, viewModel, state.profile?.id) }
            "equipe" -> item { TeamPanel(s.space, viewModel, canTeam = canAdmin || "team.edit" in s.myPerms, canAccounts = canAdmin || "accounts.manage" in s.myPerms) { snap = null; run(null, false) { null } } }
            else -> {
                item {
                    SharePanel(s) { key, mode ->
                        run("Partage enregistré.", true) {
                            viewModel.s2.saveSlots(s.slots.map { if (it.pairKey == key) it.copy(mode = mode) else it })
                            if (s.sessionCount > 0) viewModel.s2.replan(s.settings.startDate, force = false) else null
                        }
                    }
                }
                // Exports : membres de l'espace, administrateurs, ou permission « exports » (pas un simple visiteur d'un autre espace)
                if (canAdmin || "exports" in s.myPerms || s.space in s.myRoles || sup) item { PdfPanel(state, s) }; item { GenerateTab(s, ::run, viewModel) }
            }
        }
        item { Spacer(Modifier.height(30.dp)) }
    }
}

@Composable
private fun AdminTabs(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { (k, l) ->
            FilterChip(
                selected = k == selected, onClick = { onSelect(k) }, label = { Text(l, fontWeight = FontWeight.SemiBold) },
                shape = RoundedCornerShape(50),
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal, labelColor = Uphf.Title)
            )
        }
    }
}

@Composable
private fun Panel(title: String, subtitle: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Uphf.Surface), shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
            subtitle?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Uphf.Muted) }
            HorizontalDivider(color = Uphf.Line)
            content()
        }
    }
}

/* ---------------- Dates et semaines exclues ---------------- */

private data class Week(val n: Int, val mon: String, val sat: String)

private fun weeks(s: S2Snapshot): List<Week> {
    val start = LocalDate.parse(s.settings.startDate)
    val mon = start.minusDays((start.dayOfWeek.value - 1).toLong())
    val end = s.settings.endDate?.let(LocalDate::parse) ?: mon.plusWeeks(17)
    return generateSequence(mon) { it.plusWeeks(1) }.takeWhile { !it.isAfter(end) }.take(30)
        .mapIndexed { i, m -> Week(i + 1, m.toString(), m.plusDays(5).toString()) }.toList()
}

private fun androidx.compose.foundation.lazy.LazyListScope.datesTab(
    s: S2Snapshot,
    run: (String?, Boolean, suspend () -> String?) -> Unit,
    viewModel: MainViewModel
) {
    item {
        Panel("Semaines du S2", "Touchez une semaine pour l’exclure entièrement (lundi → samedi) ou la rétablir. Le planning est recalculé automatiquement.") {
            WeekGrid(s) { w, full ->
                if (full != null && full.startsOn == w.mon && full.endsOn == w.sat) {
                    run("Semaine du ${f(w.mon)} rétablie.", true) { viewModel.s2.deleteExcluded(full.id); null }
                } else if (full == null) {
                    run("Semaine du ${f(w.mon)} exclue.", true) { viewModel.s2.addExcluded(w.mon, w.sat, "Semaine exclue", "autre"); null }
                }
            }
        }
    }
    item { AddExcludedForm(s) { a, b, l, k -> run("Date exclue ajoutée.", true) { viewModel.s2.addExcluded(a, b, l, k); null } } }
    val props = s.excluded.filter { !it.validated }
    if (props.isNotEmpty()) {
        item { Text("À valider (${props.size})", style = MaterialTheme.typography.titleMedium, color = Uphf.Ochre) }
        items(props, key = { it.id }) { x -> ExcludedRow(x, run, viewModel) }
    }
    item { Text("Dates exclues validées", style = MaterialTheme.typography.titleMedium, color = Uphf.Title) }
    val ok = s.excluded.filter { it.validated }
    items(ok, key = { it.id }) { x -> ExcludedRow(x, run, viewModel) }
    if (ok.isEmpty()) item { Text("Aucune pour l’instant.", color = Uphf.Muted) }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun WeekGrid(s: S2Snapshot, onToggle: (Week, Excluded?) -> Unit) {
    val validated = s.excluded.filter { it.validated }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        weeks(s).forEach { w ->
            val full = validated.firstOrNull { it.startsOn <= w.mon && it.endsOn >= w.sat }
            val days = (0..5).count { d -> val day = LocalDate.parse(w.mon).plusDays(d.toLong()).toString(); validated.any { day in it.startsOn..it.endsOn } }
            val pending = s.excluded.any { !it.validated && it.startsOn <= w.sat && it.endsOn >= w.mon }
            val (bg, border, tagColor, tag) = when {
                full != null -> Quad(if (Uphf.dark) Color(0xFF222C34) else Color(0xFFEEF1F4), Uphf.Line, Uphf.Bad, "Exclue")
                days > 0 -> Quad(Uphf.OchreSoft, Color(0xFFDCC8A3), Uphf.Ochre, "$days j exclu${if (days > 1) "s" else ""}")
                pending -> Quad(Uphf.Surface, Color(0xFFDCC8A3), Uphf.Ochre, "À valider")
                else -> Quad(Uphf.Surface, Uphf.Line, Uphf.Teal, "TP")
            }
            Column(
                Modifier.width(104.dp).clip(RoundedCornerShape(10.dp)).background(bg).border(1.5.dp, border, RoundedCornerShape(10.dp))
                    .clickable { onToggle(w, full) }.padding(10.dp)
            ) {
                Text("S${w.n}", fontWeight = FontWeight.Bold, color = if (full != null) Uphf.Muted else Uphf.Title, textDecoration = if (full != null) TextDecoration.LineThrough else null)
                Text("${f(w.mon).take(5)} – ${f(w.sat).take(5)}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                Text(tag.uppercase(), style = MaterialTheme.typography.labelSmall, color = tagColor)
            }
        }
    }
}

private data class Quad(val a: Color, val b: Color, val c: Color, val d: String)

@Composable
private fun ExcludedRow(x: Excluded, run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    var confirm by remember { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = if (x.validated) Uphf.Surface else Uphf.OchreSoft), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (x.startsOn == x.endsOn) f(x.startsOn) else "${f(x.startsOn)} → ${f(x.endsOn)}", fontWeight = FontWeight.Bold, color = Uphf.Title)
                Text(x.label, color = Uphf.Text)
                Text("${KIND_LABEL[x.kind] ?: x.kind} · ${if (x.source == "calendrier") "importée du calendrier" else "saisie"}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
            }
            if (x.validated) TextButton(onClick = { run("Validation retirée.", true) { viewModel.s2.setValidated(x.id, false); null } }) { Text("Retirer", color = Uphf.Muted) }
            else Button(onClick = { run("Date validée.", true) { viewModel.s2.setValidated(x.id, true); null } }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal)) { Text("Valider") }
            IconButton(onClick = { confirm = true }) { Icon(Icons.Default.Delete, "Supprimer", tint = Uphf.Bad) }
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Supprimer cette date ?") },
        text = { Text("« ${x.label} » sera retirée et le planning recalculé.") },
        confirmButton = { TextButton(onClick = { confirm = false; run("Date supprimée.", true) { viewModel.s2.deleteExcluded(x.id); null } }) { Text("Supprimer", color = Uphf.Bad) } },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Annuler") } },
        containerColor = Uphf.Surface
    )
}

@Composable
private fun AddExcludedForm(s: S2Snapshot, onAdd: (String, String, String, String) -> Unit) {
    var from by rememberSaveable { mutableStateOf("") }
    var to by rememberSaveable { mutableStateOf("") }
    var label by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf("vacances") }
    Panel("Ajouter une date ou une période", "Format AAAA-MM-JJ. Laissez « Au » vide pour un seul jour.") {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(from, { from = it.trim() }, label = { Text("Du") }, placeholder = { Text("2027-03-20") }, singleLine = true, modifier = Modifier.weight(1f))
            OutlinedTextField(to, { to = it.trim() }, label = { Text("Au") }, singleLine = true, modifier = Modifier.weight(1f))
        }
        OutlinedTextField(label, { label = it }, label = { Text("Libellé") }, placeholder = { Text("Ex. Vacances de printemps") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(KIND_LABEL.entries.toList()) { (k, l) ->
                FilterChip(k == kind, { kind = k }, label = { Text(l) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Ochre, selectedLabelColor = Uphf.OnTeal))
            }
        }
        val valid = runCatching { LocalDate.parse(from); if (to.isNotBlank()) LocalDate.parse(to); true }.getOrDefault(false) && label.isNotBlank()
        Button(
            onClick = { onAdd(from, to.ifBlank { from }, label, kind); from = ""; to = ""; label = "" },
            enabled = valid, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()
        ) { Text("Ajouter (recalcul automatique)") }
    }
}

/* ---------------- Créneaux des classes ---------------- */

@Composable
private fun SlotsEditor(s: S2Snapshot, onSave: (List<ClassSlot>) -> Unit) {
    val rows = remember(s) { mutableStateListOf<ClassSlot>().apply { addAll(s.slots) } }
    Panel("Créneaux du S2", "Jour, horaires et partage de chaque classe. Deux classes avec le même « groupe de jour » se partagent le créneau.") {
        rows.forEachIndexed { i, c ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Uphf.TealSoft.copy(alpha = 0.5f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(c.className, fontWeight = FontWeight.ExtraBold, color = Uphf.Title, modifier = Modifier.weight(1f))
                    Text("Active", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                    Switch(c.active, { rows[i] = c.copy(active = it) }, colors = SwitchDefaults.colors(checkedTrackColor = Uphf.Teal))
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(DAY_LABEL.entries.toList()) { (d, l) ->
                        FilterChip(c.weekday == d, { rows[i] = c.copy(weekday = d, pairKey = l.lowercase()) }, label = { Text(l.take(3)) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TimeField("Début", c.start, { rows[i] = rows[i].copy(start = it) }, Modifier.weight(1f))
                    TimeField("Fin", c.end, { rows[i] = rows[i].copy(end = it) }, Modifier.weight(1f))
                    OutlinedTextField(c.pairOrder.toString(), { v -> v.toIntOrNull()?.let { rows[i] = c.copy(pairOrder = it.coerceIn(1, 9)) } }, label = { Text("Ordre") }, singleLine = true, modifier = Modifier.weight(0.7f))
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(c.pairKey, { rows[i] = c.copy(pairKey = it.lowercase().take(30)) }, label = { Text("Groupe de jour") }, singleLine = true, modifier = Modifier.weight(1f))
                    FilterChip(c.mode == "alternance", { rows[i] = c.copy(mode = "alternance") }, label = { Text("Alternance") })
                    FilterChip(c.mode == "bloc", { rows[i] = c.copy(mode = "bloc") }, label = { Text("Bloc") })
                }
                // Groupes de la classe = manipulations (rotation complète) : 4, 5 ou 6.
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Groupes / manips", color = Uphf.Text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    val cur = c.groupCount ?: s.settings.groupCount
                    listOf(4, 5, 6).forEach { n ->
                        FilterChip(cur == n, { rows[i] = c.copy(groupCount = n) }, label = { Text("$n") },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
                    }
                }
            }
        }
        // Une classe à 6 groupes a besoin des manipulations M1…M6.
        val have = s.manips.filter { it.active }.map { it.code }.toSet()
        val lack = (1..(rows.maxOfOrNull { it.groupCount ?: s.settings.groupCount } ?: 0)).map { "M$it" }.filter { it !in have }
        if (lack.isNotEmpty()) Text("Ajoutez la manipulation ${lack.joinToString()} (onglet Manipulations).", color = Uphf.Bad)
        val shrink = rows.filter { r -> s.members.any { it.className == r.className && it.status == "actif" && it.groupNo > (r.groupCount ?: s.settings.groupCount) } }.map { it.className }
        if (shrink.isNotEmpty()) Text("Après l’enregistrement, « Équilibrer » les groupes de ${shrink.joinToString()}.", color = Uphf.Ochre)
        val clash = rows.filter { it.active }.groupBy { it.pairKey }.filter { (_, l) -> l.map { it.weekday }.distinct().size > 1 }.keys
        if (clash.isNotEmpty()) Text("Attention : « ${clash.joinToString()} » regroupe des classes de jours différents.", color = Uphf.Bad)
        Button(onClick = { onSave(rows.toList()) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les créneaux")
        }
    }
}

/* ---------------- Enseignants par jour et manipulation ---------------- */

@Composable
private fun StationsEditor(s: S2Snapshot, fromS1: suspend (Int) -> List<Station>, onSave: (List<Station>) -> Unit) {
    val scope = rememberCoroutineScope()
    var info by remember { mutableStateOf<String?>(null) }
    val days = s.slots.filter { it.active }.map { it.weekday }.distinct().sorted().ifEmpty { listOf(1, 4, 5) }
    var day by rememberSaveable { mutableStateOf(days.first()) }
    val edits = remember(s) { mutableStateListOf<Station>().apply { addAll(s.stations) } }
    Panel("Enseignants du S2", "Chaque enseignant garde sa manipulation : la rotation des groupes se fait automatiquement.") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(days) { d ->
                FilterChip(d == day, { day = d }, label = { Text(DAY_LABEL[d] ?: "") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
            }
        }
        s.manips.filter { it.active }.forEach { m ->
            val st = edits.firstOrNull { it.weekday == day && it.code == m.code } ?: Station(day, m.code, null, null)
            var open by remember(day, m.code) { mutableStateOf(false) }
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Uphf.TealSoft.copy(alpha = 0.5f)).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(m.code, fontWeight = FontWeight.ExtraBold, color = Uphf.Teal, modifier = Modifier.width(36.dp))
                Box(Modifier.weight(1f)) {
                    OutlinedButton(onClick = { open = true }, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                        Text(s.teachers.firstOrNull { it.id == st.teacherId }?.name ?: "Choisir l’enseignant", color = if (st.teacherId == null) Uphf.Muted else Uphf.Title, maxLines = 1)
                    }
                    DropdownMenu(open, { open = false }) {
                        DropdownMenuItem(text = { Text("— Aucun —") }, onClick = { open = false; upsert(edits, st.copy(teacherId = null)) })
                        s.teachers.forEach { t -> DropdownMenuItem(text = { Text(t.name) }, onClick = { open = false; upsert(edits, st.copy(teacherId = t.id)) }) }
                    }
                }
                Spacer(Modifier.width(8.dp))
                OutlinedTextField(st.room ?: m.room.orEmpty(), { upsert(edits, st.copy(room = it)) }, label = { Text("Salle") }, singleLine = true, modifier = Modifier.width(84.dp))
            }
        }
        val dup = edits.filter { it.weekday == day && it.teacherId != null }.groupBy { it.teacherId }.filter { it.value.size > 1 }
        if (dup.isNotEmpty()) Text("Attention : un enseignant est affecté à plusieurs manipulations le ${DAY_LABEL[day]}.", color = Uphf.Bad)
        info?.let { Text(it, color = Uphf.Teal, style = MaterialTheme.typography.bodySmall) }
        OutlinedButton(onClick = {
            scope.launch {
                info = runCatching { fromS1(day) }.fold({ sug ->
                    sug.forEach { x -> val cur = edits.firstOrNull { it.weekday == x.weekday && it.code == x.code }; upsert(edits, (cur ?: x).copy(teacherId = x.teacherId)) }
                    if (sug.isEmpty()) "Rien à reprendre pour ce jour." else "Enseignants du S1 repris pour le ${DAY_LABEL[day]?.lowercase()} : vérifiez puis enregistrez."
                }, { "Reprise impossible : ${it.message}" })
            }
        }, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Reprendre ceux du S1") }
        Button(onClick = { onSave(edits.toList()) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les enseignants")
        }
    }
}

/** « Intervenants par jour » (comme au S1) : une ligne par enseignant, une colonne par jour, sa manipulation. */
@Composable
private fun RecapIntervenants(s: S2Snapshot, onSave: (List<Station>) -> Unit) {
    val days = s.slots.filter { it.active }.map { it.weekday }.distinct().sorted().ifEmpty { listOf(1, 4, 5) }
    val codes = s.manips.filter { it.active }.map { it.code }
    // choix[enseignant to jour] = code de la manipulation
    val pick = remember(s) { mutableStateMapOf<Pair<String, Int>, String>().apply { s.stations.forEach { st -> st.teacherId?.let { put(it to st.weekday, st.code) } } } }
    var err by remember { mutableStateOf<String?>(null) }
    Panel("Intervenants par jour", "Comme au S1 : la manipulation de chaque enseignant, jour par jour. Touchez une case pour la changer.") {
        val missing = days.flatMap { d -> codes.filter { c -> pick.none { it.key.second == d && it.value == c } }.map { "${DAY_LABEL[d]} $it" } }
        Text(if (missing.isEmpty()) "Toutes les manipulations ont un enseignant." else "Sans enseignant : ${missing.joinToString(", ")}", color = if (missing.isEmpty()) Uphf.Teal else Uphf.Ochre, style = MaterialTheme.typography.bodySmall)
        Row(Modifier.fillMaxWidth()) {
            Text("Intervenant", fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.weight(1.6f))
            days.forEach { d -> Text(DAY_LABEL[d].orEmpty(), fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.weight(1f)) }
        }
        s.teachers.sortedBy { it.name }.forEach { t ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(t.name, color = Uphf.Text, style = MaterialTheme.typography.bodySmall, maxLines = 2, modifier = Modifier.weight(1.6f))
                days.forEach { d ->
                    var open by remember(t.id, d) { mutableStateOf(false) }
                    Box(Modifier.weight(1f).padding(2.dp)) {
                        val cur = pick[t.id to d]
                        OutlinedButton(onClick = { open = true }, shape = RoundedCornerShape(8.dp), contentPadding = PaddingValues(horizontal = 4.dp), modifier = Modifier.fillMaxWidth()) {
                            Text(cur ?: "—", color = if (cur == null) Uphf.Muted else Uphf.Teal, fontWeight = FontWeight.Bold)
                        }
                        DropdownMenu(open, { open = false }) {
                            DropdownMenuItem(text = { Text("—") }, onClick = { open = false; pick.remove(t.id to d) })
                            codes.forEach { c -> DropdownMenuItem(text = { Text(c + (s.manips.firstOrNull { it.code == c }?.title?.let { " — $it" } ?: "")) }, onClick = { open = false; pick[t.id to d] = c }) }
                        }
                    }
                }
            }
        }
        err?.let { Text(it, color = Uphf.Bad) }
        Button(onClick = {
            val dup = days.flatMap { d -> codes.mapNotNull { c -> pick.count { it.key.second == d && it.value == c }.takeIf { it > 1 }?.let { "${DAY_LABEL[d]} $c" } } }
            if (dup.isNotEmpty()) { err = "Une manipulation ne peut avoir qu’un enseignant par jour : ${dup.joinToString(", ")}"; return@Button }
            err = null
            onSave(days.flatMap { d -> codes.map { c ->
                val old = s.stations.firstOrNull { it.weekday == d && it.code == c }
                Station(d, c, pick.entries.firstOrNull { it.key.second == d && it.value == c }?.key?.first, old?.room)
            } })
        }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les intervenants")
        }
    }
}

/** Onglet « Manipulations » : intitulé (repris dans les PDF et les cahiers), salle par défaut, active. */
@Composable
private fun ManipsEditor(s: S2Snapshot, onSave: (List<Manip>) -> Unit) {
    val edits = remember(s) { mutableStateListOf<Manip>().apply { addAll(s.manips) } }
    Panel("Manipulations du S2", "Donnez un nom à chaque manipulation : il apparaît dans le planning PDF et le cahier de présence.") {
        edits.forEachIndexed { i, m ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Uphf.TealSoft.copy(alpha = 0.5f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(m.code, fontWeight = FontWeight.ExtraBold, color = Uphf.Teal, modifier = Modifier.width(40.dp))
                    OutlinedTextField(m.title.orEmpty(), { edits[i] = m.copy(title = it.take(120)) }, label = { Text("Intitulé") }, placeholder = { Text("ex. Prisme") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(m.room.orEmpty(), { edits[i] = m.copy(room = it.take(40)) }, label = { Text("Salle par défaut") }, singleLine = true, modifier = Modifier.weight(1f))
                    FilterChip(m.active, { edits[i] = m.copy(active = !m.active) }, label = { Text(if (m.active) "Active" else "Inactive") },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
                }
            }
        }
        Button(onClick = { onSave(edits.toList()) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les manipulations")
        }
    }
}

private val ACTION = mapOf("replace_plan" to "Planning généré / recalculé", "save_version" to "Version enregistrée", "restore_version" to "Version restaurée", "init_groups" to "Groupes préparés",
    "balance" to "Groupes équilibrés", "move_student" to "Étudiant déplacé", "edit_student" to "Étudiant modifié", "reintegrate_student" to "Étudiant réintégré", "stations" to "Enseignants enregistrés",
    "manips" to "Manipulations enregistrées", "settings" to "Paramètres modifiés", "class_slots" to "Créneaux modifiés", "add_excluded" to "Date exclue ajoutée", "validate_excluded" to "Date validée",
    "delete_excluded" to "Date supprimée", "import_calendar" to "Calendrier importé")

/** Onglet « Historique » : les 30 dernières actions sur le S2 (site et application). */
@Composable
private fun HistoryPanel(viewModel: MainViewModel) {
    var list by remember { mutableStateOf<List<Pair<String, String>>?>(null) }
    LaunchedEffect(Unit) { list = runCatching { viewModel.s2.history() }.getOrDefault(emptyList()) }
    Panel("Historique", "Les 30 dernières modifications du S2.") {
        val l = list
        if (l == null) CircularProgressIndicator(color = Uphf.Teal)
        else if (l.isEmpty()) Text("Rien pour le moment.", color = Uphf.Muted)
        else l.forEach { (a, at) ->
            val dt = runCatching { java.time.OffsetDateTime.parse(at).atZoneSameInstant(java.time.ZoneId.systemDefault()) }.getOrNull()
            Row(Modifier.fillMaxWidth()) {
                Text(ACTION[a] ?: a, color = Uphf.Title, modifier = Modifier.weight(1f))
                Text(dt?.let { "%02d/%02d %02d:%02d".format(it.dayOfMonth, it.monthValue, it.hour, it.minute) } ?: "", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

private fun upsert(list: MutableList<Station>, st: Station) {
    val i = list.indexOfFirst { it.weekday == st.weekday && it.code == st.code }
    if (i >= 0) list[i] = st else list.add(st)
}

/* ---------------- Génération, fin du S2, versions ---------------- */

@Composable
private fun GenerateTab(s: S2Snapshot, run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    var from by rememberSaveable { mutableStateOf(maxOf(S2_MIN, s.settings.startDate)) }
    var end by rememberSaveable { mutableStateOf(s.settings.endDate.orEmpty()) }
    var confirmGen by remember { mutableStateOf(false) }
    var restore by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Panel("Générer ou recalculer le planning", "Les séances verrouillées et déjà passées sont conservées. Une sauvegarde est faite avant.") {
            if (s.stations.none { it.teacherId != null }) Text("Aucun enseignant n’est encore affecté (onglet « Enseignants »).", color = Uphf.Ochre)
            OutlinedTextField(from, { from = it.trim() }, label = { Text("À partir du (AAAA-MM-JJ)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = { confirmGen = true }, enabled = runCatching { LocalDate.parse(from); true }.getOrDefault(false),
                shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.AutoFixHigh, null); Spacer(Modifier.width(8.dp)); Text(if (s.sessionCount == 0) "Générer le planning" else "Recalculer à partir de cette date")
            }
        }
        Panel("Paramètres du semestre 2", "Comme l’onglet « Paramètres » du site. Pensez à recalculer le planning après un changement.") {
            var start by rememberSaveable { mutableStateOf(s.settings.startDate) }
            var groups by rememberSaveable { mutableStateOf(s.settings.groupCount.toString()) }
            var mcount by rememberSaveable { mutableStateOf(s.settings.manipCount.toString()) }
            OutlinedTextField(start, { start = it.trim() }, label = { Text("Début du S2 (AAAA-MM-JJ, au plus tôt 2027-01-11)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(end, { end = it.trim() }, label = { Text("Dernier jour (AAAA-MM-JJ, facultatif)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(groups, { groups = it.filter(Char::isDigit).take(2) }, label = { Text("Groupes") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(mcount, { mcount = it.filter(Char::isDigit).take(1) }, label = { Text("Manipulations") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            OutlinedButton(onClick = { run("Paramètres du S2 enregistrés.", false) { viewModel.s2.saveSettingsFull(start, end.ifBlank { null }, groups.toIntOrNull() ?: 0, mcount.toIntOrNull() ?: 0); null } },
                shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Enregistrer les paramètres") }
        }
        Panel("Versions", "Revenir à un planning enregistré.") {
            OutlinedButton(onClick = { run("Version enregistrée.", false) { viewModel.s2.saveVersion("Version du ${f(LocalDate.now().toString())} (application)"); null } },
                shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Bookmark, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer une version") }
            s.versions.take(10).forEach { v ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(v.label, color = Uphf.Title, fontWeight = FontWeight.SemiBold)
                        Text(v.createdAt.take(16).replace('T', ' '), style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                    }
                    IconButton(onClick = { restore = v.id }) { Icon(Icons.Default.Restore, "Restaurer", tint = Uphf.Teal) }
                }
            }
            if (s.versions.isEmpty()) Text("Aucune version.", color = Uphf.Muted)
        }
    }
    if (confirmGen) AlertDialog(
        onDismissRequest = { confirmGen = false },
        title = { Text(if (s.sessionCount == 0) "Générer le planning ?" else "Recalculer le planning ?") },
        text = { Text("À partir du ${f(from)}. Les dates exclues validées sont évitées, rien n’est placé après la fin du S2.") },
        confirmButton = { TextButton(onClick = { confirmGen = false; run(null, true) { viewModel.s2.replan(from, force = true) } }) { Text("Continuer") } },
        dismissButton = { TextButton(onClick = { confirmGen = false }) { Text("Annuler") } },
        containerColor = Uphf.Surface
    )
    restore?.let { id ->
        AlertDialog(
            onDismissRequest = { restore = null },
            title = { Text("Restaurer cette version ?") },
            text = { Text("Le planning actuel sera remplacé par celui de la version choisie.") },
            confirmButton = { TextButton(onClick = { restore = null; run("Version restaurée.", true) { viewModel.s2.restoreVersion(id); null } }) { Text("Restaurer") } },
            dismissButton = { TextButton(onClick = { restore = null }) { Text("Annuler") } },
            containerColor = Uphf.Surface
        )
    }
}


/* ---------------- Import du calendrier Excel ---------------- */

@Composable
private fun ImportCalendarButton(run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var found by remember { mutableStateOf<Pair<String, List<Excluded>>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val picker = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        error = null
        val name = uri.lastPathSegment?.substringAfterLast('/') ?: "calendrier.xlsx"
        val rows = runCatching { context.contentResolver.openInputStream(uri)!!.use { tn.utm.fst.gestionpresence.nativeapp.feature.s2.CalendarImport.parse(it) } }
            .getOrElse { error = "Fichier illisible : choisissez un fichier Excel .xlsx."; return@rememberLauncherForActivityResult }
        if (rows.isEmpty()) error = "Aucune date du S2 reconnue dans « $name »." else found = name to rows
    }
    OutlinedButton(onClick = { picker.launch(arrayOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream")) },
        shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Importer un calendrier Excel (.xlsx)") }
    error?.let { Text(it, color = Uphf.Bad) }
    found?.let { (name, rows) ->
        AlertDialog(
            onDismissRequest = { found = null },
            title = { Text("${rows.size} proposition(s) trouvée(s)") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Elles seront ajoutées « à valider » : rien ne change dans le planning tant que vous ne les validez pas.", color = Uphf.Text)
                    rows.take(8).forEach { r -> Text("• ${f(r.startsOn)}${if (r.endsOn != r.startsOn) " → " + f(r.endsOn) else ""} : ${r.label.take(60)}", style = MaterialTheme.typography.bodySmall) }
                    if (rows.size > 8) Text("… et ${rows.size - 8} autre(s)", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                }
            },
            confirmButton = { TextButton(onClick = { found = null; run("${rows.size} proposition(s) importée(s) — à valider.", false) { viewModel.s2.importProposals(rows, name); null } }) { Text("Importer") } },
            dismissButton = { TextButton(onClick = { found = null }) { Text("Annuler") } },
            containerColor = Uphf.Surface
        )
    }
}

/* ---------------- Groupes du S2 ---------------- */

/** Classes S2 de l'espace affiché (créneaux actifs). */
private fun s2Classes(s: S2Snapshot) = s.slots.filter { it.active }.map { it.className }.sorted()

private fun androidx.compose.foundation.lazy.LazyListScope.groupsTab(
    s: S2Snapshot,
    run: (String?, Boolean, suspend () -> String?) -> Unit,
    viewModel: MainViewModel
) {
    if (s.members.isEmpty()) {
        item {
            Panel("Groupes S2 pas encore préparés", "La préparation reprend les groupes du S1, met de côté les étudiants absents à toutes les séances du S1 (réintégrables) et équilibre les groupes sur les présents.") {
                var ask by remember { mutableStateOf(false) }
                Button(onClick = { ask = true }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Préparer les groupes S2") }
                if (ask) AlertDialog(onDismissRequest = { ask = false }, title = { Text("Préparer les groupes S2 ?") },
                    text = { Text("Les groupes seront créés à partir du S1 puis équilibrés. Vous pourrez ensuite tout ajuster.") },
                    confirmButton = { TextButton(onClick = { ask = false; run(null, false) { "${viewModel.s2.initGroups { s.groupsOf(it) }} étudiant(s) répartis." } }) { Text("Préparer") } },
                    dismissButton = { TextButton(onClick = { ask = false }) { Text("Annuler") } }, containerColor = Uphf.Surface)
            }
        }
        return
    }
    item { GroupsPanel(s, run, viewModel) }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun GroupsPanel(s: S2Snapshot, run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    var cls by rememberSaveable(s.space) { mutableStateOf(s2Classes(s).firstOrNull().orEmpty()) }
    if (cls !in s2Classes(s)) cls = s2Classes(s).firstOrNull().orEmpty()
    var edit by remember { mutableStateOf<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Member?>(null) }
    var preview by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Move>?>(null) }
    var applyAsk by remember { mutableStateOf(false) }
    val G = s.groupsOf(cls)
    val ms = s.members.filter { it.className == cls }
    val act = ms.filter { it.status == "actif" }; val exc = ms.filter { it.status == "exclu" }
    val sizes = (1..G).map { g -> act.count { it.groupNo == g } }
    val gap = (sizes.maxOrNull() ?: 0) - (sizes.minOrNull() ?: 0)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AdminTabs(s2Classes(s).map { it to "$it · ${s.members.count { m -> m.className == it && m.status == "actif" }}" }, cls) { cls = it }
        Panel(if (gap <= 1) "Groupes équilibrés" else "Écart de $gap étudiants", "${act.size} présent(s) répartis · ${exc.size} mis de côté") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                sizes.forEachIndexed { i, n ->
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(Uphf.TealSoft).padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("G${i + 1}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted); Text("$n", fontWeight = FontWeight.ExtraBold, color = Uphf.Title)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { preview = tn.utm.fst.gestionpresence.nativeapp.feature.s2.balanceMoves(ms, G) }, enabled = gap > 1 || act.any { it.groupNo !in 1..G }, shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("Équilibrer") }
                OutlinedButton(onClick = { run(null, false) { val n = viewModel.s2.addNewMembers(s.members.map { it.studentId }.toSet()); if (n == 0) "Aucun nouvel étudiant." else "$n étudiant(s) ajouté(s)." } },
                    shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Nouveaux") }
            }
            // PDF des groupes : une page par classe (même modèle que le site)
            val ctx = androidx.compose.ui.platform.LocalContext.current
            val share = { list: List<String> -> tn.utm.fst.gestionpresence.nativeapp.feature.s2.GroupsPdf.build(ctx, s, list, s.spaces.firstOrNull { it.id == s.space }?.name ?: "MPI1 · PC1")?.let { tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.share(ctx, it) } }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { share(listOf(cls)) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("PDF des groupes") }
                OutlinedButton(onClick = { share(s2Classes(s)) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Toutes les classes") }
            }
        }
        (1..G).forEach { g ->
            val list = act.filter { it.groupNo == g }.sortedBy { it.name }
            Panel("G$g · ${list.size} étudiant(s)") {
                list.forEach { m ->
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable { edit = m }.padding(vertical = 8.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(m.name, color = Uphf.Title, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        if (m.locked) Text("verrouillé", style = MaterialTheme.typography.bodySmall, color = Uphf.Ochre)
                    }
                }
                if (list.isEmpty()) Text("—", color = Uphf.Muted)
            }
        }
        if (exc.isNotEmpty()) Panel("Mis de côté pour le S2 (${exc.size})") {
            exc.forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(m.name, color = Uphf.Title, fontWeight = FontWeight.SemiBold); Text("G${m.groupNo} au S1 · ${m.reason.orEmpty()}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted) }
                    TextButton(onClick = { run("${m.name} réintégré(e).", false) { viewModel.s2.updateMember(m.studentId, kotlinx.serialization.json.buildJsonObject { put("status", kotlinx.serialization.json.JsonPrimitive("actif")); put("reason", kotlinx.serialization.json.JsonNull) }, "reintegrate_student"); null } }) { Text("Réintégrer") }
                }
            }
        }
        if (LocalDate.now().toString() > "2026-12-11") {
            OutlinedButton(onClick = { applyAsk = true }, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Appliquer aux listes de présence") }
        } else Text("Application aux listes de présence possible après le 11/12/2026.", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
    }
    preview?.let { moves ->
        AlertDialog(onDismissRequest = { preview = null }, title = { Text("${moves.size} déplacement(s) dans $cls") },
            text = { Column { Text("Présents seulement ; les étudiants verrouillés ne bougent pas.", color = Uphf.Text); moves.forEach { Text("• ${it.name} : G${it.from} → G${it.to}", style = MaterialTheme.typography.bodySmall) } } },
            confirmButton = { TextButton(onClick = { preview = null; run("$cls équilibrée (${moves.size} déplacement(s)).", false) { viewModel.s2.applyBalance(cls, moves); null } }) { Text("Appliquer") } },
            dismissButton = { TextButton(onClick = { preview = null }) { Text("Annuler") } }, containerColor = Uphf.Surface)
    }
    edit?.let { m -> MemberDialog(m, G, sizes, onDismiss = { edit = null }) { patch, label -> edit = null; run(label, false) { viewModel.s2.updateMember(m.studentId, patch, "edit_student"); null } } }
    if (applyAsk) AlertDialog(onDismissRequest = { applyAsk = false }, title = { Text("Appliquer les groupes S2 ?") },
        text = { Text("Les étudiants changeront de groupe dans les listes de présence. Les présences du S1 restent attachées à leurs séances.") },
        confirmButton = { TextButton(onClick = { applyAsk = false; run(null, true) { "${viewModel.s2.applyGroupsToLists(s.members)} étudiant(s) déplacé(s) dans les listes." } }) { Text("Appliquer") } },
        dismissButton = { TextButton(onClick = { applyAsk = false }) { Text("Annuler") } }, containerColor = Uphf.Surface)
}

@Composable
private fun MemberDialog(m: tn.utm.fst.gestionpresence.nativeapp.feature.s2.Member, G: Int, sizes: List<Int>, onDismiss: () -> Unit, onSave: (kotlinx.serialization.json.JsonObject, String) -> Unit) {
    var g by remember { mutableStateOf(m.groupNo) }
    var locked by remember { mutableStateOf(m.locked) }
    var aside by remember { mutableStateOf(false) }
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(m.name) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Groupe", fontWeight = FontWeight.Bold)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items((1..G).toList()) { x -> FilterChip(g == x, { g = x }, label = { Text("G$x (${sizes.getOrElse(x - 1) { 0 }})") },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal)) }
                }
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Verrouiller dans ce groupe", modifier = Modifier.weight(1f)); Switch(locked, { locked = it }) }
                Row(verticalAlignment = Alignment.CenterVertically) { Text("Mettre de côté pour le S2", modifier = Modifier.weight(1f)); Switch(aside, { aside = it }) }
                if (aside) OutlinedTextField(reason, { reason = it.take(200) }, label = { Text("Motif") }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val patch = kotlinx.serialization.json.buildJsonObject {
                    put("group_no", kotlinx.serialization.json.JsonPrimitive(g)); put("locked", kotlinx.serialization.json.JsonPrimitive(locked || g != m.groupNo))
                    if (aside) { put("status", kotlinx.serialization.json.JsonPrimitive("exclu")); put("reason", kotlinx.serialization.json.JsonPrimitive(reason.ifBlank { "Mis de côté manuellement" })) }
                }
                onSave(patch, if (aside) "Étudiant mis de côté." else if (g != m.groupNo) "Déplacé en G$g." else "Enregistré.")
            }) { Text("Enregistrer") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
        containerColor = Uphf.Surface
    )
}

/* ---------------- Partage d'un jour entre deux classes ---------------- */

/** Classes actives qui partagent un jour, triées par jour puis par ordre. */
internal fun sharePairs(s: S2Snapshot): List<Pair<String, List<ClassSlot>>> =
    s.slots.filter { it.active }.groupBy { it.pairKey }
        .map { (k, l) -> k to l.sortedWith(compareBy<ClassSlot>({ it.pairOrder }, { it.className })) }
        .sortedBy { it.second.first().weekday }

@Composable
private fun SharePanel(s: S2Snapshot, onChoose: (String, String) -> Unit) {
    val pairs = sharePairs(s).filter { it.second.size > 1 }
    if (pairs.isEmpty()) return
    var pending by remember { mutableStateOf<Triple<String, String, String>?>(null) }
    Panel("Partage des jours entre classes", "Deux classes d’un même jour alternent chaque semaine, ou font toutes leurs séances l’une après l’autre comme au S1. Changer de choix recalcule le planning (sauvegarde faite avant).") {
        pairs.forEach { (key, l) ->
            val names = l.map { it.className }; val bloc = l.first().mode == "bloc"
            Text("${DAY_LABEL[l.first().weekday]} — ${names.joinToString(" et ")}", fontWeight = FontWeight.Bold, color = Uphf.Title)
            Text(if (bloc) "Toutes les séances de ${names.first()}, puis celles de ${names.drop(1).joinToString()}" else "Une semaine chacune, à tour de rôle", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(!bloc, { if (bloc) pending = Triple(key, "alternance", names.joinToString(" et ")) }, label = { Text("Semaine par semaine") },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
                FilterChip(bloc, { if (!bloc) pending = Triple(key, "bloc", names.joinToString(" et ")) }, label = { Text("Comme au S1") },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
            }
        }
    }
    pending?.let { (key, mode, label) ->
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(label) },
            text = { Text((if (mode == "bloc") "Toutes les séances de la première classe, puis celles de la seconde (comme au S1)." else "Une semaine chacune, à tour de rôle.") + "\n\nLe planning sera recalculé à partir du ${f(s.settings.startDate)} ; une sauvegarde est faite avant.") },
            confirmButton = { TextButton(onClick = { pending = null; onChoose(key, mode) }) { Text("Continuer") } },
            dismissButton = { TextButton(onClick = { pending = null }) { Text("Annuler") } }
        )
    }
}

/* ---------------- Export PDF ---------------- */

@Composable
private fun PdfPanel(state: tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState, s: S2Snapshot) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val plan = state.data?.plan.orEmpty()
    var cls by rememberSaveable(s.space) { mutableStateOf(s2Classes(s).firstOrNull().orEmpty()) }
    if (cls !in s2Classes(s)) cls = s2Classes(s).firstOrNull().orEmpty()
    var msg by remember { mutableStateOf<String?>(null) }
    fun export(classes: List<String>) {
        val excluded = buildMap {
            s.excluded.filter { it.validated }.forEach { x -> var d = LocalDate.parse(x.startsOn); while (!d.isAfter(LocalDate.parse(x.endsOn))) { putIfAbsent(d.toString(), x.label); d = d.plusDays(1) } }
        }
        val times = s.slots.associate { it.className to Triple(it.weekday, it.start, it.end) }
        val pairs = sharePairs(s)
        val pagesOf = classes.map { c -> pairs.firstOrNull { p -> p.second.any { it.className == c } }?.let { p -> p.second.map { it.className } to p.second.first().mode } ?: (listOf(c) to "alternance") }
            .distinct().sortedBy { p -> s.slots.firstOrNull { it.className == p.first.first() }?.weekday ?: 9 }
        val names = s.teachers.associate { it.id to it.name }
        val file = tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.build(context, pagesOf, plan, excluded, times, { id -> id?.let { names[it] }.orEmpty() }, { s.groupsOf(it) },
            legend = s.manips.filter { it.active && !it.title.isNullOrBlank() }.joinToString("    ·    ") { "${it.code} : ${it.title}" },
            recapByDay = s.stations.filter { it.teacherId != null }.groupBy { it.weekday }.mapValues { (_, l) -> l.sortedBy { it.code }.joinToString("    ·    ") { "${it.code} : ${names[it.teacherId].orEmpty()}" } })
        if (file == null) msg = "Aucune séance à exporter." else tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.share(context, file)
    }
    fun book(classes: List<String>) {
        val file = tn.utm.fst.gestionpresence.nativeapp.feature.s2.AttendanceBookPdf.build(context, s, plan, classes)
        if (file == null) msg = "Préparez d’abord les groupes du S2 (onglet Groupes)." else tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.share(context, file)
    }
    fun groups(classes: List<String>) {
        val file = tn.utm.fst.gestionpresence.nativeapp.feature.s2.GroupsPdf.build(context, s, classes, s.spaces.firstOrNull { it.id == s.space }?.name ?: "MPI1 · PC1")
        if (file == null) msg = "Préparez d’abord les groupes du S2 (onglet Groupes)." else tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.share(context, file)
    }
    Panel("Exporter le planning en PDF", "Même modèle que le site : une page A4 paysage par jour ; les classes qui alternent sont sur la même feuille.") {
        AdminTabs(s2Classes(s).map { it to it }, cls) { cls = it }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { export(listOf(cls)) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("PDF $cls") }
            OutlinedButton(onClick = { export(s2Classes(s)) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Toutes les classes") }
        }
        Text("Cahier de présence : page de garde du jour, puis une page par groupe (modèle du cahier papier).", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { book(listOf(cls)) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("Cahier $cls") }
            OutlinedButton(onClick = { book(s2Classes(s)) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Tous les cahiers") }
        }
        Text("Groupes : une page par classe avec tous ses groupes et leurs étudiants.", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { groups(listOf(cls)) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("Groupes $cls") }
            OutlinedButton(onClick = { groups(s2Classes(s)) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Toutes les classes") }
        }
        msg?.let { Text(it, color = Uphf.Bad) }
    }
}

/* ---------------- Espaces (super administrateur) ---------------- */
@Composable
private fun SpacesPanel(viewModel: MainViewModel, open: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<Triple<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Space>, List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.SpaceMember>, List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Teacher>>?>(null) }
    var msg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var reload by remember { mutableStateOf(0) }
    LaunchedEffect(reload) {
        data = runCatching { Triple(viewModel.s2.load().spaces, viewModel.s2.allMembers(), viewModel.s2.directory()) }.getOrElse { msg = true to (it.message ?: "Chargement impossible."); null }
    }
    fun act(ok: String, block: suspend () -> Unit) = scope.launch {
        try { block(); msg = false to ok; reload++ } catch (e: CancellationException) { throw e } catch (e: Exception) { msg = true to (e.message ?: "Échec.") }
    }
    Panel("Espaces", "Chaque espace a ses classes, ses étudiants, ses réglages et son planning S2. Vous seul nommez ou retirez les administrateurs d’espace ; un administrateur d’espace ne voit ni ne modifie MPI1 · PC1.") {
        msg?.let { (e, m) -> Text(m, color = if (e) Uphf.Bad else Uphf.Teal, fontWeight = FontWeight.SemiBold) }
        var name by rememberSaveable { mutableStateOf("") }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(name, { name = it.take(60) }, label = { Text("Nouvel espace (ex. LPC1)") }, singleLine = true, modifier = Modifier.weight(1f))
            Button(onClick = { val n = name; act("Espace créé.") { open(viewModel.s2.createSpace(n)) }; name = "" }, enabled = name.trim().length >= 2, shape = RoundedCornerShape(50),
                colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal)) { Text("Créer") }
        }
        val d = data
        if (d == null) CircularProgressIndicator(color = Uphf.Teal)
        else d.first.forEach { sp ->
            val ms = d.second.filter { it.spaceId == sp.id }.sortedWith(compareBy({ if (it.role == "admin") 0 else 1 }, { id -> d.third.firstOrNull { it.id == id.profileId }?.name }))
            val nameOf = { id: String -> d.third.firstOrNull { it.id == id }?.name ?: "—" }
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Uphf.TealSoft.copy(alpha = 0.45f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(sp.name, fontWeight = FontWeight.ExtraBold, color = Uphf.Title, modifier = Modifier.weight(1f))
                    TextButton(onClick = { open(sp.id) }) { Text("Ouvrir") }
                    if (sp.id != tn.utm.fst.gestionpresence.nativeapp.feature.s2.DEFAULT_SPACE) {
                        var del by remember { mutableStateOf(false) }
                        TextButton(onClick = { del = true }) { Text("Supprimer", color = Uphf.Bad) }
                        if (del) AlertDialog(onDismissRequest = { del = false }, title = { Text("Supprimer « ${sp.name} » ?") }, text = { Text("Possible seulement si l’espace n’a plus de classe.") },
                            confirmButton = { TextButton(onClick = { del = false; act("Espace supprimé.") { viewModel.s2.deleteSpace(sp.id) } }) { Text("Supprimer", color = Uphf.Bad) } },
                            dismissButton = { TextButton(onClick = { del = false }) { Text("Annuler") } }, containerColor = Uphf.Surface)
                    }
                }
                ms.forEach { m ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(nameOf(m.profileId), color = Uphf.Text, modifier = Modifier.weight(1f))
                        FilterChip(m.role == "admin", { act(if (m.role == "admin") "Retiré des administrateurs." else "Nommé administrateur.") { viewModel.s2.setMember(sp.id, m.profileId, if (m.role == "admin") "teacher" else "admin") } },
                            label = { Text(if (m.role == "admin") "Admin" else "Enseignant") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal))
                        TextButton(onClick = { act("Retiré de l’espace.") { viewModel.s2.setMember(sp.id, m.profileId, null) } }) { Text("Retirer", color = Uphf.Bad) }
                    }
                }
                val out = d.third.filter { t -> ms.none { it.profileId == t.id } }
                if (out.isNotEmpty()) {
                    var openMenu by remember { mutableStateOf(false) }
                    Box {
                        OutlinedButton(onClick = { openMenu = true }, shape = RoundedCornerShape(50)) { Text("Ajouter un enseignant") }
                        DropdownMenu(openMenu, { openMenu = false }) {
                            out.forEach { t -> DropdownMenuItem(text = { Text(t.name) }, onClick = { openMenu = false; act("Ajouté à l’espace.") { viewModel.s2.setMember(sp.id, t.id, "teacher") } }) }
                        }
                    }
                }
            }
        }
        Text("Pour créer un compte enseignant : Plus → Comptes enseignants, puis ajoutez-le ici à son espace.", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
    }
}

/* ---------------- Rôles et accès (super administrateur) ---------------- */
private val PERM_GROUPS = listOf(
    "Étudiants et classes" to listOf("students.edit" to "Ajouter, modifier, retirer des étudiants", "classes.edit" to "Créer ou supprimer des classes", "groups.edit" to "Changer le groupe d’un étudiant, le rendre inactif"),
    "Planning" to listOf("planning.settings" to "Dates, créneaux, jours exclus, réglages", "planning.manips" to "Manipulations (codes, titres, salles)", "planning.stations" to "Affecter les enseignants aux postes",
        "planning.generate" to "Générer ou recalculer le planning, versions", "planning.sessions" to "Verrouiller ou déplacer une séance, changer un enseignant"),
    "Appel et notes" to listOf("attendance.any" to "Faire l’appel de toutes les cases", "attendance.edit" to "Modifier présences et notes après la séance", "attendance.makeup" to "Enregistrer les rattrapages"),
    "Exports et documents" to listOf("exports" to "PDF (planning, cahier, groupes) des espaces dont on n’est pas membre"),
    "Équipe et comptes" to listOf("team.edit" to "Ajouter ou retirer des enseignants de l’espace", "accounts.manage" to "Créer des comptes, réinitialiser un PIN", "notices.edit" to "Modifier les avis officiels"))
private val ALL_PERMS = PERM_GROUPS.flatMap { g -> g.second.map { it.first } }
private val PRESETS = listOf("Enseignant" to emptyList(), "Assistant" to listOf("attendance.any", "attendance.makeup", "exports"),
    "Gestionnaire du planning" to listOf("planning.settings", "planning.manips", "planning.stations", "planning.generate", "planning.sessions", "exports"),
    "Administrateur d’espace" to ALL_PERMS.filter { it != "accounts.manage" && it != "notices.edit" })

@Composable
private fun AccessPanel(s: S2Snapshot, viewModel: MainViewModel, me: String?) {
    val scope = rememberCoroutineScope()
    var dir by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Teacher>>(emptyList()) }
    var perms by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2Admin.PermRow>>(emptyList()) }
    var members by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.SpaceMember>>(emptyList()) }
    var history by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2Admin.PermChange>>(emptyList()) }
    var msg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var reload by remember { mutableStateOf(0) }
    var who by rememberSaveable { mutableStateOf("") }
    var space by rememberSaveable { mutableStateOf(s.space) }
    var checked by remember { mutableStateOf(setOf<String>()) }
    var confirm by remember { mutableStateOf(false) }
    LaunchedEffect(reload) {
        runCatching {
            dir = viewModel.s2.directory().filter { it.id != me }
            perms = viewModel.s2.allPermissions(); members = viewModel.s2.allMembers(); history = viewModel.s2.permissionHistory()
        }.onFailure { msg = true to (it.message ?: "Chargement impossible.") }
    }
    if (who.isBlank() || dir.none { it.id == who }) dir.firstOrNull()?.let { who = it.id }
    LaunchedEffect(who, space, perms) { checked = perms.filter { it.spaceId == space && it.profileId == who }.map { it.perm }.toSet() }
    val nameOf = { id: String -> dir.firstOrNull { it.id == id }?.name ?: "—" }
    val spaceName = { id: String -> s.spaces.firstOrNull { it.id == id }?.name ?: "—" }
    fun save(sp: String, person: String, list: List<String>, ok: String) = scope.launch {
        try { viewModel.s2.setPermissions(sp, person, list); msg = false to ok; reload++ } catch (e: CancellationException) { throw e } catch (e: Exception) { msg = true to (e.message ?: "Échec.") }
    }
    Panel("Rôles et accès", "Choisissez une personne et un espace, puis cochez ce qu’elle peut gérer. Partez d’un modèle, puis ajoutez ou retirez des cases. Chaque changement est enregistré et peut être annulé.") {
        msg?.let { (e, m) -> Text(m, color = if (e) Uphf.Bad else Uphf.Teal, fontWeight = FontWeight.SemiBold) }
        if (dir.isEmpty()) { CircularProgressIndicator(color = Uphf.Teal); return@Panel }
        var openWho by remember { mutableStateOf(false) }
        Box {
            OutlinedButton(onClick = { openWho = true }, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) { Text(nameOf(who)) }
            DropdownMenu(openWho, { openWho = false }) { dir.forEach { t -> DropdownMenuItem(text = { Text(t.name) }, onClick = { who = t.id; openWho = false }) } }
        }
        AdminTabs(s.spaces.map { it.id to it.name }, space) { space = it }
        if (members.any { it.spaceId == space && it.profileId == who && it.role == "admin" })
            Text("${nameOf(who)} est administrateur de ${spaceName(space)} : il a déjà tout dans cet espace. Pour limiter ses droits, retirez-le des administrateurs (onglet Espaces), puis cochez ses permissions ici.", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
        Text("Modèles", color = Uphf.Muted, style = MaterialTheme.typography.labelMedium)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PRESETS.forEach { (n, list) -> FilterChip(checked == list.toSet(), { checked = list.toSet() }, label = { Text(n) }) }
        }
        PERM_GROUPS.forEach { (group, list) ->
            Text(group, fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.padding(top = 6.dp))
            list.forEach { (k, label) ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().clickable { checked = if (k in checked) checked - k else checked + k }) {
                    androidx.compose.material3.Checkbox(k in checked, { on -> checked = if (on) checked + k else checked - k })
                    Text(label, color = Uphf.Text)
                }
            }
        }
        Text("Réservé au super administrateur : créer ou supprimer des espaces, changer les permissions, archives S1.", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
        Button(onClick = { confirm = true }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Enregistrer les permissions") }
        if (confirm) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Enregistrer ?") },
            text = { Text("${checked.size} permission(s) pour ${nameOf(who)} dans ${spaceName(space)}.") },
            confirmButton = { TextButton(onClick = { confirm = false; save(space, who, ALL_PERMS.filter { it in checked }, "Permissions enregistrées.") }) { Text("Enregistrer") } },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Annuler") } }, containerColor = Uphf.Surface)
        Text("Historique", fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.padding(top = 8.dp))
        if (history.isEmpty()) Text("Aucun changement pour l’instant.", color = Uphf.Muted)
        history.forEach { h ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${nameOf(h.profileId)} · ${spaceName(h.spaceId)}", color = Uphf.Title, fontWeight = FontWeight.SemiBold)
                    Text("${h.at.take(16).replace('T', ' ')} · ${h.before.size} → ${h.after.size} permission(s)", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                }
                TextButton(onClick = { save(h.spaceId, h.profileId, h.before, "Changement annulé.") }) { Text("Annuler") }
            }
        }
    }
}

/* ---------------- Équipe de l'espace : l'administrateur d'espace ajoute ou retire ses enseignants ---------------- */
@Composable
private fun TeamPanel(space: String, viewModel: MainViewModel, canTeam: Boolean = true, canAccounts: Boolean = false, changed: () -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<Pair<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.SpaceMember>, List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Teacher>>?>(null) }
    var msg by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var reload by remember { mutableStateOf(0) }
    var pinFor by remember { mutableStateOf<String?>(null) }; var newPin by remember { mutableStateOf("") }
    var fName by remember { mutableStateOf("") }; var fUser by remember { mutableStateOf("") }; var fMail by remember { mutableStateOf("") }; var fPin by remember { mutableStateOf("") }
    LaunchedEffect(space, reload) {
        data = runCatching { viewModel.s2.allMembers().filter { it.spaceId == space } to viewModel.s2.directory() }.getOrElse { msg = true to (it.message ?: "Chargement impossible."); null }
    }
    fun act(ok: String, block: suspend () -> Unit) = scope.launch {
        try { block(); msg = false to ok; reload++; changed() } catch (e: CancellationException) { throw e } catch (e: Exception) { msg = true to (e.message ?: "Échec.") }
    }
    Panel("Équipe de l’espace", "Les enseignants de l’équipe apparaissent dans « Enseignants » pour être placés sur les postes, puis dans le planning et l’appel S2. Seul le super administrateur nomme un administrateur d’espace.") {
        msg?.let { (e, m) -> Text(m, color = if (e) Uphf.Bad else Uphf.Teal, fontWeight = FontWeight.SemiBold) }
        val d = data
        if (d == null) CircularProgressIndicator(color = Uphf.Teal) else {
            val nameOf = { id: String -> d.second.firstOrNull { it.id == id }?.name ?: "—" }
            d.first.sortedWith(compareBy({ if (it.role == "admin") 0 else 1 }, { nameOf(it.profileId) })).forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(nameOf(m.profileId), color = Uphf.Text, modifier = Modifier.weight(1f))
                    Text(if (m.role == "admin") "Administrateur" else "Enseignant", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                    if (m.role == "teacher" && canAccounts) TextButton(onClick = { pinFor = m.profileId; newPin = "" }) { Text("Nouveau PIN") }
                    if (m.role == "teacher" && canTeam) TextButton(onClick = { act("Retiré de l’équipe.") { viewModel.s2.setMember(space, m.profileId, null) } }) { Text("Retirer", color = Uphf.Bad) }
                }
            }
            pinFor?.let { pid ->
                AlertDialog(onDismissRequest = { pinFor = null }, title = { Text("Nouveau PIN — ${nameOf(pid)}") },
                    text = { OutlinedTextField(newPin, { newPin = it.filter(Char::isDigit).take(6) }, label = { Text("PIN (6 chiffres)") }, singleLine = true) },
                    confirmButton = { TextButton(enabled = newPin.length == 6, onClick = { val p = newPin; pinFor = null; act("PIN modifié. Communiquez-le à l’enseignant.") { viewModel.s2.resetTeacherPin(pid, p) } }) { Text("Enregistrer") } },
                    dismissButton = { TextButton(onClick = { pinFor = null }) { Text("Annuler") } }, containerColor = Uphf.Surface)
            }
            val out = d.second.filter { t -> d.first.none { it.profileId == t.id } }
            if (canAccounts) {
                Text("Créer un compte enseignant", fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.padding(top = 8.dp))
                OutlinedTextField(fName, { fName = it }, label = { Text("Nom et prénom") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(fUser, { fUser = it.lowercase().filter { c -> c.isLetterOrDigit() || c in "._-" } }, label = { Text("Identifiant (ex. a.benali)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(fMail, { fMail = it }, label = { Text("E-mail (facultatif)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(fPin, { fPin = it.filter(Char::isDigit).take(6) }, label = { Text("PIN de connexion (6 chiffres)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(onClick = { val (n, u, m, p) = listOf(fName, fUser, fMail, fPin); act("Compte créé : $u. Il rejoint l’équipe de l’espace.") { viewModel.s2.createTeacherAccount(space, n, u, m, p); fName = ""; fUser = ""; fMail = ""; fPin = "" } },
                    enabled = fName.isNotBlank() && fUser.isNotBlank() && fPin.length == 6, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Créer le compte") }
            }
            if (out.isNotEmpty() && canTeam) {
                var openMenu by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(onClick = { openMenu = true }, shape = RoundedCornerShape(50)) { Text("Ajouter un enseignant") }
                    DropdownMenu(openMenu, { openMenu = false }) {
                        out.forEach { t -> DropdownMenuItem(text = { Text(t.name) }, onClick = { openMenu = false; act("Ajouté à l’équipe.") { viewModel.s2.setMember(space, t.id, "teacher") } }) }
                    }
                }
            }
        }
    }
}

/* ---------------- Classes & étudiants (espaces autres que MPI1 · PC1) ---------------- */
@Composable
private fun ClassesPanel(s: S2Snapshot, run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    var sel by rememberSaveable(s.space) { mutableStateOf(s.spaceClasses.firstOrNull()?.name.orEmpty()) }
    if (s.spaceClasses.none { it.name == sel }) sel = s.spaceClasses.firstOrNull()?.name.orEmpty()
    val cur = s.spaceClasses.firstOrNull { it.name == sel }
    Panel("Nouvelle classe", "Créez les classes de l’espace, puis ajoutez leurs étudiants. Ensuite : onglet Groupes → « Préparer les groupes ».") {
        var name by rememberSaveable { mutableStateOf("") }
        var day by rememberSaveable { mutableStateOf(1) }
        var st by rememberSaveable { mutableStateOf("14:00") }
        var et by rememberSaveable { mutableStateOf("17:00") }
        var partner by rememberSaveable { mutableStateOf("") }
        OutlinedTextField(name, { name = it.take(30) }, label = { Text("Nom (ex. LPC1-A)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
            DAY_LABEL.entries.forEach { (k, l) -> FilterChip(day == k, { day = k }, label = { Text(l) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Uphf.OnTeal)) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TimeField("Début", st, { st = it }, Modifier.weight(1f))
            TimeField("Fin", et, { et = it }, Modifier.weight(1f))
        }
        if (s.slots.isNotEmpty()) {
            Text("Partage le jour avec :", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                FilterChip(partner.isEmpty(), { partner = "" }, label = { Text("aucune classe") })
                s.slots.forEach { c -> FilterChip(partner == c.pairKey, { partner = c.pairKey }, label = { Text("${c.className} (${DAY_LABEL[c.weekday]})") }) }
            }
        }
        Button(onClick = {
            val n = name; val p = s.slots.firstOrNull { it.pairKey == partner && partner.isNotEmpty() }
            run("Classe créée.", false) { viewModel.s2.createClass(n, day, st, et, p, s.slots); sel = n.trim().uppercase(); null }; name = ""
        }, enabled = name.trim().length >= 2, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Créer la classe") }
    }
    if (s.spaceClasses.isEmpty()) return
    AdminTabs(s.spaceClasses.map { c -> c.name to "${c.name} · ${s.spaceStudents.count { it.classId == c.id }}" }, sel) { sel = it }
    if (cur == null) return
    val studs = s.spaceStudents.filter { it.classId == cur.id }.sortedBy { "${it.lastName} ${it.firstName}".lowercase() }
    val slot = s.slots.firstOrNull { it.className == cur.name }
    Panel(cur.name, slot?.let { "${DAY_LABEL[it.weekday]} ${it.start}–${it.end} · ${studs.size} étudiant(s)" } ?: "${studs.size} étudiant(s)") {
        var ln by rememberSaveable { mutableStateOf("") }; var fn by rememberSaveable { mutableStateOf("") }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(ln, { ln = it.take(60) }, label = { Text("Nom") }, singleLine = true, modifier = Modifier.weight(1f))
            OutlinedTextField(fn, { fn = it.take(60) }, label = { Text("Prénom") }, singleLine = true, modifier = Modifier.weight(1f))
        }
        Button(onClick = { val a = ln; val b = fn; run("Étudiant ajouté.", false) { viewModel.s2.addStudents(cur.id, listOf(a to b)); null }; ln = ""; fn = "" },
            enabled = ln.isNotBlank(), shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) { Text("Ajouter l’étudiant") }
        var paste by rememberSaveable { mutableStateOf("") }
        OutlinedTextField(paste, { paste = it }, label = { Text("Coller une liste (une ligne par étudiant : NOM Prénom, ou NOM;Prénom)") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        OutlinedButton(onClick = {
            val list = paste.lines().map { it.trim() }.filter { it.isNotEmpty() }.map { l ->
                if (';' in l) l.substringBefore(';').trim() to l.substringAfter(';').trim()
                else { val w = l.split(Regex("\\s+")); val up = w.filter { x -> x == x.uppercase() && x.any(Char::isLetter) }
                    val last = if (up.isNotEmpty() && up.size < w.size) up.joinToString(" ") else w.first(); last to w.filterNot { it in last.split(" ") }.joinToString(" ") }
            }
            run("${list.size} étudiant(s) ajouté(s).", false) { viewModel.s2.addStudents(cur.id, list); null }; paste = ""
        }, enabled = paste.isNotBlank(), shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Ajouter la liste") }
        studs.forEachIndexed { i, st ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${i + 1}. ${st.lastName} ${st.firstName}", color = Uphf.Text, modifier = Modifier.weight(1f))
                TextButton(onClick = { run("Étudiant retiré.", false) { viewModel.s2.removeStudent(st.id); null } }) { Text("Retirer", color = Uphf.Bad) }
            }
        }
        var del by remember { mutableStateOf(false) }
        OutlinedButton(onClick = { del = true }, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Supprimer la classe", color = Uphf.Bad) }
        if (del) AlertDialog(onDismissRequest = { del = false }, title = { Text("Supprimer ${cur.name} ?") }, text = { Text("Son créneau, ses groupes S2 et ses étudiants sont retirés.") },
            confirmButton = { TextButton(onClick = { del = false; run("Classe supprimée.", false) { viewModel.s2.deleteClass(cur); null } }) { Text("Supprimer", color = Uphf.Bad) } },
            dismissButton = { TextButton(onClick = { del = false }) { Text("Annuler") } }, containerColor = Uphf.Surface)
    }
}
