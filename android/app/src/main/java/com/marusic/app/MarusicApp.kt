package com.marusic.app

import android.app.Application
import android.content.Context
import com.marusic.app.data.ApiClient
import com.marusic.app.data.MusicRepo
import com.marusic.app.data.SettingsStore
import com.marusic.app.playback.JamManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class MarusicApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

val Context.appContainer: AppContainer
    get() = (applicationContext as MarusicApp).container

/**
 * Hand-rolled DI, matching the server's no-framework ethos. Keeps ApiClient's
 * baseUrl/bearer and the stream quality in sync with persisted settings so the
 * activity and the media service always see current credentials.
 */
class AppContainer(context: Context) {
    val settings = SettingsStore(context)
    val api = ApiClient()
    val repo = MusicRepo(api)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val jam = JamManager(api, scope)

    @Volatile var quality: String = "high"
        private set

    @Volatile var autoplay: Boolean = true
        private set

    /** Last kind of shared session started here — seeds the Jam screen toggle. */
    @Volatile var jamMode: String = "speaker"
        private set

    init {
        // One blocking read of a tiny prefs file: both the service and the UI
        // may fire requests immediately after process start.
        applySettings(runBlocking { settings.snapshot() })
        jam.quality = { quality }
        scope.launch {
            jam.deviceId = settings.deviceId()
            // if this account is already in a jam (e.g. app restart), rejoin
            if (api.bearer != null) jam.resumeExisting()
        }
        scope.launch { settings.flow.collect(::applySettings) }
    }

    private fun applySettings(s: SettingsStore.Snapshot) {
        api.baseUrl = s.baseUrl
        val hadToken = api.bearer
        api.bearer = s.token
        quality = s.quality
        autoplay = s.autoplay
        jamMode = s.jamMode
        if (hadToken != null && s.token == null) {
            repo.invalidate() // signed out
            scope.launch { jam.leave() }
        }
    }
}
