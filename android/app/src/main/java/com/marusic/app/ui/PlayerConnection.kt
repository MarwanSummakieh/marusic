package com.marusic.app.ui

import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.marusic.app.appContainer
import com.marusic.app.data.JamSnapshot
import com.marusic.app.data.Song
import com.marusic.app.playback.MediaIds
import com.marusic.app.playback.PlaybackService
import com.marusic.app.playback.songItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * The phone UI's handle on PlaybackService — and, when a shared session is
 * active, on that instead: transport commands route to the jam API (the server
 * syncs every device), and the displayed track/position derive from session
 * state so remotes render correctly while staying silent. In listen together
 * every device renders the audio, so nothing here is a remote — the same fork
 * the web player makes.
 */
class PlayerConnection(context: Context) {
    private val appContext = context.applicationContext
    private val container = appContext.appContainer
    private var future: ListenableFuture<MediaController>? = null
    private var scope: CoroutineScope? = null

    var controller: MediaController? by mutableStateOf(null)
        private set
    var metadata: MediaMetadata? by mutableStateOf(null)
        private set
    var currentMediaId: String? by mutableStateOf(null)
        private set
    var isPlayingLocal: Boolean by mutableStateOf(false)
        private set
    var durationMsLocal: Long by mutableStateOf(0L)
        private set
    var localQueue: List<MediaItem> by mutableStateOf(emptyList())
        private set
    var currentIndexLocal: Int by mutableStateOf(0)
        private set
    var shuffleOn: Boolean by mutableStateOf(false)
        private set
    var repeatMode: Int by mutableStateOf(Player.REPEAT_MODE_OFF)
        private set
    var volume: Float by mutableStateOf(1f)
        private set

    /** Live jam snapshot (null when not in a jam). */
    var jam: JamSnapshot? by mutableStateOf(null)
        private set

    val inJam: Boolean get() = jam != null

    /** Speaker mode: is this phone the one device making sound? */
    val isJamSpeaker: Boolean get() = container.jam.isSpeaker

    /** Does this phone render the audio? In listen together, every device does. */
    val jamPlaysAudio: Boolean get() = container.jam.playsAudio

    /** "Listen together" rather than a same-room jam. */
    val isTogether: Boolean get() = container.jam.isTogether

    // ---- displayed state (jam-aware) ----

    val currentSong: Song?
        get() {
            jam?.let { return it.queue.getOrNull(it.index) }
            val id = currentMediaId?.let { MediaIds.parseSong(it)?.first } ?: return null
            val m = metadata ?: return null
            return Song(
                id = id,
                title = m.title?.toString().orEmpty(),
                artist = m.artist?.toString().orEmpty(),
                artistId = m.extras?.getString("artistId").orEmpty(),
                album = m.albumTitle?.toString().orEmpty(),
                duration = (durationMsLocal / 1000).toInt(),
                image = m.artworkUri?.toString().orEmpty(),
            )
        }

    val hasMedia: Boolean get() = inJam || currentMediaId != null

    val isPlaying: Boolean get() = jam?.playing ?: isPlayingLocal

    val durationMs: Long
        get() {
            jam?.let { j ->
                val song = j.queue.getOrNull(j.index)
                // a device that plays knows the real duration; remotes use metadata
                if (jamPlaysAudio && durationMsLocal > 0) return durationMsLocal
                return (song?.duration ?: 0) * 1000L
            }
            return durationMsLocal
        }

    fun positionMs(): Long {
        jam?.let { j ->
            return if (jamPlaysAudio && controller != null && durationMsLocal > 0) {
                controller?.currentPosition?.coerceAtLeast(0L) ?: 0L
            } else {
                (container.jam.positionSec(j) * 1000).toLong().coerceAtLeast(0L)
            }
        }
        return controller?.currentPosition?.coerceAtLeast(0L) ?: 0L
    }

    /** Queue for display: jam queue, or the local player's items as Songs. */
    val queueSongs: List<Song>
        get() = jam?.queue ?: localQueue.map { item ->
            val id = MediaIds.parseSong(item.mediaId)?.first ?: item.mediaId
            val m = item.mediaMetadata
            Song(
                id = id,
                title = m.title?.toString().orEmpty(),
                artist = m.artist?.toString().orEmpty(),
                album = m.albumTitle?.toString().orEmpty(),
                image = m.artworkUri?.toString().orEmpty(),
            )
        }

    val queueIndex: Int get() = jam?.index ?: currentIndexLocal

    val canControl: Boolean get() = jam?.you?.canControl ?: true

