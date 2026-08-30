package tn.utm.fst.gestionpresence.nativeapp.data.remote

import android.util.Base64
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import tn.utm.fst.gestionpresence.nativeapp.BuildConfig
import tn.utm.fst.gestionpresence.nativeapp.core.model.AcademicClass
import tn.utm.fst.gestionpresence.nativeapp.core.model.ApiException
import tn.utm.fst.gestionpresence.nativeapp.core.model.AppContract
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceDraft
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceRecord
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceSheet
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.core.model.AuthSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaEnrollment
import tn.utm.fst.gestionpresence.nativeapp.core.model.MfaFactor
import tn.utm.fst.gestionpresence.nativeapp.core.model.Student
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeacherDirectoryEntry
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeachingSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.UserProfile
import java.time.Instant

class OnlineApiClient(
    private val baseUrl: String = BuildConfig.SUPABASE_URL,
    private val publishableKey: String = BuildConfig.SUPABASE_PUBLISHABLE_KEY
) {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val http = HttpClient(OkHttp) {
        expectSuccess = false
        install(ContentNegotiation) { json(json) }
    }

    suspend fun login(identifier: String, credential: String): AuthSession {
        val response = http.post("$baseUrl/functions/v1/pin-login") {
            publicHeaders()
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("identifier", identifier.trim().lowercase())
                put("credential", credential)
            })
        }
        val body = response.requireObject()
        val access = body.requiredString("access_token")
        return AuthSession(
            accessToken = access,
            refreshToken = body.requiredString("refresh_token"),
            userId = body.string("user_id") ?: jwtClaim(access, "sub")
                ?: throw ApiException("UNAUTHENTICATED", "Session invalide."),
            role = body.string("role") ?: "teacher",
            mfaRequired = body.boolean("mfa_required") ?: true,
            expiresAtEpochSeconds = Instant.now().epochSecond + (body.long("expires_in") ?: 3600L)
        )
    }

    suspend fun refresh(refreshToken: String): AuthSession {
        val response = http.post("$baseUrl/auth/v1/token") {
            publicHeaders()
            parameter("grant_type", "refresh_token")
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("refresh_token", refreshToken) })
        }
        val body = response.requireObject()
        val access = body.requiredString("access_token")
        return AuthSession(
            accessToken = access,
            refreshToken = body.string("refresh_token") ?: refreshToken,
            userId = (body["user"] as? JsonObject)?.string("id") ?: jwtClaim(access, "sub")
                ?: throw ApiException("UNAUTHENTICATED", "Session invalide."),
            role = jwtClaim(access, "user_role") ?: jwtClaim(access, "role") ?: "teacher",
            mfaRequired = true,
            expiresAtEpochSeconds = Instant.now().epochSecond + (body.long("expires_in") ?: 3600L)
        )
    }

    suspend fun logout(session: AuthSession) {
        http.post("$baseUrl/auth/v1/logout") { authenticatedHeaders(session) }
    }

    suspend fun profile(session: AuthSession): UserProfile {
        val response = http.get("$baseUrl/rest/v1/profiles") {
            authenticatedHeaders(session)
            parameter("id", "eq.${session.userId}")
            parameter("select", "id,email,username,full_name,role,account_state,mfa_required")
        }
        val body = response.requireObject()
        return UserProfile(
            id = body.requiredString("id"),
            email = body.string("email"),
            username = body.string("username"),
            fullName = body.string("full_name") ?: "Enseignant",
            role = body.string("role") ?: "teacher",
            accountState = body.string("account_state") ?: "active",
            mfaRequired = body.boolean("mfa_required") ?: true
        )
    }

    suspend fun appContract(session: AuthSession): AppContract {
        val body = rpc(session, "get_app_contract", buildJsonObject { }).singleObject()
        val maintenance = body["maintenance"] as? JsonObject ?: JsonObject(emptyMap())
        val versions = body["minimum_client_versions"] as? JsonObject ?: JsonObject(emptyMap())
        val mfa = body["mfa_policy"] as? JsonObject ?: JsonObject(emptyMap())
        return AppContract(
            schemaVersion = body.int("schema_version") ?: 2,
            academicYear = body.string("academic_year") ?: "2026/2027",
            maintenanceEnabled = maintenance.boolean("enabled") ?: false,
            maintenanceMessage = maintenance.string("message") ?: "",
            minimumWebVersion = versions.string("web"),
            minimumWindowsVersion = versions.string("windows"),
            minimumAndroidVersion = versions.string("android"),
            enforceBusinessMfa = mfa.boolean("enforce_business_writes") ?: false
        )
    }

    suspend fun classes(session: AuthSession): List<AcademicClass> =
        getArray(session, "classes", "*").map { element ->
            val row = element.jsonObject
            AcademicClass(
                id = row.requiredString("id"), teacherId = row.requiredString("teacher_id"),
                name = row.requiredString("name"), module = row.string("module") ?: "",
                track = row.string("track"), classNumber = row.int("class_number"),
                groupNumber = row.int("group_number"), day = row.string("day"),
                startTime = row.string("start_time")?.take(5), endTime = row.string("end_time")?.take(5),
                room = row.string("room"), revision = row.long("revision") ?: 1L
            )
        }.sortedBy { it.name }

    suspend fun students(session: AuthSession): List<Student> =
        getArray(session, "students", "*").map { element ->
            val row = element.jsonObject
            Student(
                id = row.requiredString("id"), teacherId = row.requiredString("teacher_id"),
                classId = row.requiredString("class_id"), lastName = row.requiredString("last_name"),
                firstName = row.requiredString("first_name"), email = row.string("email"),
                revision = row.long("revision") ?: 1L
            )
        }.sortedWith(compareBy<Student> { it.lastName }.thenBy { it.firstName })

    suspend fun sessions(session: AuthSession): List<TeachingSession> =
        getArray(session, "sessions", "*").map { element ->
            val row = element.jsonObject
            TeachingSession(
                id = row.requiredString("id"), teacherId = row.requiredString("teacher_id"),
                classId = row.requiredString("class_id"), sessionDate = row.requiredString("session_date"),
                startTime = row.requiredString("start_time").take(5), endTime = row.requiredString("end_time").take(5),
                completedAt = row.string("completed_at"), revision = row.long("revision") ?: 1L
            )
        }.sortedWith(compareByDescending<TeachingSession> { it.sessionDate }.thenBy { it.startTime })

    suspend fun attendance(session: AuthSession): List<AttendanceRecord> =
        getArray(session, "attendance", "*").map { attendanceRecord(it.jsonObject) }

    suspend fun teacherDirectory(session: AuthSession): List<TeacherDirectoryEntry> {
        return rpc(session, "teacher_directory_v2", buildJsonObject { }).jsonArray.map { element ->
            val row = element.jsonObject
            TeacherDirectoryEntry(
                teacherId = row.requiredString("teacher_id"), teacherName = row.string("teacher_name") ?: "Enseignant",
                day = row.string("day"), startTime = row.string("start_time")?.take(5),
                endTime = row.string("end_time")?.take(5), track = row.string("track"),
                classNumber = row.int("class_number"), groupNumber = row.int("group_number"),
                module = row.string("module"), room = row.string("room")
            )
        }
    }

    suspend fun upsertClass(session: AuthSession, row: JsonObject) = upsert(session, "classes", row)
    suspend fun upsertStudent(session: AuthSession, row: JsonObject) = upsert(session, "students", row)
    suspend fun upsertSession(session: AuthSession, row: JsonObject) = upsert(session, "sessions", row)

    suspend fun deleteRow(session: AuthSession, table: String, id: String) {
        http.delete("$baseUrl/rest/v1/$table") {
            authenticatedHeaders(session)
            parameter("id", "eq.$id")
        }.requireSuccess()
    }

    suspend fun getAttendanceSheet(session: AuthSession, sessionId: String): AttendanceSheet {
        val body = rpc(session, "get_attendance_sheet", buildJsonObject { put("p_session_id", sessionId) }).singleObject()
        ensureBusinessResult(body)
        return AttendanceSheet(
            sessionId = sessionId, sheetId = body.string("sheet_id"), revision = body.long("revision") ?: 0L,
            records = (body["records"] as? JsonArray).orEmpty().map { attendanceRecord(it.jsonObject, sessionId) }
        )
    }

    suspend fun saveAttendanceSheet(
        session: AuthSession,
        sessionId: String,
        expectedRevision: Long,
        operationId: String,
        records: List<AttendanceDraft>,
        justification: String? = null
    ): AttendanceSheet {
        val body = rpc(session, "save_attendance_sheet", buildJsonObject {
            put("p_session_id", sessionId)
            put("p_expected_revision", expectedRevision)
            put("p_operation_id", operationId)
            put("p_records", buildJsonArray {
                records.forEach { record ->
                    add(buildJsonObject {
                        put("student_id", record.studentId)
                        put("status", record.status.wireValue)
                        put("comment", record.comment)
                        if (record.grade == null) put("grade", JsonNull) else put("grade", record.grade)
                    })
                }
            })
            if (justification == null) put("p_justification", JsonNull) else put("p_justification", justification)
        }).singleObject()
        ensureBusinessResult(body)
        return AttendanceSheet(
            sessionId = sessionId, sheetId = body.string("sheet_id"),
            revision = body.long("revision") ?: expectedRevision,
            records = (body["records"] as? JsonArray).orEmpty().map { attendanceRecord(it.jsonObject, sessionId) }
        )
    }

    suspend fun mfaFactors(session: AuthSession): List<MfaFactor> {
        val value = http.get("$baseUrl/auth/v1/factors") { authenticatedHeaders(session) }.requireJson()
        val candidates = when (value) {
            is JsonArray -> value
            is JsonObject -> value["all"] as? JsonArray ?: value["totp"] as? JsonArray ?: JsonArray(emptyList())
            else -> JsonArray(emptyList())
        }
        return candidates.mapNotNull { element ->
            val row = element as? JsonObject ?: return@mapNotNull null
            val type = row.string("factor_type") ?: row.string("factorType") ?: row.string("type") ?: "totp"
            if (type != "totp") return@mapNotNull null
            MfaFactor(
                id = row.requiredString("id"),
                friendlyName = row.string("friendly_name") ?: row.string("friendlyName") ?: "Application TOTP",
                status = row.string("status") ?: "unverified", factorType = type
            )
        }
    }

    suspend fun enrollMfa(session: AuthSession): MfaEnrollment {
        val body = http.post("$baseUrl/auth/v1/factors") {
            authenticatedHeaders(session)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("factor_type", "totp")
                put("friendly_name", "Gestion Présence Android")
                put("issuer", "FST UTM Gestion Presence")
            })
        }.requireObject()
        val totp = body["totp"] as? JsonObject ?: JsonObject(emptyMap())
        return MfaEnrollment(
            factorId = body.requiredString("id"), qrCode = totp.string("qr_code") ?: totp.string("qrCode") ?: "",
            secret = totp.string("secret") ?: "", uri = totp.string("uri") ?: ""
        )
    }

    suspend fun verifyMfa(session: AuthSession, factorId: String, code: String): AuthSession {
        val challenge = http.post("$baseUrl/auth/v1/factors/$factorId/challenge") {
            authenticatedHeaders(session)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { })
        }.requireObject()
        val verified = http.post("$baseUrl/auth/v1/factors/$factorId/verify") {
            authenticatedHeaders(session)
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject {
                put("challenge_id", challenge.requiredString("id"))
                put("code", code)
            })
        }.requireObject()
        return session.copy(
            accessToken = verified.string("access_token") ?: session.accessToken,
            refreshToken = verified.string("refresh_token") ?: session.refreshToken,
            expiresAtEpochSeconds = Instant.now().epochSecond + (verified.long("expires_in") ?: 3600L)
        )
    }

    suspend fun unenrollMfa(session: AuthSession, factorId: String) {
        http.delete("$baseUrl/auth/v1/factors/$factorId") { authenticatedHeaders(session) }.requireSuccess()
    }

    suspend fun adminAction(session: AuthSession, body: JsonObject): JsonObject =
        http.post("$baseUrl/functions/v1/admin-teacher") {
            authenticatedHeaders(session)
            contentType(ContentType.Application.Json)
            setBody(body)
        }.requireObject()

    fun assuranceLevel(session: AuthSession): String = jwtClaim(session.accessToken, "aal") ?: "aal1"

    private suspend fun getArray(session: AuthSession, table: String, select: String): JsonArray {
        val response = http.get("$baseUrl/rest/v1/$table") {
            authenticatedHeaders(session)
            parameter("select", select)
            parameter("deleted_at", "is.null")
        }
        return response.requireJson().jsonArray
    }

    private suspend fun upsert(session: AuthSession, table: String, row: JsonObject) {
        http.post("$baseUrl/rest/v1/$table") {
            authenticatedHeaders(session)
            header("Prefer", "resolution=merge-duplicates,return=minimal")
            contentType(ContentType.Application.Json)
            setBody(JsonArray(listOf(row)))
        }.requireSuccess()
    }

    private suspend fun rpc(session: AuthSession, function: String, body: JsonObject): JsonElement =
        http.post("$baseUrl/rest/v1/rpc/$function") {
            authenticatedHeaders(session)
            contentType(ContentType.Application.Json)
            setBody(body)
        }.requireJson()

    private fun HttpRequestBuilder.publicHeaders() {
        header("apikey", publishableKey)
        header(HttpHeaders.Accept, ContentType.Application.Json)
    }

    private fun HttpRequestBuilder.authenticatedHeaders(session: AuthSession) {
        publicHeaders()
        header(HttpHeaders.Authorization, "Bearer ${session.accessToken}")
    }

    private suspend fun HttpResponse.requireSuccess() {
        if (!status.isSuccess()) throw toApiException()
    }

    private suspend fun HttpResponse.requireJson(): JsonElement {
        val text = bodyAsText()
        val parsed = runCatching { json.parseToJsonElement(text.ifBlank { "{}" }) }
            .getOrElse { JsonObject(emptyMap()) }
        if (!status.isSuccess()) throw toApiException(parsed)
        return parsed
    }

    private suspend fun HttpResponse.requireObject(): JsonObject = try {
        requireJson().singleObject()
    } catch (error: IllegalStateException) {
        throw ApiException("VALIDATION_ERROR", "Réponse serveur inattendue: ${error.message}")
    }

    private suspend fun HttpResponse.toApiException(parsed: JsonElement? = null): ApiException {
        val value = parsed ?: runCatching { json.parseToJsonElement(bodyAsText().ifBlank { "{}" }) }.getOrNull()
        val body = when (value) {
            is JsonObject -> value
            is JsonArray -> value.singleOrNull() as? JsonObject
            else -> null
        }
        val code = body?.string("code") ?: when (status) {
            HttpStatusCode.Unauthorized -> "UNAUTHENTICATED"
            HttpStatusCode.Forbidden -> "FORBIDDEN"
            HttpStatusCode.TooManyRequests -> "RATE_LIMITED"
            in HttpStatusCode.InternalServerError..HttpStatusCode.GatewayTimeout -> "SERVER_UNAVAILABLE"
            else -> "VALIDATION_ERROR"
        }
        val message = body?.string("message") ?: body?.string("error") ?: when (code) {
            "UNAUTHENTICATED" -> "Session invalide."
            "FORBIDDEN" -> "Accès refusé."
            "RATE_LIMITED" -> "Trop de tentatives."
            "SERVER_UNAVAILABLE" -> "Serveur indisponible."
            else -> "Requête invalide."
        }
        return ApiException(code, message, body?.string("correlation_id"), status.value)
    }

    private fun ensureBusinessResult(body: JsonObject) {
        if (body.boolean("ok") == true) return
        throw ApiException(
            code = body.string("code") ?: "INTERNAL_ERROR",
            message = body.string("message") ?: body.string("error") ?: "Opération refusée.",
            correlationId = body.string("correlation_id")
        )
    }

    private fun attendanceRecord(row: JsonObject, fallbackSessionId: String? = null): AttendanceRecord =
        AttendanceRecord(
            id = row.requiredString("id"), sessionId = row.string("session_id") ?: fallbackSessionId.orEmpty(),
            studentId = row.requiredString("student_id"), status = AttendanceStatus.fromWire(row.string("status")),
            comment = row.string("comment") ?: "", grade = row.double("grade"),
            revision = row.long("revision") ?: 1L, updatedAt = row.string("updated_at")
        )

    private fun jwtClaim(jwt: String, key: String): String? = runCatching {
        val encoded = jwt.split('.')[1].replace('-', '+').replace('_', '/')
        val padded = encoded + "=".repeat((4 - encoded.length % 4) % 4)
        val payload = Base64.decode(padded, Base64.NO_WRAP).decodeToString()
        json.parseToJsonElement(payload).jsonObject.string(key)
    }.getOrNull()
}

private fun JsonObject.string(key: String): String? =
    this[key]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull

private fun JsonObject.requiredString(key: String): String =
    string(key) ?: throw ApiException("VALIDATION_ERROR", "Champ serveur manquant: $key")

private fun JsonObject.boolean(key: String): Boolean? = string(key)?.toBooleanStrictOrNull()
private fun JsonObject.int(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
private fun JsonObject.long(key: String): Long? = this[key]?.jsonPrimitive?.longOrNull
private fun JsonObject.double(key: String): Double? = this[key]?.takeUnless { it is JsonNull }?.jsonPrimitive?.doubleOrNull
