package tn.utm.fst.gestionpresence.nativeapp

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ArchitectureContractTest {
    private val sources = File("src/main/java")
        .walkTopDown()
        .filter { it.isFile && it.extension == "kt" }
        .joinToString("\n") { it.readText() }

    @Test
    fun `native app contains no WebView or embedded HTML runtime`() {
        assertFalse(sources.contains("android.webkit.WebView"))
        assertFalse(sources.contains("file:///android_asset"))
        assertFalse(sources.contains("loadUrl("))
    }

    @Test
    fun `business data is online only`() {
        assertFalse(sources.contains("androidx.room"))
        assertFalse(sources.contains("RoomDatabase"))
        assertFalse(sources.contains("androidx.work"))
        assertFalse(sources.contains("WorkManager"))
        assertFalse(sources.contains("Outbox"))
        assertTrue(sources.contains("NETWORK_UNAVAILABLE"))
        assertTrue(sources.contains("save_attendance_sheet"))
        assertTrue(sources.contains("p_expected_revision"))
        assertTrue(sources.contains("p_operation_id"))
    }

    @Test
    fun `session storage is protected by Android Keystore`() {
        assertTrue(sources.contains("AndroidKeyStore"))
        assertTrue(sources.contains("AES/GCM/NoPadding"))
        assertFalse(sources.contains("putString(\"token\""))
    }
}
