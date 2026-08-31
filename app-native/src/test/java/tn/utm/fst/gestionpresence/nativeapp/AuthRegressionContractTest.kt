package tn.utm.fst.gestionpresence.nativeapp

import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthRegressionContractTest {
    private fun source(relative: String): String {
        var current = File(System.getProperty("user.dir")).absoluteFile
        repeat(6) {
            val candidate = File(current, relative)
            if (candidate.isFile) return candidate.readText()
            current = current.parentFile ?: return@repeat
        }
        error("Source file not found: $relative")
    }

    @Test
    fun `profile parser accepts PostgREST array response`() {
        val source = source("app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/data/remote/OnlineApiClient.kt")
        assertTrue(source.contains("requireSingleObject"), "Profile parsing must accept a one-row JSON array returned by PostgREST.")
        assertFalse(source.contains("val body = response.requireObject()\n        return UserProfile"), "Profile must not force a top-level JsonObject.")
    }

    @Test
    fun `login does not force second factor`() {
        val source = source("app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/feature/main/MainViewModel.kt")
        assertFalse(source.contains("requiresMfa"), "Login flow must not gate access on MFA.")
        assertFalse(source.contains("repository.enrollMfa()\n            _state.value = MainUiState"), "Login must not auto-enroll TOTP.")
    }

    @Test
    fun `native application exposes no MFA route or UI`() {
        val viewModel = source("app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/feature/main/MainViewModel.kt")
        val ui = source("app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/ui/AppRoot.kt")

        for (forbidden in listOf(
            "MFA_ENROLL",
            "MFA_CHALLENGE",
            "beginMfaEnrollment",
            "removeMfa(",
            "verifyMfa(",
            "mfaEnrollment",
            "mfaFactorId"
        )) {
            assertFalse(viewModel.contains(forbidden), "MFA is disabled; MainViewModel must not expose $forbidden")
        }

        for (forbidden in listOf(
            "MfaScreen",
            "AccountScreen",
            "Double authentification",
            "double authentification",
            "TOTP",
            "Ajouter un appareil",
            "AppScreen.ACCOUNT to \"Sécurité\""
        )) {
            assertFalse(ui.contains(forbidden), "MFA is disabled; Android UI must not expose $forbidden")
        }
    }
}
