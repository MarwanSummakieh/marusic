package com.marusic.app.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

class SettingsStore(private val context: Context) {

    data class Snapshot(
        val baseUrl: String,
        val token: String?,
        val tokenId: Long,
        val quality: String,
        val userName: String,
        val userRole: String,
        val deviceId: String,
        /** Home rows the user switched off in "Customise" (web: homeRows pref). */
        val hiddenRows: Set<String>,
        val autoplay: Boolean,
        /** Which kind of session the Jam screen offers first (web: jamMode pref). */
        val jamMode: String,
    ) {
        val loggedIn: Boolean get() = baseUrl.isNotBlank() && !token.isNullOrBlank()
        fun rowVisible(id: String) = id !in hiddenRows
    }

    suspend fun toggleRow(id: String, visible: Boolean) {
        context.dataStore.edit {
            val cur = it[HIDDEN_ROWS] ?: emptySet()
            it[HIDDEN_ROWS] = if (visible) cur - id else cur + id
        }
    }

    val flow: Flow<Snapshot> = context.dataStore.data.map(::toSnapshot)

    suspend fun snapshot(): Snapshot = toSnapshot(context.dataStore.data.first())

    /** Stable per-install id — identifies this phone as a jam speaker device. */
    suspend fun deviceId(): String {
        val existing = snapshot().deviceId
        if (existing.isNotBlank()) return existing
        val fresh = "android-" + UUID.randomUUID().toString()
        context.dataStore.edit { it[DEVICE_ID] = fresh }
        return fresh
    }

    suspend fun saveLogin(baseUrl: String, token: String, tokenId: Long, userName: String, userRole: String) {
        context.dataStore.edit {
            it[BASE_URL] = baseUrl.trimEnd('/')
            it[TOKEN] = token
            it[TOKEN_ID] = tokenId
            it[USER_NAME] = userName
            it[USER_ROLE] = userRole
        }
    }

    suspend fun setQuality(quality: String) {
        context.dataStore.edit { it[QUALITY] = quality }
    }

    suspend fun setAutoplay(on: Boolean) {
        context.dataStore.edit { it[AUTOPLAY] = on }
    }

    /** Remembers the last kind of session started — "speaker" or "together". */
    suspend fun setJamMode(mode: String) {
        context.dataStore.edit { it[JAM_MODE] = mode }
    }

    suspend fun setUserName(name: String) {
        context.dataStore.edit { it[USER_NAME] = name }
    }

    /** Clears credentials but keeps the server URL for the next sign-in. */
    suspend fun clearLogin() {
        context.dataStore.edit {
            it.remove(TOKEN)
            it.remove(TOKEN_ID)
            it.remove(USER_NAME)
            it.remove(USER_ROLE)
        }
    }

    private fun toSnapshot(p: Preferences) = Snapshot(
        baseUrl = p[BASE_URL] ?: "",
        token = p[TOKEN],
        tokenId = p[TOKEN_ID] ?: 0L,
        quality = p[QUALITY] ?: "high",
        userName = p[USER_NAME] ?: "",
        userRole = p[USER_ROLE] ?: "",
        deviceId = p[DEVICE_ID] ?: "",
        hiddenRows = p[HIDDEN_ROWS] ?: emptySet(),
        autoplay = p[AUTOPLAY] ?: true,
        jamMode = p[JAM_MODE] ?: "speaker",
    )

    private companion object {
        val BASE_URL = stringPreferencesKey("base_url")
        val TOKEN = stringPreferencesKey("token")
        val TOKEN_ID = longPreferencesKey("token_id")
        val QUALITY = stringPreferencesKey("quality")
        val USER_NAME = stringPreferencesKey("user_name")
        val USER_ROLE = stringPreferencesKey("user_role")
        val DEVICE_ID = stringPreferencesKey("device_id")
        val HIDDEN_ROWS = stringSetPreferencesKey("hidden_home_rows")
        val AUTOPLAY = booleanPreferencesKey("autoplay")
        val JAM_MODE = stringPreferencesKey("jam_mode")
    }
}