    /**
     * The web's `npSheetLabel()`: what's driving playback right now, shown
     * uppercase at the top of the Now Playing sheet.
     */
    fun contextLabel(): String {
        jam?.let { return "${if (isTogether) "Listen together" else "Jam"} · ${it.code}" }
        val ctx = currentMediaId?.let { MediaIds.parseSong(it)?.second } ?: return "Now playing"
        return when {
            ctx.startsWith("station/") -> "${ctx.removePrefix("station/")} Radio"
            ctx.startsWith("mix/") -> "Daily Mix"
            ctx.startsWith("reco/") -> "Autoplay"
            ctx.startsWith("search/") -> "Search results"
            ctx == MediaIds.SPEEDDIAL -> "Speed dial"
            ctx == MediaIds.LIKED -> "Liked Songs"
            ctx == MediaIds.HISTORY -> "Recently played"
            ctx == MediaIds.TRENDING -> "Trending"
            else -> "Now playing"
        }
    }

    // ---- connection ----

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = refresh(player)
    }

    fun connect() {
        if (future != null) return
        val s = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        scope = s
        s.launch { container.jam.state.collect { jam = it } }

        val token = SessionToken(appContext, ComponentName(appContext, PlaybackService::class.java))
        val f = MediaController.Builder(appContext, token).buildAsync()
        future = f
        f.addListener({
            val c = runCatching { f.get() }.getOrNull() ?: return@addListener
            c.addListener(listener)
            controller = c
            refresh(c)
        }, ContextCompat.getMainExecutor(appContext))
    }

    fun release() {
        scope?.cancel()
        scope = null
        controller?.removeListener(listener)
        future?.let(MediaController::releaseFuture)
        future = null
        controller = null
    }

    private fun refresh(p: Player) {
        metadata = p.mediaMetadata
        currentMediaId = p.currentMediaItem?.mediaId
        isPlayingLocal = p.isPlaying
        durationMsLocal = p.duration.takeIf { it != C.TIME_UNSET }?.coerceAtLeast(0L) ?: 0L
        currentIndexLocal = p.currentMediaItemIndex
        localQueue = List(p.mediaItemCount) { p.getMediaItemAt(it) }
        shuffleOn = p.shuffleModeEnabled
        repeatMode = p.repeatMode
        volume = p.volume
    }

    private fun launchJam(block: suspend () -> Unit) {
        (scope ?: container.scope).launch { runCatching { block() } }
    }

    // ---- transport (jam-aware) ----

    /**
     * Replace the queue and play — or, inside a jam, add the songs to the
     * jam queue (tapping songs while jamming queues them for everyone).
     */
    fun play(songs: List<Song>, startIndex: Int, ctx: String?) {
        if (songs.isEmpty()) return
        if (inJam) {
            val picked = songs.drop(startIndex) + songs.take(startIndex)
            launchJam { container.jam.addSongs(picked) }
            return
        }
        val c = controller ?: return
        c.setMediaItems(songs.map { songItem(it, ctx) }, startIndex.coerceIn(0, songs.size - 1), 0L)
        c.prepare()
        c.play()
    }

    fun togglePlayPause() {
        jam?.let { j ->
            launchJam { if (j.playing) container.jam.pause() else container.jam.resume() }
            return
        }
        val c = controller ?: return
        if (c.isPlaying) c.pause() else c.play()
    }

    fun next() {
        if (inJam) { launchJam { container.jam.next() }; return }
        controller?.seekToNext()
    }

    fun previous() {
        if (inJam) { launchJam { container.jam.previous() }; return }
        controller?.seekToPrevious()
    }

    fun seekTo(ms: Long) {
        if (inJam) { launchJam { container.jam.seek(ms / 1000.0) }; return }
        controller?.seekTo(ms)
    }

    fun seekToItem(index: Int) {
        if (inJam) { launchJam { container.jam.playAt(index) }; return }
        controller?.seekTo(index, 0L)
    }

    fun toggleShuffle() {
        if (inJam) return // jams have no shuffle (server owns the order)
        controller?.let { it.shuffleModeEnabled = !it.shuffleModeEnabled }
    }

    fun cycleRepeat() {
        if (inJam) return
        controller?.let {
            it.repeatMode = when (it.repeatMode) {
                Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                else -> Player.REPEAT_MODE_OFF
            }
        }
    }

    fun updateVolume(v: Float) {
        controller?.volume = v.coerceIn(0f, 1f)
        volume = v.coerceIn(0f, 1f)
    }

    fun stop() {
        controller?.stop()
        controller?.clearMediaItems()
    }

    /** Everything needed to seed a jam from what's playing right now. */
    fun jamSeed(): Triple<List<Song>, Int, Pair<Double, Boolean>> {
        val songs = queueSongs
        val index = currentIndexLocal.coerceIn(0, (songs.size - 1).coerceAtLeast(0))
        return Triple(songs, index, (positionMs() / 1000.0) to isPlayingLocal)
    }
}
