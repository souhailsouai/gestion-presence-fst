package tn.utm.fst.gestionpresence.nativeapp.feature.s2

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import java.io.InputStream
import java.text.Normalizer
import java.time.LocalDate
import java.util.zip.ZipInputStream

/**
 * Lecture d'un calendrier .xlsx (sans bibliothèque externe : un .xlsx est un zip de fichiers XML).
 * Même règle que le site : une ligne qui contient un mot-clé (vacances, férié, DS, examen…) et des dates
 * du S2 devient une proposition « à valider ». Rien n'est validé automatiquement.
 */
object CalendarImport {
    private val KEYWORDS = Regex("(vacance|f[ée]ri[ée]|cong[ée]|\\bds\\b|devoir|examen|rattrapage|f[êe]te|a[iï]d|mouled|ramadan|r[ée]volution|ind[ée]pendance|martyrs|travail)", RegexOption.IGNORE_CASE)
    private val DATE_TEXT = Regex("(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})")

    /** Toutes les lignes de toutes les feuilles d'un .xlsx (texte ou nombre par cellule). */
    fun readRows(input: InputStream): List<List<Any?>> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(input).use { zip ->
            var e = zip.nextEntry
            while (e != null) {
                if (e.name == "xl/sharedStrings.xml" || (e.name.startsWith("xl/worksheets/sheet") && e.name.endsWith(".xml"))) files[e.name] = zip.readBytes()
                e = zip.nextEntry
            }
        }
        val shared = files["xl/sharedStrings.xml"]?.let(::sharedStrings).orEmpty()
        return files.keys.filter { it.startsWith("xl/worksheets/") }.sorted().flatMap { rows(files[it]!!, shared) }
    }

    fun parse(input: InputStream): List<Excluded> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(input).use { zip ->
            var e = zip.nextEntry
            while (e != null) {
                if (e.name == "xl/sharedStrings.xml" || (e.name.startsWith("xl/worksheets/sheet") && e.name.endsWith(".xml"))) files[e.name] = zip.readBytes()
                e = zip.nextEntry
            }
        }
        val shared = files["xl/sharedStrings.xml"]?.let(::sharedStrings).orEmpty()
        val out = mutableListOf<Excluded>()
        files.keys.filter { it.startsWith("xl/worksheets/") }.sorted().forEach { name ->
            rows(files[name]!!, shared).forEach { cells ->
                val text = cells.filterIsInstance<String>().joinToString(" ")
                if (!KEYWORDS.containsMatchIn(text)) return@forEach
                val dates = (cells.mapNotNull(::toIso) + DATE_TEXT.findAll(text).mapNotNull { toIso(it.value) })
                    .filter { it in "2027-01-01".."2027-08-31" }.sorted()
                if (dates.isEmpty()) return@forEach
                val kind = when {
                    Regex("vacance|cong", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "vacances"
                    Regex("\\bds\\b|devoir", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "ds"
                    Regex("examen", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "examen"
                    Regex("f[ée]ri|f[êe]te|a[iï]d", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "ferie"
                    else -> "autre"
                }
                out += Excluded("", dates.first(), dates.last(), text.replace(Regex("\\s+"), " ").trim().take(160), kind, "calendrier", false)
            }
        }
        return out.distinctBy { it.startsOn + it.endsOn + it.label }
    }

    /** Valeur de cellule → date ISO : nombre de série Excel, ou texte jj/mm/aaaa. */
    private fun toIso(v: Any?): String? = when (v) {
        is Double -> if (v in 20000.0..80000.0) LocalDate.of(1899, 12, 30).plusDays(v.toLong()).toString() else null
        is String -> DATE_TEXT.find(v)?.let { m ->
            val y = m.groupValues[3].let { if (it.length == 2) "20$it" else it }
            runCatching { LocalDate.of(y.toInt(), m.groupValues[2].toInt(), m.groupValues[1].toInt()).toString() }.getOrNull()
        }
        else -> null
    }

    private fun sharedStrings(bytes: ByteArray): List<String> {
        val p = Xml.newPullParser(); p.setInput(bytes.inputStream(), "UTF-8")
        val out = mutableListOf<String>(); val sb = StringBuilder(); var inSi = false; var inT = false
        while (p.next() != XmlPullParser.END_DOCUMENT) {
            when (p.eventType) {
                XmlPullParser.START_TAG -> when (p.name) { "si" -> { inSi = true; sb.clear() }; "t" -> inT = inSi }
                XmlPullParser.TEXT -> if (inT) sb.append(p.text)
                XmlPullParser.END_TAG -> when (p.name) { "t" -> inT = false; "si" -> { inSi = false; out += sb.toString() } }
            }
        }
        return out
    }

    private fun rows(bytes: ByteArray, shared: List<String>): List<List<Any?>> {
        val p = Xml.newPullParser(); p.setInput(bytes.inputStream(), "UTF-8")
        val out = mutableListOf<List<Any?>>(); var row = mutableListOf<Any?>()
        var type: String? = null; var inV = false; var inIs = false; val value = StringBuilder()
        while (p.next() != XmlPullParser.END_DOCUMENT) {
            when (p.eventType) {
                XmlPullParser.START_TAG -> when (p.name) {
                    "row" -> row = mutableListOf()
                    "c" -> { type = p.getAttributeValue(null, "t"); value.clear() }
                    "v" -> inV = true
                    "is" -> inIs = true
                    "t" -> if (inIs) inV = true
                }
                XmlPullParser.TEXT -> if (inV) value.append(p.text)
                XmlPullParser.END_TAG -> when (p.name) {
                    "v", "t" -> inV = false
                    "is" -> inIs = false
                    "c" -> {
                        val raw = value.toString()
                        row += when (type) {
                            "s" -> raw.toIntOrNull()?.let { shared.getOrNull(it) }
                            "inlineStr", "str" -> raw
                            "b" -> null
                            else -> raw.toDoubleOrNull() ?: raw.ifBlank { null }
                        }
                    }
                    "row" -> out += row
                }
            }
        }
        return out
    }

    @Suppress("unused")
    private fun norm(s: String) = Normalizer.normalize(s, Normalizer.Form.NFC)
}
