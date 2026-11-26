package tn.utm.fst.gestionpresence.nativeapp.feature.admin

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceRecord
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import java.io.File

/**
 * PDF des statistiques (bouton « PDF statistiques » du site) : chiffres clés, répartition des présences
 * et des notes, puis tableaux par enseignant, par classe / groupe et par manipulation. A4 portrait.
 */
object StatsPdf {
    private const val MM = 72f / 25.4f
    data class Line(val record: AttendanceRecord, val teacher: String, val group: String, val manip: String)

    private fun rate(l: List<Line>) = if (l.isEmpty()) 0.0 else Math.round(1000.0 * l.count { it.record.status == AttendanceStatus.PRESENT || it.record.status == AttendanceStatus.LATE } / l.size) / 10.0
    private fun avg(l: List<Line>) = l.mapNotNull { it.record.grade }.takeIf { it.isNotEmpty() }?.let { Math.round(it.average() * 100) / 100.0 }

    fun build(context: Context, lines: List<Line>, subtitle: String): File? {
        if (lines.isEmpty()) return null
        val doc = PdfDocument(); var pageNo = 0
        var page = doc.startPage(PdfDocument.PageInfo.Builder((210 * MM).toInt(), (297 * MM).toInt(), ++pageNo).create())
        var c = page.canvas
        fun paint(size: Float, bold: Boolean = false, color: Int = Color.rgb(25, 25, 25)) = Paint().apply {
            textSize = size; this.color = color; isAntiAlias = true; typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }
        val stroke = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 0.6f; color = Color.rgb(90, 90, 90) }
        val fill = Paint().apply { style = Paint.Style.FILL }
        fun text(t: String, x: Float, y: Float, p: Paint) = c.drawText(t, x * MM, y * MM, p)
        var y = 16f
        fun newPageIfNeeded(h: Float) { if (y + h > 285f) { doc.finishPage(page); page = doc.startPage(PdfDocument.PageInfo.Builder((210 * MM).toInt(), (297 * MM).toInt(), ++pageNo).create()); c = page.canvas; y = 18f } }

        text("Statistiques de présence et de notes", 14f, y, paint(14f, true)); y += 7f
        text("Faculté des Sciences de Tunis — Université de Tunis El Manar", 14f, y, paint(9f)); y += 5f
        text("Année universitaire : 2026/2027 — $subtitle", 14f, y, paint(9f)); y += 8f
        val sessions = lines.map { it.record.sessionId }.distinct().size; val students = lines.map { it.record.studentId }.distinct().size
        text("Séances : $sessions   Étudiants : $students   Pointages : ${lines.size}   Taux de présence : ${rate(lines)} %   Moyenne : ${avg(lines)?.let { "$it /20" } ?: "—"}", 14f, y, paint(9.5f, true)); y += 9f

        // Répartition des présences (barres)
        text("Répartition des présences", 14f, y, paint(11f, true)); y += 4f
        val statuses = listOf(AttendanceStatus.PRESENT to "Présent", AttendanceStatus.LATE to "Retard", AttendanceStatus.ABSENT to "Absent", AttendanceStatus.JUSTIFIED to "Justifié")
        val colors = listOf(Color.rgb(46, 125, 50), Color.rgb(191, 144, 0), Color.rgb(192, 57, 43), Color.rgb(230, 126, 34))
        val counts = statuses.map { (st, _) -> lines.count { it.record.status == st } }; val max = maxOf(1, counts.max())
        statuses.forEachIndexed { i, (_, lab) ->
            val h = 28f * counts[i] / max; val x = 14f + i * 44f
            fill.color = colors[i]; c.drawRect(x * MM, (y + 30f - h) * MM, (x + 28f) * MM, (y + 30f) * MM, fill)
            text("${counts[i]}", x + 11f, y + 28.5f - h, paint(9.5f, true)); text(lab, x + 6f, y + 35.5f, paint(9.5f))
        }
        y += 42f
        // Répartition des notes par tranche
        val grades = lines.mapNotNull { it.record.grade }
        if (grades.isNotEmpty()) {
            text("Répartition des notes", 14f, y, paint(11f, true)); y += 4f
            val buckets = listOf(0.0 to 5.0, 5.0 to 10.0, 10.0 to 12.0, 12.0 to 14.0, 14.0 to 16.0, 16.0 to 20.01)
            val bc = buckets.map { (a, b) -> grades.count { it >= a && it < b } }; val bm = maxOf(1, bc.max())
            buckets.forEachIndexed { i, (a, b) ->
                val h = 28f * bc[i] / bm; val x = 14f + i * 30f
                fill.color = Color.rgb(31, 78, 120); c.drawRect(x * MM, (y + 30f - h) * MM, (x + 24f) * MM, (y + 30f) * MM, fill)
                text("${bc[i]}", x + 9f, y + 28.5f - h, paint(9f, true)); text("${a.toInt()}–${minOf(20, b.toInt())}", x + 5f, y + 35.5f, paint(9f))
            }
            y += 42f
        }
        fun table(title: String, head: String, groups: Map<String, List<Line>>) {
            if (groups.isEmpty()) return
            newPageIfNeeded(20f)
            text(title, 14f, y, paint(11f, true)); y += 3f
            val cols = listOf(14f, 110f, 140f, 166f, 196f)
            fun row(vals: List<String>, head: Boolean) {
                // Lignes de 7 mm, texte 9 pt : lisible une fois imprimé.
                newPageIfNeeded(8f)
                if (head) { fill.color = Color.rgb(221, 235, 247); c.drawRect(cols[0] * MM, y * MM, cols[4] * MM, (y + 7f) * MM, fill) }
                c.drawRect(cols[0] * MM, y * MM, cols[4] * MM, (y + 7f) * MM, stroke)
                vals.forEachIndexed { i, v -> text(v, cols[i] + 1.5f, y + 5f, paint(9f, head)) }
                y += 7f
            }
            row(listOf(head, "Pointages", "Présence", "Moyenne"), true)
            groups.entries.sortedBy { it.key }.forEach { (k, l) -> row(listOf(k.take(55), "${l.size}", "${rate(l)} %", avg(l)?.toString() ?: "—"), false) }
            y += 6f
        }
        table("Comparaison par enseignant", "Enseignant", lines.groupBy { it.teacher })
        table("Comparaison par classe / groupe", "Classe / groupe", lines.groupBy { it.group })
        table("Comparaison par manipulation", "Manipulation", lines.filter { it.manip.isNotBlank() }.groupBy { it.manip })
        doc.finishPage(page)
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, "Statistiques_Presence_2026-2027.pdf")
        file.outputStream().use { doc.writeTo(it) }; doc.close()
        return file
    }
}
