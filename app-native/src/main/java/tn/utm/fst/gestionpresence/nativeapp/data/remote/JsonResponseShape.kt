package tn.utm.fst.gestionpresence.nativeapp.data.remote

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Converts an API response that semantically represents one row into an object.
 * PostgREST normally returns an object for the singular media type, but some
 * clients/proxies can negotiate application/json and return a one-item array.
 */
internal fun JsonElement.singleObject(): JsonObject = when (this) {
    is JsonObject -> this
    is JsonArray -> {
        check(size == 1) { "Expected exactly one JSON object, received $size rows." }
        this[0] as? JsonObject
            ?: error("Expected a JSON object inside the single-row response.")
    }
    else -> error("Expected a JSON object response.")
}
