package tn.utm.fst.gestionpresence.nativeapp.feature.admin

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData
import java.io.File
import java.time.LocalDate

/** Rapport de présence filtré (même logique que l'onglet Rapports du site), en PDF A4. */
object ReportPdf {
    data class Filters(val family: String?, val classId: String?, val teacherId: String?, val from: String?, val to: String?)

    private fun fmt(d: String) = runCatching { val x = LocalDate.parse(d.take(10)); "%02d/%02d/%04d".format(x.dayOfMonth, x.monthValue, x.year) }.getOrDefault(d)

    fun build(context: Context, data: RepositoryData, f: Filters, teacherName: (String?) -> String): File? {
        val sessions = data.sessions.filter { s ->
            val cls = data.classById[s.classId]?.name ?: return@filter false
            (f.family == null || cls.substringBeforeLast("-G") == f.family) && (f.classId == null || s.classId == f.classId) &&
                (f.teacherId == null || s.teacherId == f.teacherId) && (f.from == null || s.sessionDate >= f.from) && (f.to == null || s.sessionDate <= f.to)
        }.sortedWith(compareBy({ it.sessionDate }, { data.classById[it.classId]?.name }))
        if (sessions.isEmpty()) return null
        val ids = sessions.map { it.id }.toSet()
        val recs = data.attendance.filter { it.sessionId in ids }

        val doc = PdfDocument(); var pageNo = 0
        val W = 595f; val H = 842f; val M = 36f
        var page: PdfDocument.Page? = null; var y = 0f
        val title = Paint().apply { textSize = 15f; typeface = Typeface.DEFAULT_BOLD; color = Color.rgb(28, 61, 94); isAntiAlias = true }
        val head = Paint().apply { textSize = 9f; typeface = Typeface.DEFAULT_BOLD; color = Color.WHITE; isAntiAlias = true }
        val body = Paint().apply { textSize = 9f; color = Color.rgb(40, 40, 40); isAntiAlias = true }
        val small = Paint().apply { textSize = 8f; color = Color.rgb(107, 118, 130); isAntiAlias = true }
        val fill = Paint().apply { style = Paint.Style.FILL }
        fun newPage() { page?.let { doc.finishPage(it) }; pageNo++; page = doc.startPage(PdfDocument.PageInfo.Builder(W.toInt(), H.toInt(), pageNo).create()); y = M
            page!!.canvas.drawText("Faculté des Sciences de Tunis — Rapport de présence des TP — page $pageNo", M, H - 18f, small) }
        fun ensure(h: Float) { if (page == null || y + h > H - 40f) newPage() }
        fun table(cols: List<Pair<String, Float>>, rows: List<List<String>>) {
            ensure(36f)
            fill.color = Color.rgb(28, 61, 94); page!!.canvas.drawRect(M, y, W - M, y + 16f, fill)
            var x = M + 4f; cols.forEach { (n, w) -> page!!.canvas.drawText(n, x, y + 11f, head); x += w }; y += 16f
            rows.forEachIndexed { i, r ->
                ensure(14f)
                if (i % 2 == 1) { fill.color = Color.rgb(244, 247, 249); page!!.canvas.drawRect(M, y, W - M, y + 14f, fill) }
                x = M + 4f; r.forEachIndexed { j, v -> page!!.canvas.drawText(v.take(((cols[j].second - 4) / 4.6f).toInt().coerceAtLeast(3)), x, y + 10f, body); x += cols[j].second }
                y += 14f
            }
            y += 10f
        }
        fun pct(p: Int, t: Int) = if (t == 0) "—" else "%.0f %%".format(100.0 * p / t)

        newPage()
        page!!.canvas.drawText("Rapport de présence des TP", M, y + 14f, title); y += 24f
        val scope = listOfNotNull(f.family ?: "Toutes les classes", f.classId?.let { data.classById[it]?.name }, f.teacherId?.let { teacherName(it) },
            if (f.from != null || f.to != null) "du ${f.from?.let(::fmt) ?: "début"} au ${f.to?.let(::fmt) ?: "aujourd’hui"}" else "toute l’année").joinToString(" · ")
        page!!.canvas.drawText(scope, M, y + 10f, small); y += 14f
        page!!.canvas.drawText("Taux de présence = (présents + retards) / appels enregistrés. Généré le ${fmt(LocalDate.now().toString())}.", M, y + 10f, small); y += 20f

        val byGroup = sessions.groupBy { data.classById[it.classId]?.name ?: "?" }.toSortedMap()
        table(listOf("Groupe" to 90f, "Séances" to 60f, "Appels" to 60f, "Présents" to 60f, "Retards" to 55f, "Absents" to 55f, "Justifiés" to 55f, "Présence" to 80f),
            byGroup.map { (g, ss) -> val r = recs.filter { a -> ss.any { it.id == a.sessionId } }
                val p = r.count { it.status == AttendanceStatus.PRESENT }; val l = r.count { it.status == AttendanceStatus.LATE }
                listOf(g, "${ss.size}", "${r.size}", "$p", "$l", "${r.count { it.status == AttendanceStatus.ABSENT }}", "${r.count { it.status == AttendanceStatus.JUSTIFIED }}", pct(p + l, r.size)) })

        ensure(30f); page!!.canvas.drawText("Détail par étudiant", M, y + 12f, title.apply { textSize = 12f }); y += 20f
        val students = data.students.filter { st -> sessions.any { it.classId == st.classId } || recs.any { it.studentId == st.id } }
            .sortedWith(compareBy({ data.classById[it.classId]?.name }, { it.lastName.lowercase() }))
        table(listOf("Étudiant" to 170f, "Groupe" to 80f, "Prés." to 45f, "Ret." to 40f, "Abs." to 40f, "Just." to 40f, "Rattr." to 40f, "Présence" to 68f),
            students.map { st -> val r = recs.filter { it.studentId == st.id }
                val p = r.count { it.status == AttendanceStatus.PRESENT }; val l = r.count { it.status == AttendanceStatus.LATE }
                listOf(st.displayName, data.classById[st.classId]?.name ?: "", "$p", "$l", "${r.count { it.status == AttendanceStatus.ABSENT }}", "${r.count { it.status == AttendanceStatus.JUSTIFIED }}", "${r.count { it.makeupDate != null }}", pct(p + l, r.size)) })

        page?.let { doc.finishPage(it) }
        val file = File(File(context.cacheDir, "reports").apply { mkdirs() }, "Rapport_presence_${(f.family ?: "toutes").replace(' ', '_')}_${LocalDate.now()}.pdf")
        file.outputStream().use { doc.writeTo(it) }; doc.close()
        return file
    }
}
