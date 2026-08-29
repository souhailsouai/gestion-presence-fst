package tn.utm.fst.gestionpresence.nativeapp.data

import android.content.Context
import androidx.room.Room
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import java.util.UUID

object NativeRepository {
 private const val BASE="https://dbslzmvzbxczpqyektpx.supabase.co"
 private lateinit var db:AppDatabase
 private val http=HttpClient(OkHttp){install(ContentNegotiation){json(Json{ignoreUnknownKeys=true})}}
 private val prefsName="presence_native_session"
 private var accessToken:String?=null
 var teacherId:String?=null; private set
 var fullName:String="Enseignant"; private set
 var role:String="teacher"; private set
 var activeMode:String="teacher"; private set
 val syncState=MutableStateFlow("Hors ligne")
 val classes get()=db.dao().classes(); val students get()=db.dao().students(); val sessions get()=db.dao().sessions(); val attendance get()=db.dao().attendance()
 fun init(context:Context){if(!::db.isInitialized)db=Room.databaseBuilder(context,AppDatabase::class.java,"presence-native.db").build();val p=context.getSharedPreferences(prefsName,0);accessToken=p.getString("token",null);teacherId=p.getString("teacher",null);fullName=p.getString("name","Enseignant")?:"Enseignant";role=p.getString("role","teacher")?:"teacher";activeMode=p.getString("mode","teacher")?:"teacher"}
 fun hasSession()=teacherId!=null
 fun logout(context:Context){accessToken=null;teacherId=null;context.getSharedPreferences(prefsName,0).edit().clear().apply()}
 private fun authHeaders(b:HttpRequestBuilder){b.header("apikey",BuildSecrets.ANON);b.header("Authorization","Bearer ${accessToken?:BuildSecrets.ANON}")}
 suspend fun login(context:Context,identifier:String,password:String,mode:String):Result<Unit> = runCatching {
  val email=if(identifier.contains('@'))identifier else "$identifier@presence-app.local"
  val r=http.post("$BASE/auth/v1/token?grant_type=password"){header("apikey",BuildSecrets.ANON);contentType(ContentType.Application.Json);setBody(buildJsonObject{put("email",email);put("password",password)})}
  if(!r.status.isSuccess()) error("Identifiant ou mot de passe incorrect")
  val j=r.body<JsonObject>();accessToken=j["access_token"]!!.jsonPrimitive.content;val uid=j["user"]!!.jsonObject["id"]!!.jsonPrimitive.content
  val pr=http.get("$BASE/rest/v1/profiles?id=eq.$uid&select=id,email,username,full_name,role"){authHeaders(this)}
  val profile=pr.body<JsonArray>().first().jsonObject;role=profile["role"]!!.jsonPrimitive.content
  if(mode=="admin"&&role!="admin")error("Droits administrateur requis")
  teacherId=uid;fullName=profile["full_name"]?.jsonPrimitive?.contentOrNull?:identifier;activeMode=mode
  context.getSharedPreferences(prefsName,0).edit().putString("token",accessToken).putString("teacher",uid).putString("name",fullName).putString("role",role).putString("mode",mode).apply()
  sync()
 }
 suspend fun addClass(name:String,module:String,track:String,number:Int,group:Int){val t=teacherId?:return;db.dao().putClass(ClassEntity(UUID.randomUUID().toString(),t,name,module,track,number,group));syncState.value="Modifications locales"}
 suspend fun addStudent(classId:String,last:String,first:String,email:String){val t=teacherId?:return;db.dao().putStudent(StudentEntity(UUID.randomUUID().toString(),t,classId,last,first,email));syncState.value="Modifications locales"}
 suspend fun addSession(classId:String,date:String,start:String,end:String){val t=teacherId?:return;db.dao().putSession(SessionEntity(UUID.randomUUID().toString(),t,classId,date,start,end));syncState.value="Modifications locales"}
 suspend fun saveAttendance(sessionId:String,studentId:String,status:String,comment:String,grade:Double?){require(grade==null||grade in 0.0..20.0);val t=teacherId?:return;val old=db.dao().allAttendance().firstOrNull{it.sessionId==sessionId&&it.studentId==studentId};db.dao().putAttendance(AttendanceEntity(old?.id?:UUID.randomUUID().toString(),t,sessionId,studentId,status,comment,grade));syncState.value="Modifications locales"}
 suspend fun sync(){val t=teacherId?:return;val token=accessToken?:return;syncState.value="Synchronisation…";runCatching{
   push("classes",db.dao().allClasses().filter{it.dirty}.map{buildJsonObject{put("id",it.id);put("teacher_id",it.teacherId);put("name",it.name);put("module",it.module);put("track",it.track);put("class_number",it.classNumber);put("group_number",it.groupNumber)}})
   push("students",db.dao().allStudents().filter{it.dirty}.map{buildJsonObject{put("id",it.id);put("teacher_id",it.teacherId);put("class_id",it.classId);put("last_name",it.lastName);put("first_name",it.firstName);put("email",it.email)}})
   push("sessions",db.dao().allSessions().filter{it.dirty}.map{buildJsonObject{put("id",it.id);put("teacher_id",it.teacherId);put("class_id",it.classId);put("session_date",it.sessionDate);put("start_time",it.startTime);put("end_time",it.endTime)}})
   push("attendance",db.dao().allAttendance().filter{it.dirty}.map{buildJsonObject{put("id",it.id);put("teacher_id",it.teacherId);put("session_id",it.sessionId);put("student_id",it.studentId);put("status",it.status);put("comment",it.comment);if(it.grade==null)put("grade",JsonNull)else put("grade",it.grade)}})
   pull(t);syncState.value="Synchronisé"
  }.onFailure{syncState.value="Hors ligne — données conservées"}
 }
 private suspend fun push(table:String,rows:List<JsonObject>){if(rows.isEmpty())return;val r=http.post("$BASE/rest/v1/$table?on_conflict=id"){authHeaders(this);header("Prefer","resolution=merge-duplicates");contentType(ContentType.Application.Json);setBody(JsonArray(rows))};if(!r.status.isSuccess())error("sync $table ${r.status}")}
 private suspend fun pull(t:String){
  val c=get("classes",t);db.dao().putClasses(c.map{val x=it.jsonObject;ClassEntity(x.s("id"),t,x.s("name"),x.s("module"),x.s("track","MPI"),x.i("class_number",1),x.i("group_number",1),dirty=false)})
  val st=get("students",t);db.dao().putStudents(st.map{val x=it.jsonObject;StudentEntity(x.s("id"),t,x.s("class_id"),x.s("last_name"),x.s("first_name"),x.s("email"),dirty=false)})
  val se=get("sessions",t);db.dao().putSessions(se.map{val x=it.jsonObject;SessionEntity(x.s("id"),t,x.s("class_id"),x.s("session_date"),x.s("start_time").take(5),x.s("end_time").take(5),dirty=false)})
  val a=get("attendance",t);db.dao().putAttendances(a.map{val x=it.jsonObject;AttendanceEntity(x.s("id"),t,x.s("session_id"),x.s("student_id"),x.s("status","present"),x.s("comment"),x["grade"]?.jsonPrimitive?.doubleOrNull,dirty=false)})
 }
 private suspend fun get(table:String,t:String):JsonArray{val r=http.get("$BASE/rest/v1/$table?teacher_id=eq.$t&select=*"){authHeaders(this)};if(!r.status.isSuccess())error("pull $table");return r.body()}
 private fun JsonObject.s(k:String,d:String="")=this[k]?.jsonPrimitive?.contentOrNull?:d
 private fun JsonObject.i(k:String,d:Int)=this[k]?.jsonPrimitive?.intOrNull?:d
}
object BuildSecrets { const val ANON="sb_publishable_6K4yMGrDmfYmPhakPWGArw_Yf46byLY" }
