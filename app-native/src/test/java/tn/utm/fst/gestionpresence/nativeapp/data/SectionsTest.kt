package tn.utm.fst.gestionpresence.nativeapp.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import tn.utm.fst.gestionpresence.nativeapp.core.model.AcademicClass
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData

class SectionsTest {
    private fun cls(name: String, module: String = "TP Physique", space: String? = null) =
        AcademicClass(name, "t", name, module, null, null, null, null, null, null, null, 1, space)

    @Test fun chaqueEspaceASaSection() {
        val def = RepositoryData.DEFAULT_SPACE
        assertEquals("PHY", RepositoryData.moduleOf(cls("MPI1-A-G1", space = def)))
        assertEquals("PHY", RepositoryData.moduleOf(cls("PC1-A-G1")))
        assertEquals("LPC", RepositoryData.moduleOf(cls("LPC3-G1", "TP Ondes et Vibrations", def)))
        assertEquals("SP:lphe", RepositoryData.moduleOf(cls("LPHE1-A", space = "lphe")))
        // LPC1 n'est pas LPC3 : sa propre section, jamais avec LPC3.
        assertEquals("SP:lpc1", RepositoryData.moduleOf(cls("LPC1-A", space = "lpc1")))
    }

    @Test fun espaceDUneSection() {
        assertEquals(RepositoryData.DEFAULT_SPACE, RepositoryData.spaceOfModule("PHY"))
        assertEquals("lphe", RepositoryData.spaceOfModule("SP:lphe"))
        assertNull(RepositoryData.spaceOfModule("LPC"))
    }
}
