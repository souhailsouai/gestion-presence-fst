package tn.utm.fst.gestionpresence.nativeapp.feature.main

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import tn.utm.fst.gestionpresence.nativeapp.core.model.ApiException
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceDraft
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaEnrollment
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaFactor
import tn.utm.fst.gestionpresence.nativeapp.core.model.ReportSummary
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeachingSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.UserProfile
import tn.utm.fst.gestionpresence.nativeapp.data.repository.LoginBundle
import tn.utm.fst.gestionpresence.nativeapp.data.repository.PresenceRepository
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData
import java.util.UUID

enum class AppScreen {
    LOGIN,
    MFA_ENROLL,
    MFA_CHALLENGE,
    HOME,
    CLASSES,
    TIMETABLE,
    TEACHERS,
    STUDENTS,
    SESSIONS,
    ATTENDANCE,
    REPORTS,
    ADMIN,
    ACCOUNT,
    PLANNING,
    STATS,
    MORE,
    STUDENT_DETAIL,
    LOCKED,
    S2_ADMIN,
    SWAP,
    EXPORT,
    ACCOUNTS,
    REPORT_PDF,
    S1_CONFIG,
    HELP,
    NOTICES
}

data class MainUiState(
    val screen: AppScreen = AppScreen.LOGIN,
    val loading: Boolean = true,
    val online: Boolean = true,
    val profile: UserProfile? = null,
    val data: RepositoryData? = null,
    val factors: List<MfaFactor> = emptyList(),
    val mfaEnrollment: MfaEnrollment? = null,
    val mfaFactorId: String? = null,
    val selectedSessionId: String? = null,
    val attendanceRevision: Long = 0,
    /** Appel commun à plusieurs séances (examen LPC3) : séance → révision. Vide = appel normal. */
    val examSessions: Map<String, Long> = emptyMap(),
    val attendanceDrafts: Map<String, AttendanceDraft> = emptyMap(),
    val pendingOperationId: String? = null,
    val reports: List<ReportSummary> = emptyList(),
    val message: String? = null,
    val error: String? = null,
    val selectedStudentId: String? = null,
    val biometricEnabled: Boolean = false,
    val offerBiometric: Boolean = false
) {
    val authenticated: Boolean get() = profile != null
    val isAdmin: Boolean get() = profile?.isAdmin == true
}

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PresenceRepository(application)
    val s2 = tn.utm.fst.gestionpresence.nativeapp.feature.s2.S2Admin(repository)
    val admin = tn.utm.fst.gestionpresence.nativeapp.feature.admin.AdminTools(repository)
    private val _state = MutableStateFlow(MainUiState(online = repository.isOnline()))
    val state: StateFlow<MainUiState> = _state.asStateFlow()

    init {
        if (repository.biometricEnabled && repository.hasSavedSession()) {
            // Écran de déverrouillage immédiat : aucune requête réseau avant l'empreinte.
            _state.value = MainUiState(screen = AppScreen.LOCKED, loading = false, online = repository.isOnline(), biometricEnabled = true)
        } else {
            restore()
        }
    }

    /** Appelé après une authentification biométrique réussie. */
    fun unlocked() = restore()

    /** Abandon de l'empreinte : retour au formulaire (la session enregistrée est conservée). */
    fun usePassword() {
        _state.value = MainUiState(screen = AppScreen.LOGIN, loading = false, online = repository.isOnline(), biometricEnabled = repository.biometricEnabled)
    }

    /** Recharge les données après une modification du S2 (planning recalculé côté serveur). */
    fun reloadData(message: String? = null) = mutate(message ?: "") { }

    /** Action S2 (planning, groupes) puis rechargement des données. */
    fun s2Action(message: String, block: suspend () -> Unit) = mutate(message) { block() }

    fun lock() {
        repository.lock()
        _state.value = MainUiState(screen = AppScreen.LOCKED, loading = false, online = repository.isOnline(), biometricEnabled = true)
    }

    fun setBiometric(enabled: Boolean) {
        repository.biometricEnabled = enabled
        _state.value = _state.value.copy(
            biometricEnabled = enabled,
            offerBiometric = false,
            message = if (enabled) "Connexion par empreinte activée." else "Connexion par empreinte désactivée.",
            error = null
        )
    }

    fun dismissBiometricOffer() {
        repository.biometricOffered = true
        _state.value = _state.value.copy(offerBiometric = false)
    }

    fun restore() {
        viewModelScope.launch {
            setLoading(true)
            try {
                val bundle = repository.restore()
                if (bundle == null) {
                    _state.value = MainUiState(screen = AppScreen.LOGIN, loading = false, online = repository.isOnline())
                } else {
                    continueAfterLogin(bundle)
                }
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.LOGIN)
            }
        }
    }

    fun login(identifier: String, credential: String, mode: String) {
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                continueAfterLogin(repository.login(identifier, credential, mode))
            } catch (error: Throwable) {
                runCatching { repository.logout() }
                handle(error, fallbackScreen = AppScreen.LOGIN)
            }
        }
    }

    fun verifyMfa(code: String) {
        if (!code.matches(Regex("^\\d{6}$"))) {
            _state.value = _state.value.copy(error = "Le code doit contenir exactement 6 chiffres.")
            return
        }
        val factorId = _state.value.mfaFactorId ?: _state.value.mfaEnrollment?.factorId ?: return
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                repository.verifyMfa(factorId, code)
                loadApplication(AppScreen.HOME)
            } catch (error: Throwable) {
                handle(error, fallbackScreen = _state.value.screen)
            }
        }
    }

    fun cancelMfa() {
        viewModelScope.launch {
            runCatching { repository.logout() }
            _state.value = MainUiState(screen = AppScreen.LOGIN, loading = false, online = repository.isOnline())
        }
    }

    fun navigate(screen: AppScreen) {
        if (screen == AppScreen.ADMIN && !_state.value.isAdmin) {
            _state.value = _state.value.copy(error = "Droits administrateur requis.")
            return
        }
        _state.value = _state.value.copy(screen = screen, message = null, error = null)
        if (screen == AppScreen.ACCOUNT) refreshMfaFactors()
    }

    fun refresh() {
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                loadApplication(_state.value.screen.takeIf { it != AppScreen.LOGIN } ?: AppScreen.HOME)
            } catch (error: Throwable) {
                handle(error)
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            setLoading(true)
            runCatching { repository.logout() }
            _state.value = MainUiState(screen = AppScreen.LOGIN, loading = false, online = repository.isOnline())
        }
    }

    fun addClass(
        name: String,
        module: String,
        track: String,
        classNumber: Int,
        groupNumber: Int,
        day: String?,
        startTime: String?,
        endTime: String?,
        room: String?
    ) = mutate("Classe ajoutée.") {
        require(name.isNotBlank() && module.isNotBlank()) { "Le nom et le module sont obligatoires." }
        require(groupNumber in 1..4) { "Le groupe doit être compris entre 1 et 4." }
        require((track == "MPI" && classNumber in 1..5) || (track == "PC" && classNumber == 1)) { "Numéro de classe invalide." }
        repository.addClass(name, module, track, classNumber, groupNumber, day, startTime, endTime, room)
    }

    fun addStudent(classId: String, lastName: String, firstName: String, email: String?) = mutate("Étudiant ajouté.") {
        require(classId.isNotBlank() && lastName.isNotBlank() && firstName.isNotBlank()) { "Classe, nom et prénom sont obligatoires." }
        repository.addStudent(classId, lastName, firstName, email)
    }

    fun addSession(classId: String, date: String, startTime: String, endTime: String) = mutate("Séance créée.") {
        require(classId.isNotBlank() && date.isNotBlank() && startTime.isNotBlank() && endTime.isNotBlank()) { "Tous les champs sont obligatoires." }
        repository.addSession(classId, date, startTime, endTime)
    }

    fun deleteClass(id: String) = mutate("Classe supprimée.") { repository.deleteClass(id) }
    fun deleteStudent(id: String) = mutate("Étudiant supprimé.") { repository.deleteStudent(id) }
    fun deleteSession(id: String) = mutate("Séance supprimée.") { repository.deleteSession(id) }

    /** Ouvre l'appel d'un groupe du planning : crée la séance réelle puis affiche la feuille d'appel. */
    fun openPlannedSession(planId: String) {
        viewModelScope.launch {
            setLoading(true); clearNotice()
            try {
                val sessionId = repository.startPlannedSession(planId)
                val data = repository.load()
                _state.value = _state.value.copy(data = data, reports = repository.reports(data), online = repository.isOnline())
                selectAttendanceSession(sessionId)
            } catch (error: Throwable) {
                handle(error)
            }
        }
    }

    /** Appel commun : une seule feuille pour tous les étudiants de plusieurs séances (examen LPC3, tous les groupes). */
    fun selectExamSessions(sessionIds: List<String>) {
        viewModelScope.launch {
            setLoading(true); clearNotice()
            try {
                val data = _state.value.data ?: repository.load()
                val sessions = sessionIds.mapNotNull { id -> data.sessions.firstOrNull { it.id == id } }
                require(sessions.isNotEmpty()) { "Séance introuvable." }
                val revisions = mutableMapOf<String, Long>()
                val drafts = mutableMapOf<String, AttendanceDraft>()
                for (s in sessions) {
                    val sheet = repository.attendanceSheet(s.id)
                    revisions[s.id] = sheet.revision
                    val records = sheet.records.associateBy { it.studentId }
                    data.students.filter { it.classId == s.classId }.forEach { student ->
                        val record = records[student.id]
                        drafts[student.id] = AttendanceDraft(studentId = student.id, status = record?.status ?: AttendanceStatus.PRESENT,
                            comment = record?.comment.orEmpty(), grade = record?.grade)
                    }
                }
                _state.value = _state.value.copy(screen = AppScreen.ATTENDANCE, loading = false, online = repository.isOnline(), data = data,
                    selectedSessionId = sessions.first().id, examSessions = revisions, attendanceRevision = revisions[sessions.first().id] ?: 0,
                    attendanceDrafts = drafts, pendingOperationId = null)
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ATTENDANCE)
            }
        }
    }

    fun selectAttendanceSession(sessionId: String) {
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                val data = _state.value.data ?: repository.load()
                val teachingSession = data.sessions.firstOrNull { it.id == sessionId }
                    ?: throw IllegalArgumentException("Séance introuvable.")
                val sheet = repository.attendanceSheet(sessionId)
                val records = sheet.records.associateBy { it.studentId }
                val drafts = data.students
                    .filter { it.classId == teachingSession.classId }
                    .associate { student ->
                        val record = records[student.id]
                        student.id to AttendanceDraft(
                            studentId = student.id,
                            status = record?.status ?: AttendanceStatus.PRESENT,
                            comment = record?.comment.orEmpty(),
                            grade = record?.grade
                        )
                    }
                _state.value = _state.value.copy(
                    screen = AppScreen.ATTENDANCE,
                    loading = false,
                    online = repository.isOnline(),
                    data = data,
                    selectedSessionId = sessionId,
                    examSessions = emptyMap(),
                    attendanceRevision = sheet.revision,
                    attendanceDrafts = drafts,
                    pendingOperationId = null
                )
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ATTENDANCE)
            }
        }
    }

    fun updateAttendanceStatus(studentId: String, status: AttendanceStatus) {
        updateDraft(studentId) { it.copy(status = status) }
    }

    fun updateAttendanceComment(studentId: String, comment: String) {
        updateDraft(studentId) { it.copy(comment = comment) }
    }

    fun updateAttendanceGrade(studentId: String, value: String) {
        val normalized = value.replace(',', '.').trim()
        val grade = normalized.takeIf { it.isNotBlank() }?.toDoubleOrNull()
        if (normalized.isNotBlank() && (grade == null || grade !in 0.0..20.0)) {
            _state.value = _state.value.copy(error = "La note doit être comprise entre 0 et 20.")
            return
        }
        updateDraft(studentId) { it.copy(grade = grade) }
    }

    fun saveAttendance() {
        if (_state.value.examSessions.isNotEmpty()) return saveExamAttendance()
        val current = _state.value
        val sessionId = current.selectedSessionId ?: return
        val operationId = current.pendingOperationId ?: UUID.randomUUID().toString()
        _state.value = current.copy(pendingOperationId = operationId, loading = true, error = null, message = null)
        viewModelScope.launch {
            try {
                val sheet = repository.saveAttendance(
                    sessionId = sessionId,
                    expectedRevision = _state.value.attendanceRevision,
                    operationId = operationId,
                    records = _state.value.attendanceDrafts.values.map { if (it.status == AttendanceStatus.ABSENT) it.copy(grade = null) else it }
                )
                // Mise à jour locale avec la feuille renvoyée par le serveur : pas de rechargement complet.
                val current = _state.value.data
                val updatedData = if (current != null && sheet.records.isNotEmpty())
                    current.copy(attendance = current.attendance.filter { it.sessionId != sessionId } + sheet.records)
                else repository.load()
                _state.value = _state.value.copy(
                    loading = false,
                    online = repository.isOnline(),
                    data = updatedData,
                    attendanceRevision = sheet.revision,
                    pendingOperationId = null,
                    reports = repository.reports(updatedData),
                    message = "Présence enregistrée.",
                    error = null
                )
            } catch (error: Throwable) {
                if (error is ApiException && error.code == "VERSION_CONFLICT") {
                    val server = runCatching { repository.attendanceSheet(sessionId) }.getOrNull()
                    if (server != null) {
                        val records = server.records.associateBy { it.studentId }
                        val drafts = _state.value.attendanceDrafts.mapValues { (studentId, draft) ->
                            records[studentId]?.let { record ->
                                draft.copy(status = record.status, comment = record.comment, grade = record.grade)
                            } ?: draft
                        }
                        _state.value = _state.value.copy(
                            loading = false,
                            attendanceRevision = server.revision,
                            attendanceDrafts = drafts,
                            pendingOperationId = null,
                            error = "Conflit détecté : la version serveur a été rechargée. Vérifiez puis enregistrez à nouveau."
                        )
                        return@launch
                    }
                }
                handle(error, fallbackScreen = AppScreen.ATTENDANCE, preserveOperation = true)
            }
        }
    }

    /** Enregistre l'appel commun : une écriture par séance (groupe), avec les étudiants de ce groupe. */
    private fun saveExamAttendance() {
        val current = _state.value
        val data0 = current.data ?: return
        _state.value = current.copy(loading = true, error = null, message = null)
        viewModelScope.launch {
            try {
                val revisions = _state.value.examSessions.toMutableMap()
                var data = data0
                for ((sid, rev) in revisions.toMap()) {
                    val classId = data.sessions.firstOrNull { it.id == sid }?.classId ?: continue
                    val ids = data.students.filter { it.classId == classId }.map { it.id }.toSet()
                    val sheet = repository.saveAttendance(sessionId = sid, expectedRevision = rev, operationId = UUID.randomUUID().toString(),
                        records = _state.value.attendanceDrafts.values.filter { it.studentId in ids }.map { if (it.status == AttendanceStatus.ABSENT) it.copy(grade = null) else it })
                    revisions[sid] = sheet.revision
                    if (sheet.records.isNotEmpty()) data = data.copy(attendance = data.attendance.filter { it.sessionId != sid } + sheet.records)
                }
                _state.value = _state.value.copy(loading = false, online = repository.isOnline(), data = data, examSessions = revisions,
                    reports = repository.reports(data), message = "Présence de l’examen enregistrée (tous les groupes).", error = null)
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ATTENDANCE)
            }
        }
    }

    fun openStudent(studentId: String) {
        _state.value = _state.value.copy(screen = AppScreen.STUDENT_DETAIL, selectedStudentId = studentId, message = null, error = null)
    }

    fun markAllPresent() {
        val drafts = _state.value.attendanceDrafts.mapValues { (_, draft) -> draft.copy(status = AttendanceStatus.PRESENT) }
        _state.value = _state.value.copy(attendanceDrafts = drafts, error = null)
    }

    /** Rattrapage d'une absence enregistrée (date au format AAAA-MM-JJ, ou null pour annuler). */
    fun setMakeup(attendanceId: String, date: String?) {
        viewModelScope.launch {
            clearNotice()
            try {
                repository.setMakeup(attendanceId, date, if (date != null) "Rattrapé (application Android)" else null)
                val data = repository.load()
                _state.value = _state.value.copy(
                    online = repository.isOnline(),
                    data = data,
                    reports = repository.reports(data),
                    message = if (date != null) "Rattrapage enregistré." else "Rattrapage annulé.",
                    error = null
                )
            } catch (error: Throwable) {
                handle(error)
            }
        }
    }

    fun endMembership(studentId: String, effectiveTo: String) = mutate("Étudiant rendu inactif à partir du ${effectiveTo.let { it.substring(8, 10) + "/" + it.substring(5, 7) + "/" + it.substring(0, 4) }}.") {
        repository.endMembership(studentId, effectiveTo)
    }

    fun assignStudent(studentId: String, classId: String, effectiveFrom: String) = mutate("Groupe modifié à partir du ${effectiveFrom.split('-').reversed().joinToString("/")}.") {
        repository.assignStudent(studentId, classId, effectiveFrom)
    }

    fun assignS1Teacher(sessionId: String, groupNo: Int, code: String, teacherId: String, room: String) =
        mutate("Enseignant modifié.") { repository.assignS1Teacher(sessionId, groupNo, code, teacherId, room) }

    fun swapTeachers(a: String, dayA: Int, b: String, dayB: Int, effective: String, scope: String) {
        viewModelScope.launch {
            setLoading(true); clearNotice()
            try {
                val n = repository.swapTeachers(a, dayA, b, dayB, effective, scope)
                val data = repository.load()
                _state.value = _state.value.copy(loading = false, data = data, reports = repository.reports(data), message = "Permutation appliquée ($n affectation(s)).", error = null)
            } catch (e: Throwable) { handle(e) }
        }
    }

    fun completeSession(session: TeachingSession) = mutate("Séance terminée.") {
        repository.completeSession(session)
    }

    fun beginMfaEnrollment() {
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                val enrollment = repository.enrollMfa()
                _state.value = _state.value.copy(
                    loading = false,
                    screen = AppScreen.MFA_ENROLL,
                    mfaEnrollment = enrollment,
                    mfaFactorId = enrollment.factorId
                )
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ACCOUNT)
            }
        }
    }

    fun removeMfa(factorId: String) {
        viewModelScope.launch {
            setLoading(true)
            try {
                repository.removeMfa(factorId)
                refreshMfaFactors("Appareil retiré.")
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ACCOUNT)
            }
        }
    }

    fun adminCreateTeacher(username: String, fullName: String, password: String) = mutate("Compte enseignant créé.") {
        require(username.isNotBlank() && fullName.isNotBlank() && password.length >= 6) { "Données du compte invalides." }
        repository.adminCreateTeacher(username, fullName, password)
    }

    /** Mêmes règles que le site : 6 chiffres (enseignant) ou 6 à 12 (administrateur), confirmation identique, nouveau ≠ actuel. */
    fun changeOwnPin(current: String, new: String, confirm: String) = mutate("PIN modifié.") {
        val rule = if (_state.value.isAdmin) Regex("^\\d{6,12}$") else Regex("^\\d{6}$")
        val label = if (_state.value.isAdmin) "6 à 12 chiffres" else "exactement 6 chiffres"
        require(current.matches(rule)) { "Le PIN actuel doit contenir $label." }
        require(new.matches(rule)) { "Le nouveau PIN doit contenir $label." }
        require(new != current) { "Le nouveau PIN doit être différent du PIN actuel." }
        require(new == confirm) { "La confirmation du PIN ne correspond pas." }
        repository.changeOwnPin(current, new)
    }

    fun adminSetPin(pin: String) = mutate("PIN administrateur modifié.") {
        require(pin.matches(Regex("^\\d{6,12}$"))) { "Le PIN doit contenir 6 à 12 chiffres." }
        repository.adminSetPin(pin)
    }

    fun clearNotice() {
        _state.value = _state.value.copy(message = null, error = null)
    }

    private suspend fun continueAfterLogin(bundle: LoginBundle) {
        val verified = bundle.factors.firstOrNull { it.status == "verified" }
        val requiresMfa = bundle.profile.mfaRequired && repository.assuranceLevel() != "aal2"
        if (requiresMfa && verified != null) {
            _state.value = MainUiState(
                screen = AppScreen.MFA_CHALLENGE,
                loading = false,
                online = repository.isOnline(),
                profile = bundle.profile,
                factors = bundle.factors,
                mfaFactorId = verified.id
            )
        } else if (requiresMfa) {
            val enrollment = repository.enrollMfa()
            _state.value = MainUiState(
                screen = AppScreen.MFA_ENROLL,
                loading = false,
                online = repository.isOnline(),
                profile = bundle.profile,
                factors = bundle.factors,
                mfaEnrollment = enrollment,
                mfaFactorId = enrollment.factorId
            )
        } else {
            loadApplication(AppScreen.HOME, bundle.factors)
        }
    }

    private suspend fun loadApplication(screen: AppScreen, factors: List<MfaFactor>? = null) {
        val data = repository.load()
        val profile = repository.profile() ?: throw ApiException("UNAUTHENTICATED", "Profil absent.")
        _state.value = _state.value.copy(
            screen = screen,
            loading = false,
            online = repository.isOnline(),
            profile = profile,
            data = data,
            factors = factors ?: _state.value.factors,
            mfaEnrollment = null,
            mfaFactorId = null,
            reports = repository.reports(data),
            error = null,
            biometricEnabled = repository.biometricEnabled,
            offerBiometric = !repository.biometricEnabled && !repository.biometricOffered
        )
    }

    private fun refreshMfaFactors(message: String? = null) {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(
                    loading = false,
                    factors = repository.mfaFactors(),
                    message = message,
                    error = null
                )
            } catch (error: Throwable) {
                handle(error, fallbackScreen = AppScreen.ACCOUNT)
            }
        }
    }

    private fun mutate(successMessage: String, action: suspend () -> Unit) {
        viewModelScope.launch {
            setLoading(true)
            clearNotice()
            try {
                action()
                val data = repository.load()
                _state.value = _state.value.copy(
                    loading = false,
                    online = repository.isOnline(),
                    data = data,
                    reports = repository.reports(data),
                    message = successMessage.ifBlank { null },
                    error = null
                )
            } catch (error: Throwable) {
                handle(error)
            }
        }
    }

    private fun updateDraft(studentId: String, transform: (AttendanceDraft) -> AttendanceDraft) {
        val drafts = _state.value.attendanceDrafts.toMutableMap()
        drafts[studentId]?.let { drafts[studentId] = transform(it) }
        _state.value = _state.value.copy(attendanceDrafts = drafts, error = null)
    }

    private fun setLoading(value: Boolean) {
        _state.value = _state.value.copy(loading = value, online = repository.isOnline())
    }

    private fun handle(
        throwable: Throwable,
        fallbackScreen: AppScreen? = null,
        preserveOperation: Boolean = false
    ) {
        if (throwable is CancellationException) throw throwable
        val error = when (throwable) {
            is ApiException -> when (throwable.code) {
                "NETWORK_UNAVAILABLE" -> "Connexion Internet requise."
                "UNAUTHENTICATED", "SESSION_EXPIRED" -> "Votre session a expiré. Reconnectez-vous."
                "MFA_REQUIRED" -> "La double authentification est requise."
                "FORBIDDEN" -> "Vous ne disposez pas des droits requis."
                "VERSION_CONFLICT" -> "Conflit de version détecté."
                "RATE_LIMITED" -> "Trop de tentatives. Réessayez plus tard."
                else -> throwable.message
            }
            else -> throwable.message ?: "Une erreur est survenue."
        }
        val sessionExpired = throwable is ApiException && throwable.code in setOf("UNAUTHENTICATED", "SESSION_EXPIRED")
        _state.value = if (sessionExpired) {
            MainUiState(screen = AppScreen.LOGIN, loading = false, online = repository.isOnline(), error = error)
        } else {
            _state.value.copy(
                screen = fallbackScreen ?: _state.value.screen,
                loading = false,
                online = repository.isOnline(),
                pendingOperationId = if (preserveOperation) _state.value.pendingOperationId else null,
                error = error
            )
        }
    }
}
