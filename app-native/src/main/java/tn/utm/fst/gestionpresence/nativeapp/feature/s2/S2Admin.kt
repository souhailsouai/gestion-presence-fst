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
/** Espaces S2 (V43) : MPI1 · PC1 et les espaces créés par le super administrateur. */
data class Space(val id: String, val name: String)
data class SpaceClass(val id: String, val name: String)
data class SpaceStudent(val id: String, val lastName: String, val firstName: String, val classId: String)
data class SpaceMember(val spaceId: String, val profileId: String, val role: String)
const val DEFAULT_SPACE = "00000000-0000-4000-8000-000000000001"

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
    val members: List<Member> = emptyList(),
    val space: String = DEFAULT_SPACE,
    val spaces: List<Space> = emptyList(),
    val myRoles: Map<String, String> = emptyMap(),
    val spaceClasses: List<SpaceClass> = emptyList(),
    val spaceStudents: List<SpaceStudent> = emptyList(),
    val isSuper: Boolean = false
)

val DAY_LABEL = mapOf(1 to "Lundi", 2 to "Mardi", 3 to "Mercredi", 4 to "Jeudi", 5 to "Vendredi", 6 to "Samedi")
val KIND_LABEL = linkedMapOf("vacances" to "Vacances", "ferie" to "Jour férié", "ds" to "DS", "examen" to "Examen", "autre" to "Autre")
const val S2_MIN = "2027-01-11"

