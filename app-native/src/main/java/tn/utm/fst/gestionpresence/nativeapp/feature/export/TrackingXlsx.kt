package tn.utm.fst.gestionpresence.nativeapp.feature.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData
import java.io.File
import java.io.OutputStream
import java.text.Normalizer
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Export Excel de suivi des TP, même contenu que le site (v31) :
 * une feuille par classe (MPI1-A…, PC1-A ou LPC3), une ligne par étudiant,
 * statut et note de chaque manipulation, puis présences, retards, absences et pourcentages.
 * Le fichier .xlsx est écrit directement (format Office Open XML), sans bibliothèque externe.
 */
object TrackingXlsx {
    private val LABEL = mapOf(AttendanceStatus.PRESENT to "Présent", AttendanceStatus.LATE to "Retard", AttendanceStatus.ABSENT to "Absent non justifié", AttendanceStatus.JUSTIFIED to "Absent justifié")

    internal sealed interface Cell { data class T(val v: String, val style: Int = 0) : Cell; data class N(val v: Double, val style: Int = 0) : Cell; object Empty : Cell }
    internal data class Sheet(val name: String, val rows: List<List<Cell>>, val headerRow: Int, val widths: List<Double>)

    private fun base(name: String) = name.replace(Regex("-G\\d+$", RegexOption.IGNORE_CASE), "")
    private fun safe(v: String) = Normalizer.normalize(v, Normalizer.Form.NFD).replace(Regex("\\p{M}"), "").replace(Regex("[^A-Za-z0-9_-]+"), "_").trim('_')

    fun build(context: Context, data: RepositoryData, families: List<String>, fileLabel: String, academicYear: String = "2026/2027"): File? {
        val sheets = families.mapNotNull { family -> sheetFor(data, family, academicYear) }
        if (sheets.isEmpty()) return null
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        val file = File(dir, "Suivi_TP_${safe(fileLabel).replace('-', '_')}_${academicYear.replace('/', '_')}.xlsx")
        file.outputStream().use { write(it, sheets) }
        return file
    }

    private fun sheetFor(data: RepositoryData, family: String, year: String): Sheet? {
        val classes = data.classes.filter { base(it.name) == family }
        if (classes.isEmpty()) return null
        val classIds = classes.map { it.id }.toSet()
        val students = data.students.filter { it.classId in classIds }.sortedWith(compareBy({ data.classById[it.classId]?.name }, { it.lastName.lowercase() }, { it.firstName.lowercase() }))
        val sessions = data.sessions.filter { it.classId in classIds }.associateBy { it.id }
        // Manipulation de la séance : planning des séances (session_plans) ; sinon date de la séance.
        val manipOf = { sessionId: String -> data.sessionManipulations[sessionId] ?: sessions[sessionId]?.sessionDate?.let { "Séance ${it.drop(8)}/${it.drop(5).take(2)}" } ?: "?" }
        val records = students.flatMap { st -> data.attendanceByStudent[st.id].orEmpty().filter { it.sessionId in sessions } }
        val manips = records.map { manipOf(it.sessionId) }.distinct().sortedWith(compareBy({ !it.startsWith("M") }, { it.drop(1).toIntOrNull() ?: 99 }, { it }))
        val columns = listOf("N°", "Nom", "Prénom", "Groupe") + manips.flatMap { listOf("$it Statut", "$it Note") } +
            listOf("Présences", "Retards", "Abs. justifiées", "Abs. non justifiées", "Total absences", "Présence %", "Absence %")
        val rows = mutableListOf<List<Cell>>(
            listOf(Cell.T("Suivi TP — $family", 1)),
            listOf(Cell.T("Faculté des Sciences de Tunis — Université de Tunis El Manar")),
            listOf(Cell.T("Année universitaire"), Cell.T(year)),
            listOf(Cell.T("Classe"), Cell.T(family)),
            listOf(Cell.T("Export généré avec l’application Android")),
            emptyList(),
            columns.map { Cell.T(it, 2) }
        )
        students.forEachIndexed { i, st ->
            val recs = data.attendanceByStudent[st.id].orEmpty().filter { it.sessionId in sessions }
            val row = mutableListOf<Cell>(Cell.N((i + 1).toDouble()), Cell.T(st.lastName), Cell.T(st.firstName), Cell.T(data.classById[st.classId]?.name ?: family))
            manips.forEach { m ->
                val r = recs.firstOrNull { manipOf(it.sessionId) == m }
                row += if (r == null) Cell.T("—") else Cell.T(if (r.makeupDate != null) "Rattrapé" else LABEL[r.status] ?: "—")
                row += r?.grade?.let { Cell.N(it, 4) } ?: Cell.Empty
            }
            // Mêmes définitions que le site : présence = présent + retard ; absence = absent + justifié.
            val present = recs.count { it.status == AttendanceStatus.PRESENT }; val late = recs.count { it.status == AttendanceStatus.LATE }
            val absent = recs.count { it.status == AttendanceStatus.ABSENT }; val justified = recs.count { it.status == AttendanceStatus.JUSTIFIED }
            val counted = present + late + absent + justified
            row += listOf(Cell.N(present.toDouble()), Cell.N(late.toDouble()), Cell.N(justified.toDouble()), Cell.N(absent.toDouble()), Cell.N((absent + justified).toDouble()),
                Cell.N(if (counted == 0) 0.0 else (present + late).toDouble() / counted, 3), Cell.N(if (counted == 0) 0.0 else (absent + justified).toDouble() / counted, 3))
            rows += row
        }
        val widths = columns.map { c -> when { c == "N°" -> 5.0; c == "Nom" || c == "Prénom" -> 18.0; c == "Groupe" -> 14.0; c.endsWith(" Statut") -> 21.0; c.endsWith(" Note") -> 11.0; c.endsWith("%") -> 12.0; else -> minOf(24.0, maxOf(12.0, c.length + 2.0)) } }
        return Sheet(safe(family).take(31).ifBlank { "Classe" }, rows, 7, widths)
    }

