package com.marusic.app.playback

import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import com.marusic.app.data.ApiClient
import com.marusic.app.data.CodeBody
import com.marusic.app.data.DeviceBody
import com.marusic.app.data.EndedBody
import com.marusic.app.data.JamCreateBody
import com.marusic.app.data.JamMembersEvent
import com.marusic.app.data.JamPeek
import com.marusic.app.data.JamQueueEvent
import com.marusic.app.data.JamSettingsBody
import com.marusic.app.data.JamSettingsEvent
import com.marusic.app.data.JamSnapshot
import com.marusic.app.data.JamSyncEvent
import com.marusic.app.data.JamWrapper
import com.marusic.app.data.OkResponse
import com.marusic.app.data.PlayIndexBody
import com.marusic.app.data.SeekBody
import com.marusic.app.data.Song
import com.marusic.app.data.SongsBody
import com.marusic.app.data.UserIdBody
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Client half of lib/jam.js. REST for actions, one SSE stream for state.
 *
 * The server clock is the source of truth: state carries {pos, at, now} and
 * this class keeps a server-clock offset so any device can derive the exact
 * position. If this phone is the jam's speaker device it drives the local
 * ExoPlayer to match; otherwise the player stays silent and the app is a
 * synchronized remote — exactly like a second browser tab on the web app.
 */
