package tn.utm.fst.gestionpresence.nativeapp.data.repository

import android.content.Context
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.core.model.*
import tn.utm.fst.gestionpresence.nativeapp.core.security.SecureSessionStore
import tn.utm.fst.gestionpresence.nativeapp.data.remote.OnlineApiClient
import java.time.Instant

// Repository remains online-only. This compact implementation centralizes all server access.
data class LoginBundle(val profile: UserProfile, val factors: List<MfaFactor>)
data class RepositoryData(val classes:List<AcademicClass>,val students:List<Student>,val sessions:List<TeachingSession>,val attendance:List<AttendanceRecord>,val teachers:List<TeacherDirectoryEntry>,val contract:AppContract)

class PresenceRepository(context:Context){
 private val api=OnlineApiClient();private val store=SecureSessionStore(context);private var session:AuthSession?=store.load();private var cachedProfile:UserProfile?=null
 fun isOnline()=true
 private fun requireOnline(){}
 private fun authorizedSession()=session?:throw ApiException("UNAUTHENTICATED","Session absente.")
 suspend fun login(identifier:String,credential:String,mode:String):LoginBundle{requireOnline();val s=api.login(identifier,credential);session=s;store.save(s);val p=api.profile(s);cachedProfile=p;return LoginBundle(p,emptyList())}
 suspend fun restore():LoginBundle?{var s=session?:return null;try{if(s.expiresAtEpochSeconds<=Instant.now().epochSecond+60){s=api.refresh(s.refreshToken);session=s;store.save(s)};val p=api.profile(s);cachedProfile=p;return LoginBundle(p,emptyList())}catch(e:Throwable){session=null;cachedProfile=null;store.clear();throw e}}
 suspend fun logout(){session?.let{runCatching{api.logout(it)}};session=null;cachedProfile=null;store.clear()}
 fun profile()=cachedProfile
 suspend fun load():RepositoryData{requireOnline();val s=authorizedSession();val p=api.profile(s);cachedProfile=p;return RepositoryData(api.classes(s),api.students(s),api.sessions(s),api.attendance(s),api.teacherDirectory(s),api.appContract(s))}
 fun reports(data:RepositoryData):List<ReportSummary>{val bySession=data.attendance.groupBy{it.sessionId};return data.sessions.map{s->val rows=bySession[s.id].orEmpty();ReportSummary(s.id,s.sessionDate,rows.count{it.status==AttendanceStatus.PRESENT},rows.count{it.status==AttendanceStatus.ABSENT},rows.count{it.status==AttendanceStatus.LATE},rows.count{it.status==AttendanceStatus.EXCUSED})}}
 suspend fun addClass(name:String,module:String,track:String,classNumber:Int,groupNumber:Int,day:String?,startTime:String?,endTime:String?,room:String?){api.upsertClass(authorizedSession(),buildJsonObject{put("teacher_id",authorizedSession().userId);put("name",name);put("module",module);put("track",track);put("class_number",classNumber);put("group_number",groupNumber);day?.let{put("day",it)};startTime?.let{put("start_time",it)};endTime?.let{put("end_time",it)};room?.let{put("room",it)}})}
 suspend fun addStudent(classId:String,lastName:String,firstName:String,email:String?){api.upsertStudent(authorizedSession(),buildJsonObject{put("teacher_id",authorizedSession().userId);put("class_id",classId);put("last_name",lastName);put("first_name",firstName);email?.let{put("email",it)}})}
 suspend fun addSession(classId:String,date:String,startTime:String,endTime:String){api.upsertSession(authorizedSession(),buildJsonObject{put("teacher_id",authorizedSession().userId);put("class_id",classId);put("session_date",date);put("start_time",startTime);put("end_time",endTime)})}
 suspend fun deleteClass(id:String)=api.deleteRow(authorizedSession(),"classes",id);suspend fun deleteStudent(id:String)=api.deleteRow(authorizedSession(),"students",id);suspend fun deleteSession(id:String)=api.deleteRow(authorizedSession(),"sessions",id)
 suspend fun completeSession(s:TeachingSession){api.upsertSession(authorizedSession(),buildJsonObject{put("id",s.id);put("teacher_id",s.teacherId);put("class_id",s.classId);put("session_date",s.sessionDate);put("start_time",s.startTime);put("end_time",s.endTime);put("completed_at",Instant.now().toString())})}
 suspend fun attendanceSheet(sessionId:String)=api.getAttendanceSheet(authorizedSession(),sessionId)
 suspend fun saveAttendance(sessionId:String,expectedRevision:Long,operationId:String,records:List<AttendanceDraft>,justification:String?=null):AttendanceSheet{records.forEach{require(it.grade==null||it.grade in 0.0..20.0){"La note doit être comprise entre 0 et 20."}};return api.saveAttendanceSheet(authorizedSession(),sessionId,expectedRevision,operationId,records,justification)}
 suspend fun mfaFactors():List<MfaFactor>=emptyList();suspend fun enrollMfa()=api.enrollMfa(authorizedSession());suspend fun verifyMfa(factorId:String,code:String){val s=api.verifyMfa(authorizedSession(),factorId,code);session=s;store.save(s)};suspend fun removeMfa(factorId:String)=api.unenrollMfa(authorizedSession(),factorId);fun assuranceLevel()=api.assuranceLevel(authorizedSession())
 suspend fun adminCreateTeacher(username:String,fullName:String,password:String):JsonObject=api.adminAction(authorizedSession(),buildJsonObject{put("action","create");put("username",username);put("full_name",fullName);put("password",password)})
 suspend fun adminSetPin(pin:String):JsonObject=api.adminAction(authorizedSession(),buildJsonObject{put("action","set_admin_pin");put("pin",pin)})
}
