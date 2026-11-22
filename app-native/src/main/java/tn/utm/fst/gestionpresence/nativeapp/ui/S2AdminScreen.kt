package tn.utm.fst.gestionpresence.nativeapp.ui

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
    LaunchedEffect(Unit) { run(null, false) { null }; notice = null }

    val s = snap
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            AdminTabs(listOf("dates" to "Dates exclues", "groupes" to "Groupes", "creneaux" to "Créneaux", "postes" to "Enseignants", "planning" to "Générer & PDF"), tab) { tab = it }
        }
        notice?.let { (err, msg) ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = if (err) Uphf.BadSoft else Uphf.TealSoft), shape = RoundedCornerShape(10.dp)) {
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
            "creneaux" -> item { SlotsEditor(s) { rows -> run("Créneaux enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveSlots(rows); null } } }
            "postes" -> item { StationsEditor(s) { rows -> run("Enseignants enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveStations(rows); null } } }
            else -> { item { PdfPanel(state, s) }; item { GenerateTab(s, ::run, viewModel) } }
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
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White, labelColor = Uphf.Title)
            )
        }
    }
}

@Composable
private fun Panel(title: String, subtitle: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth()) {
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
                full != null -> Quad(Color(0xFFEEF1F4), Color(0xFFCFD6DE), Uphf.Bad, "Exclue")
                days > 0 -> Quad(Uphf.OchreSoft, Color(0xFFDCC8A3), Uphf.Ochre, "$days j exclu${if (days > 1) "s" else ""}")
                pending -> Quad(Color.White, Color(0xFFDCC8A3), Uphf.Ochre, "À valider")
                else -> Quad(Color.White, Uphf.Line, Uphf.Teal, "TP")
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
    Card(colors = CardDefaults.cardColors(containerColor = if (x.validated) Color.White else Uphf.OchreSoft), shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, Uphf.Line)) {
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
        containerColor = Color.White
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
                FilterChip(k == kind, { kind = k }, label = { Text(l) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Ochre, selectedLabelColor = Color.White))
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
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(c.start, { rows[i] = c.copy(start = it.take(5)) }, label = { Text("Début") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(c.end, { rows[i] = c.copy(end = it.take(5)) }, label = { Text("Fin") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(c.pairOrder.toString(), { v -> v.toIntOrNull()?.let { rows[i] = c.copy(pairOrder = it.coerceIn(1, 9)) } }, label = { Text("Ordre") }, singleLine = true, modifier = Modifier.weight(0.7f))
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(c.pairKey, { rows[i] = c.copy(pairKey = it.lowercase().take(30)) }, label = { Text("Groupe de jour") }, singleLine = true, modifier = Modifier.weight(1f))
                    FilterChip(c.mode == "alternance", { rows[i] = c.copy(mode = "alternance") }, label = { Text("Alternance") })
                    FilterChip(c.mode == "bloc", { rows[i] = c.copy(mode = "bloc") }, label = { Text("Bloc") })
                }
            }
        }
        val clash = rows.filter { it.active }.groupBy { it.pairKey }.filter { (_, l) -> l.map { it.weekday }.distinct().size > 1 }.keys
        if (clash.isNotEmpty()) Text("Attention : « ${clash.joinToString()} » regroupe des classes de jours différents.", color = Uphf.Bad)
        Button(onClick = { onSave(rows.toList()) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les créneaux")
        }
    }
}

/* ---------------- Enseignants par jour et manipulation ---------------- */

@Composable
private fun StationsEditor(s: S2Snapshot, onSave: (List<Station>) -> Unit) {
    val days = s.slots.filter { it.active }.map { it.weekday }.distinct().sorted().ifEmpty { listOf(1, 4, 5) }
    var day by rememberSaveable { mutableStateOf(days.first()) }
    val edits = remember(s) { mutableStateListOf<Station>().apply { addAll(s.stations) } }
    Panel("Enseignants du S2", "Chaque enseignant garde sa manipulation : la rotation des groupes se fait automatiquement.") {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(days) { d ->
                FilterChip(d == day, { day = d }, label = { Text(DAY_LABEL[d] ?: "") }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White))
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
        Button(onClick = { onSave(edits.toList()) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Save, null); Spacer(Modifier.width(8.dp)); Text("Enregistrer les enseignants")
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
        Panel("Fin du semestre 2") {
            OutlinedTextField(end, { end = it.trim() }, label = { Text("Dernier jour (AAAA-MM-JJ)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedButton(onClick = { run("Fin du S2 enregistrée.", false) { viewModel.s2.saveSettings(end.ifBlank { null }); null } },
                enabled = end.isBlank() || runCatching { LocalDate.parse(end); true }.getOrDefault(false), shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Enregistrer") }
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
        containerColor = Color.White
    )
    restore?.let { id ->
        AlertDialog(
            onDismissRequest = { restore = null },
            title = { Text("Restaurer cette version ?") },
            text = { Text("Le planning actuel sera remplacé par celui de la version choisie.") },
            confirmButton = { TextButton(onClick = { restore = null; run("Version restaurée.", true) { viewModel.s2.restoreVersion(id); null } }) { Text("Restaurer") } },
            dismissButton = { TextButton(onClick = { restore = null }) { Text("Annuler") } },
            containerColor = Color.White
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
            containerColor = Color.White
        )
    }
}

/* ---------------- Groupes du S2 ---------------- */

private val S2_CLASSES = listOf("MPI1-A", "MPI1-B", "MPI1-C", "MPI1-D", "MPI1-E", "PC1-A")

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
                    confirmButton = { TextButton(onClick = { ask = false; run(null, false) { "${viewModel.s2.initGroups(s.settings.groupCount)} étudiant(s) répartis." } }) { Text("Préparer") } },
                    dismissButton = { TextButton(onClick = { ask = false }) { Text("Annuler") } }, containerColor = Color.White)
            }
        }
        return
    }
    item { GroupsPanel(s, run, viewModel) }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun GroupsPanel(s: S2Snapshot, run: (String?, Boolean, suspend () -> String?) -> Unit, viewModel: MainViewModel) {
    var cls by rememberSaveable { mutableStateOf(S2_CLASSES.first()) }
    var edit by remember { mutableStateOf<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Member?>(null) }
    var preview by remember { mutableStateOf<List<tn.utm.fst.gestionpresence.nativeapp.feature.s2.Move>?>(null) }
    var applyAsk by remember { mutableStateOf(false) }
    val G = s.settings.groupCount
    val ms = s.members.filter { it.className == cls }
    val act = ms.filter { it.status == "actif" }; val exc = ms.filter { it.status == "exclu" }
    val sizes = (1..G).map { g -> act.count { it.groupNo == g } }
    val gap = (sizes.maxOrNull() ?: 0) - (sizes.minOrNull() ?: 0)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AdminTabs(S2_CLASSES.map { it to "$it · ${s.members.count { m -> m.className == it && m.status == "actif" }}" }, cls) { cls = it }
        Panel(if (gap <= 1) "Groupes équilibrés" else "Écart de $gap étudiants", "${act.size} présent(s) répartis · ${exc.size} mis de côté") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                sizes.forEachIndexed { i, n ->
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(Uphf.TealSoft).padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("G${i + 1}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted); Text("$n", fontWeight = FontWeight.ExtraBold, color = Uphf.Title)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { preview = tn.utm.fst.gestionpresence.nativeapp.feature.s2.balanceMoves(ms, G) }, enabled = gap > 1, shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("Équilibrer") }
                OutlinedButton(onClick = { run(null, false) { val n = viewModel.s2.addNewMembers(s.members.map { it.studentId }.toSet()); if (n == 0) "Aucun nouvel étudiant." else "$n étudiant(s) ajouté(s)." } },
                    shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Nouveaux") }
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
            dismissButton = { TextButton(onClick = { preview = null }) { Text("Annuler") } }, containerColor = Color.White)
    }
    edit?.let { m -> MemberDialog(m, G, sizes, onDismiss = { edit = null }) { patch, label -> edit = null; run(label, false) { viewModel.s2.updateMember(m.studentId, patch, "edit_student"); null } } }
    if (applyAsk) AlertDialog(onDismissRequest = { applyAsk = false }, title = { Text("Appliquer les groupes S2 ?") },
        text = { Text("Les étudiants changeront de groupe dans les listes de présence. Les présences du S1 restent attachées à leurs séances.") },
        confirmButton = { TextButton(onClick = { applyAsk = false; run(null, true) { "${viewModel.s2.applyGroupsToLists(s.members)} étudiant(s) déplacé(s) dans les listes." } }) { Text("Appliquer") } },
        dismissButton = { TextButton(onClick = { applyAsk = false }) { Text("Annuler") } }, containerColor = Color.White)
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
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White)) }
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
        containerColor = Color.White
    )
}

/* ---------------- Export PDF ---------------- */

@Composable
private fun PdfPanel(state: tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState, s: S2Snapshot) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val plan = state.data?.plan.orEmpty()
    var cls by rememberSaveable { mutableStateOf(S2_CLASSES.first()) }
    var msg by remember { mutableStateOf<String?>(null) }
    fun export(classes: List<String>) {
        val excluded = buildMap {
            s.excluded.filter { it.validated }.forEach { x -> var d = LocalDate.parse(x.startsOn); while (!d.isAfter(LocalDate.parse(x.endsOn))) { putIfAbsent(d.toString(), x.label); d = d.plusDays(1) } }
        }
        val times = s.slots.associate { it.className to Triple(it.weekday, it.start, it.end) }
        val names = s.teachers.associate { it.id to it.name }
        val file = tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.build(context, classes, plan, excluded, times, { id -> id?.let { names[it] }.orEmpty() }, s.settings.groupCount)
        if (file == null) msg = "Aucune séance à exporter." else tn.utm.fst.gestionpresence.nativeapp.feature.s2.PlanningPdf.share(context, file)
    }
    Panel("Exporter le planning en PDF", "Même modèle que le site : une page A4 paysage par classe.") {
        AdminTabs(S2_CLASSES.map { it to it }, cls) { cls = it }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { export(listOf(cls)) }, shape = RoundedCornerShape(50), colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal), modifier = Modifier.weight(1f)) { Text("PDF $cls") }
            OutlinedButton(onClick = { export(S2_CLASSES) }, shape = RoundedCornerShape(50), modifier = Modifier.weight(1f)) { Text("Toutes les classes") }
        }
        msg?.let { Text(it, color = Uphf.Bad) }
    }
}
