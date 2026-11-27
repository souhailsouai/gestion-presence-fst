package tn.utm.fst.gestionpresence.nativeapp.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TimeFieldTest {
    @Test fun heuresAcceptees() {
        assertEquals("13:30", normalizeTime("13:30"))
        assertEquals("13:30", normalizeTime("13.30"))
        assertEquals("13:30", normalizeTime("13h30"))
        assertEquals("13:30", normalizeTime("1330"))
        assertEquals("09:05", normalizeTime("9:5"))
        assertEquals("08:00", normalizeTime("8h"))
        assertEquals("14:00", normalizeTime("14"))
    }
    @Test fun heuresRefusees() {
        assertNull(normalizeTime("25:00"))
        assertNull(normalizeTime("12:60"))
        assertNull(normalizeTime("abc"))
        assertNull(normalizeTime(""))
    }
}
