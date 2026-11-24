package tn.utm.fst.gestionpresence.nativeapp.feature.export

import android.content.Context
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceRecord
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData
import tn.utm.fst.gestionpresence.nativeapp.feature.export.TrackingXlsx.Cell
import tn.utm.fst.gestionpresence.nativeapp.feature.export.TrackingXlsx.Sheet
import java.io.File
import java.time.LocalDate

/**
 * Bilan Excel du S1 (MPI1 et PC1), identique au bouton « Bilan S1 (absences en couleur) » du site :
 * une feuille par classe, une colonne par manipulation avec la note ou l'état en couleur
 * (rouge : absent non rattrapé · orange : justifié · vert : rattrapé · jaune : retard),
 * puis moyenne, totaux et détail ; feuilles « Synthèse » et « Légende ».
 * Une case vide n'est jamais comptée comme une absence.
 */
object BilanS1Xlsx {
    private const val S1_START = "2026-09-01"
    private const val S1_END = "2026-12-31"
    private const val RED = 5; private const val ORANGE = 6; private const val GREEN = 7; private const val LATE = 8
    private const val HEAD = 9; private const val BOX = 10; private const val LEFT = 11; private const val NUM = 12
    private val RANK = mapOf(AttendanceStatus.PRESENT to 4, AttendanceStatus.LATE to 3, AttendanceStatus.JUSTIFIED to 2, AttendanceStatus.ABSENT to 1)

    private fun base(n: String) = n.replace(Regex("-G\\d+$", RegexOption.IGNORE_CASE), "")
    private fun group(n: String) = Regex("-G(\\d+)$", RegexOption.IGNORE_CASE).find(n)?.groupValues?.get(1)?.let { "G$it" } ?: ""
    private fun dm(d: String?) = d?.let { it.substring(8, 10) + "/" + it.substring(5, 7) } ?: ""
    private fun gradeText(g: Double) = if (g % 1.0 == 0.0) g.toInt().toString() else g.toString().replace('.', ',')

