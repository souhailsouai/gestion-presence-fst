package tn.utm.fst.gestionpresence.nativeapp.feature.export

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.zip.ZipFile

class TrackingXlsxTest {
    @Test
    fun `writes a valid xlsx package`() {
        val C = TrackingXlsx.Cell::class
        val rows = listOf(
            listOf(TrackingXlsx.Cell.T("Suivi TP — MPI1-A", 1)),
            listOf(TrackingXlsx.Cell.T("N°", 2), TrackingXlsx.Cell.T("Nom", 2), TrackingXlsx.Cell.T("Présence %", 2)),
            listOf(TrackingXlsx.Cell.N(1.0), TrackingXlsx.Cell.T("BEN <ALI> & Co"), TrackingXlsx.Cell.N(0.875, 3))
        )
        val out = File(System.getProperty("java.io.tmpdir"), "tracking-test.xlsx")
        out.outputStream().use { TrackingXlsx.write(it, listOf(TrackingXlsx.Sheet("MPI1-A", rows, 2, listOf(5.0, 18.0, 12.0)))) }
        ZipFile(out).use { z ->
            assertTrue(z.getEntry("xl/workbook.xml") != null)
            val sheet = z.getInputStream(z.getEntry("xl/worksheets/sheet1.xml")).readBytes().decodeToString()
            assertTrue(sheet.contains("BEN &lt;ALI&gt; &amp; Co"))
        }
        assertTrue(C.simpleName != null)
    }

    @Test
    fun `writes coloured cells for the S1 report`() {
        val rows = listOf(
            listOf(TrackingXlsx.Cell.T("Bilan S1", 1)), emptyList(),
            listOf(TrackingXlsx.Cell.T("Nom", 9), TrackingXlsx.Cell.T("M1", 9), TrackingXlsx.Cell.T("M2", 9)),
            listOf(TrackingXlsx.Cell.T("GHARBI", 5), TrackingXlsx.Cell.T("ABS 14/09", 5), TrackingXlsx.Cell.T("ABS J 28/09", 6)),
            listOf(TrackingXlsx.Cell.T("BEN ALI", 7), TrackingXlsx.Cell.N(14.5, 12), TrackingXlsx.Cell.T("Ratt. 05/10 — 12", 7)),
            listOf(TrackingXlsx.Cell.T("TRABELSI", 11), TrackingXlsx.Cell.T("Retard", 8), TrackingXlsx.Cell.T("", 10))
        )
        val out = File(System.getProperty("java.io.tmpdir"), "bilan-colors-test.xlsx")
        out.outputStream().use { TrackingXlsx.write(it, listOf(TrackingXlsx.Sheet("MPI1-A", rows, 3, listOf(20.0, 14.0, 18.0)))) }
        ZipFile(out).use { z ->
            val styles = z.getInputStream(z.getEntry("xl/styles.xml")).readBytes().decodeToString()
            assertTrue(styles.contains("<cellXfs count=\"13\">"))
            assertTrue(styles.contains("FFFFC7CE") && styles.contains("FFC6EFCE") && styles.contains("FFFFEB9C"))
            val sheet = z.getInputStream(z.getEntry("xl/worksheets/sheet1.xml")).readBytes().decodeToString()
            assertTrue(sheet.contains("s=\"5\"") && sheet.contains("s=\"7\""))
        }
    }
}
