package tn.utm.fst.gestionpresence.nativeapp.feature.s2

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * PDF des groupes du S2, même modèle que le site (« Liste des groupes d'étudiants ») :
 * A4 paysage, une page pleine par classe ; groupes par blocs de 3, lignes numérotées, effectif en bas.
 */
object GroupsPdf {
    private const val MM = 72f / 25.4f
    private val GCOL = listOf(Color.rgb(61, 124, 201), Color.rgb(106, 168, 79), Color.rgb(255, 217, 102), Color.rgb(237, 125, 49),
        Color.rgb(194, 84, 160), Color.rgb(128, 100, 162), Color.rgb(69, 160, 170), Color.rgb(150, 150, 150))

    private fun ink(c: Int) = if (Color.red(c) * 0.299 + Color.green(c) * 0.587 + Color.blue(c) * 0.114 > 165) Color.rgb(30, 30, 30) else Color.WHITE

    fun build(context: Context, s: S2Snapshot, classes: List<String>, spaceName: String, academicYear: String = "2026/2027"): File? {
        val doc = PdfDocument(); var n = 0
        val W = 297f; val H = 210f; val M = 10f; val IW = W - 2 * M
        val per = 3; val nw = 11f
        classes.forEach { cls ->
            val act = s.members.filter { it.className == cls && it.status == "actif" }
            if (act.isEmpty()) return@forEach
            val G = s.groupsOf(cls).coerceAtLeast(1); val blocks = (G + per - 1) / per
            n++
            val page = doc.startPage(PdfDocument.PageInfo.Builder((W * MM).toInt(), (H * MM).toInt(), n).create())
            val c = page.canvas
            fun paint(size: Float, style: Int, color: Int, align: Paint.Align) = Paint().apply {
                textSize = size; this.color = color; isAntiAlias = true; textAlign = align; typeface = Typeface.create(Typeface.SERIF, style)
            }
            fun text(t: String, x: Float, y: Float, size: Float, style: Int = Typeface.NORMAL, color: Int = Color.rgb(25, 25, 25), align: Paint.Align = Paint.Align.LEFT) =
                c.drawText(t, x * MM, y * MM, paint(size, style, color, align))
            fun fit(t: String, widthMm: Float, size: Float, style: Int = Typeface.NORMAL): String {
                val p = paint(size, style, Color.BLACK, Paint.Align.LEFT); if (p.measureText(t) / MM <= widthMm) return t
                var cut = t; while (cut.length > 3 && p.measureText("$cut…") / MM > widthMm) cut = cut.dropLast(1)
                return "$cut…"
            }
            val fill = Paint().apply { style = Paint.Style.FILL; isAntiAlias = true }
            fun box(x: Float, y: Float, w: Float, h: Float, bg: Int?, line: Int = Color.rgb(150, 150, 150), width: Float = 0.6f) {
                if (bg != null) { fill.color = bg; c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, fill) }
                c.drawRect(x * MM, y * MM, (x + w) * MM, (y + h) * MM, Paint().apply { style = Paint.Style.STROKE; strokeWidth = width; color = line; isAntiAlias = true })
            }
            val lists = (1..G).map { g -> act.filter { it.groupNo == g }.map { it.name }.sortedWith(String.CASE_INSENSITIVE_ORDER) }
            val R = maxOf(12, lists.maxOf { it.size })
            // En-tête
            fill.color = Color.rgb(220, 230, 241); c.drawRect(M * MM, M * MM, (M + IW) * MM, (M + 10) * MM, fill)
            text("LISTE DES GROUPES D'ÉTUDIANTS - $cls", W / 2, M + 7f, 16f, Typeface.BOLD, align = Paint.Align.CENTER)
            fill.color = Color.rgb(255, 242, 204); c.drawRect(M * MM, (M + 10) * MM, (M + IW) * MM, (M + 17) * MM, fill)
            text("Année universitaire $academicYear - Répartition en $G groupes", W / 2, M + 15f, 10.5f, Typeface.BOLD, align = Paint.Align.CENTER)
            // Blocs de groupes
            val top = M + 21f; val foot = 8f; val gapB = 5f
            val bh = (H - top - M - foot - (blocks - 1) * gapB) / blocks; val rh = bh / (R + 2); val gw = (IW - nw) / per
            val fs = maxOf(8f, minOf(11f, rh * 1.75f))
            for (b in 0 until blocks) {
                val y0 = top + b * (bh + gapB); val gs = (0 until per).map { b * per + it }.filter { it < G }
                box(M, y0, nw, rh, Color.rgb(242, 242, 242), Color.rgb(60, 60, 60))
                text("N°", M + nw / 2, y0 + rh * 0.68f, fs, Typeface.BOLD, align = Paint.Align.CENTER)
                gs.forEachIndexed { k, g -> val x = M + nw + k * gw; val col = GCOL[g % GCOL.size]
                    box(x, y0, gw, rh, col, Color.rgb(60, 60, 60)); text("G${g + 1}", x + gw / 2, y0 + rh * 0.7f, fs + 1, Typeface.BOLD, ink(col), Paint.Align.CENTER) }
                for (r in 0 until R) {
                    val y = y0 + (r + 1) * rh
                    box(M, y, nw, rh, null); text("${r + 1}", M + nw / 2, y + rh * 0.7f, fs, Typeface.BOLD, align = Paint.Align.CENTER)
                    gs.forEachIndexed { k, g -> val x = M + nw + k * gw; box(x, y, gw, rh, null)
                        lists[g].getOrNull(r)?.let { name -> text(fit(name, gw - 3f, fs), x + 1.5f, y + rh * 0.7f, fs) } }
                }
                val ye = y0 + (R + 1) * rh
                box(M, ye, nw, rh, Color.rgb(242, 248, 246)); text("Effectif", M + nw / 2, ye + rh * 0.7f, fs - 1, Typeface.BOLD, align = Paint.Align.CENTER)
                gs.forEachIndexed { k, g -> val x = M + nw + k * gw; val col = GCOL[g % GCOL.size]
                    box(x, ye, gw, rh, Color.rgb(242, 248, 246))
                    text("${lists[g].size}/$R", x + gw / 2, ye + rh * 0.7f, fs - 1, Typeface.BOLD, if (Color.red(col) > 230 && Color.green(col) > 200) Color.rgb(160, 120, 0) else col, Paint.Align.CENTER) }
                box(M, y0, nw + gs.size * gw, (R + 2) * rh, null, Color.rgb(60, 60, 60), 1.4f)
            }
            val exc = s.members.filter { it.className == cls && it.status == "exclu" }.map { it.name }.sortedWith(String.CASE_INSENSITIVE_ORDER)
            val note = if (exc.isNotEmpty()) "Mis de côté (absents à tout le S1, réintégrables) : ${exc.joinToString(", ")}"
                else "Effectif total : ${act.size} étudiants · édité le ${LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))}"
            text(fit(note, IW, 9f, Typeface.ITALIC), M, H - M + 1f, 9f, Typeface.ITALIC, Color.rgb(90, 90, 90))
            doc.finishPage(page)
        }
        if (n == 0) { doc.close(); return null }
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val safe = (if (classes.size == 1) classes[0] else spaceName).replace(Regex("[^\\w-]+"), "_")
        val file = File(dir, "Groupes_S2_$safe.pdf")
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }
}
