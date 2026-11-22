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
}
