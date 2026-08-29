package tn.utm.fst.gestionpresence.nativeapp.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName="classes") data class ClassEntity(@PrimaryKey val id:String,val teacherId:String,val name:String,val module:String="",val track:String="MPI",val classNumber:Int=1,val groupNumber:Int=1,val day:String="",val startTime:String="",val endTime:String="",val room:String="",val updatedAt:Long=System.currentTimeMillis(),val dirty:Boolean=true)
@Entity(tableName="students",indices=[Index("classId")]) data class StudentEntity(@PrimaryKey val id:String,val teacherId:String,val classId:String,val lastName:String,val firstName:String,val email:String="",val updatedAt:Long=System.currentTimeMillis(),val dirty:Boolean=true)
@Entity(tableName="sessions",indices=[Index("classId")]) data class SessionEntity(@PrimaryKey val id:String,val teacherId:String,val classId:String,val sessionDate:String,val startTime:String,val endTime:String,val completedAt:String?=null,val updatedAt:Long=System.currentTimeMillis(),val dirty:Boolean=true)
@Entity(tableName="attendance",indices=[Index(value=["sessionId","studentId"],unique=true)]) data class AttendanceEntity(@PrimaryKey val id:String,val teacherId:String,val sessionId:String,val studentId:String,val status:String="present",val comment:String="",val grade:Double?=null,val updatedAt:Long=System.currentTimeMillis(),val dirty:Boolean=true)

@Dao interface AppDao {
 @Query("SELECT * FROM classes ORDER BY track,classNumber,groupNumber") fun classes():Flow<List<ClassEntity>>
 @Query("SELECT * FROM students ORDER BY lastName,firstName") fun students():Flow<List<StudentEntity>>
 @Query("SELECT * FROM sessions ORDER BY sessionDate DESC,startTime DESC") fun sessions():Flow<List<SessionEntity>>
 @Query("SELECT * FROM attendance") fun attendance():Flow<List<AttendanceEntity>>
 @Query("SELECT * FROM classes") suspend fun allClasses():List<ClassEntity>
 @Query("SELECT * FROM students") suspend fun allStudents():List<StudentEntity>
 @Query("SELECT * FROM sessions") suspend fun allSessions():List<SessionEntity>
 @Query("SELECT * FROM attendance") suspend fun allAttendance():List<AttendanceEntity>
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putClass(x:ClassEntity)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putStudent(x:StudentEntity)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putSession(x:SessionEntity)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putAttendance(x:AttendanceEntity)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putClasses(x:List<ClassEntity>)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putStudents(x:List<StudentEntity>)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putSessions(x:List<SessionEntity>)
 @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun putAttendances(x:List<AttendanceEntity>)
 @Query("DELETE FROM classes WHERE id=:id") suspend fun deleteClass(id:String)
 @Query("DELETE FROM students WHERE id=:id") suspend fun deleteStudent(id:String)
 @Query("DELETE FROM sessions WHERE id=:id") suspend fun deleteSession(id:String)
 @Query("DELETE FROM attendance WHERE id=:id") suspend fun deleteAttendance(id:String)
}

@Database(entities=[ClassEntity::class,StudentEntity::class,SessionEntity::class,AttendanceEntity::class],version=1,exportSchema=false)
abstract class AppDatabase:RoomDatabase(){abstract fun dao():AppDao}
