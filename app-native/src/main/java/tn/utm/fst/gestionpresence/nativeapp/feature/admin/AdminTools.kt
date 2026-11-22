package tn.utm.fst.gestionpresence.nativeapp.feature.admin

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.data.repository.PresenceRepository
import java.io.File
import java.time.LocalDate
import java.util.UUID

data class TeacherAccount(val id: String, val fullName: String, val username: String, val email: String, val role: String, val state: String)
data class Notice(val title: String, val body: String)
data class ImportRow(val lastName: String, val firstName: String, val email: String?, val classLabel: String)

private fun JsonObject.s(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull

/** Fonctions d'administration et d'export reprises du site (mêmes appels serveur). */
class AdminTools(private val repository: PresenceRepository) {

    suspend fun teachers(): List<TeacherAccount> = repository.online { api, session ->
        api.rows(session, "profiles", "id,full_name,username,email,role,account_state,deleted_at", mapOf("deleted_at" to "is.null"), "full_name").map {
            TeacherAccount(it.s("id")!!, it.s("full_name") ?: "—", it.s("username").orEmpty(), it.s("email").orEmpty(), it.s("role") ?: "teacher", it.s("account_state") ?: "active")
        }
    }

    private fun check(r: JsonObject, label: String) {
        r.s("error")?.let { throw IllegalStateException("$label : $it") }
    }

    /** Modification d'un compte : profil, puis PIN et statut si demandés (fonction serveur admin-teacher). */
    suspend fun saveTeacher(original: TeacherAccount, fullName: String, username: String, email: String, state: String, pin: String?, isSelf: Boolean) = repository.online { api, session ->
        require(fullName.isNotBlank() && username.isNotBlank() && email.isNotBlank()) { "Nom, nom d’utilisateur et email sont obligatoires." }
        require(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email.trim())) { "Adresse email invalide." }
        require(pin.isNullOrBlank() || Regex("^\\d{6}$").matches(pin)) { "Le nouveau PIN doit contenir exactement 6 chiffres." }
        check(api.adminAction(session, buildJsonObject {
            put("action", "update_profile"); put("user_id", original.id); put("full_name", fullName.trim())
            put("username", username.trim().lowercase()); put("email", email.trim().lowercase())
        }), "Modification impossible")
        if (!pin.isNullOrBlank()) check(api.adminAction(session, buildJsonObject { put("action", "set_teacher_pin"); put("user_id", original.id); put("pin", pin) }), "Profil modifié, mais PIN non changé")
        if (!isSelf && state != original.state) check(api.adminAction(session, buildJsonObject { put("action", "set_account_state"); put("user_id", original.id); put("account_state", state) }), "Profil modifié, mais statut non changé")
    }

    suspend fun deleteTeacher(id: String) = repository.online { api, session ->
        check(api.adminAction(session, buildJsonObject { put("action", "delete"); put("user_id", id) }), "Suppression impossible")
    }

    /** Modification d'un étudiant (nom, prénom, email). Le changement de groupe passe par « Changer de groupe ». */
    suspend fun updateStudent(id: String, lastName: String, firstName: String, email: String?) = repository.online { api, session ->
        require(lastName.isNotBlank() && firstName.isNotBlank()) { "Nom et prénom obligatoires." }
        api.patchRows(session, "students", mapOf("id" to "eq.$id"), buildJsonObject {
            put("last_name", lastName.trim()); put("first_name", firstName.trim())
            if (email.isNullOrBlank()) put("email", JsonNull) else put("email", email.trim())
        })
    }

    /** Lignes « Nom ; Prénom ; Email ; Classe/Groupe » depuis un CSV ou un Excel (ligne d'en-tête ignorée). */
    fun parseImport(name: String, bytes: ByteArray): List<ImportRow> {
        val rows: List<List<String>> = if (name.lowercase().endsWith(".csv") || !(bytes.size > 4 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte())) {
            val text = bytes.decodeToString().removePrefix("\uFEFF")
            val sep = if (text.lineSequence().first().count { it == ';' } >= text.lineSequence().first().count { it == ',' }) ';' else ','
            text.lines().filter { it.isNotBlank() }.map { line -> line.split(sep).map { it.trim().trim('"') } }
        } else {
            tn.utm.fst.gestionpresence.nativeapp.feature.s2.CalendarImport.readRows(bytes.inputStream()).map { r -> r.map { v -> when (v) { null -> ""; is Double -> if (v % 1.0 == 0.0) v.toLong().toString() else v.toString(); else -> v.toString().trim() } } }
        }
        return rows.filter { it.size >= 2 && it[0].isNotBlank() && !it[0].lowercase().startsWith("nom") }
            .map { ImportRow(it[0], it.getOrElse(1) { "" }, it.getOrElse(2) { "" }.ifBlank { null }, it.getOrElse(3) { "" }) }
            .filter { it.firstName.isNotBlank() }
    }

    /** Ajout via la même fonction serveur que le site (droits vérifiés côté serveur). */
    suspend fun importStudents(rows: List<ImportRow>, classIdFor: (String) -> String?, defaultClassId: String?): Pair<Int, List<String>> = repository.online { api, session ->
        var ok = 0; val errors = mutableListOf<String>()
        rows.forEach { r ->
            val classId = classIdFor(r.classLabel) ?: defaultClassId
            if (classId == null) { errors += "${r.lastName} ${r.firstName} : classe « ${r.classLabel} » inconnue"; return@forEach }
            runCatching {
                api.callRpc(session, "v31_add_student_authorized", buildJsonObject {
                    put("p_student_id", UUID.randomUUID().toString()); put("p_class_id", classId)
                    put("p_last_name", r.lastName.trim()); put("p_first_name", r.firstName.trim())
                    if (r.email == null) put("p_email", JsonNull) else put("p_email", r.email)
                })
            }.onSuccess { ok++ }.onFailure { errors += "${r.lastName} ${r.firstName} : ${it.message}" }
        }
        ok to errors
    }

    /** Configuration S1 : enseignant de chaque manipulation (M1–M6) pour lundi (1), jeudi (4) et vendredi (5). */
    suspend fun s1Config(): Map<Pair<Int, String>, String> = repository.online { api, session ->
        api.rows(session, "v21_teacher_day_manipulations", "teacher_id,day_of_week,manipulation_code,active", order = "day_of_week")
            .filter { it.s("active") != "false" }
            .associate { (it.s("day_of_week")!!.toInt() to it.s("manipulation_code")!!) to it.s("teacher_id")!! }
    }

    /** Même enregistrement que le site (18 affectations, contrôlées par le serveur). */
    suspend fun saveS1Config(cfg: Map<Pair<Int, String>, String>) = repository.online { api, session ->
        require(cfg.size == 18) { "Il faut un enseignant pour M1 à M6, lundi, jeudi et vendredi (18 cases)." }
        val res = api.callRpc(session, "v23_save_teacher_configuration", buildJsonObject {
            put("p_rows", JsonArray(cfg.map { (k, t) -> buildJsonObject { put("teacher_id", t); put("day_of_week", k.first); put("manipulation_code", k.second) } }))
        })
        val o = res as? JsonObject
        if (o != null && o.s("ok") == "false") throw IllegalStateException(o.s("message") ?: o.s("code") ?: "Enregistrement refusé.")
    }

    suspend fun notices(): List<Notice> = repository.online { api, session ->
        runCatching {
            val today = LocalDate.now().toString()
            api.rows(session, "v21_notices", "title,body,active,starts_on,ends_on,sort_order", order = "sort_order")
                .filter { it.s("active") != "false" && (it.s("starts_on") ?: "") <= today && (it.s("ends_on") ?: "9999") >= today }
                .map { Notice(it.s("title") ?: "Avis", it.s("body").orEmpty()) }
        }.getOrDefault(emptyList())
    }

    /** Sauvegarde complète (JSON), comme le bouton du site. */
    suspend fun exportJson(context: Context): File = repository.online { api, session ->
        val tables = listOf("profiles", "classes", "students", "sessions", "attendance")
        val data = coroutineScope { tables.map { t -> t to async { api.rows(session, t, order = "id") } }.associate { (t, d) -> t to d.await() } }
        val json = buildJsonObject {
            put("exportedAt", java.time.Instant.now().toString()); put("academicYear", "2026/2027"); put("institution", "Faculté des Sciences de Tunis")
            data.forEach { (t, rows) -> put(t, JsonArray(rows)) }
        }
        file(context, "sauvegarde_supabase_${LocalDate.now()}.json").apply { writeText(json.toString()) }
    }

    /** Export CSV de toutes les présences (séparateur « ; », lisible dans Excel). */
    suspend fun exportCsv(context: Context): File = repository.online { api, session ->
        val (att, sessions, students, classes, profiles) = coroutineScope {
            val a = async { api.rows(session, "attendance", order = "id") }
            val s = async { api.rows(session, "sessions", order = "id") }
            val st = async { api.rows(session, "students", order = "id") }
            val c = async { api.rows(session, "classes", order = "id") }
            val p = async { api.rows(session, "profiles", "id,full_name", order = "id") }
            listOf(a.await(), s.await(), st.await(), c.await(), p.await())
        }
        val byId = { l: List<JsonObject> -> l.associateBy { it.s("id") } }
        val S = byId(sessions); val ST = byId(students); val C = byId(classes); val P = byId(profiles)
        fun q(v: String?) = "\"" + (v ?: "").replace("\"", "\"\"") + "\""
        val lines = mutableListOf("Date;Classe;Groupe;Enseignant;Nom;Prénom;Statut;Note;Commentaire;Rattrapage")
        att.forEach { a ->
            val s = S[a.s("session_id")]; val st = ST[a.s("student_id")]; val c = C[s?.s("class_id")]
            lines += listOf(s?.s("session_date"), c?.s("name")?.substringBeforeLast("-G"), c?.s("name"), P[s?.s("teacher_id")]?.s("full_name"),
                st?.s("last_name"), st?.s("first_name"), a.s("status"), a.s("grade"), a.s("comment"), a.s("makeup_date")).joinToString(";") { q(it) }
        }
        file(context, "presences_${LocalDate.now()}.csv").apply { writeText("\uFEFF" + lines.joinToString("\r\n")) }
    }

    private fun file(context: Context, name: String) = File(File(context.cacheDir, "reports").apply { mkdirs() }, name)

    companion object {
        fun share(context: Context, file: File, mime: String, title: String) {
            val uri = FileProvider.getUriForFile(context, context.packageName + ".files", file)
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = mime; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