    fun build(context: Context, data: RepositoryData): File? {
        val classes = data.classes.filter { Regex("^(MPI1|PC1)-[A-Z]").containsMatchIn(it.name) }
        val classById = classes.associateBy { it.id }
        val sessions = data.sessions.filter { it.sessionDate in S1_START..S1_END && it.classId in classById }.associateBy { it.id }
        val manipOf = { sid: String -> data.sessionManipulations[sid].orEmpty() }
        val manips = sessions.keys.map(manipOf).filter { it.isNotBlank() }.distinct().sortedWith(compareBy({ it.drop(1).toIntOrNull() ?: 99 }, { it }))
        val families = classes.map { base(it.name) }.distinct().sorted()
        val sheets = mutableListOf<Sheet>(); val summary = mutableListOf<List<Int>>(); val summaryNames = mutableListOf<String>()
        val today = LocalDate.now().let { "%02d/%02d/%d".format(it.dayOfMonth, it.monthValue, it.year) }
        for (fam in families) {
            val ids = classes.filter { base(it.name) == fam }.map { it.id }.toSet()
            val students = data.students.filter { it.classId in ids }.sortedWith(compareBy({ it.lastName.lowercase() }, { it.firstName.lowercase() }))
            if (students.isEmpty()) continue
            val head = listOf("N°", "Nom", "Prénom", "Groupe") + manips + listOf("Sans manip.", "Moyenne", "Absences", "Justifiées", "Rattrapées", "Détail des absences")
            val rows = mutableListOf<List<Cell>>(
                listOf(Cell.T("Bilan S1 — $fam — absences, rattrapages et notes", 1)),
                listOf(Cell.T("Université de Tunis El Manar — Faculté des Sciences de Tunis — TP de Physique")),
                listOf(Cell.T("Année universitaire 2026/2027 — semestre 1 — généré le $today (application)")),
                emptyList(),
                head.map { Cell.T(it, HEAD) }
            )
            var tAbs = 0; var tJ = 0; var tR = 0; var withAbs = 0
            students.forEachIndexed { i, st ->
                val recs = data.attendanceByStudent[st.id].orEmpty().filter { it.sessionId in sessions }.sortedBy { sessions[it.sessionId]!!.sessionDate }
                fun cellFor(list: List<AttendanceRecord>): Cell {
                    if (list.isEmpty()) return Cell.T("", BOX)
                    val best = list.maxBy { RANK[it.status] ?: 0 }
                    val g = list.firstNotNullOfOrNull { it.grade }
                    val date = dm(sessions[best.sessionId]?.sessionDate)
                    return when {
                        best.status == AttendanceStatus.PRESENT -> if (g != null) Cell.N(g, NUM) else Cell.T("P", BOX)
                        best.status == AttendanceStatus.LATE -> if (g != null) Cell.N(g, LATE) else Cell.T("Retard", LATE)
                        best.status == AttendanceStatus.JUSTIFIED -> Cell.T("ABS J $date", ORANGE)
                        best.makeupDate != null -> Cell.T("Ratt. ${dm(best.makeupDate)}" + (g?.let { " — " + gradeText(it) } ?: ""), GREEN)
                        else -> Cell.T("ABS $date", RED)
                    }
                }
                val abs = recs.filter { it.status == AttendanceStatus.ABSENT && it.makeupDate == null }
                val jus = recs.filter { it.status == AttendanceStatus.JUSTIFIED }
                val rat = recs.filter { it.status == AttendanceStatus.ABSENT && it.makeupDate != null }
                tAbs += abs.size; tJ += jus.size; tR += rat.size; if (abs.isNotEmpty()) withAbs++
                val grades = recs.mapNotNull { it.grade }
                fun lbl(r: AttendanceRecord) = dm(sessions[r.sessionId]?.sessionDate) + manipOf(r.sessionId).takeIf { it.isNotBlank() }?.let { " ($it)" }.orEmpty()
                val detail = (abs.map { lbl(it) } + jus.map { lbl(it) + " justifiée" } +
                    rat.map { lbl(it) + " rattrapée le " + dm(it.makeupDate) + (it.makeupNote?.takeIf { n -> n.isNotBlank() }?.let { n -> " — $n" } ?: "") }).joinToString(", ")
                val nameStyle = when { abs.isNotEmpty() -> RED; jus.isNotEmpty() -> ORANGE; rat.isNotEmpty() -> GREEN; else -> -1 }
                val row = mutableListOf<Cell>(
                    Cell.N((i + 1).toDouble(), if (nameStyle > 0) nameStyle else BOX),
                    Cell.T(st.lastName, if (nameStyle > 0) nameStyle else LEFT),
                    Cell.T(st.firstName, if (nameStyle > 0) nameStyle else LEFT),
                    Cell.T(group(classById[st.classId]?.name.orEmpty()), BOX)
                )
                manips.forEach { m -> row += cellFor(recs.filter { manipOf(it.sessionId) == m }) }
                row += cellFor(recs.filter { manipOf(it.sessionId).isBlank() })
                row += if (grades.isEmpty()) Cell.T("", BOX) else Cell.N(Math.round(grades.average() * 100) / 100.0, NUM)
                row += if (abs.isEmpty()) Cell.T("", BOX) else Cell.N(abs.size.toDouble(), RED)
                row += if (jus.isEmpty()) Cell.T("", BOX) else Cell.N(jus.size.toDouble(), ORANGE)
                row += if (rat.isEmpty()) Cell.T("", BOX) else Cell.N(rat.size.toDouble(), GREEN)
                row += Cell.T(detail, if (nameStyle > 0) nameStyle else LEFT)
                rows += row
            }
            val widths = head.map { h -> when { h == "N°" -> 5.0; h == "Nom" -> 22.0; h == "Prénom" -> 20.0; h == "Groupe" -> 8.0; h == "Détail des absences" -> 60.0; h.startsWith("M") -> 14.0; else -> 12.0 } }
            sheets += Sheet(fam.take(31), rows, 5, widths)
            summaryNames += fam; summary += listOf(students.size, withAbs, tAbs, tJ, tR)
        }
        if (sheets.isEmpty()) return null
        val syn = mutableListOf<List<Cell>>(listOf(Cell.T("Synthèse du S1", 1)), emptyList(),
            listOf("Classe", "Étudiants", "Étudiants avec absence non rattrapée", "Absences non rattrapées", "Absences justifiées", "Absences rattrapées").map { Cell.T(it, HEAD) })
        summaryNames.forEachIndexed { i, n ->
            val s = summary[i]
            syn += listOf(Cell.T(n, BOX), Cell.N(s[0].toDouble(), BOX), Cell.N(s[1].toDouble(), BOX),
                Cell.N(s[2].toDouble(), if (s[2] > 0) RED else BOX), Cell.N(s[3].toDouble(), if (s[3] > 0) ORANGE else BOX), Cell.N(s[4].toDouble(), if (s[4] > 0) GREEN else BOX))
        }
        sheets += Sheet("Synthèse", syn, 3, listOf(12.0, 11.0, 22.0, 16.0, 16.0, 16.0))
        val leg = listOf(
            listOf(Cell.T("Légende", 1)), emptyList(), listOf(Cell.T("Exemple", HEAD), Cell.T("Signification", HEAD)),
            listOf(Cell.T("14,5", BOX), Cell.T("Présent : note de la manipulation (P si pas encore de note)", LEFT)),
            listOf(Cell.T("Retard", LATE), Cell.T("Présent en retard (note si saisie)", LEFT)),
            listOf(Cell.T("ABS 21/09", RED), Cell.T("Absent, non rattrapé", LEFT)),
            listOf(Cell.T("ABS J 02/10", ORANGE), Cell.T("Absence justifiée", LEFT)),
            listOf(Cell.T("Ratt. 05/11 — 12", GREEN), Cell.T("Absence rattrapée (date du rattrapage, note si saisie)", LEFT)),
            listOf(Cell.T("(vide)", BOX), Cell.T("Aucune donnée : jamais compté comme une absence", LEFT)),
            listOf(Cell.T("Sans manip.", BOX), Cell.T("Séance dont la manipulation n'est pas connue du planning", LEFT)))
        sheets += Sheet("Légende", leg, 3, listOf(18.0, 70.0))
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, "Bilan_S1_TP_Physique_MPI1_PC1_2026_2027.xlsx")
        file.outputStream().use { TrackingXlsx.write(it, sheets) }
        return file
    }
}