class JamManager(
    private val api: ApiClient,
    private val scope: CoroutineScope,
) {
    var deviceId: String = ""
    var quality: () -> String = { "high" }

    private val main = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _state = MutableStateFlow<JamSnapshot?>(null)
    val state: StateFlow<JamSnapshot?> = _state

    /** Human-readable happenings ("Ana added 3 songs", "host left") for snackbars. */
    private val _notes = MutableSharedFlow<String>(extraBufferCapacity = 16)
    val notes: SharedFlow<String> = _notes

    val active: Boolean get() = _state.value != null
    val isSpeaker: Boolean
        get() = _state.value?.let { it.speakerId.isNotBlank() && it.speakerId == deviceId } == true

    /** Set by PlaybackService while it lives (main thread). */
    var player: Player? = null
        set(value) {
            field = value
            main.launch { applyToPlayer(force = true) }
        }

    private var clockOffsetMs = 0L // serverNow - clientNow
    private var sseJob: Job? = null
    private var lastPrefetchedId: String? = null

    private val sseClient: OkHttpClient by lazy {
        api.http.newBuilder().readTimeout(0, TimeUnit.MILLISECONDS).build()
    }

    // ------------------------------------------------------------ derived --

    fun positionSec(s: JamSnapshot? = _state.value): Double {
        s ?: return 0.0
        if (!s.playing) return s.pos
        return s.pos + (System.currentTimeMillis() + clockOffsetMs - s.at) / 1000.0
    }

    fun currentSong(): Song? = _state.value?.let { it.queue.getOrNull(it.index) }

    // ---------------------------------------------------------- lifecycle --

    /** On app start: rejoin the jam this account is already a member of, if any. */
    suspend fun resumeExisting() {
        val existing = runCatching { api.get("/api/jam", JamWrapper.serializer()).jam }.getOrNull()
        if (existing != null) adopt(existing)
    }

    suspend fun create(queue: List<Song>, index: Int, posSec: Double, playing: Boolean) {
        val body = api.json.encodeToString(
            JamCreateBody.serializer(),
            JamCreateBody(queue, index, posSec, playing, deviceId)
        )
        adopt(api.post("/api/jam", body, JamSnapshot.serializer()))
    }

    suspend fun peek(code: String): JamPeek =
        api.get("/api/jam/peek/${ApiClient.enc(code.trim().uppercase())}", JamPeek.serializer())

    suspend fun join(code: String) {
        val body = api.json.encodeToString(CodeBody.serializer(), CodeBody(code.trim().uppercase()))
        adopt(api.post("/api/jam/join", body, JamSnapshot.serializer()))
    }

    suspend fun leave() {
        runCatching { api.post("/api/jam/leave", "{}", OkResponse.serializer()) }
        clear("You left the jam")
    }

    suspend fun end() {
        runCatching { api.post("/api/jam/end", "{}", OkResponse.serializer()) }
        clear("Jam ended")
    }

    // ------------------------------------------------------------ actions --

    suspend fun kick(userId: Long) = post("/api/jam/kick", UserIdBody(userId), UserIdBody.serializer())

    suspend fun setSettings(guestsControl: Boolean? = null, autoplay: Boolean? = null) =
        post("/api/jam/settings", JamSettingsBody(guestsControl, autoplay), JamSettingsBody.serializer())

    /** Host: make this phone the device that plays the audio. */
    suspend fun playHere() = post("/api/jam/speaker", DeviceBody(deviceId), DeviceBody.serializer())

    suspend fun addSongs(songs: List<Song>) {
        post("/api/jam/queue", SongsBody(songs), SongsBody.serializer())
        _notes.tryEmit(if (songs.size == 1) "Added to jam: ${songs.first().title}" else "Added ${songs.size} songs to jam")
    }

    suspend fun removeAt(index: Int) {
        runCatching { api.deleteQuiet("/api/jam/queue/$index") }
    }

    suspend fun playAt(index: Int) = post("/api/jam/play", PlayIndexBody(index), PlayIndexBody.serializer())
    suspend fun resume() = post("/api/jam/play", PlayIndexBody(), PlayIndexBody.serializer())
    suspend fun pause() = post("/api/jam/pause", PlayIndexBody(), PlayIndexBody.serializer())
    suspend fun seek(posSec: Double) = post("/api/jam/seek", SeekBody(posSec), SeekBody.serializer())
    suspend fun next() = post("/api/jam/next", PlayIndexBody(), PlayIndexBody.serializer())
    suspend fun previous() = post("/api/jam/prev", PlayIndexBody(), PlayIndexBody.serializer())

    /** Called by PlaybackService when the speaker's audio hits the end of a track. */
    fun notifyTrackEnded() {
        val s = _state.value ?: return
        if (!isSpeaker) return
        scope.launch {
            runCatching {
                val body = api.json.encodeToString(EndedBody.serializer(), EndedBody(s.index, deviceId))
                api.post("/api/jam/ended", body, OkResponse.serializer())
            }
        }
    }

    private suspend fun <T> post(path: String, body: T, ser: kotlinx.serialization.KSerializer<T>) {
        runCatching { api.post(path, api.json.encodeToString(ser, body), OkResponse.serializer()) }
            .onFailure { _notes.tryEmit(it.message ?: "Jam action failed") }
    }

    // ---------------------------------------------------------------- SSE --

    private fun adopt(snap: JamSnapshot) {
        clockOffsetMs = snap.now - System.currentTimeMillis()
        _state.value = snap
        startSse()
        main.launch { applyToPlayer(force = true) }
    }

    private fun clear(note: String? = null) {
        sseJob?.cancel()
        sseJob = null
        _state.value = null
        note?.let { _notes.tryEmit(it) }
        main.launch {
            player?.let {
                it.stop()
                it.clearMediaItems()
            }
        }
    }

    private fun startSse() {
        sseJob?.cancel()
        sseJob = scope.launch(Dispatchers.IO) {
            while (isActive && _state.value != null) {
                try {
                    streamOnce()
                } catch (_: Exception) {
                    // connection dropped — fall through to the retry delay
                }
                if (!isActive || _state.value == null) break
                delay(2500) // server's suggested retry interval
            }
        }
    }

    /** One SSE connection: blocks reading events until it drops. */
    private fun streamOnce() {
        val url = api.baseUrl.trimEnd('/') + "/api/jam/events?device=" + ApiClient.enc(deviceId)
        val builder = Request.Builder().url(url).header("Accept", "text/event-stream")
        api.bearer?.let { builder.header("Authorization", "Bearer $it") }
        sseClient.newCall(builder.build()).execute().use { res ->
            if (res.code == 401 || res.code == 404) {
                // no longer a member (kicked while offline / jam swept) — stop
                clear()
                return
            }
            if (!res.isSuccessful) return
            val source = res.body?.source() ?: return
            var event = ""
            val data = StringBuilder()
            while (_state.value != null) {
                val line = source.readUtf8Line() ?: break // EOF: server hung up
                when {
                    line.isEmpty() -> {
                        if (event.isNotEmpty()) dispatch(event, data.toString())
                        event = ""
                        data.clear()
                    }
                    line.startsWith(":") -> Unit // heartbeat
                    line.startsWith("event:") -> event = line.removePrefix("event:").trim()
                    line.startsWith("data:") -> {
                        if (data.isNotEmpty()) data.append('\n')
                        data.append(line.removePrefix("data:").trim())
                    }
                    else -> Unit // retry:/id: hints
                }
            }
        }
    }

    private fun dispatch(event: String, raw: String) {
        val json = api.json
        when (event) {
            "hello" -> {
                val snap = runCatching { json.decodeFromString(JamSnapshot.serializer(), raw) }.getOrNull() ?: return
                clockOffsetMs = snap.now - System.currentTimeMillis()
                _state.value = snap
                main.launch { applyToPlayer(force = true) }
            }

            "sync" -> {
                val s = runCatching { json.decodeFromString(JamSyncEvent.serializer(), raw) }.getOrNull() ?: return
                clockOffsetMs = s.now - System.currentTimeMillis()
                _state.update { it?.copy(index = s.index, playing = s.playing, pos = s.pos, at = s.at) }
                main.launch { applyToPlayer() }
                prefetchUpcoming()
            }

            "queue" -> {
                val q = runCatching { json.decodeFromString(JamQueueEvent.serializer(), raw) }.getOrNull() ?: return
                _state.update { it?.copy(queue = q.queue, index = q.index) }
                if (q.added > 0 && q.by.isNotBlank()) {
                    _notes.tryEmit("${q.by} added ${if (q.added == 1) "a song" else "${q.added} songs"}")
                }
                main.launch { applyToPlayer() }
            }

            "members" -> {
                val m = runCatching { json.decodeFromString(JamMembersEvent.serializer(), raw) }.getOrNull() ?: return
                _state.update { cur ->
                    cur?.copy(
                        hostId = m.hostId,
                        speakerId = m.speakerId,
                        speakerOnline = m.speakerOnline,
                        members = m.members,
                        you = cur.you.copy(
                            isHost = cur.you.id == m.hostId,
                            canControl = cur.you.id == m.hostId || cur.settings.guestsControl,
                        ),
                    )
                }
                when (m.note?.type) {
                    "join" -> _notes.tryEmit("${m.note.name} joined")
                    "leave" -> _notes.tryEmit("${m.note.name} left")
                    "kick" -> _notes.tryEmit("${m.note.name} was removed")
                    "host" -> _notes.tryEmit("${m.note.name} is the new host")
                }
                main.launch { applyToPlayer(force = true) } // the speaker may have moved
            }

            "settings" -> {
                val s = runCatching { json.decodeFromString(JamSettingsEvent.serializer(), raw) }.getOrNull() ?: return
                _state.update { cur ->
                    cur?.copy(
                        settings = s.settings,
                        you = cur.you.copy(canControl = cur.you.isHost || s.settings.guestsControl),
                    )
                }
            }

            "left" -> clear()
            "kicked" -> clear("You were removed from the jam")
            "jam-ended" -> clear("The jam has ended")
        }
    }

    // --------------------------------------------------------- the engine --

    /** Make the local player mirror jam state. Main thread only. */
    private fun applyToPlayer(force: Boolean = false) {
        val p = player ?: return
        val s = _state.value ?: return

        if (!isSpeaker) {
            // remotes are silent — the web app's remote tabs behave the same
            if (p.mediaItemCount > 0 || p.isPlaying) {
                p.stop()
                p.clearMediaItems()
            }
            return
        }

        val song = s.queue.getOrNull(s.index)
        if (song == null) {
            p.stop()
            p.clearMediaItems()
            return
        }

        val targetId = MediaIds.song(song.id, "jam/${s.code}")
        val targetPosMs = (positionSec(s) * 1000).toLong().coerceAtLeast(0L)

        if (p.currentMediaItem?.mediaId != targetId) {
            val item = MediaItem.Builder()
                .setMediaId(targetId)
                .setUri(api.streamUrl(song.id, quality()))
                .setMediaMetadata(songMetadata(song))
                .build()
            p.setMediaItem(item, targetPosMs)
            p.prepare()
        } else if (force || abs(p.currentPosition - targetPosMs) > DRIFT_TOLERANCE_MS) {
            if (s.playing || abs(p.currentPosition - targetPosMs) > DRIFT_TOLERANCE_MS) {
                p.seekTo(targetPosMs)
            }
        }
        p.playWhenReady = s.playing
    }

    /** Warm the next jam track's stream URL on the server (yt-dlp cold start). */
    private fun prefetchUpcoming() {
        if (!isSpeaker) return
        val s = _state.value ?: return
        val next = s.queue.getOrNull(s.index + 1) ?: return
        if (next.id == lastPrefetchedId) return
        lastPrefetchedId = next.id
        val token = api.bearer ?: return
        val url = api.streamUrl(next.id, quality())
        scope.launch(Dispatchers.IO) {
            runCatching {
                val req = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .header("Range", "bytes=0-1")
                    .build()
                api.http.newCall(req).execute().use { it.body?.bytes() }
            }
        }
    }

    private companion object {
        const val DRIFT_TOLERANCE_MS = 1500L
    }
}
