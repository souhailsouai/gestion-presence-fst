package tn.utm.fst.gestionpresence.nativeapp.data.repository

import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.async
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.core.model.AcademicClass
import tn.utm.fst.gestionpresence.nativeapp.core.model.ApiException
import tn.utm.fst.gestionpresence.nativeapp.core.model.AppContract
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceDraft
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceRecord
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceSheet
import tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.DashboardStats
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaEnrollment
import tn.utm.fst.gestionpresence.nativeapp.core.model.PlanSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaFactor
import tn.utm.fst.gestionpresence.nativeapp.core.model.ReportSummary
import tn.utm.fst.gestionpresence.nativeapp.core.model.Student
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeacherDirectoryEntry
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeachingSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.UserProfile
import tn.utm.fst.gestionpresence.nativeapp.core.security.SecureSessionStore
import tn.utm.fst.gestionpresence.nativeapp.data.remote.OnlineApiClient
import java.time.LocalDate
import java.util.UUID

class PresenceRepository(context: Context) {
    private val appContext = context.applicationContext
    private val api = OnlineApiClient()
    private val sessionStore = SecureSessionStore(appContext)
    private var activeSession: AuthSession? = null
    private var activeProfile: UserProfile? = null

    fun isOnline(): Boolean {
        val connectivity = appContext.getSystemService(ConnectivityManager::class.java)
        val network = connectivity.activeNetwork ?: return false
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun session(): AuthSession? = activeSession
    fun profile(): UserProfile? = activeProfile
    fun assuranceLevel(): String = activeSession?.let(api::assuranceLevel) ?: "aal1"

    suspend fun login(identifier: String, credential: String, mode: String): LoginBundle {
        requireOnline()
        var session = api.login(identifier, credential)
        val profile = api.profile(session)
        if (profile.accountState != "active") throw ApiException("FORBIDDEN", "Ce compte est désactivé.")
        if (mode == "admin" && !profile.isAdmin) throw ApiException("FORBIDDEN", "Droits administrateur requis.")
        if (session.role != profile.role) session = session.copy(role = profile.role)
        activeSession = session
        activeProfile = profile
        sessionStore.save(session)
        return LoginBundle(session, profile, api.mfaFactors(session))
    }

    suspend fun restore(): LoginBundle? {
        requireOnline()
        var session = sessionStore.load() ?: return null
        if (session.isExpired) session = api.refresh(session.refreshToken)
        return runCatching {
            val current = session
            val (profile, factors) = coroutineScope {
                val p = async { api.profile(current) }
                val f = async { runCatching { api.mfaFactors(current) }.getOrDefault(emptyList()) }
                p.await() to f.await()
            }
            if (profile.accountState != "active") throw ApiException("FORBIDDEN", "Ce compte est désactivé.")
            if (session.role != profile.role) session = session.copy(role = profile.role)
            activeSession = session
            activeProfile = profile
            sessionStore.save(session)
            LoginBundle(session, profile, factors)
        }.getOrElse {
            sessionStore.clear()
            activeSession = null
            activeProfile = null
            null
        }
    }

    suspend fun logout() {
        activeSession?.let { runCatching { api.logout(it) } }
        activeSession = null
        activeProfile = null
        sessionStore.clearAll()
    }

    /** Verrouille l'application sans fermer la session serveur (réouverture par empreinte). */
    fun lock() {
        activeSession = null
        activeProfile = null
    }

    /** Exécute un appel authentifié (session rafraîchie si besoin). */
    suspend fun <T> online(block: suspend (OnlineApiClient, AuthSession) -> T): T {
        requireOnline()
        return block(api, authorizedSession())
    }

    /** S1 : changer l'enseignant d'un groupe (séance pas encore commencée). */
    suspend fun assignS1Teacher(sessionId: String, groupNo: Int, code: String, teacherId: String, room: String) {
        requireOnline()
        val r = api.callRpc(authorizedSession(), "v515_assign_teacher", buildJsonObject {
            put("p_session_id", sessionId); put("p_group_no", groupNo); put("p_manipulation_code", code); put("p_teacher_id", teacherId); put("p_room", room)
        })
        checkOk(r, "Affectation impossible.")
    }

    /** Permutation de deux enseignants entre deux jours (cette semaine ou toutes les semaines futures). */
    suspend fun swapTeachers(a: String, dayA: Int, b: String, dayB: Int, effective: String, scope: String): Int {
        requireOnline()
        require(a != b) { "Les enseignants doivent être différents." }
        require(dayA != dayB) { "Les jours doivent être différents." }
        LocalDate.parse(effective)
        val session = authorizedSession()
        val r = api.callRpc(session, "v16_swap_teachers", buildJsonObject {
            put("p_teacher_a", a); put("p_day_a", dayA); put("p_teacher_b", b); put("p_day_b", dayB)
            put("p_effective_date", effective); put("p_scope", scope); put("p_context", "real")
        })
        checkOk(r, "Permutation refusée.")
        val monday = LocalDate.parse(effective).let { it.minusDays((it.dayOfWeek.value - 1).toLong()) }
        runCatching { api.callRpc(session, "v16_verify_teacher_week", buildJsonObject { put("p_week_start", monday.toString()); put("p_context", "real") }) }
        return ((r as? JsonObject)?.get("changed_assignments") as? kotlinx.serialization.json.JsonPrimitive)?.content?.toIntOrNull() ?: 0
    }

    private fun checkOk(r: kotlinx.serialization.json.JsonElement, fallback: String) {
        val o = r as? JsonObject ?: return
        val ok = (o["ok"] as? kotlinx.serialization.json.JsonPrimitive)?.content
        if (ok == "false") throw ApiException("VALIDATION_ERROR", (o["message"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: fallback)
    }

    fun hasSavedSession(): Boolean = sessionStore.hasSession()
    var biometricEnabled: Boolean
        get() = sessionStore.biometricEnabled
        set(value) { sessionStore.biometricEnabled = value; sessionStore.biometricOffered = true }
    var biometricOffered: Boolean
        get() = sessionStore.biometricOffered
        set(value) { sessionStore.biometricOffered = value }

    suspend fun enrollMfa(): MfaEnrollment {
        requireOnline()
        return api.enrollMfa(authorizedSession())
    }

    suspend fun verifyMfa(factorId: String, code: String): AuthSession {
        requireOnline()
        val updated = api.verifyMfa(authorizedSession(), factorId, code)
        activeSession = updated
        sessionStore.save(updated)
        return updated
    }

    suspend fun mfaFactors(): List<MfaFactor> {
        requireOnline()
        return api.mfaFactors(authorizedSession())
    }

    suspend fun removeMfa(factorId: String) {
        requireOnline()
        api.unenrollMfa(authorizedSession(), factorId)
    }

    suspend fun load(): RepositoryData {
        requireOnline()
        val session = authorizedSession()
        val contract = runCatching { api.appContract(session) }.getOrElse { if (it is ApiException && it.code == "UNAUTHENTICATED") throw it else AppContract.DEFAULT }
        if (contract.maintenanceEnabled) {
            throw ApiException("SERVER_UNAVAILABLE", contract.maintenanceMessage.ifBlank { "Application en maintenance." })
        }
        // Toutes les lectures partent en parallèle : l'ouverture ne dépend plus que de la plus lente.
        val (lists, extras) = coroutineScope {
            val classes = async { api.classes(session) }
            val students = async { api.students(session) }
            val sessions = async { api.sessions(session) }
            val attendance = async { api.attendance(session) }
            val directory = async { api.teacherDirectory(session) }
            val plan = async { api.s2Plan(session) }
            val names = async { api.teacherNames(session) }
            val titles = async { api.manipulationTitles(session) }
            val s1 = async { api.s1Plan(session) }
            val manips = async { api.sessionManipulations(session) }
            Triple(classes.await(), students.await(), sessions.await()) to listOf(attendance.await(), directory.await(), plan.await(), names.await(), titles.await(), s1.await(), manips.await())
        }
        val (classes, students, sessions) = lists
        @Suppress("UNCHECKED_CAST") val attendance = extras[0] as List<AttendanceRecord>
        @Suppress("UNCHECKED_CAST") val directory = extras[1] as List<TeacherDirectoryEntry>
        @Suppress("UNCHECKED_CAST") val plan = extras[2] as List<PlanSession>
        @Suppress("UNCHECKED_CAST") val names = directory.associate { it.teacherId to it.teacherName } + (extras[3] as Map<String, String>)
        @Suppress("UNCHECKED_CAST") val titles = extras[4] as Map<String, String>
        @Suppress("UNCHECKED_CAST") val s1 = extras[5] as Pair<List<PlanSession>, Map<Int, List<String>>>
        @Suppress("UNCHECKED_CAST") val sessionManips = extras[6] as Map<String, String>
        return RepositoryData(
            contract = contract,
            classes = classes,
            students = students,
            sessions = sessions,
            attendance = attendance,
            directory = directory,
            stats = stats(classes, students, sessions, attendance),
            plan = plan,
            teacherNames = names,
            manipulationTitles = titles,
            s1Plan = s1.first,
            s1Pool = s1.second,
            sessionManipulations = sessionManips
        )
    }

    suspend fun addClass(
        name: String,
        module: String,
        track: String,
        classNumber: Int,
        groupNumber: Int,
        day: String?,
        startTime: String?,
        endTime: String?,
        room: String?
    ) {
        requireOnline()
        validateTimes(startTime, endTime)
        val session = authorizedSession()
        api.upsertClass(session, buildJsonObject {
            put("id", UUID.randomUUID().toString())
            put("teacher_id", session.userId)
            put("name", name.trim())
            put("module", module.trim())
            put("track", track)
            put("class_number", classNumber)
            put("group_number", groupNumber)
            if (day.isNullOrBlank()) put("day", JsonNull) else put("day", day)
            if (startTime.isNullOrBlank()) put("start_time", JsonNull) else put("start_time", startTime)
            if (endTime.isNullOrBlank()) put("end_time", JsonNull) else put("end_time", endTime)
            if (room.isNullOrBlank()) put("room", JsonNull) else put("room", room.trim())
        })
    }

    suspend fun addStudent(classId: String, lastName: String, firstName: String, email: String?) {
        requireOnline()
        require(lastName.isNotBlank() && firstName.isNotBlank()) { "Nom et prénom obligatoires." }
        // Même chemin que le site (contrôle des droits côté serveur, y compris LPC3).
        api.callRpc(authorizedSession(), "v31_add_student_authorized", buildJsonObject {
            put("p_student_id", UUID.randomUUID().toString())
            put("p_class_id", classId)
            put("p_last_name", lastName.trim())
            put("p_first_name", firstName.trim())
            if (email.isNullOrBlank()) put("p_email", JsonNull) else put("p_email", email.trim())
        })
    }

    /** Changement de groupe à partir d'une date d'effet (les présences passées restent attachées). */
    suspend fun assignStudent(studentId: String, classId: String, effectiveFrom: String) {
        requireOnline()
        LocalDate.parse(effectiveFrom)
        val res = api.callRpc(authorizedSession(), "v30_teacher_assign_student", buildJsonObject {
            put("p_student_id", studentId); put("p_class_id", classId); put("p_effective_from", effectiveFrom)
        })
        (res as? JsonObject)?.let { o ->
            val ok = (o["ok"] as? kotlinx.serialization.json.JsonPrimitive)?.content
            if (ok == "false") throw ApiException("VALIDATION_ERROR", (o["message"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: "Modification refusée.")
        }
    }

    suspend fun addSession(classId: String, date: String, startTime: String, endTime: String) {
        requireOnline()
        validateTimes(startTime, endTime)
        LocalDate.parse(date)
        val session = authorizedSession()
        api.upsertSession(session, buildJsonObject {
            put("id", UUID.randomUUID().toString())
            put("teacher_id", session.userId)
            put("class_id", classId)
            put("session_date", date)
            put("start_time", startTime)
            put("end_time", endTime)
        })
    }

    suspend fun completeSession(item: TeachingSession) {
        requireOnline()
        api.upsertSession(authorizedSession(), buildJsonObject {
            put("id", item.id)
            put("teacher_id", item.teacherId)
            put("class_id", item.classId)
            put("session_date", item.sessionDate)
            put("start_time", item.startTime)
            put("end_time", item.endTime)
            put("completed_at", java.time.Instant.now().toString())
        })
    }

    suspend fun deleteClass(id: String) = delete("classes", id)
    suspend fun deleteStudent(id: String) = delete("students", id)
    suspend fun deleteSession(id: String) = delete("sessions", id)

    suspend fun attendanceSheet(sessionId: String): AttendanceSheet {
        requireOnline()
        return api.getAttendanceSheet(authorizedSession(), sessionId)
    }

    suspend fun saveAttendance(
        sessionId: String,
        expectedRevision: Long,
        operationId: String,
        records: List<AttendanceDraft>,
        justification: String? = null
    ): AttendanceSheet {
        requireOnline()
        records.forEach { require(it.grade == null || it.grade in 0.0..20.0) { "La note doit être comprise entre 0 et 20." } }
        return api.saveAttendanceSheet(
            session = authorizedSession(),
            sessionId = sessionId,
            expectedRevision = expectedRevision,
            operationId = operationId,
            records = records,
            justification = justification
        )
    }

    suspend fun setMakeup(attendanceId: String, date: String?, note: String?) {
        requireOnline()
        date?.let { LocalDate.parse(it) }
        api.setMakeup(authorizedSession(), attendanceId, date, note)
    }

    suspend fun adminCreateTeacher(username: String, fullName: String, password: String): JsonObject {
        requireOnline()
        return api.adminAction(authorizedSession(), buildJsonObject {
            put("action", "create")
            put("username", username)
            put("full_name", fullName)
            put("password", password)
        })
    }

    suspend fun adminResetPassword(userId: String, password: String, justification: String): JsonObject {
        requireOnline()
        return api.adminAction(authorizedSession(), buildJsonObject {
            put("action", "reset_password")
            put("user_id", userId)
            put("password", password)
            put("justification", justification)
        })
    }

    suspend fun adminSetPin(pin: String): JsonObject {
        requireOnline()
        return api.adminAction(authorizedSession(), buildJsonObject {
            put("action", "set_admin_pin")
            put("pin", pin)
        })
    }

    fun reports(data: RepositoryData): List<ReportSummary> {
        val attendanceBySession = data.attendance.groupBy { it.sessionId }
        return data.classes.map { academicClass ->
            val sessionIds = data.sessions.filter { it.classId == academicClass.id }.map { it.id }.toSet()
            val records = attendanceBySession.filterKeys(sessionIds::contains).values.flatten()
            ReportSummary(
                title = "${academicClass.name} — ${academicClass.module}",
                totalRecords = records.size,
                present = records.count { it.status.wireValue == "present" },
                absent = records.count { it.status.wireValue == "absent" },
                late = records.count { it.status.wireValue == "retard" },
                justified = records.count { it.status.wireValue == "justifie" },
                averageGrade = records.mapNotNull { it.grade }.takeIf { it.isNotEmpty() }?.average()
            )
        }
    }

    private suspend fun delete(table: String, id: String) {
        requireOnline()
        api.deleteRow(authorizedSession(), table, id)
    }

    private suspend fun authorizedSession(): AuthSession {
        var session = activeSession ?: throw ApiException("UNAUTHENTICATED", "Session absente.")
        if (session.isExpired) {
            session = api.refresh(session.refreshToken)
            activeSession = session
            sessionStore.save(session)
        }
        return session
    }

    private fun requireOnline() {
        if (!isOnline()) throw ApiException("NETWORK_UNAVAILABLE", "Connexion Internet requise.")
    }

    private fun validateTimes(start: String?, end: String?) {
        if (!start.isNullOrBlank() && !end.isNullOrBlank()) {
            require(start < end) { "L’heure de début doit précéder l’heure de fin." }
        }
    }

    private fun stats(
        classes: List<AcademicClass>,
        students: List<Student>,
        sessions: List<TeachingSession>,
        attendance: List<AttendanceRecord>
    ): DashboardStats = DashboardStats(
        classCount = classes.size,
        studentCount = students.size,
        sessionCount = sessions.size,
        attendanceCount = attendance.size,
        presentCount = attendance.count { it.status.wireValue == "present" },
        absentCount = attendance.count { it.status.wireValue == "absent" },
        lateCount = attendance.count { it.status.wireValue == "retard" },
        justifiedCount = attendance.count { it.status.wireValue == "justifie" }
    )
}

data class LoginBundle(
    val session: AuthSession,
    val profile: UserProfile,
    val factors: List<MfaFactor>
)

data class RepositoryData(
    val contract: AppContract,
    val classes: List<AcademicClass>,
    val students: List<Student>,
    val sessions: List<TeachingSession>,
    val attendance: List<AttendanceRecord>,
    val directory: List<TeacherDirectoryEntry>,
    val stats: DashboardStats,
    val plan: List<PlanSession> = emptyList(),
    val teacherNames: Map<String, String> = emptyMap(),
    val manipulationTitles: Map<String, String> = emptyMap(),
    val s1Plan: List<PlanSession> = emptyList(),
    val s1Pool: Map<Int, List<String>> = emptyMap(),
    val sessionManipulations: Map<String, String> = emptyMap()
) {
    // Index calculés une seule fois : l'interface ne parcourt plus les 1000+ présences à chaque affichage.
    val classById: Map<String, AcademicClass> by lazy { classes.associateBy { it.id } }
    val sessionById: Map<String, TeachingSession> by lazy { sessions.associateBy { it.id } }
    val attendanceBySession: Map<String, List<AttendanceRecord>> by lazy { attendance.groupBy { it.sessionId } }
    val attendanceByStudent: Map<String, List<AttendanceRecord>> by lazy { attendance.groupBy { it.studentId } }
    val studentsByClass: Map<String, List<Student>> by lazy { students.groupBy { it.classId } }

    /** Filière : "PHY" = TP Physique (MPI1, PC1) ; "LPC" = LPC3 (Ondes et Vibrations). */
    fun forModule(module: String): RepositoryData {
        val keep = classes.filter { moduleOf(it) == module }
        val ids = keep.map { it.id }.toSet()
        val keptSessions = sessions.filter { it.classId in ids }
        val sessionIds = keptSessions.map { it.id }.toSet()
        return copy(
            classes = keep,
            students = students.filter { it.classId in ids },
            sessions = keptSessions,
            attendance = attendance.filter { it.sessionId in sessionIds },
            plan = if (module == "PHY") plan else emptyList(),
            s1Plan = if (module == "PHY") s1Plan else emptyList()
        )
    }

    fun hasModule(module: String): Boolean = classes.any { moduleOf(it) == module }

    companion object {
        fun moduleOf(c: AcademicClass): String = if (c.track.equals("LPC", true) || c.name.startsWith("LPC")) "LPC" else "PHY"
    }
}
