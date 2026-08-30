package tn.utm.fst.gestionpresence.nativeapp.core.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    fun save(session: AuthSession) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val payload = buildJsonObject {
            put("access_token", session.accessToken)
            put("refresh_token", session.refreshToken)
            put("user_id", session.userId)
            put("role", session.role)
            put("mfa_required", session.mfaRequired)
            put("expires_at", session.expiresAtEpochSeconds)
        }.toString().encodeToByteArray()
        val encrypted = cipher.doFinal(payload)
        preferences.edit()
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString(KEY_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    fun load(): AuthSession? = runCatching {
        val iv = preferences.getString(KEY_IV, null) ?: return null
        val ciphertext = preferences.getString(KEY_CIPHERTEXT, null) ?: return null
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            secretKey(),
            GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
        )
        val decrypted = cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)).decodeToString()
        val value = json.parseToJsonElement(decrypted).jsonObject
        AuthSession(
            accessToken = value.getValue("access_token").jsonPrimitive.content,
            refreshToken = value.getValue("refresh_token").jsonPrimitive.content,
            userId = value.getValue("user_id").jsonPrimitive.content,
            role = value.getValue("role").jsonPrimitive.content,
            mfaRequired = value["mfa_required"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: true,
            expiresAtEpochSeconds = value.getValue("expires_at").jsonPrimitive.content.toLong()
        )
    }.getOrNull()

    fun clear() {
        preferences.edit().clear().apply()
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val PREFERENCES = "fst_secure_session_v2"
        const val KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "fst_presence_session_aes_v2"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_IV = "session_iv"
        const val KEY_CIPHERTEXT = "session_ciphertext"
    }
}
