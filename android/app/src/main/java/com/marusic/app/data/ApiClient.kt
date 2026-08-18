package com.marusic.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class ApiException(val code: Int, message: String) : IOException(message)

/**
 * Thin OkHttp + kotlinx.serialization client for the marusic API. Auth is a
 * long-lived device token sent as `Authorization: Bearer` on every request
 * (the server's currentUser middleware checks it before the cookie).
 * [baseUrl]/[bearer] are hot-swapped by AppContainer whenever settings change.
 */
class ApiClient {
    @Volatile var baseUrl: String = ""
    @Volatile var bearer: String? = null

    val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        // a cold /api/stream hit makes the server shell out to yt-dlp (~45 s cap)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    fun streamUrl(id: String, quality: String): String =
        "${baseUrl.trimEnd('/')}/api/stream/$id?q=$quality"

    // ---- generic verbs ----

    suspend fun <T> get(path: String, ser: KSerializer<T>): T =
        decode(ser, execute(builder(path).get().build()))

    suspend fun <T> post(path: String, body: String, ser: KSerializer<T>): T =
        decode(ser, execute(builder(path).post(body.toRequestBody(JSON_MEDIA)).build()))

    suspend fun <T> put(path: String, body: String, ser: KSerializer<T>): T =
        decode(ser, execute(builder(path).put(body.toRequestBody(JSON_MEDIA)).build()))

    suspend fun <T> delete(path: String, ser: KSerializer<T>): T =
        decode(ser, execute(builder(path).delete().build()))

    suspend fun deleteQuiet(path: String) {
        execute(builder(path).delete().build())
    }

    // ---- login flow (pre-token, cookie-based) ----

    /** GET /api/health with no auth — throws unless the URL is a marusic server. */
    suspend fun health(base: String): HealthResponse {
        val body = execute(Request.Builder().url(base.trimEnd('/') + "/api/health").get().build())
        val health = decode(HealthResponse.serializer(), body)
        if (!health.ok || health.app != "marusic") throw ApiException(0, "not a marusic server")
        return health
    }

    data class SignInResult(val token: DeviceTokenResponse, val userName: String, val userRole: String)

    /**
     * Sign in and mint a device token: POST /api/login for a one-shot session
     * cookie, exchange it at POST /api/device/token, then drop the cookie.
     * Returns the token response; the caller persists it and sets [bearer].
     */
    suspend fun signIn(base: String, email: String, password: String, deviceName: String): SignInResult {
        val root = base.trimEnd('/')
        val loginBody = json.encodeToString(LoginBody.serializer(), LoginBody(email, password))
        val (sid, loginRes) = withContext(Dispatchers.IO) {
            http.newCall(
                Request.Builder().url("$root/api/login").post(loginBody.toRequestBody(JSON_MEDIA)).build()
            ).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) throw ApiException(res.code, errorFrom(text, res.code))
                val sid = res.headers("Set-Cookie")
                    .firstNotNullOfOrNull { SID_COOKIE.find(it)?.groupValues?.get(1) }
                    ?: throw ApiException(res.code, "login response had no session cookie")
                sid to decode(LoginResponse.serializer(), text)
            }
        }
        val body = json.encodeToString(NameBody.serializer(), NameBody(deviceName))
        val text = execute(
            Request.Builder()
                .url("$root/api/device/token")
                .header("Cookie", "sid=$sid")
                .post(body.toRequestBody(JSON_MEDIA))
                .build()
        )
        return SignInResult(
            token = decode(DeviceTokenResponse.serializer(), text),
            userName = loginRes.user?.name ?: "",
            userRole = loginRes.user?.role ?: "member",
        )
    }

    /** GET returning the raw body (e.g. playlist export JSON). */
    suspend fun getRaw(path: String): String = execute(builder(path).get().build())

    // ---- plumbing ----

    private fun builder(path: String): Request.Builder {
        val b = Request.Builder().url(baseUrl.trimEnd('/') + path)
        bearer?.let { b.header("Authorization", "Bearer $it") }
        return b
    }

    private suspend fun execute(req: Request): String = withContext(Dispatchers.IO) {
        http.newCall(req).execute().use { res: Response ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw ApiException(res.code, errorFrom(text, res.code))
            text
        }
    }

    private fun <T> decode(ser: KSerializer<T>, text: String): T =
        try {
            json.decodeFromString(ser, text)
        } catch (e: Exception) {
            throw ApiException(0, "unexpected response: ${e.message}")
        }

    private fun errorFrom(body: String, code: Int): String =
        runCatching {
            json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content
        }.getOrNull() ?: "HTTP $code"

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
        private val SID_COOKIE = Regex("^sid=([^;]+)")

        fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")
    }
}