private fun JsonObject.s(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
private fun JsonObject.i(k: String): Int? = (this[k] as? JsonPrimitive)?.intOrNull
private fun JsonObject.b(k: String): Boolean? = (this[k] as? JsonPrimitive)?.booleanOrNull

class S2Admin(private val repository: PresenceRepository) {
    private var landed = false
    /** Espace S2 affiché (MPI1 · PC1 par défaut). */
    var space: String = DEFAULT_SPACE
    private val sp get() = mapOf("space_id" to "eq.$space")
    private val isDefault get() = space == DEFAULT_SPACE

    suspend fun load(): S2Snapshot = repository.online { api, session ->
        val uid = session.userId
        val spaces = api.rows(session, "spaces", "id,name", order = "created_at").map { Space(it.s("id")!!, it.s("name") ?: "—") }
        val mine = runCatching { api.rows(session, "space_members", "space_id,role", mapOf("profile_id" to "eq.$uid"), "space_id") }.getOrDefault(emptyList())
            .associate { it.s("space_id")!! to (it.s("role") ?: "teacher") }
        if (spaces.none { it.id == space }) space = spaces.firstOrNull()?.id ?: DEFAULT_SPACE
        // Un administrateur d'espace arrive directement sur l'espace qu'il administre.
        if (!landed && mine[space] != "admin") mine.entries.firstOrNull { it.value == "admin" && spaces.any { sp -> sp.id == it.key } }?.let { space = it.key }
        landed = true
        val amSuper = runCatching { (api.callRpc(session, "v45_am_super_admin", buildJsonObject { }) as? JsonPrimitive)?.booleanOrNull == true }.getOrDefault(false)
        coroutineScope {
            val settings = async { api.rows(session, "v33_s2_settings", filters = sp, order = "space_id").firstOrNull() }
            val slots = async { api.rows(session, "v33_s2_class_slots", filters = sp, order = "weekday") }
            val excluded = async { api.rows(session, "v33_s2_excluded_dates", filters = sp, order = "starts_on") }
            val stations = async { api.rows(session, "v33_s2_stations", filters = sp, order = "weekday") }
            val manips = async { api.rows(session, "v33_s2_manipulations", filters = sp, order = "code") }
            val versions = async { api.rows(session, "v33_s2_versions", "id,label,created_at", sp, order = "created_at.desc") }
            val teachers = async { api.rows(session, "profiles", "id,full_name,role,deleted_at", mapOf("deleted_at" to "is.null"), "full_name") }
            val spaceMembers = async { runCatching { api.rows(session, "space_members", "profile_id", sp, "profile_id") }.getOrDefault(emptyList()).mapNotNull { it.s("profile_id") }.toSet() }
            val sessions = async { api.rows(session, "v33_s2_sessions", "id", sp, order = "id") }
            val members = async { api.rows(session, "v33_s2_group_members", filters = sp, order = "student_id") }
            val students = async { api.rows(session, "students", "id,last_name,first_name", mapOf("deleted_at" to "is.null"), "id") }
            val spaceClasses = async { if (isDefault) emptyList() else api.rows(session, "classes", "id,name", sp + ("deleted_at" to "is.null"), "name").map { SpaceClass(it.s("id")!!, it.s("name")!!) } }
            val spaceStudents = async {
                if (isDefault) emptyList() else api.rows(session, "students", "id,last_name,first_name,class_id,classes!inner(space_id)",
                    mapOf("deleted_at" to "is.null", "classes.space_id" to "eq.$space"), "last_name").map { SpaceStudent(it.s("id")!!, it.s("last_name").orEmpty(), it.s("first_name").orEmpty(), it.s("class_id")!!) }
            }
            val st = settings.await()
            // Les listes « X-Gn » créées à l'appel S2 restent rattachées à la classe X (et masquées de la liste des classes).
            val allClasses = spaceClasses.await()
            val baseIds = allClasses.associate { it.name to it.id }
            val groupOf = allClasses.mapNotNull { c -> Regex("^(.*)-G\\d+$").find(c.name)?.groupValues?.get(1)?.let { baseIds[it] }?.let { c.id to it } }.toMap()
            S2Snapshot(
                settings = S2Settings(st?.s("start_date") ?: S2_MIN, st?.s("end_date"), st?.i("group_count") ?: 5, st?.i("manip_count") ?: 5),
                slots = slots.await().map { ClassSlot(it.s("class_name")!!, it.i("weekday") ?: 1, it.s("start_time")!!.take(5), it.s("end_time")!!.take(5), it.s("pair_key") ?: "", it.i("pair_order") ?: 1, it.s("mode") ?: "alternance", it.b("active") ?: true) }
                    .sortedWith(compareBy({ it.weekday }, { it.pairOrder }, { it.className })),
                excluded = excluded.await().map { Excluded(it.s("id")!!, it.s("starts_on")!!, it.s("ends_on")!!, it.s("label") ?: "", it.s("kind") ?: "autre", it.s("source") ?: "manuel", it.b("validated") ?: false) },
                stations = stations.await().map { Station(it.i("weekday") ?: 1, it.s("manipulation_code")!!, it.s("teacher_id"), it.s("room")) },
                manips = manips.await().map { Manip(it.s("code")!!, it.s("title"), it.s("room"), it.b("active") ?: true) },
                versions = versions.await().map { Version(it.s("id")!!, it.s("label") ?: "", it.s("created_at") ?: "") },
                teachers = teachers.await().let { all -> val ids = spaceMembers.await(); if (isDefault || ids.isEmpty()) all else all.filter { it.s("id") in ids } }.map { Teacher(it.s("id")!!, it.s("full_name") ?: "—") },
                sessionCount = sessions.await().size,
                members = run {
                    val names = students.await().associate { it.s("id")!! to "${it.s("last_name").orEmpty()} ${it.s("first_name").orEmpty()}".trim() }
                    members.await().map { Member(it.s("student_id")!!, names[it.s("student_id")] ?: "?", it.s("class_name") ?: "", it.i("group_no") ?: 1, it.s("s1_class_id"), it.s("status") ?: "actif", it.s("reason"), it.b("locked") ?: false) }
                },
                space = space, spaces = spaces, myRoles = mine, isSuper = amSuper, spaceClasses = allClasses.filter { it.id !in groupOf }, spaceStudents = spaceStudents.await().map { x -> groupOf[x.classId]?.let { x.copy(classId = it) } ?: x }
            )
        }
    }

    /** Ajout d'une date / période exclue (validée). Le serveur recalcule le planning automatiquement. */
    suspend fun addExcluded(from: String, to: String, label: String, kind: String) = repository.online { api, session ->
        LocalDate.parse(from); LocalDate.parse(to)
        require(to >= from) { "La fin précède le début." }
        api.insertRows(session, "v33_s2_excluded_dates", buildJsonArray {
            add(buildJsonObject {
                put("space_id", space); put("starts_on", from); put("ends_on", to); put("label", label.trim().ifBlank { "Date exclue" }.take(160))
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
                    put("space_id", space); put("class_name", c.className); put("weekday", c.weekday); put("start_time", c.start); put("end_time", c.end)
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
                    put("space_id", space); put("weekday", s.weekday); put("manipulation_code", s.code)
                    if (s.teacherId == null) put("teacher_id", JsonNull) else put("teacher_id", s.teacherId)
                    if (s.room.isNullOrBlank()) put("room", JsonNull) else put("room", s.room.trim().take(40))
                    put("updated_at", java.time.Instant.now().toString())
                })
            }
        }, "space_id,weekday,manipulation_code")
        audit(api, session, "stations", buildJsonObject { put("source", "android") })
    }

    suspend fun saveSettings(endDate: String?) = repository.online { api, session ->
        endDate?.let { LocalDate.parse(it) }
        api.patchRows(session, "v33_s2_settings", sp, buildJsonObject {
            if (endDate == null) put("end_date", JsonNull) else put("end_date", endDate)
            put("updated_at", java.time.Instant.now().toString())
        })
        audit(api, session, "settings", buildJsonObject { put("end_date", endDate ?: ""); put("source", "android") })
    }

    /** Manipulations : intitulé, salle par défaut, active (onglet « Manipulations » du site). */
    suspend fun saveManips(list: List<Manip>) = repository.online { api, session ->
        api.upsertRows(session, "v33_s2_manipulations", buildJsonArray {
            list.forEach { m ->
                add(buildJsonObject {
                    put("space_id", space); put("code", m.code)
                    if (m.title.isNullOrBlank()) put("title", JsonNull) else put("title", m.title.trim().take(120))
                    if (m.room.isNullOrBlank()) put("room", JsonNull) else put("room", m.room.trim().take(40))
                    put("active", m.active); put("updated_at", java.time.Instant.now().toString())
                })
            }
        }, "space_id,code")
        audit(api, session, "manips", buildJsonObject { put("source", "android") })
    }

    /** Paramètres complets du S2 (début, fin, nombre de groupes et de manipulations), mêmes contrôles que le site. */
    suspend fun saveSettingsFull(start: String, endDate: String?, groups: Int, manips: Int) = repository.online { api, session ->
        LocalDate.parse(start); endDate?.let { LocalDate.parse(it) }
        require(start >= "2027-01-11") { "Le S2 ne peut pas commencer avant le 11/01/2027." }
        require(endDate == null || endDate > start) { "La fin du S2 précède son début." }
        require(groups in 1..12 && manips in 1..9) { "Groupes : 1 à 12 ; manipulations : 1 à 9." }
        api.patchRows(session, "v33_s2_settings", sp, buildJsonObject {
            put("start_date", start); if (endDate == null) put("end_date", JsonNull) else put("end_date", endDate)
            put("group_count", groups); put("manip_count", manips); put("updated_at", java.time.Instant.now().toString())
        })
        audit(api, session, "settings", buildJsonObject { put("start_date", start); put("end_date", endDate ?: ""); put("group_count", groups); put("manip_count", manips); put("source", "android") })
    }

    /** « Reprendre ceux du S1 » : pour chaque manipulation du jour, l'enseignant qui l'a le plus souvent encadrée au S1 (même règle que le site). */
    suspend fun stationsFromS1(weekday: Int): List<Station> = repository.online { api, session ->
        val rows = api.rows(session, "sessions", "session_date,teacher_id,classes(name)",
            mapOf("and" to "(session_date.gte.2026-09-01,session_date.lte.2026-11-22)", "deleted_at" to "is.null"), order = "id")
        data class R(val cls: String, val g: Int, val date: String, val teacher: String)
        val list = rows.mapNotNull { r ->
            val name = (r["classes"] as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val m = Regex("^(.*)-G(\\d+)$").find(name) ?: return@mapNotNull null
            val t = r["teacher_id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            R(m.groupValues[1], m.groupValues[2].toInt(), r["session_date"]!!.jsonPrimitive.content, t)
        }
        val votes = mutableMapOf<Triple<Int, String, String>, Int>()
        list.groupBy { it.cls }.forEach { (_, l) ->
            val dates = l.map { it.date }.distinct().sorted()
            l.forEach { x ->
                val occ = dates.indexOf(x.date) + 1
                val code = "M" + (((x.g - 1) + (occ - 1)) % 6 + 1)
                val k = Triple(LocalDate.parse(x.date).dayOfWeek.value, code, x.teacher)
                votes[k] = (votes[k] ?: 0) + 1
            }
        }
        votes.entries.filter { it.key.first == weekday }.groupBy { it.key.second }
            .map { (code, e) -> val best = e.maxBy { it.value }; Station(weekday, code, best.key.third, null) }
    }

    /** Historique des actions sur le S2 (30 dernières), comme l'onglet « Versions » du site. */
    suspend fun history(): List<Pair<String, String>> = repository.online { api, session ->
        api.rows(session, "v33_s2_audit", "action,created_at", order = "created_at.desc").take(30)
            .map { (it["action"]?.jsonPrimitive?.contentOrNull ?: "") to (it["created_at"]?.jsonPrimitive?.contentOrNull ?: "") }
    }

    /** Génère (force) ou recalcule le planning côté serveur, à partir d'une date. */
    suspend fun replan(from: String, force: Boolean): String = repository.online { api, session ->
        val res = api.callRpc(session, "v37_s2_auto_replan", buildJsonObject {
            put("p_from", from); put("p_reason", if (force) "génération (application)" else "recalcul (application)"); put("p_force", force); put("p_space", space)
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
        if (!isDefault) {
            // Autres espaces : étudiants des classes de l'espace, répartis par ordre alphabétique (puis équilibrés).
            val cls = api.rows(session, "classes", "id,name", sp + ("deleted_at" to "is.null"), "name").associate { it.s("id")!! to it.s("name")!! }
            val gc = api.rows(session, "v33_s2_settings", "group_count", sp, "space_id").firstOrNull()?.i("group_count") ?: 5
            val counters = mutableMapOf<String, Int>()
            return api.rows(session, "students", "id,last_name,first_name,class_id,classes!inner(space_id)", mapOf("deleted_at" to "is.null", "classes.space_id" to "eq.$space"), "last_name")
                .sortedBy { "${it.s("last_name")} ${it.s("first_name")}".lowercase() }
                .mapNotNull { st -> val name = cls[st.s("class_id")] ?: return@mapNotNull null
                    val n = counters.getOrDefault(name, 0); counters[name] = n + 1
                    Triple(st.s("id")!!, st.s("class_id")!!, name to (n % gc + 1)) }
        }
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
            rows.forEach { (id, classId, cg) -> add(buildJsonObject { put("space_id", space); put("student_id", id); put("class_name", cg.first); put("group_no", cg.second); put("s1_class_id", classId); put("status", "actif"); put("locked", false) }) }
        })
        audit(api, session, "add_students", buildJsonObject { put("n", rows.size); put("source", "android") })
        rows.size
    }

    /** Préparation : groupes du S1, absents à toutes les séances du S1 mis de côté, puis équilibrage. */
    suspend fun initGroups(groupCount: Int): Int = repository.online { api, session ->
        val base = s1Groups(api, session)
        val att = if (!isDefault) emptyList() else api.rows(session, "attendance", "student_id,status,sessions!inner(session_date)",
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
                put("space_id", space); put("student_id", m.studentId); put("class_name", m.className); put("group_no", m.groupNo); put("s1_class_id", m.s1ClassId)
                put("status", m.status); if (m.reason == null) put("reason", JsonNull) else put("reason", m.reason); put("locked", false)
            }) }
        })
        audit(api, session, "init_groups", buildJsonObject { put("n", members.size); put("excluded", members.count { it.status == "exclu" }); put("balanced", true); put("source", "android") })
        members.size
    }

    // ---- Espaces (V43) ----
    /** L'utilisateur administre-t-il au moins un espace S2 ? */
    suspend fun isSpaceAdmin(): Boolean = repository.online { api, session ->
        api.rows(session, "space_members", "role", mapOf("profile_id" to "eq.${session.userId}", "role" to "eq.admin"), "space_id").isNotEmpty()
    }
    suspend fun createSpace(name: String): String = repository.online { api, session ->
        require(name.trim().length in 2..60) { "Nom d’espace : 2 à 60 caractères." }
        api.callRpc(session, "v43_create_space", buildJsonObject { put("p_name", name.trim()) }).jsonPrimitive.content.also { space = it }
    }
    suspend fun renameSpace(id: String, name: String) = repository.online { api, session -> api.callRpc(session, "v43_rename_space", buildJsonObject { put("p_space", id); put("p_name", name.trim()) }) }
    suspend fun deleteSpace(id: String) = repository.online { api, session -> api.callRpc(session, "v43_delete_space", buildJsonObject { put("p_space", id) }); if (space == id) space = DEFAULT_SPACE }
    /** role = "admin", "teacher" ou null (retirer). */
    suspend fun setMember(spaceId: String, profileId: String, role: String?) = repository.online { api, session ->
        api.callRpc(session, "v43_set_member", buildJsonObject { put("p_space", spaceId); put("p_profile", profileId); if (role == null) put("p_role", JsonNull) else put("p_role", role) })
    }
    suspend fun allMembers(): List<SpaceMember> = repository.online { api, session ->
        api.rows(session, "space_members", "space_id,profile_id,role", order = "space_id").map { SpaceMember(it.s("space_id")!!, it.s("profile_id")!!, it.s("role") ?: "teacher") }
    }
    suspend fun directory(): List<Teacher> = repository.online { api, session ->
        (api.callRpc(session, "v43_teacher_directory", buildJsonObject { }) as? JsonArray).orEmpty().map { it.jsonObject.let { o -> Teacher(o.s("id")!!, o.s("full_name") ?: "—") } }
    }
    /** Nouvelle classe de l'espace : ligne « classes » + créneau S2 (partage éventuel du jour d'une autre classe). */
    suspend fun createClass(name: String, weekday: Int, start: String, end: String, partner: ClassSlot?, existing: List<ClassSlot>) = repository.online { api, session ->
        val n = name.trim().uppercase()
        require(Regex("^[A-Z0-9][A-Z0-9 ._-]{1,29}$").matches(n)) { "Nom de classe : lettres, chiffres, tiret." }
        require(existing.none { it.className == n }) { "Cette classe existe déjà." }
        require(start < end) { "L’heure de fin précède le début." }
        api.insertRows(session, "classes", buildJsonArray { add(buildJsonObject { put("teacher_id", session.userId); put("name", n); put("module", "TP Physique S2"); put("space_id", space) }) })
        api.insertRows(session, "v33_s2_class_slots", buildJsonArray { add(buildJsonObject {
            put("space_id", space); put("class_name", n); put("weekday", partner?.weekday ?: weekday); put("start_time", start); put("end_time", end)
            put("pair_key", partner?.pairKey ?: n); put("pair_order", (existing.filter { partner != null && it.pairKey == partner.pairKey }.maxOfOrNull { it.pairOrder } ?: 0) + 1)
            put("mode", partner?.mode ?: "alternance"); put("active", true)
        }) })
        audit(api, session, "create_class", buildJsonObject { put("name", n); put("source", "android") })
    }
    suspend fun deleteClass(c: SpaceClass) = repository.online { api, session ->
        val now = java.time.Instant.now().toString()
        api.deleteWhere(session, "v33_s2_group_members", sp + ("class_name" to "eq.${c.name}"))
        api.deleteWhere(session, "v33_s2_class_slots", sp + ("class_name" to "eq.${c.name}"))
        api.patchRows(session, "students", mapOf("class_id" to "eq.${c.id}"), buildJsonObject { put("deleted_at", now) })
        api.patchRows(session, "classes", mapOf("id" to "eq.${c.id}"), buildJsonObject { put("deleted_at", now) })
        audit(api, session, "delete_class", buildJsonObject { put("name", c.name); put("source", "android") })
    }
    suspend fun addStudents(classId: String, list: List<Pair<String, String>>) = repository.online { api, session ->
        require(list.isNotEmpty()) { "Liste vide." }
        api.insertRows(session, "students", buildJsonArray { list.forEach { (ln, fn) -> add(buildJsonObject {
            put("teacher_id", session.userId); put("class_id", classId); put("last_name", ln.trim().uppercase().take(60)); put("first_name", fn.trim().take(60))
        }) } })
    }
    suspend fun removeStudent(id: String) = repository.online { api, session ->
        api.patchRows(session, "students", mapOf("id" to "eq.$id"), buildJsonObject { put("deleted_at", java.time.Instant.now().toString()) })
        api.deleteWhere(session, "v33_s2_group_members", mapOf("student_id" to "eq.$id"))
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
            rows.forEach { r -> add(buildJsonObject { put("space_id", space); put("starts_on", r.startsOn); put("ends_on", r.endsOn); put("label", r.label.take(160)); put("kind", r.kind); put("source", "calendrier"); put("validated", false) }) }
        })
        audit(api, session, "import_calendar", buildJsonObject { put("file", file); put("n", rows.size); put("source", "android") })
        rows.size
    }

    suspend fun saveVersion(label: String) = repository.online { api, session ->
        api.callRpc(session, "v33_s2_save_version", buildJsonObject { put("p_label", label.take(120)); put("p_space", space) })
    }

    suspend fun restoreVersion(id: String) = repository.online { api, session ->
        // Sauvegarde du planning actuel avant de le remplacer.
        api.callRpc(session, "v33_s2_save_version", buildJsonObject { put("p_label", "Sauvegarde avant restauration (application)"); put("p_space", space) })
        api.callRpc(session, "v33_s2_restore_version", buildJsonObject { put("p_id", id) })
    }

    private suspend fun audit(api: tn.utm.fst.gestionpresence.nativeapp.data.remote.OnlineApiClient, session: tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession, action: String, detail: JsonObject) {
        runCatching { api.insertRows(session, "v33_s2_audit", buildJsonArray { add(buildJsonObject { put("space_id", space); put("action", action); put("detail", detail) }) }) }
    }

    companion object {
        fun fmt(d: String): String = runCatching { val x = LocalDate.parse(d.take(10)); "%02d/%02d/%04d".format(x.dayOfMonth, x.monthValue, x.year) }.getOrDefault(d)
    }
}
