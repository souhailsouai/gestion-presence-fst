package tn.utm.fst.gestionpresence.nativeapp.data.remote

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class JsonResponseShapeTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `single object response is accepted`() {
        val value = json.parseToJsonElement("{\"id\":\"teacher-1\"}")
        assertEquals("teacher-1", value.singleObject().getValue("id").toString().trim('"'))
    }

    @Test
    fun `single element PostgREST array is accepted as object`() {
        val value = json.parseToJsonElement("[{\"id\":\"teacher-1\"}]")
        assertEquals("teacher-1", value.singleObject().getValue("id").toString().trim('"'))
    }

    @Test
    fun `multiple element array is rejected as ambiguous`() {
        val value = json.parseToJsonElement("[{\"id\":\"one\"},{\"id\":\"two\"}]")
        assertFailsWith<IllegalStateException> { value.singleObject() }
    }
}
