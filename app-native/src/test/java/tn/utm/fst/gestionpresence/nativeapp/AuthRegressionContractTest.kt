package tn.utm.fst.gestionpresence.nativeapp

import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthRegressionContractTest {
    private fun source(relative: String): String = File(relative).readText()

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
}
