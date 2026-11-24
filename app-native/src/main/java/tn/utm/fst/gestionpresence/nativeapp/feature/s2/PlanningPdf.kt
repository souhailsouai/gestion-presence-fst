package tn.utm.fst.gestionpresence.nativeapp.feature.s2

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import tn.utm.fst.gestionpresence.nativeapp.core.model.PlanSession
import java.io.File
import java.time.LocalDate

/** PDF du planning S2, même modèle que le site : A4 paysage, une page par jour partagé
 *  (les classes qui alternent sont sur la même feuille, une couleur de ligne par classe). */
object PlanningPdf {
    private const val MM = 72f / 25.4f // points par millimètre

    fun build(
        context: Context,
        pagesOf: List<Pair<List<String>, String>>,
        plan: List<PlanSession>,
        excluded: Map<String, String>,
        slotTimes: Map<String, Triple<Int, String, String>>,
        teacherName: (String?) -> String,
        groupCount: Int,
        academicYear: String = "2026/2027"
    ): File? {
        val doc = PdfDocument()
        var pages = 0
        val tints = listOf(Color.rgb(255, 250, 214), Color.rgb(226, 239, 218), Color.rgb(222, 235, 247))
        pagesOf.forEach { (names, mode) ->
            val cls = names.first(); val multi = names.size > 1
            val list = plan.filter { it.className in names }.sortedBy { it.date }
            if (list.isEmpty()) return@forEach
            pages++
            val page = doc.startPage(PdfDocument.PageInfo.Builder((297 * MM).toInt(), (210 * MM).toInt(), pages).create())
            val c = page.canvas
            val line = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 0.6f; color = Color.rgb(40, 40, 40) }
            val fill = Paint().apply { style = Paint.Style.FILL }
            fun txt(size: Float, bold: Boolean = true, color: Int = Color.rgb(20, 20, 20), italic: Boolean = false) = Paint().apply {
                textSize = size; this.color = color; isAntiAlias = true; textAlign = Paint.Align.CENTER
                typeface = Typeface.create(Typeface.SANS_SERIF, when { bold && italic -> Typeface.BOLD_ITALIC; bold -> Typeface.BOLD; italic -> Typeface.ITALIC; else -> Typeface.NORMAL })
            }
            fun box(x: Float, y: Float, w: Float, h: Float, rgb: Int? = null) {
                if (rgb != null) { fill.color = rgb; c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, fill) }
                c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, line)
            }
            fun text(s: String, x: Float, y: Float, p: Paint) = c.drawText(s, x * MM, y * MM, p)

            val slot = slotTimes[cls]
            val rows = mutableListOf<Pair<String, PlanSession?>>()
            var d = LocalDate.parse(list.first().date); val last = LocalDate.parse(list.last().date)
            while (!d.isAfter(last)) { val iso = d.toString(); if (excluded.containsKey(iso) && list.none { it.date == iso }) rows += iso to null; d = d.plusDays(7) }
            list.forEach { rows += it.date to it }
            rows.sortBy { it.first }

            val X = 14f; val W = 269f; val c0 = if (multi) 30f else 36f; val c1 = if (multi) 24f else 0f; val cw = (W - c0 - c1) / groupCount; var y = 10f
            val levels = names.map { it.substringBefore('-') }.distinct().joinToString(" / ")
            box(X, y, W, 8f, Color.rgb(243, 241, 234)); text("[$levels] - [$academicYear] - [SEMESTRE 2]", X + W / 2, y + 5.5f, txt(10f)); y += 8f
            box(X, y, W, 12f, Color.rgb(243, 241, 234)); text("PLANNING DES TP DE PHYSIQUE", X + W / 2, y + 8.3f, txt(16f)); y += 12f
            val band = names.joinToString("  /  ") + if (!multi) "" else if (mode == "bloc") "   (l'une après l'autre, comme au S1)" else "   (une semaine sur deux)"
            box(X, y, W, 9f, Color.rgb(255, 242, 0)); text(band, X + W / 2, y + 6.3f, txt(12f)); y += 9f
            box(X, y, c0, 9f); text(slot?.let { DAY_LABEL[it.first] }.orEmpty(), X + c0 / 2, y + 6f, txt(9f, color = Color.rgb(190, 0, 0)))
            if (multi) { box(X + c0, y, c1, 9f, Color.rgb(221, 235, 247)); text("Classe", X + c0 + c1 / 2, y + 6f, txt(9f)) }
            for (g in 0 until groupCount) { box(X + c0 + c1 + g * cw, y, cw, 9f, Color.rgb(221, 235, 247)); text("G${g + 1}", X + c0 + c1 + g * cw + cw / 2, y + 6f, txt(9f)) }
            y += 9f
            box(X, y, c0, 8f); text(slot?.let { "${it.second.replace(':', 'H')} - ${it.third.replace(':', 'H')}" }.orEmpty(), X + c0 / 2, y + 5.5f, txt(8.5f))
            if (multi) box(X + c0, y, c1, 8f)
            for (g in 0 until groupCount) box(X + c0 + c1 + g * cw, y, cw, 8f)
            y += 8f
            val rh = minOf(17f, (195f - y - 10f) / maxOf(rows.size, 1))
            rows.forEach { (date, s) ->
                if (s == null) {
                    box(X, y, c0, rh, Color.rgb(252, 229, 180)); box(X + c0, y, W - c0, rh, Color.rgb(252, 229, 180))
                    text(S2Admin.fmt(date), X + c0 / 2, y + rh / 2 + 1.6f, txt(10f))
                    text("${excluded[date]} - aucun TP", X + c0 + (W - c0) / 2, y + rh / 2 + 1.6f, txt(10f, color = Color.rgb(190, 0, 0)))
                } else {
                    val tint = if (multi) tints[names.indexOf(s.className).coerceAtLeast(0) % tints.size] else null
                    box(X, y, c0, rh, tint); text(S2Admin.fmt(date), X + c0 / 2, y + rh / 2 + 1.6f, txt(10f))
                    if (multi) { box(X + c0, y, c1, rh, tint); text(s.className, X + c0 + c1 / 2, y + rh / 2 + 1.6f, txt(10f)) }
                    for (g in 0 until groupCount) {
                        box(X + c0 + c1 + g * cw, y, cw, rh)
                        s.slots.firstOrNull { it.groupNo == g + 1 }?.let { x ->
                            text("${x.manipulation}${x.room?.takeIf { it.isNotBlank() }?.let { " - Salle $it" } ?: ""}", X + c0 + c1 + g * cw + cw / 2, y + rh / 2, txt(9.5f, color = Color.rgb(31, 73, 125)))
                            text(teacherName(x.teacherId), X + c0 + c1 + g * cw + cw / 2, y + rh / 2 + 4f, txt(7.5f, bold = false, color = Color.rgb(31, 73, 125)))
                        }
                    }
                }
                y += rh
            }
            val lastDate = LocalDate.parse(list.last().date)
            val foot = names.mapNotNull { n -> list.lastOrNull { it.className == n }?.let { LocalDate.parse(it.date) }?.let { l -> "$n : dernière séance ${DAY_LABEL[l.dayOfWeek.value]?.lowercase()} ${S2Admin.fmt(l.toString())}" } }.joinToString("   ·   ")
            box(X, y, W, 8f, Color.rgb(230, 230, 230))
            text("Planning arrêté au ${S2Admin.fmt(lastDate.plusDays(1).toString())} - $foot", X + W / 2, y + 5.3f, txt(8f, bold = false, italic = true))
            doc.finishPage(page)
        }
        if (pages == 0) { doc.close(); return null }
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, if (pagesOf.size == 1) "Planning_${pagesOf[0].first.joinToString("_")}_TP_Physique_S2.pdf" else "Planning_TP_Physique_S2.pdf")
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Planning S2 (PDF)").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
