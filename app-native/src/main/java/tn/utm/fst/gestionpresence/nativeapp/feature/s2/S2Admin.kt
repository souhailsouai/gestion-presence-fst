package tn.utm.fst.gestionpresence.nativeapp.feature.s2

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.data.repository.PresenceRepository
import java.time.LocalDate

/** Gestion du semestre 2 depuis l'application (mêmes tables et mêmes règles que le site). */
data class S2Settings(val startDate: String, val endDate: String?, val groupCount: Int, val manipCount: Int)
data class ClassSlot(val className: String, val weekday: Int, val start: String, val end: String, val pairKey: String, val pairOrder: Int, val mode: String, val active: Boolean)
data class Excluded(val id: String, val startsOn: String, val endsOn: String, val label: String, val kind: String, val source: String, val validated: Boolean)
data class Station(val weekday: Int, val code: String, val teacherId: String?, val room: String?)
data class Manip(val code: String, val title: String?, val room: String?, val active: Boolean)
data class Version(val id: String, val label: String, val createdAt: String)
data class Teacher(val id: String, val name: String)
data class Member(val studentId: String, val name: String, val className: String, val groupNo: Int, val s1ClassId: String?, val status: String, val reason: String?, val locked: Boolean)
data class Move(val studentId: String, val name: String, val className: String, val from: Int, val to: Int)

/** Même règle que le site : on retire du groupe le plus chargé (non verrouillé) vers le moins chargé, présents seulement. */
fun balanceMoves(members: List<Member>, groupCount: Int): List<Move> {
    val moves = mutableListOf<Move>()
    members.filter { it.status == "actif" }.groupBy { it.className }.forEach { (cls, list0) ->
        val list = list0.map { it.copy() }.toMutableList()
        repeat(500) {
            val sizes = (1..groupCount).map { g -> g to list.count { it.groupNo == g } }.sortedWith(compareBy({ -it.second }, { it.first }))
            val big = sizes.first(); val small = sizes.last()
            if (big.second - small.second <= 1) return@forEach
            val cand = list.filter { it.groupNo == big.first && !it.locked }.sortedByDescending { it.name }.firstOrNull() ?: return@forEach
            moves += Move(cand.studentId, cand.name, cls, big.first, small.first)
            list[list.indexOf(cand)] = cand.copy(groupNo = small.first)
        }
    }
    return moves
}

data class S2Snapshot(
    val settings: S2Settings,
    val slots: List<ClassSlot>,
    val excluded: List<Excluded>,
    val stations: List<Station>,
    val manips: List<Manip>,
    val versions: List<Version>,
    val teachers: List<Teacher>,
    val sessionCount: Int,
    val members: List<Member> = emptyList()
)

val DAY_LABEL = mapOf(1 to "Lundi", 2 to "Mardi", 3 to "Mercredi", 4 to "Jeudi", 5 to "Vendredi", 6 to "Samedi")
val KIND_LABEL = linkedMapOf("vacances" to "Vacances", "ferie" to "Jour férié", "ds" to "DS", "examen" to "Examen", "autre" to "Autre")
const val S2_MIN = "2027-01-11"

