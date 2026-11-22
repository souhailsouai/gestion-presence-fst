package tn.utm.fst.gestionpresence.nativeapp.feature.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import io.ktor.utils.io.jvm.javaio.toInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import tn.utm.fst.gestionpresence.nativeapp.BuildConfig
import java.io.File

data class AppRelease(val version: String, val notes: String, val apkUrl: String, val sizeBytes: Long)

/**
 * Mise à jour intégrée : les versions de l'application sont publiées comme « releases » GitHub
 * du dépôt (étiquette android-vX.Y.Z, fichier .apk joint). L'application compare avec sa version,
 * télécharge le fichier puis ouvre l'installateur d'Android (l'utilisateur confirme).
 */
object AppUpdater {
    private const val RELEASES = "https://api.github.com/repos/souhailsouai/gestion-presence-fst/releases?per_page=20"
    private val json = Json { ignoreUnknownKeys = true }
    private val http by lazy { HttpClient(OkHttp) { expectSuccess = false } }

    /** Compare deux versions « 2.5.0 » ; vrai si [remote] est plus récente. */
    fun isNewer(remote: String, local: String = BuildConfig.VERSION_NAME): Boolean {
        val r = remote.split('.').map { it.toIntOrNull() ?: 0 }; val l = local.split('.').map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(r.size, l.size)) { val a = r.getOrElse(i) { 0 }; val b = l.getOrElse(i) { 0 }; if (a != b) return a > b }
        return false
    }

    suspend fun latest(): AppRelease? = runCatching {
        val res = http.get(RELEASES) { header("Accept", "application/vnd.github+json") }
        if (!res.status.isSuccess()) return null
        json.parseToJsonElement(res.bodyAsText()).jsonArray.mapNotNull { el ->
            val o = el.jsonObject
            if (o["draft"]?.jsonPrimitive?.contentOrNull == "true" || o["prerelease"]?.jsonPrimitive?.contentOrNull == "true") return@mapNotNull null
            val tag = o["tag_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            if (!tag.startsWith("android-v")) return@mapNotNull null
            val asset = (o["assets"] as? JsonArray)?.map { it.jsonObject }?.firstOrNull { (it["name"]?.jsonPrimitive?.contentOrNull ?: "").endsWith(".apk") } ?: return@mapNotNull null
            AppRelease(
                version = tag.removePrefix("android-v"),
                notes = o["body"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                apkUrl = asset["browser_download_url"]!!.jsonPrimitive.content,
                sizeBytes = asset["size"]?.jsonPrimitive?.longOrNull ?: 0L
            )
        }.filter { isNewer(it.version) }.maxWithOrNull { a, b -> if (isNewer(a.version, b.version)) 1 else if (a.version == b.version) 0 else -1 }
    }.getOrNull()

    /** Télécharge l'APK dans le cache (dossier partagé par le FileProvider). */
    suspend fun download(context: Context, release: AppRelease, onProgress: (Float) -> Unit): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
        dir.listFiles { f -> f.name.endsWith(".apk") }?.forEach { it.delete() }
        val file = File(dir, "Presence-FST-${release.version}.apk")
        val res = http.get(release.apkUrl)
        require(res.status.isSuccess()) { "Téléchargement impossible (${res.status.value})." }
        val total = res.headers["Content-Length"]?.toLongOrNull() ?: release.sizeBytes
        res.bodyAsChannel().toInputStream().use { input ->
            file.outputStream().use { out ->
                val buf = ByteArray(64 * 1024); var done = 0L
                while (true) { val n = input.read(buf); if (n < 0) break; out.write(buf, 0, n); done += n; if (total > 0) onProgress(done.toFloat() / total) }
            }
        }
        require(file.length() > 1_000_000) { "Fichier téléchargé incomplet." }
        file
    }

    fun canInstall(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

    /** Ouvre le réglage « Installer des applications inconnues » pour cette application. */
    fun openInstallPermission(context: Context) {
        context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".files", apk)
        context.startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
