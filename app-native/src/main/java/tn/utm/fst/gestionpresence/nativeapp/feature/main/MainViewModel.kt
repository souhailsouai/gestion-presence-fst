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

enum class AppScreen { LOGIN, MFA_ENROLL, MFA_CHALLENGE, HOME, CLASSES, TIMETABLE, TEACHERS, STUDENTS, SESSIONS, ATTENDANCE, REPORTS, ADMIN, ACCOUNT }

data class MainUiState(
    val screen: AppScreen = AppScreen.LOGIN, val loading: Boolean = true, val online: Boolean = true,
    val profile: UserProfile? = null, val data: RepositoryData? = null, val factors: List<MfaFactor> = emptyList(),
    val mfaEnrollment: MfaEnrollment? = null, val mfaFactorId: String? = null, val selectedSessionId: String? = null,
    val attendanceRevision: Long = 0, val attendanceDrafts: Map<String, AttendanceDraft> = emptyMap(),
    val pendingOperationId: String? = null, val reports: List<ReportSummary> = emptyList(), val message: String? = null, val error: String? = null
) { val authenticated get() = profile != null; val isAdmin get() = profile?.isAdmin == true }

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PresenceRepository(application)
    private val _state = MutableStateFlow(MainUiState(online = repository.isOnline()))
    val state: StateFlow<MainUiState> = _state.asStateFlow()
    init { restore() }

    fun restore() { viewModelScope.launch { setLoading(true); try { val bundle=repository.restore(); if(bundle==null) _state.value=MainUiState(screen=AppScreen.LOGIN,loading=false,online=repository.isOnline()) else continueAfterLogin(bundle) } catch(e:Throwable){ handle(e,AppScreen.LOGIN) } } }
    fun login(identifier:String,credential:String,mode:String){ viewModelScope.launch { setLoading(true);clearNotice();try{continueAfterLogin(repository.login(identifier,credential,mode))}catch(e:Throwable){runCatching{repository.logout()};handle(e,AppScreen.LOGIN)}} }
    fun verifyMfa(code:String){ if(!code.matches(Regex("^\\d{6}$"))){_state.value=_state.value.copy(error="Le code doit contenir exactement 6 chiffres.");return}; val factorId=_state.value.mfaFactorId?:_state.value.mfaEnrollment?.factorId?:return;viewModelScope.launch{setLoading(true);clearNotice();try{repository.verifyMfa(factorId,code);loadApplication(AppScreen.HOME)}catch(e:Throwable){handle(e,_state.value.screen)}} }
    fun cancelMfa(){viewModelScope.launch{runCatching{repository.logout()};_state.value=MainUiState(screen=AppScreen.LOGIN,loading=false,online=repository.isOnline())}}
    fun navigate(screen:AppScreen){if(screen==AppScreen.ADMIN&&!_state.value.isAdmin){_state.value=_state.value.copy(error="Droits administrateur requis.");return};_state.value=_state.value.copy(screen=screen,message=null,error=null);if(screen==AppScreen.ACCOUNT)refreshMfaFactors()}
    fun refresh(){viewModelScope.launch{setLoading(true);clearNotice();try{loadApplication(_state.value.screen.takeIf{it!=AppScreen.LOGIN}?:AppScreen.HOME)}catch(e:Throwable){handle(e)}}}
    fun logout(){viewModelScope.launch{setLoading(true);runCatching{repository.logout()};_state.value=MainUiState(screen=AppScreen.LOGIN,loading=false,online=repository.isOnline())}}

    fun addClass(name:String,module:String,track:String,classNumber:Int,groupNumber:Int,day:String?,startTime:String?,endTime:String?,room:String?)=mutate("Classe ajoutée."){require(name.isNotBlank()&&module.isNotBlank()){"Le nom et le module sont obligatoires."};require(groupNumber in 1..4){"Le groupe doit être compris entre 1 et 4."};require((track=="MPI"&&classNumber in 1..5)||(track=="PC"&&classNumber==1)){"Numéro de classe invalide."};repository.addClass(name,module,track,classNumber,groupNumber,day,startTime,endTime,room)}
    fun addStudent(classId:String,lastName:String,firstName:String,email:String?)=mutate("Étudiant ajouté."){require(classId.isNotBlank()&&lastName.isNotBlank()&&firstName.isNotBlank()){"Classe, nom et prénom sont obligatoires."};repository.addStudent(classId,lastName,firstName,email)}
    fun addSession(classId:String,date:String,startTime:String,endTime:String)=mutate("Séance créée."){require(classId.isNotBlank()&&date.isNotBlank()&&startTime.isNotBlank()&&endTime.isNotBlank()){"Tous les champs sont obligatoires."};repository.addSession(classId,date,startTime,endTime)}
    fun deleteClass(id:String)=mutate("Classe supprimée."){repository.deleteClass(id)};fun deleteStudent(id:String)=mutate("Étudiant supprimé."){repository.deleteStudent(id)};fun deleteSession(id:String)=mutate("Séance supprimée."){repository.deleteSession(id)}

    fun selectAttendanceSession(sessionId:String){viewModelScope.launch{setLoading(true);clearNotice();try{val data=_state.value.data?:repository.load();val teachingSession=data.sessions.firstOrNull{it.id==sessionId}?:throw IllegalArgumentException("Séance introuvable.");val sheet=repository.attendanceSheet(sessionId);val records=sheet.records.associateBy{it.studentId};val drafts=data.students.filter{it.classId==teachingSession.classId}.associate{student->val record=records[student.id];student.id to AttendanceDraft(student.id,record?.status?:AttendanceStatus.PRESENT,record?.comment.orEmpty(),record?.grade)};_state.value=_state.value.copy(screen=AppScreen.ATTENDANCE,loading=false,online=repository.isOnline(),data=data,selectedSessionId=sessionId,attendanceRevision=sheet.revision,attendanceDrafts=drafts,pendingOperationId=null)}catch(e:Throwable){handle(e,AppScreen.ATTENDANCE)}}}
    fun updateAttendanceStatus(studentId:String,status:AttendanceStatus){updateDraft(studentId){it.copy(status=status)}};fun updateAttendanceComment(studentId:String,comment:String){updateDraft(studentId){it.copy(comment=comment)}}
    fun updateAttendanceGrade(studentId:String,value:String){val normalized=value.replace(',','.').trim();val grade=normalized.takeIf{it.isNotBlank()}?.toDoubleOrNull();if(normalized.isNotBlank()&&(grade==null||grade !in 0.0..20.0)){_state.value=_state.value.copy(error="La note doit être comprise entre 0 et 20.");return};updateDraft(studentId){it.copy(grade=grade)}}
    fun saveAttendance(){val current=_state.value;val sessionId=current.selectedSessionId?:return;val operationId=current.pendingOperationId?:UUID.randomUUID().toString();_state.value=current.copy(pendingOperationId=operationId,loading=true,error=null,message=null);viewModelScope.launch{try{val sheet=repository.saveAttendance(sessionId,_state.value.attendanceRevision,operationId,_state.value.attendanceDrafts.values.toList());val data=repository.load();_state.value=_state.value.copy(loading=false,online=repository.isOnline(),data=data,attendanceRevision=sheet.revision,pendingOperationId=null,reports=repository.reports(data),message="Présence enregistrée.",error=null)}catch(e:Throwable){if(e is ApiException&&e.code=="VERSION_CONFLICT"){val server=runCatching{repository.attendanceSheet(sessionId)}.getOrNull();if(server!=null){val records=server.records.associateBy{it.studentId};val drafts=_state.value.attendanceDrafts.mapValues{(studentId,draft)->records[studentId]?.let{draft.copy(status=it.status,comment=it.comment,grade=it.grade)}?:draft};_state.value=_state.value.copy(loading=false,attendanceRevision=server.revision,attendanceDrafts=drafts,pendingOperationId=null,error="Conflit détecté : la version serveur a été rechargée. Vérifiez puis enregistrez à nouveau.");return@launch}};handle(e,AppScreen.ATTENDANCE,true)}}}
    fun completeSession(session:TeachingSession)=mutate("Séance terminée."){repository.completeSession(session)}

    fun beginMfaEnrollment(){viewModelScope.launch{setLoading(true);clearNotice();try{val enrollment=repository.enrollMfa();_state.value=_state.value.copy(loading=false,screen=AppScreen.MFA_ENROLL,mfaEnrollment=enrollment,mfaFactorId=enrollment.factorId)}catch(e:Throwable){handle(e,AppScreen.ACCOUNT)}}}
    fun removeMfa(factorId:String){viewModelScope.launch{setLoading(true);try{repository.removeMfa(factorId);refreshMfaFactors("Appareil retiré.")}catch(e:Throwable){handle(e,AppScreen.ACCOUNT)}}}
    fun adminCreateTeacher(username:String,fullName:String,password:String)=mutate("Compte enseignant créé."){require(username.isNotBlank()&&fullName.isNotBlank()&&password.length>=6){"Données du compte invalides."};repository.adminCreateTeacher(username,fullName,password)}
    fun adminSetPin(pin:String)=mutate("PIN administrateur modifié."){require(pin.matches(Regex("^\\d{6,12}$"))){"Le PIN doit contenir 6 à 12 chiffres."};repository.adminSetPin(pin)}
    fun clearNotice(){_state.value=_state.value.copy(message=null,error=null)}

    private suspend fun continueAfterLogin(bundle:LoginBundle){
        // MFA is optional: a valid username/PIN or password session enters the application directly.
        _state.value=_state.value.copy(profile=bundle.profile,factors=emptyList(),mfaEnrollment=null,mfaFactorId=null)
        loadApplication(AppScreen.HOME)
    }
    private suspend fun loadApplication(screen:AppScreen){val data=repository.load();val profile=repository.profile()?:throw ApiException("UNAUTHENTICATED","Profil absent.");_state.value=_state.value.copy(screen=screen,loading=false,online=repository.isOnline(),profile=profile,data=data,factors=emptyList(),mfaEnrollment=null,mfaFactorId=null,reports=repository.reports(data),error=null)}
    private fun refreshMfaFactors(message:String?=null){_state.value=_state.value.copy(loading=false,factors=emptyList(),message=message,error=null)}
    private fun mutate(successMessage:String,action:suspend()->Unit){viewModelScope.launch{setLoading(true);clearNotice();try{action();val data=repository.load();_state.value=_state.value.copy(loading=false,online=repository.isOnline(),data=data,reports=repository.reports(data),message=successMessage,error=null)}catch(e:Throwable){handle(e)}}}
    private fun updateDraft(studentId:String,transform:(AttendanceDraft)->AttendanceDraft){val drafts=_state.value.attendanceDrafts.toMutableMap();drafts[studentId]?.let{drafts[studentId]=transform(it)};_state.value=_state.value.copy(attendanceDrafts=drafts,error=null)}
    private fun setLoading(value:Boolean){_state.value=_state.value.copy(loading=value,online=repository.isOnline())}
    private fun handle(throwable:Throwable,fallbackScreen:AppScreen?=null,preserveOperation:Boolean=false){if(throwable is CancellationException)throw throwable;val error=when(throwable){is ApiException->when(throwable.code){"NETWORK_UNAVAILABLE"->"Connexion Internet requise.";"UNAUTHENTICATED","SESSION_EXPIRED"->"Votre session a expiré. Reconnectez-vous.";"FORBIDDEN"->"Vous ne disposez pas des droits requis.";"VERSION_CONFLICT"->"Conflit de version détecté.";"RATE_LIMITED"->"Trop de tentatives. Réessayez plus tard.";else->throwable.message};else->throwable.message?:"Une erreur est survenue."};val expired=throwable is ApiException&&throwable.code in setOf("UNAUTHENTICATED","SESSION_EXPIRED");_state.value=if(expired)MainUiState(screen=AppScreen.LOGIN,loading=false,online=repository.isOnline(),error=error)else _state.value.copy(screen=fallbackScreen?:_state.value.screen,loading=false,online=repository.isOnline(),pendingOperationId=if(preserveOperation)_state.value.pendingOperationId else null,error=error)}
}