private fun JsonObject.s(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
private fun JsonObject.i(k: String): Int? = (this[k] as? JsonPrimitive)?.intOrNull
private fun JsonObject.b(k: String): Boolean? = (this[k] as? JsonPrimitive)?.booleanOrNull

class S2Admin(private val repository: PresenceRepository) {

    suspend fun load(): S2Snapshot = repository.online { api, session ->
        coroutineScope {
            val settings = async { api.rows(session, "v33_s2_settings", order = "id").firstOrNull() }
            val slots = async { api.rows(session, "v33_s2_class_slots", order = "weekday") }
            val excluded = async { api.rows(session, "v33_s2_excluded_dates", order = "starts_on") }
            val stations = async { api.rows(session, "v33_s2_stations", order = "weekday") }
            val manips = async { api.rows(session, "v33_s2_manipulations", order = "code") }
            val versions = async { api.rows(session, "v33_s2_versions", "id,label,created_at", order = "created_at.desc") }
            val teachers = async { api.rows(session, "profiles", "id,full_name,role,deleted_at", mapOf("deleted_at" to "is.null"), "full_name") }
            val sessions = async { api.rows(session, "v33_s2_sessions", "id", order = "id") }
            val members = async { api.rows(session, "v33_s2_group_members", order = "student_id") }
            val students = async { api.rows(session, "students", "id,last_name,first_name", mapOf("deleted_at" to "is.null"), "id") }
            val st = settings.await()
            S2Snapshot(
                settings = S2Settings(st?.s("start_date") ?: S2_MIN, st?.s("end_date"), st?.i("group_count") ?: 5, st?.i("manip_count") ?: 5),
                slots = slots.await().map { ClassSlot(it.s("class_name")!!, it.i("weekday") ?: 1, it.s("start_time")!!.take(5), it.s("end_time")!!.take(5), it.s("pair_key") ?: "", it.i("pair_order") ?: 1, it.s("mode") ?: "alternance", it.b("active") ?: true) }
                    .sortedWith(compareBy({ it.weekday }, { it.pairOrder }, { it.className })),
                excluded = excluded.await().map { Excluded(it.s("id")!!, it.s("starts_on")!!, it.s("ends_on")!!, it.s("label") ?: "", it.s("kind") ?: "autre", it.s("source") ?: "manuel", it.b("validated") ?: false) },
                stations = stations.await().map { Station(it.i("weekday") ?: 1, it.s("manipulation_code")!!, it.s("teacher_id"), it.s("room")) },
                manips = manips.await().map { Manip(it.s("code")!!, it.s("title"), it.s("room"), it.b("active") ?: true) },
                versions = versions.await().map { Version(it.s("id")!!, it.s("label") ?: "", it.s("created_at") ?: "") },
                teachers = teachers.await().map { Teacher(it.s("id")!!, it.s("full_name") ?: "—") },
                sessionCount = sessions.await().size,
                members = run {
                    val names = students.await().associate { it.s("id")!! to "${it.s("last_name").orEmpty()} ${it.s("first_name").orEmpty()}".trim() }
                    members.await().map { Member(it.s("student_id")!!, names[it.s("student_id")] ?: "?", it.s("class_name") ?: "", it.i("group_no") ?: 1, it.s("s1_class_id"), it.s("status") ?: "actif", it.s("reason"), it.b("locked") ?: false) }
                }
            )
        }
    }

    /** Ajout d'une date / période exclue (validée). Le serveur recalcule le planning automatiquement. */
    suspend fun addExcluded(from: String, to: String, label: String, kind: String) = repository.online { api, session ->
        LocalDate.parse(from); LocalDate.parse(to)
        require(to >= from) { "La fin précède le début." }
        api.insertRows(session, "v33_s2_excluded_dates", buildJsonArray {
            add(buildJsonObject {
                put("starts_on", from); put("ends_on", to); put("label", label.trim().ifBlank { "Date exclue" }.take(160))
                put("kind", kind); put("source", "manuel"); put("validated", true)
            })
        })
        audit(api, session, "add_excluded", buildJsonObject { put("starts_on", from); put("ends_on", to); put("label", label); put("source", "android") })
    }

    suspend fun setValidated(id: String, validated: Boolean) = repository.online { api, session ->
        api.patchRows(session, "v33_s2_excluded_dates", mapOf("id" to "eq.$id"), buildJsonObject { put("validated", validated) })
        audit(api, session, "validate_excluded", buildJsonObject { put("id", id); put("validated", validated); put("source", "android") })
    }

    suspend fun deleteExcluded(id: String) = repository.online { api, session ->
        api.deleteWhere(session, "v33_s2_excluded_dates", mapOf("id" to "eq.$id"))
        audit(api, session, "delete_excluded", buildJsonObject { put("id", id); put("source", "android") })
    }

    suspend fun saveSlots(slots: List<ClassSlot>) = repository.online { api, session ->
        slots.forEach { require(it.start < it.end) { "${it.className} : l’heure de début doit précéder la fin." } }
        api.upsertRows(session, "v33_s2_class_slots", buildJsonArray {
            slots.forEach { c ->
                add(buildJsonObject {
                    put("class_name", c.className); put("weekday", c.weekday); put("start_time", c.start); put("end_time", c.end)
                    put("pair_key", c.pairKey.ifBlank { DAY_LABEL[c.weekday]!!.lowercase() }); put("pair_order", c.pairOrder); put("mode", c.mode); put("active", c.active)
                    put("updated_at", java.time.Instant.now().toString())
                })
            }
        }, "class_name")
        audit(api, session, "class_slots", buildJsonObject { put("source", "android") })
    }

    suspend fun saveStations(stations: List<Station>) = repository.online { api, session ->
        api.upsertRows(session, "v33_s2_stations", buildJsonArray {
            stations.forEach { s ->
                add(buildJsonObject {
                    put("weekday", s.weekday); put("manipulation_code", s.code)
                    if (s.teacherId == null) put("teacher_id", JsonNull) else put("teacher_id", s.teacherId)
                    if (s.room.isNullOrBlank()) put("room", JsonNull) else put("room", s.room.trim().take(40))
                    put("updated_at", java.time.Instant.now().toString())
                })
            }
        }, "weekday,manipulation_code")
        audit(api, session, "stations", buildJsonObject { put("source", "android") })
    }

    suspend fun saveSettings(endDate: String?) = repository.online { api, session ->
        endDate?.let { LocalDate.parse(it) }
        api.patchRows(session, "v33_s2_settings", mapOf("id" to "eq.1"), buildJsonObject {
            if (endDate == null) put("end_date", JsonNull) else put("end_date", endDate)
            put("updated_at", java.time.Instant.now().toString())
        })
        audit(api, session, "settings", buildJsonObject { put("end_date", endDate ?: ""); put("source", "android") })
    }

    /** Génère (force) ou recalcule le planning côté serveur, à partir d'une date. */
    suspend fun replan(from: String, force: Boolean): String = repository.online { api, session ->
        val res = api.callRpc(session, "v37_s2_auto_replan", buildJsonObject {
            put("p_from", from); put("p_reason", if (force) "génération (application)" else "recalcul (application)"); put("p_force", force)
        }).jsonObject
        if (res.b("skipped") == true) return@online "Aucun planning à recalculer : générez-le d’abord."
        val warnings = (res["warnings"] as? JsonArray).orEmpty().mapNotNull { it.jsonPrimitive.contentOrNull }
        "${res.i("inserted") ?: 0} séance(s) planifiée(s) à partir du ${fmt(res.s("from") ?: from)}." +
            (if (warnings.isNotEmpty()) "\n" + warnings.joinToString("\n") else "")
    }

    // ---- Groupes S2 ----
    suspend fun updateMember(studentId: String, patch: JsonObject, event: String) = repository.online { api, session ->
        api.patchRows(session, "v33_s2_group_members", mapOf("student_id" to "eq.$studentId"), buildJsonObject {
            patch.forEach { (k, v) -> put(k, v) }; put("updated_at", java.time.Instant.now().toString())
        })
        audit(api, session, event, buildJsonObject { put("student", studentId); patch.forEach { (k, v) -> put(k, v) }; put("source", "android") })
    }

    suspend fun applyBalance(cls: String, moves: List<Move>) = repository.online { api, session ->
        moves.forEach { mv ->
            api.patchRows(session, "v33_s2_group_members", mapOf("student_id" to "eq.${mv.studentId}"), buildJsonObject { put("group_no", mv.to); put("updated_at", java.time.Instant.now().toString()) })
        }
        audit(api, session, "balance", buildJsonObject { put("class", cls); put("n", moves.size); put("source", "android") })
    }

    /** Groupes S1 actuels (nom de classe MPI1-A-G3 → MPI1-A, groupe 3). */
    private suspend fun s1Groups(api: tn.utm.fst.gestionpresence.nativeapp.data.remote.OnlineApiClient, session: tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession): List<Triple<String, String, Pair<String, Int>>> {
        val classes = api.rows(session, "classes", "id,name", mapOf("deleted_at" to "is.null"), "name").associate { it.s("id")!! to it.s("name")!! }
        return api.rows(session, "students", "id,class_id", mapOf("deleted_at" to "is.null"), "id").mapNotNull { st ->
            val name = classes[st.s("class_id")] ?: return@mapNotNull null
            val m = Regex("^((?:MPI1|PC1)-[A-E])-G(\\d+)$").find(name) ?: return@mapNotNull null
            Triple(st.s("id")!!, st.s("class_id")!!, m.groupValues[1] to m.groupValues[2].toInt())
        }
    }

    suspend fun addNewMembers(known: Set<String>): Int = repository.online { api, session ->
        val rows = s1Groups(api, session).filter { it.first !in known }
        if (rows.isEmpty()) return@online 0
        api.insertRows(session, "v33_s2_group_members", buildJsonArray {
            rows.forEach { (id, classId, cg) -> add(buildJsonObject { put("student_id", id); put("class_name", cg.first); put("group_no", cg.second); put("s1_class_id", classId); put("status", "actif"); put("locked", false) }) }
        })
        audit(api, session, "add_students", buildJsonObject { put("n", rows.size); put("source", "android") })
        rows.size
    }

    /** Préparation : groupes du S1, absents à toutes les séances du S1 mis de côté, puis équilibrage. */
    suspend fun initGroups(groupCount: Int): Int = repository.online { api, session ->
        val base = s1Groups(api, session)
        val att = api.rows(session, "attendance", "student_id,status,sessions!inner(session_date)",
            mapOf("deleted_at" to "is.null", "sessions.session_date" to "lte.2026-12-31"), "id")
            .filter { (it["sessions"] as? JsonObject)?.s("session_date").orEmpty() >= "2026-09-01" }
        val seen = att.groupBy { it.s("student_id") }
        val names = api.rows(session, "students", "id,last_name,first_name", mapOf("deleted_at" to "is.null"), "id").associate { it.s("id")!! to "${it.s("last_name").orEmpty()} ${it.s("first_name").orEmpty()}".trim() }
        var members = base.map { (id, classId, cg) ->
            val k = seen[id].orEmpty(); val always = k.isNotEmpty() && k.all { it.s("status") == "absent" }
            Member(id, names[id] ?: "?", cg.first, cg.second, classId, if (always) "exclu" else "actif",
                if (always) "Toujours absent au S1 (${k.size} séance${if (k.size > 1) "s" else ""}) — réintégrable" else null, false)
        }
        balanceMoves(members, groupCount).forEach { mv -> members = members.map { if (it.studentId == mv.studentId) it.copy(groupNo = mv.to) else it } }
        api.insertRows(session, "v33_s2_group_members", buildJsonArray {
            members.forEach { m -> add(buildJsonObject {
                put("student_id", m.studentId); put("class_name", m.className); put("group_no", m.groupNo); put("s1_class_id", m.s1ClassId)
                put("status", m.status); if (m.reason == null) put("reason", JsonNull) else put("reason", m.reason); put("locked", false)
            }) }
        })
        audit(api, session, "init_groups", buildJsonObject { put("n", members.size); put("excluded", members.count { it.status == "exclu" }); put("balanced", true); put("source", "android") })
        members.size
    }

    /** Après le 11/12/2026 : les listes de présence suivent les groupes S2. */
    suspend fun applyGroupsToLists(members: List<Member>): Int = repository.online { api, session ->
        val classes = api.rows(session, "classes", "id,name", mapOf("deleted_at" to "is.null"), "name").associate { it.s("name")!! to it.s("id")!! }
        val current = api.rows(session, "students", "id,class_id", mapOf("deleted_at" to "is.null"), "id").associate { it.s("id")!! to it.s("class_id") }
        val moves = members.filter { it.status == "actif" }.mapNotNull { m ->
            val target = classes["${m.className}-G${m.groupNo}"] ?: return@mapNotNull null
            if (current[m.studentId] == target) null else m.studentId to target
        }
        moves.forEach { (id, target) -> api.patchRows(session, "students", mapOf("id" to "eq.$id"), buildJsonObject { put("class_id", target) }) }
        audit(api, session, "apply_groups", buildJsonObject { put("n", moves.size); put("source", "android") })
        moves.size
    }

    // ---- Planning : verrou, déplacement, case ----
    suspend fun setSessionLocked(sessionId: String, locked: Boolean) = repository.online { api, session ->
        api.patchRows(session, "v33_s2_sessions", mapOf("id" to "eq.$sessionId"), buildJsonObject { put("locked", locked) })
        audit(api, session, if (locked) "lock" else "unlock", buildJsonObject { put("session", sessionId); put("source", "android") })
    }

    suspend fun moveSession(sessionId: String, from: String, to: String) = repository.online { api, session ->
        LocalDate.parse(to); require(to >= S2_MIN) { "Le S2 commence le 11/01/2027." }
        api.patchRows(session, "v33_s2_sessions", mapOf("id" to "eq.$sessionId"), buildJsonObject { put("session_date", to); put("locked", true) })
        audit(api, session, "move", buildJsonObject { put("session", sessionId); put("from", from); put("to", to); put("source", "android") })
    }

    suspend fun editSlot(sessionId: String, slotId: String, code: String, teacherId: String?, room: String?) = repository.online { api, session ->
        api.patchRows(session, "v33_s2_slots", mapOf("id" to "eq.$slotId"), buildJsonObject {
            put("manipulation_code", code); if (teacherId == null) put("teacher_id", JsonNull) else put("teacher_id", teacherId)
            if (room.isNullOrBlank()) put("room", JsonNull) else put("room", room.trim().take(40)); put("locked", true)
        })
        api.patchRows(session, "v33_s2_sessions", mapOf("id" to "eq.$sessionId"), buildJsonObject { put("locked", true) })
        audit(api, session, "edit_slot", buildJsonObject { put("slot", slotId); put("manipulation_code", code); put("source", "android") })
    }

    // ---- Import d'un calendrier Excel : propositions à valider ----
    suspend fun importProposals(rows: List<Excluded>, file: String): Int = repository.online { api, session ->
        if (rows.isEmpty()) return@online 0
        api.insertRows(session, "v33_s2_excluded_dates", buildJsonArray {
            rows.forEach { r -> add(buildJsonObject { put("starts_on", r.startsOn); put("ends_on", r.endsOn); put("label", r.label.take(160)); put("kind", r.kind); put("source", "calendrier"); put("validated", false) }) }
        })
        audit(api, session, "import_calendar", buildJsonObject { put("file", file); put("n", rows.size); put("source", "android") })
        rows.size
    }

    suspend fun saveVersion(label: String) = repository.online { api, session ->
        api.callRpc(session, "v33_s2_save_version", buildJsonObject { put("p_label", label.take(120)) })
    }

    suspend fun restoreVersion(id: String) = repository.online { api, session ->
        // Sauvegarde du planning actuel avant de le remplacer.
        api.callRpc(session, "v33_s2_save_version", buildJsonObject { put("p_label", "Sauvegarde avant restauration (application)") })
        api.callRpc(session, "v33_s2_restore_version", buildJsonObject { put("p_id", id) })
    }

    private suspend fun audit(api: tn.utm.fst.gestionpresence.nativeapp.data.remote.OnlineApiClient, session: tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession, action: String, detail: JsonObject) {
        runCatching { api.insertRows(session, "v33_s2_audit", buildJsonArray { add(buildJsonObject { put("action", action); put("detail", detail) }) }) }
    }

    companion object {
        fun fmt(d: String): String = runCatching { val x = LocalDate.parse(d.take(10)); "%02d/%02d/%04d".format(x.dayOfMonth, x.monthValue, x.year) }.getOrDefault(d)
    }
}
