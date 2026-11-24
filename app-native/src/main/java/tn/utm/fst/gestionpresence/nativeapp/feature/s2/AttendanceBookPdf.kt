package tn.utm.fst.gestionpresence.nativeapp.feature.s2

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import tn.utm.fst.gestionpresence.nativeapp.core.model.PlanSession
import java.io.File
import java.time.LocalDate

/**
 * Cahier de présence du S2, même modèle que le cahier papier et que le site :
 * pour chaque jour, une page de garde puis une page par classe et par groupe (A4 paysage).
 */
object AttendanceBookPdf {
    private const val MM = 72f / 25.4f
    private val GROUP = listOf(Color.rgb(61, 124, 201), Color.rgb(91, 154, 60), Color.rgb(236, 196, 64), Color.rgb(232, 131, 58), Color.rgb(181, 72, 122), Color.rgb(106, 90, 205))
    private val CLASS = listOf(Color.rgb(207, 221, 240), Color.rgb(235, 207, 214), Color.rgb(222, 235, 210))
    private val CREAM = Color.rgb(243, 239, 200)
    private val KIND = mapOf("ds" to "Semaine des DS", "vacances" to "Vacances", "ferie" to "Jour férié", "examen" to "Examens", "autre" to "Date exclue")

    fun build(context: Context, s: S2Snapshot, plan: List<PlanSession>, classes: List<String>, academicYear: String = "2026/2027"): File? {
        if (s.members.none { it.status == "actif" }) return null
        val active = s.slots.filter { it.active }
        val pairs = active.groupBy { it.pairKey }.values.map { l -> l.sortedWith(compareBy<ClassSlot>({ it.pairOrder }, { it.className })) }
        val books = classes.map { c -> pairs.firstOrNull { p -> p.any { it.className == c } } ?: listOfNotNull(active.firstOrNull { it.className == c }) }
            .filter { it.isNotEmpty() }.distinct().sortedBy { it.first().weekday }
        if (books.isEmpty()) return null
        val G = s.settings.groupCount
        val start = s.settings.startDate; val end = s.settings.endDate
        val exList = s.excluded.filter { it.validated && it.endsOn >= start && (end == null || it.startsOn <= end) }.sortedBy { it.startsOn }
        fun onDay(e: Excluded, wd: Int): Boolean { var d = LocalDate.parse(e.startsOn); val last = LocalDate.parse(e.endsOn); while (!d.isAfter(last)) { if (d.dayOfWeek.value == wd) return true; d = d.plusDays(1) }; return false }
        fun label(e: Excluded) = e.label.takeIf { it.isNotBlank() } ?: KIND[e.kind] ?: "Date exclue"
        fun f(d: String) = S2Admin.fmt(d)

        val doc = PdfDocument(); var n = 0
        val W = 297f; val M = 14f; val IW = W - 2 * M
        books.forEach { bk ->
            val names = bk.map { it.className }; val wd = bk.first().weekday; val day = DAY_LABEL[wd].orEmpty()
            val hours = "${bk.first().start.take(5).replace(':', 'H')} – ${bk.first().end.take(5).replace(':', 'H')}"
            // ---- Page de garde ----
            run {
                n++; val page = doc.startPage(PdfDocument.PageInfo.Builder((297 * MM).toInt(), (210 * MM).toInt(), n).create())
                val p = Painter(page.canvas)
                var y = 22f
                p.text("UNIVERSITÉ DE TUNIS EL MANAR — FACULTÉ DES SCIENCES DE TUNIS", W / 2, y, 10.5f); y += 7f
                p.band(M + 12, y, IW - 24, 11f, CREAM, "CAHIER DE PRÉSENCE — TRAVAUX PRATIQUES DE PHYSIQUE", 15f); y += 15f
                p.band(M + 12, y, IW - 24, 10f, Color.rgb(215, 215, 215), day.uppercase(), 16f); y += 10f
                val cw = (IW - 24) / names.size
                names.forEachIndexed { i, c -> p.band(M + 12 + i * cw, y, cw, 10f, CLASS[i % CLASS.size], c, 14f) }; y += 18f
                p.text("Année universitaire $academicYear — Semestre 2", W / 2, y, 11f); y += 6f
                p.text("Horaire : $hours — $G groupes par classe", W / 2, y, 11f, bold = false); y += 4f
                exList.filter { onDay(it, wd) }.forEach { e ->
                    val t = "${label(e)} : ${if (e.startsOn == e.endsOn) "le ${f(e.startsOn)}" else "du ${f(e.startsOn)} au ${f(e.endsOn)}"} — aucun TP"
                    p.band(M + 12, y, IW - 24, 7f, Color.rgb(244, 176, 120), t.uppercase(), 9.5f); y += 7.5f
                }
                y += 5f; p.band(M + 12, y, IW - 24, 7f, CREAM, "LÉGENDE DES MANIPULATIONS", 10.5f); y += 11f
                p.text("Code", M + 16, y, 9.5f, center = false); p.text("Intitulé", M + 110, y, 9.5f); p.text("Salle", W - M - 28, y, 9.5f); y += 1.5f
                p.line(M + 12, y, W - M - 12, y, 1.1f); y += 6f
                s.manips.filter { it.active }.forEach { m ->
                    val room = s.stations.firstOrNull { it.weekday == wd && it.code == m.code }?.room?.takeIf { it.isNotBlank() }
                    p.text(m.code, M + 16, y, 9.5f, center = false)
                    p.text(m.title?.takeIf { it.isNotBlank() } ?: ".....................................................................................", M + 30, y, 9.5f, bold = false, center = false)
                    p.text(room ?: "..................", W - M - 28, y, 9.5f, bold = false); y += 1.8f
                    p.line(M + 12, y, W - M - 12, y, 0.6f); y += 6f
                }
                y += 4f; p.text("Repérage des groupes", W / 2, y, 10f); y += 2.5f
                val gw = (IW - 24) / G
                for (g in 0 until G) { val c = GROUP[g % GROUP.size]; p.band(M + 12 + g * gw, y, gw, 7f, c, "G${g + 1}", 10f, ink(c)) }
                y += 15f
                p.text("Présence / absence à renseigner dans les cases. Manipulations prévues indiquées sous chaque date (à corriger à la main si besoin).", W / 2, y, 9.5f, bold = false, italic = true)
                doc.finishPage(page)
            }
            // ---- Une page par classe et par groupe ----
            names.forEachIndexed { ci, cls ->
                val sess = plan.filter { it.className == cls }.sortedBy { it.date }
                val cols = maxOf(sess.size + 1, 6)
                val exs = exList.filter { onDay(it, wd) }.map { e -> "${label(e)} ${if (e.startsOn == e.endsOn) f(e.startsOn) else f(e.startsOn).take(5) + " – " + f(e.endsOn)}" }
                for (g in 1..G) {
                    val stu = s.members.filter { it.className == cls && it.groupNo == g && it.status == "actif" }.map { it.name }.sortedWith(String.CASE_INSENSITIVE_ORDER)
                    val nrows = maxOf(12, stu.size + 2)
                    n++; val page = doc.startPage(PdfDocument.PageInfo.Builder((297 * MM).toInt(), (210 * MM).toInt(), n).create())
                    val p = Painter(page.canvas)
                    var y = 14f; val X = M; val Wt = IW
                    p.band(X, y, Wt, 8f, CREAM, "CAHIER DE PRÉSENCE — TP PHYSIQUE — ${day.uppercase()}", 12f); y += 8f
                    val gc = GROUP[(g - 1) % GROUP.size]
                    p.band(X, y, Wt * 0.57f, 8f, CLASS[ci % CLASS.size], "CLASSE $cls", 12f)
                    p.band(X + Wt * 0.57f, y, Wt * 0.43f, 8f, gc, "GROUPE G$g", 12f, ink(gc)); y += 12f
                    p.text("Horaire : $hours  |  Effectif actuel : ${stu.size}/$nrows", W / 2, y, 9.5f); y += 2.5f
                    val cN = 10f; val cName = 68f; val cd = (Wt - cN - cName) / cols; val hh = 13f
                    val rh = minOf(10f, (186f - y - hh) / nrows)
                    p.rect(X, y, Wt, hh, CREAM)
                    p.text("N°", X + cN / 2, y + hh / 2 + 1.3f, 9f); p.text("NOM ET PRÉNOM", X + cN + cName / 2, y + hh / 2 + 1.3f, 9f)
                    p.line(X + cN, y, X + cN, y + hh + nrows * rh); p.line(X + cN + cName, y, X + cN + cName, y + hh + nrows * rh)
                    for (c in 0 until cols) {
                        val x = X + cN + cName + c * cd
                        if (c > 0) p.line(x, y, x, y + hh + nrows * rh)
                        val se = sess.getOrNull(c)
                        if (se != null) {
                            val sl = se.slots.firstOrNull { it.groupNo == g }
                            p.text(f(se.date), x + cd / 2, y + 5f, 9.5f)
                            p.text("Manip. : ${sl?.manipulation ?: ".........."}", x + cd / 2, y + 10f, 8.5f, bold = false)
                        } else {
                            p.text("...../...../.......", x + cd / 2, y + 5f, 8.5f, bold = false)
                            p.text("Manip. : ..........", x + cd / 2, y + 10f, 8.5f, bold = false)
                        }
                    }
                    y += hh
                    for (r in 0 until nrows) {
                        p.line(X, y + (r + 1) * rh, X + Wt, y + (r + 1) * rh)
                        p.text("${r + 1}", X + cN / 2, y + r * rh + rh / 2 + 1.3f, 9f)
                        stu.getOrNull(r)?.let { p.text(it.uppercase(), X + cN + 2, y + r * rh + rh / 2 + 1.3f, if (it.length > 30) 8f else 9.5f, bold = false, center = false) }
                    }
                    p.frame(X, y - hh, Wt, hh + nrows * rh); y += nrows * rh + 1f
                    if (exs.isNotEmpty()) {
                        val lines = p.wrap("Aucun TP : " + exs.joinToString("  ·  "), Wt - 6, 9f)
                        val bh = 2.5f + lines.size * 4f
                        p.rect(X, y, Wt, bh, CREAM, stroke = false)
                        lines.forEachIndexed { i, l -> p.text(l, W / 2, y + 4.3f + i * 4f, 9f) }
                        y += bh
                    }
                    y += 6f
                    p.text("Signature enseignant : .....................................................", X, y, 10f, bold = false, italic = true, center = false)
                    p.text("Observations : .....................................................", X + Wt * 0.6f, y, 10f, bold = false, center = false)
                    y += 7f
                    p.text(".........................................................................................................................................................................................", X, y, 10f, bold = false, center = false)
                    doc.finishPage(page)
                }
            }
        }
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, if (books.size == 1) "Cahier_presence_${DAY_LABEL[books[0].first().weekday].orEmpty().lowercase()}_${books[0].joinToString("_") { it.className }}_S2.pdf" else "Cahiers_presence_TP_Physique_S2.pdf")
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }

    private fun ink(c: Int): Int = if (Color.red(c) * 0.299 + Color.green(c) * 0.587 + Color.blue(c) * 0.114 > 165) Color.rgb(30, 30, 30) else Color.WHITE

    private class Painter(val c: android.graphics.Canvas) {
        private val stroke = Paint().apply { style = Paint.Style.STROKE; strokeWidth = 0.7f; color = Color.rgb(40, 40, 40); isAntiAlias = true }
        private val fill = Paint().apply { style = Paint.Style.FILL; isAntiAlias = true }
        fun paint(size: Float, bold: Boolean, italic: Boolean, color: Int, center: Boolean) = Paint().apply {
            textSize = size; this.color = color; isAntiAlias = true; textAlign = if (center) Paint.Align.CENTER else Paint.Align.LEFT
            typeface = Typeface.create(Typeface.SANS_SERIF, when { bold && italic -> Typeface.BOLD_ITALIC; bold -> Typeface.BOLD; italic -> Typeface.ITALIC; else -> Typeface.NORMAL })
        }
        fun text(s: String, x: Float, y: Float, size: Float, bold: Boolean = true, italic: Boolean = false, color: Int = Color.rgb(30, 30, 30), center: Boolean = true) =
            c.drawText(s, x * MM, y * MM, paint(size, bold, italic, color, center))
        fun rect(x: Float, y: Float, w: Float, h: Float, rgb: Int, stroke: Boolean = true) {
            fill.color = rgb; c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, fill)
            if (stroke) c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, this.stroke)
        }
        fun frame(x: Float, y: Float, w: Float, h: Float) {
            val p = Paint(stroke).apply { strokeWidth = 1.4f }; c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, p)
        }
        fun line(x1: Float, y1: Float, x2: Float, y2: Float, width: Float = 0.7f) {
            val p = Paint(stroke).apply { strokeWidth = width }; c.drawLine(x1 * MM, y1 * MM, x2 * MM, y2 * MM, p)
        }
        fun band(x: Float, y: Float, w: Float, h: Float, rgb: Int, t: String, size: Float, color: Int = Color.rgb(30, 30, 30)) {
            rect(x, y, w, h, rgb); text(t, x + w / 2, y + h / 2 + size * 0.13f, size, color = color)
        }
        /** Coupe un texte en lignes qui tiennent dans la largeur (mm). */
        fun wrap(t: String, widthMm: Float, size: Float): List<String> {
            val p = paint(size, true, false, Color.BLACK, true); val out = mutableListOf<String>(); var cur = ""
            t.split(" ").forEach { w -> val next = if (cur.isEmpty()) w else "$cur $w"; if (p.measureText(next) / MM > widthMm && cur.isNotEmpty()) { out += cur; cur = w } else cur = next }
            if (cur.isNotEmpty()) out += cur
            return out
        }
    }
}
