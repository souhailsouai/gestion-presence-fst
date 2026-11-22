package tn.utm.fst.gestionpresence.nativeapp.core.model

import java.time.Instant

data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val role: String,
    val mfaRequired: Boolean,
    val expiresAtEpochSeconds: Long
) {
    val isAdmin: Boolean get() = role == "admin"
    val isExpired: Boolean get() = Instant.now().epochSecond >= expiresAtEpochSeconds - 30
}

data class UserProfile(
    val id: String,
    val email: String?,
    val username: String?,
    val fullName: String,
    val role: String,
    val accountState: String,
    val mfaRequired: Boolean
) {
    val isAdmin: Boolean get() = role == "admin"
}

data class AcademicClass(
    val id: String,
    val teacherId: String,
    val name: String,
    val module: String,
    val track: String?,
    val classNumber: Int?,
    val groupNumber: Int?,
    val day: String?,
    val startTime: String?,
    val endTime: String?,
    val room: String?,
    val revision: Long
)

data class Student(
    val id: String,
    val teacherId: String,
    val classId: String,
    val lastName: String,
    val firstName: String,
    val email: String?,
    val revision: Long
) {
    val displayName: String get() = "$lastName $firstName".trim()
}

data class TeachingSession(
    val id: String,
    val teacherId: String,
    val classId: String,
    val sessionDate: String,
    val startTime: String,
    val endTime: String,
    val completedAt: String?,
    val revision: Long
)

data class AttendanceRecord(
    val id: String,
    val sessionId: String,
    val studentId: String,
    val status: AttendanceStatus,
    val comment: String,
    val grade: Double?,
    val revision: Long,
    val updatedAt: String?,
    val makeupDate: String? = null,
    val makeupNote: String? = null
)

data class AttendanceDraft(
    val studentId: String,
    val status: AttendanceStatus = AttendanceStatus.PRESENT,
    val comment: String = "",
    val grade: Double? = null
)

data class AttendanceSheet(
    val sessionId: String,
    val sheetId: String?,
    val revision: Long,
    val records: List<AttendanceRecord>
)

data class TeacherDirectoryEntry(
    val teacherId: String,
    val teacherName: String,
    val day: String?,
    val startTime: String?,
    val endTime: String?,
    val track: String?,
    val classNumber: Int?,
    val groupNumber: Int?,
    val module: String?,
    val room: String?
)

data class AppContract(
    val schemaVersion: Int,
    val academicYear: String,
    val maintenanceEnabled: Boolean,
    val maintenanceMessage: String,
    val minimumWebVersion: String?,
    val minimumWindowsVersion: String?,
    val minimumAndroidVersion: String?,
    val enforceBusinessMfa: Boolean
)

data class MfaFactor(
    val id: String,
    val friendlyName: String,
    val status: String,
    val factorType: String
)

data class MfaEnrollment(
    val factorId: String,
    val qrCode: String,
    val secret: String,
    val uri: String
)

data class DashboardStats(
    val classCount: Int,
    val studentCount: Int,
    val sessionCount: Int,
    val attendanceCount: Int,
    val presentCount: Int,
    val absentCount: Int,
    val lateCount: Int,
    val justifiedCount: Int
)

data class ReportSummary(
    val title: String,
    val totalRecords: Int,
    val present: Int,
    val absent: Int,
    val late: Int,
    val justified: Int,
    val averageGrade: Double?
)

data class PlanSlot(
    val groupNo: Int,
    val manipulation: String,
    val teacherId: String?,
    val room: String?
)

data class PlanSession(
    val id: String,
    val className: String,
    val date: String,
    val startTime: String,
    val endTime: String,
    val occurrence: Int,
    val locked: Boolean,
    val slots: List<PlanSlot>
)

class ApiException(
    val code: String,
    override val message: String,
    val correlationId: String? = null,
    val httpStatus: Int? = null
) : Exception(message)
