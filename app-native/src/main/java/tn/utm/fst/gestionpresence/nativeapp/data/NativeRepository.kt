package tn.utm.fst.gestionpresence.nativeapp.data
import android.content.Context
import androidx.room.Room
import io.ktor.client.*;import io.ktor.client.call.*;import io.ktor.client.engine.okhttp.*;import io.ktor.client.plugins.contentnegotiation.*;import io.ktor.client.request.*;import io.ktor.http.*;import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.json.*
import java.util.UUID

object NativeRepository{
 private const val BASE="https://dbslzmvzbxczpqyektpx.supabase.co";private const val ANON="sb_publishable_wKwmPnXS_Q7REGU57hTIyw_eqxhIXLT"
 private val http=HttpClient(OkHttp){install(ContentNegotiation){json(Json{ignoreUnknownKeys=true})}};private lateinit var db:AppDatabase;private var token:String?=null
 var teacherId:String?=null;private set;var fullName="Enseignant";private set;var role="teacher";private set;var activeMode="teacher";private set;val syncState=MutableStateFlow("Hors ligne")
 val classes get()=db.dao().classes();val students get()=db.dao().students();val sessions get()=db.dao().sessions();val attendance get()=db.dao().attendance()
 fun init(c:Context){if(!::db.isInitialized)db=Room.databaseBuilder(c,AppDatabase::class.java,"presence-native.db").build();val p=c.getSharedPreferences("native_session",0);token=p.getString("token",null);teacherId=p.getString("teacher",null);fullName=p.getString("name","Enseignant")?:"Enseignant";role=p.getString("role","teacher")?:"teacher";activeMode=p.getString("mode","teacher")?:"teacher"}
 fun hasSession()=teacherId!=null;fun logout(c:Context){token=null;teacherId=null;c.getSharedPreferences("native_session",0).edit().clear().apply()}
 private fun HttpRequestBuilder.headersAuth(){header("apikey",ANON);header("Authorization","Bearer ${token?:ANON}")}
 suspend fun login(c:Context,id:String,password:String,mode:String)=runCatching<Unit>{
  var auth:JsonObject?=null
  val admin=http.post("$BASE/functions/v1/admin-pin-login"){header("apikey",ANON);contentType(ContentType.Application.Json);setBody(buildJsonObject{put("identifier",id);put("credential",password)})}
  if(admin.status.isSuccess()){val j=admin.body<JsonObject>();if(j["access_token"]!=null)auth=j}
  if(auth==null&&mode=="teacher"){val email=if(id.contains('@'))id else "$id@presence-app.local";val r=http.post("$BASE/auth/v1/token?grant_type=password"){header("apikey",ANON);contentType(ContentType.Application.Json);setBody(buildJsonObject{put("email",email);put("password",password)})};if(r.status.isSuccess())auth=r.body()}
  val a=auth?:error("Identifiant, mot de passe ou PIN incorrect");token=a["access_token"]!!.jsonPrimitive.content
  val uid=a["user"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull?:jwtUserId(token!!)?:error("Session invalide")
  val r=http.get("$BASE/rest/v1/profiles?id=eq.$uid&select=id,email,username,full_name,role"){headersAuth()};val p=r.body<JsonArray>().firstOrNull()?.jsonObject?:error("Profil introuvable");role=p.s("role","teacher");if(mode=="admin"&&role!="admin")error("Droits administrateur requis");teacherId=uid;fullName=p.s("full_name",id);activeMode=mode
  c.getSharedPreferences("native_session",0).edit().putString("token",token).putString("teacher",uid).putString("name",fullName).putString("role",role).putString("mode",mode).apply();sync()
 }
 private fun jwtUserId(jwt:String):String?=runCatching{val b=jwt.split('.')[1].replace('-','+').replace('_','/');val pad=b+"=".repeat((4-b.length%4)%4);val j=Json.parseToJsonElement(String(android.util.Base64.decode(pad,android.util.Base64.DEFAULT))).jsonObject;j["sub"]?.jsonPrimitive?.content}.getOrNull()
 suspend fun addClass(n:String,m:String,t:String,no:Int,g:Int){val u=teacherId?:return;db.dao().putClass(ClassEntity(UUID.randomUUID().toString(),u,n,m,t,no,g));syncState.value="À synchroniser"}
 suspend fun addStudent(cid:String,l:String,f:String,e:String){val u=teacherId?:return;db.dao().putStudent(StudentEntity(UUID.randomUUID().toString(),u,cid,l,f,e));syncState.value="À synchroniser"}
 suspend fun addSession(cid:String,d:String,s:String,e:String){val u=teacherId?:return;db.dao().putSession(SessionEntity(UUID.randomUUID().toString(),u,cid,d,s,e));syncState.value="À synchroniser"}
 suspend fun saveAttendance(sid:String,stid:String,status:String,comment:String,grade:Double?){require(grade==null||grade in 0.0..20.0);val u=teacherId?:return;val old=db.dao().allAttendance().firstOrNull{it.sessionId==sid&&it.studentId==stid};db.dao().putAttendance(AttendanceEntity(old?.id?:UUID.randomUUID().toString(),u,sid,stid,status,comment,grade));syncState.value="À synchroniser"}
 suspend fun sync(){val u=teacherId?:return;if(token==null){syncState.value="Hors ligne";return};syncState.value="Synchronisation…";runCatching{push("classes",db.dao().allClasses().filter{it.dirty}.map{obj("id" to it.id,"teacher_id" to it.teacherId,"name" to it.name,"module" to it.module,"track" to it.track,"class_number" to it.classNumber,"group_number" to it.groupNumber)});push("students",db.dao().allStudents().filter{it.dirty}.map{obj("id" to it.id,"teacher_id" to it.teacherId,"class_id" to it.classId,"last_name" to it.lastName,"first_name" to it.firstName,"email" to it.email)});push("sessions",db.dao().allSessions().filter{it.dirty}.map{obj("id" to it.id,"teacher_id" to it.teacherId,"class_id" to it.classId,"session_date" to it.sessionDate,"start_time" to it.startTime,"end_time" to it.endTime)});push("attendance",db.dao().allAttendance().filter{it.dirty}.map{buildJsonObject{put("id",it.id);put("teacher_id",it.teacherId);put("session_id",it.sessionId);put("student_id",it.studentId);put("status",it.status);put("comment",it.comment);if(it.grade==null)put("grade",JsonNull)else put("grade",it.grade)}});pull(u);syncState.value="Synchronisé"}.onFailure{syncState.value="Hors ligne — données conservées"}}
 private fun obj(vararg p:Pair<String,Any>)=buildJsonObject{p.forEach{(k,v)->when(v){is String->put(k,v);is Int->put(k,v)}}}
 private suspend fun push(table:String,rows:List<JsonObject>){if(rows.isEmpty())return;val r=http.post("$BASE/rest/v1/$table?on_conflict=id"){headersAuth();header("Prefer","resolution=merge-duplicates");contentType(ContentType.Application.Json);setBody(JsonArray(rows))};if(!r.status.isSuccess())error("Erreur $table")}
 private suspend fun get(table:String,u:String):JsonArray{val r=http.get("$BASE/rest/v1/$table?teacher_id=eq.$u&select=*"){headersAuth()};if(!r.status.isSuccess())error("Lecture $table");return r.body()}
 private suspend fun pull(u:String){db.dao().putClasses(get("classes",u).map{val x=it.jsonObject;ClassEntity(x.s("id"),u,x.s("name"),x.s("module"),x.s("track","MPI"),x.i("class_number",1),x.i("group_number",1),dirty=false)});db.dao().putStudents(get("students",u).map{val x=it.jsonObject;StudentEntity(x.s("id"),u,x.s("class_id"),x.s("last_name"),x.s("first_name"),x.s("email"),dirty=false)});db.dao().putSessions(get("sessions",u).map{val x=it.jsonObject;SessionEntity(x.s("id"),u,x.s("class_id"),x.s("session_date"),x.s("start_time").take(5),x.s("end_time").take(5),dirty=false)});db.dao().putAttendances(get("attendance",u).map{val x=it.jsonObject;AttendanceEntity(x.s("id"),u,x.s("session_id"),x.s("student_id"),x.s("status","present"),x.s("comment"),x["grade"]?.jsonPrimitive?.doubleOrNull,dirty=false)})}
 private fun JsonObject.s(k:String,d:String="")=this[k]?.jsonPrimitive?.contentOrNull?:d;private fun JsonObject.i(k:String,d:Int)=this[k]?.jsonPrimitive?.intOrNull?:d
}