    private fun col(i: Int): String { var n = i + 1; val sb = StringBuilder(); while (n > 0) { val r = (n - 1) % 26; sb.insert(0, ('A' + r)); n = (n - 1) / 26 }; return sb.toString() }
    private fun esc(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    internal fun write(out: OutputStream, sheets: List<Sheet>) {
        ZipOutputStream(out).use { zip ->
            fun put(name: String, body: String) { zip.putNextEntry(ZipEntry(name)); zip.write(body.toByteArray(Charsets.UTF_8)); zip.closeEntry() }
            put("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>""" +
                sheets.indices.joinToString("") { """<Override PartName="/xl/worksheets/sheet${it + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""" } + "</Types>")
            put("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""")
            put("xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>""" +
                sheets.mapIndexed { i, s -> """<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>""" }.joinToString("") + "</sheets></workbook>")
            put("xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">""" +
                sheets.indices.joinToString("") { """<Relationship Id="rId${it + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${it + 1}.xml"/>""" } +
                """<Relationship Id="rId${sheets.size + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""")
            // Styles : 0 normal, 1 titre gras 14, 2 en-tête gras fond bleu clair, 3 pourcentage 0.0 %, 4 note 0.00
            put("xl/styles.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>""")
            sheets.forEachIndexed { i, s ->
                val last = col(s.widths.size - 1)
                val sb = StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="${s.headerRow}" topLeftCell="A${s.headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>""")
                s.widths.forEachIndexed { c, w -> sb.append("""<col min="${c + 1}" max="${c + 1}" width="$w" customWidth="1"/>""") }
                sb.append("</cols><sheetData>")
                s.rows.forEachIndexed { r, cells ->
                    sb.append("""<row r="${r + 1}">""")
                    cells.forEachIndexed { c, cell ->
                        val ref = col(c) + (r + 1)
                        when (cell) {
                            is Cell.T -> sb.append("""<c r="$ref" t="inlineStr"${if (cell.style > 0) " s=\"${cell.style}\"" else ""}><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>""")
                            is Cell.N -> sb.append("""<c r="$ref"${if (cell.style > 0) " s=\"${cell.style}\"" else ""}><v>${cell.v}</v></c>""")
                            Cell.Empty -> Unit
                        }
                    }
                    sb.append("</row>")
                }
                sb.append("""</sheetData><autoFilter ref="A${s.headerRow}:$last${s.headerRow}"/><mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>""")
                put("xl/worksheets/sheet${i + 1}.xml", sb.toString())
            }
        }
    }

    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Suivi des TP (Excel)").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
