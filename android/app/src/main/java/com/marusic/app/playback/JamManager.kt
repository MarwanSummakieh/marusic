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
import com.marusic.app.data.ServerTime
import com.marusic.app.data.Song
import com.marusic.app.data.SongsBody
import com.marusic.app.data.UserIdBody
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.min
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
 * position.
 *
 * One engine, two products, differing only in who renders the audio:
 *   "speaker"  — Jam, same room: the device named by `speakerId` makes sound
 *                and every other member is a synchronized remote control.
 *   "together" — Listen together, everyone elsewhere: *every* device plays its
 *                own stream, held to the same moment of the same song.
 * [playsAudio] is the fork; everything else is shared.
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
    val mode: String get() = _state.value?.mode ?: MODE_SPEAKER
    val isTogether: Boolean get() = _state.value?.mode == MODE_TOGETHER
    val isSpeaker: Boolean
        get() = _state.value?.let { it.speakerId.isNotBlank() && it.speakerId == deviceId } == true

    /** Does *this* phone render the audio? In listen together, always. */
    val playsAudio: Boolean get() = active && (isTogether || isSpeaker)

    /** Set by PlaybackService while it lives (main thread). */
    var player: Player? = null
        set(value) {
            val previous = field
            field = value
            main.launch {
                previous?.removeListener(playerEvents)
                value?.addListener(playerEvents)
                applyToPlayer(sync = true)
            }
        }

    private var clockOffsetMs = 0L // serverNow - clientNow
    private var clockRtt = Double.MAX_VALUE // best round trip behind that offset
    private var clockJob: Job? = null
    private var sseJob: Job? = null
    private var lastPrefetchedId: String? = null

    private val sseClient: OkHttpClient by lazy {
        api.http.newBuilder().readTimeout(0, TimeUnit.MILLISECONDS).build()
    }

    // ------------------------------------------------------------ derived --

    fun positionSec(s: JamSnapshot? = _state.value): Double {
        s ?: return 0.0
        if (!s.playing) return s.pos
        return s.pos + (serverNow() - s.at) / 1000.0
    }

    fun currentSong(): Song? = _state.value?.let { it.queue.getOrNull(it.index) }

    private fun serverNow() = System.currentTimeMillis() + clockOffsetMs

    /**
     * Is the current track due to run out about now? `ends` is the server-time
     * boundary we were handed up front; a session with no boundary (a track of
     * unknown length) is always "due", since nothing else will move it along.
     */
    private fun atBoundary(slackMs: Long = BOUNDARY_SLACK_MS): Boolean {
        val s = _state.value ?: return false
        if (s.ends <= 0L) return true
        return serverNow() >= s.ends - slackMs
    }

    // ---------------------------------------------------------- lifecycle --

    /** On app start: rejoin the session this account is already a member of, if any. */
    suspend fun resumeExisting() {
        val existing = runCatching { api.get("/api/jam", JamWrapper.serializer()).jam }.getOrNull()
        if (existing != null) adopt(existing)
    }

    /**
     * Start a session. [mode] fixes the kind for its whole life — moving the
     * audio out from under everyone mid-song is not a thing anyone asked for.
     */
    suspend fun create(
        queue: List<Song>,
        index: Int,
        posSec: Double,
        playing: Boolean,
        mode: String = MODE_SPEAKER,
    ) {
        val body = api.json.encodeToString(
            JamCreateBody.serializer(),
            JamCreateBody(queue, index, posSec, playing, deviceId, normalizeMode(mode))
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
        clear("You left")
    }

    suspend fun end() {
        runCatching { api.post("/api/jam/end", "{}", OkResponse.serializer()) }
        clear("Ended for everyone")
    }

    // ------------------------------------------------------------ actions --

    suspend fun kick(userId: Long) = post("/api/jam/kick", UserIdBody(userId), UserIdBody.serializer())

    suspend fun setSettings(guestsControl: Boolean? = null, autoplay: Boolean? = null) =
        post("/api/jam/settings", JamSettingsBody(guestsControl, autoplay), JamSettingsBody.serializer())

    /** Host, speaker mode only: make this phone the device that plays the audio. */
    suspend fun playHere() = post("/api/jam/speaker", DeviceBody(deviceId), DeviceBody.serializer())

    suspend fun addSongs(songs: List<Song>) {
        post("/api/jam/queue", SongsBody(songs), SongsBody.serializer())
        _notes.tryEmit(
            if (songs.size == 1) "Added to the queue: ${songs.first().title}"
            else "Added ${songs.size} songs to the queue"
        )
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

    /**
     * Called by PlaybackService when this device's audio hits the end of a
     * track. The server schedules the boundary itself now, so our stream
     * running out is only news where no boundary was scheduled (a track with
     * no duration metadata) or right as one is due. Ending early just means
     * this copy was short — stay quiet and wait for the session to move.
     */
    fun notifyTrackEnded() {
        val s = _state.value ?: return
        if (!playsAudio || !atBoundary()) return
        scope.launch {
            runCatching {
                val body = api.json.encodeToString(EndedBody.serializer(), EndedBody(s.index, deviceId))
                api.post("/api/jam/ended", body, OkResponse.serializer())
            }
        }
    }

    private suspend fun <T> post(path: String, body: T, ser: kotlinx.serialization.KSerializer<T>) {
        runCatching { api.post(path, api.json.encodeToString(ser, body), OkResponse.serializer()) }
            .onFailure { _notes.tryEmit(it.message ?: "That did not go through") }
    }

    // ------------------------------------------------------- clock offset --

    /*  clockOffsetMs converts our clock to the server's. Reading it off a
        pushed SSE payload (server_now - our_now) silently includes the one-way
        delivery delay, which we cannot measure and which jitters. A jam did not
        care — one device made sound, so being 200 ms off matched nothing.
        Listen together does: a biased offset holds everyone permanently that
        far apart. So we time round trips to /api/jam/time and keep the
        lowest-RTT sample, since the fastest round trip is the least skewed. */

    private suspend fun probeClock(rounds: Int) {
        repeat(rounds) {
            if (_state.value == null) return
            val t0 = System.nanoTime()
            val now = runCatching { api.get("/api/jam/time", ServerTime.serializer()).now }
                .getOrNull() ?: return
            val rtt = (System.nanoTime() - t0) / 1_000_000.0
            if (_state.value == null) return
            if (rtt < clockRtt) {
                clockRtt = rtt
                // the reply was written ~rtt/2 ago, so server time is
                // `now + rtt/2` right about now
                clockOffsetMs = (now + rtt / 2 - System.currentTimeMillis()).toLong()
            }
        }
    }

    private fun startClock() {
        clockJob?.cancel()
        clockRtt = Double.MAX_VALUE
        clockJob = scope.launch(Dispatchers.IO) {
            probeClock(5)
            // re-probe occasionally: phones sleep and clocks get stepped by
            // NTP. The best sample decays so a stale lucky RTT cannot lock out
            // a fresh accurate one.
            while (isActive && _state.value != null) {
                delay(CLOCK_REPROBE_MS)
                if (_state.value == null) break
                clockRtt *= 1.5
                probeClock(3)
            }
        }
    }

    /** Only trust a payload's clock until a round trip gives us a better one. */
    private fun adoptOffset(serverNow: Long) {
        if (clockRtt == Double.MAX_VALUE) clockOffsetMs = serverNow - System.currentTimeMillis()
    }

    // ---------------------------------------------------------------- SSE --

    private fun adopt(snap: JamSnapshot) {
        clockOffsetMs = snap.now - System.currentTimeMillis()
        _state.value = snap
        startClock()
        startSse()
        main.launch { applyToPlayer(sync = true) }
    }

    private fun clear(note: String? = null) {
        sseJob?.cancel()
        sseJob = null
        clockJob?.cancel()
        clockJob = null
        clockRtt = Double.MAX_VALUE
        _state.value = null
        note?.let { _notes.tryEmit(it) }
        main.launch { player?.let(::silence) }
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
                // no longer a member (kicked while offline / session swept) — stop
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
                adoptOffset(snap.now)
                _state.value = snap
                main.launch { applyToPlayer(sync = true) }
            }

            "sync" -> {
                val s = runCatching { json.decodeFromString(JamSyncEvent.serializer(), raw) }.getOrNull() ?: return
                adoptOffset(s.now)
                _state.update {
                    it?.copy(index = s.index, playing = s.playing, pos = s.pos, at = s.at, ends = s.ends)
                }
                main.launch { applyToPlayer(sync = true) }
                prefetchUpcoming()
            }

            "queue" -> {
                val q = runCatching { json.decodeFromString(JamQueueEvent.serializer(), raw) }.getOrNull() ?: return
                _state.update { it?.copy(queue = q.queue, index = q.index) }
                if (q.added > 0 && q.by.isNotBlank()) {
                    _notes.tryEmit(
                        if (q.by == "Autoplay") "Autoplay added similar songs"
                        else "${q.by} added ${if (q.added == 1) "a song" else "${q.added} songs"}"
                    )
                }
                // a queue edit is not a transport move: re-apply so a removal
                // that shifts the index still loads, but never let it drag the
                // playhead of a track that is already playing
                main.launch { applyToPlayer() }
            }

            "members" -> {
                val m = runCatching { json.decodeFromString(JamMembersEvent.serializer(), raw) }.getOrNull() ?: return
                val wasPlaying = playsAudio
                _state.update { cur ->
                    cur?.copy(
                        mode = m.mode.ifBlank { cur.mode },
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
                // the audio moved to (or away from) this device — start or
                // stop the sound; nothing else here touches playback
                if (wasPlaying != playsAudio) main.launch { applyToPlayer(sync = true) }
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
            "kicked" -> clear("You were removed")
            "jam-ended" -> clear("The session has ended")
        }
    }

    // --------------------------------------------------------- the engine --

    /*  Sync is one promise: everyone starts the same song at the same instant.
        The server schedules that instant and hands it to us up front (`ends`),
        so there is exactly one moment per track that needs arranging — and in
        between we do nothing at all.

        The nothing is the point. Chasing the server clock through a song means
        a seek every time the gap opens, and a seek is not free: the proxy
        opens a fresh ranged request upstream, so playback resumes seconds
        later on a phone and by then we are further behind than when we
        started. So the playhead is placed once, when a track starts or the
        transport moves, and then left alone. */

    private var loadedKey = "" // "index:songId" this device has loaded
    private var placedAt = 0L // when the last placement was issued
    private var startLeadMs = 0.0 // what starting a stream has been costing us (EMA)
    private var stalledAt = 0L // last buffering — the buffer ran dry
    private var playingAt = 0L // last resume — buffer refilled
    private var recoverAt = 0L // last post-stall realignment

    private val playerEvents = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            // A placement we just issued buffers on its way in; that is the
            // cost we are already compensating for, not a stall. Buffering
            // with no placement outstanding is the buffer running dry.
            if (playbackState == Player.STATE_BUFFERING && placedAt == 0L) {
                stalledAt = System.currentTimeMillis()
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (!isPlaying) return
            val recovering = stalledAt > playingAt
            playingAt = System.currentTimeMillis()
            if (placedAt != 0L && playingAt - placedAt < LEAD_SAMPLE_WINDOW_MS) {
                // how long the last placement took to start sounding, so the
                // next one can aim past its target and land on the beat
                val took = min(LEAD_MAX_MS, (playingAt - placedAt).toDouble())
                startLeadMs = if (startLeadMs > 0.0) startLeadMs * 0.6 + took * 0.4 else took
            }
            placedAt = 0L
            /*  The one exception to leaving a playing track alone: a stall
                already broke the music and left us behind by however long the
                buffer was dry. Taking that back now adds no glitch that is not
                already there — and it is the only thing that puts time between
                us in the first place. */
            if (!recovering) return
            val p = player ?: return
            val s = _state.value ?: return
            if (!playsAudio || !s.playing) return
            if (playingAt - recoverAt < RECOVER_HOLDOFF_MS) return
            if (abs(p.currentPosition - positionSec(s) * 1000) < RECOVER_DRIFT_MS) return
            recoverAt = playingAt
            align(p, s)
        }
    }

    /** Make the local player mirror session state. Main thread only. */
    private fun applyToPlayer(sync: Boolean = false) {
        val p = player ?: return
        val s = _state.value ?: return

        if (!playsAudio) {
            // a remote is silent — the web app's remote tabs behave the same
            silence(p)
            return
        }

        val song = s.queue.getOrNull(s.index)
        if (song == null) {
            silence(p)
            return
        }

        val key = "${s.index}:${song.id}"
        val targetId = MediaIds.song(song.id, "jam/${s.code}")
        if (key != loadedKey || p.currentMediaItem?.mediaId != targetId) {
            loadedKey = key
            val item = MediaItem.Builder()
                .setMediaId(targetId)
                .setUri(api.streamUrl(song.id, quality()))
                .setMediaMetadata(songMetadata(song))
                .build()
            placedAt = System.currentTimeMillis()
            // a fresh load always has to fetch, so it always pays the lead
            p.setMediaItem(item, placement(s, buffered = false))
            p.prepare()
        } else if (sync) {
            align(p, s)
        }
        p.playWhenReady = s.playing
    }

    /** Put the playhead where the session is — once. */
    private fun align(p: Player, s: JamSnapshot) {
        val target = positionSec(s) * 1000
        if (!s.playing) {
            // parked: land on the same frame everyone else is parked on, so
            // the resume starts the room together
            if (abs(p.currentPosition - target) > ALIGN_TOLERANCE_MS) place(p, target)
            return
        }
        val want = placement(s, buffered = isBuffered(p, target)).toDouble()
        if (want <= 0.0) return
        if (abs(p.currentPosition - want) > ALIGN_TOLERANCE_MS) place(p, want)
    }

    /**
     * Where to drop the playhead. A placement that has to fetch does not sound
     * until the fetch lands, so aim past the target by what that has been
     * costing and arrive on the beat; one that is already buffered starts
     * instantly and needs no lead. At the top of a track there is nothing to
     * skip past, and seeking a fraction of a second in buys a fresh ranged
     * request for no gain.
     */
    private fun placement(s: JamSnapshot, buffered: Boolean): Long {
        val target = positionSec(s) * 1000
        if (!s.playing) return target.toLong().coerceAtLeast(0L)
        val want = target + if (buffered) 0.0 else startLeadMs
        return if (want < START_FLOOR_MS) 0L else want.toLong()
    }

    // is that moment already downloaded? Landing inside the buffer is instant;
    // landing outside it means waiting on a fresh ranged request.
    private fun isBuffered(p: Player, targetMs: Double): Boolean =
        targetMs >= p.currentPosition && targetMs <= p.bufferedPosition

    private fun place(p: Player, posMs: Double) {
        placedAt = System.currentTimeMillis()
        p.seekTo(posMs.toLong().coerceAtLeast(0L))
    }

    private fun silence(p: Player) {
        loadedKey = ""
        if (p.mediaItemCount > 0 || p.isPlaying) {
            p.stop()
            p.clearMediaItems()
        }
    }

    /** Warm the next track's stream URL on the server (yt-dlp cold start). */
    private fun prefetchUpcoming() {
        if (!playsAudio) return
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

    companion object {
        const val MODE_SPEAKER = "speaker"
        const val MODE_TOGETHER = "together"

        fun normalizeMode(mode: String) = if (mode == MODE_TOGETHER) MODE_TOGETHER else MODE_SPEAKER

        private const val ALIGN_TOLERANCE_MS = 150.0 // inside this we are together
        private const val START_FLOOR_MS = 300.0 // this close to 0:00, play from the top
        private const val LEAD_MAX_MS = 2000.0 // cap on the start-up lead we compensate for
        private const val LEAD_SAMPLE_WINDOW_MS = 10_000L
        private const val RECOVER_DRIFT_MS = 500.0 // a stall cost us this much — take it back
        private const val RECOVER_HOLDOFF_MS = 8000L // …but not over and over
        private const val BOUNDARY_SLACK_MS = 1500L // an `ended` this close is telling the truth
        private const val CLOCK_REPROBE_MS = 60_000L
    }
}
