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
fun S2AdminScreen(viewModel: MainViewModel) {
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
            AdminTabs(listOf("dates" to "Dates exclues", "creneaux" to "Créneaux", "postes" to "Enseignants", "planning" to "Générer"), tab) { tab = it }
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
            "dates" -> datesTab(s, ::run, viewModel)
            "creneaux" -> item { SlotsEditor(s) { rows -> run("Créneaux enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveSlots(rows); null } } }
            "postes" -> item { StationsEditor(s) { rows -> run("Enseignants enregistrés. Pensez à recalculer le planning.", false) { viewModel.s2.saveStations(rows); null } } }
            else -> item { GenerateTab(s, ::run, viewModel) }
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
