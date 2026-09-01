package com.marusic.app.playback

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.marusic.app.AppContainer
import com.marusic.app.appContainer
import com.marusic.app.data.Song
import com.marusic.app.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future
import kotlinx.coroutines.launch
import okhttp3.Request

/**
 * The one player in the app. The phone UI attaches a MediaController; the
 * Android Auto host binds as a MediaBrowser and renders [MediaTree]. Both see
 * the same queue and state.
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaLibraryService() {

    private lateinit var container: AppContainer
    private lateinit var tree: MediaTree
    private lateinit var player: ExoPlayer
    private lateinit var session: MediaLibrarySession

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // history is reported once per item, after duration is known
    private var pendingHistory: MediaItem? = null
    private var lastRecoSeed: String? = null

    override fun onCreate() {
        super.onCreate()
        container = appContainer
        tree = MediaTree(container)

        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("marusic-android")
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(60_000)
            .setAllowCrossProtocolRedirects(true)
        // The device token can rotate (sign out / back in), so attach it per
        // request instead of baking it into the factory.
        val authFactory = ResolvingDataSource.Factory(httpFactory) { spec ->
            container.api.bearer
                ?.let { spec.withAdditionalHeaders(mapOf("Authorization" to "Bearer $it")) }
                ?: spec
        }

        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(authFactory))
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        player.addListener(PlayerEvents())

        val sessionActivity = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        session = MediaLibrarySession.Builder(this, player, LibraryCallback())
            .setSessionActivity(sessionActivity)
            .build()

        // jam sync drives this player directly whenever this device is one of
        // the ones making sound (the speaker, or any device in listen together)
        container.jam.player = player
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession = session

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!player.playWhenReady || player.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        container.jam.player = null
        scope.cancel()
        session.release()
        player.release()
        super.onDestroy()
    }

    // ------------------------------------------------------------------ //

    private inner class PlayerEvents : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            pendingHistory = mediaItem
            prefetchNext()
            maybeExtendQueue()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) reportPendingHistory()
            // Single-item shared playback: the server schedules the track
            // boundary itself, so this is only a fallback report — JamManager
            // drops it unless the boundary is actually due.
            if (playbackState == Player.STATE_ENDED) container.jam.notifyTrackEnded()
        }
    }

    private fun reportPendingHistory() {
        val item = pendingHistory ?: return
        pendingHistory = null
        val (vid, _) = MediaIds.parseSong(item.mediaId) ?: return
        val song = songFromMetadata(vid, item.mediaMetadata, player.duration)
        scope.launch {
            runCatching { container.repo.reportHistory(song) }
        }
    }

    /**
     * Warm the next track: a 2-byte ranged request makes the server resolve
     * and cache the yt-dlp stream URL (up to ~45 s cold), so skipping ahead
     * in the car starts near-instantly. Same trick the web client uses.
     */
    private fun prefetchNext() {
        val next = player.currentMediaItemIndex + 1
        if (next >= player.mediaItemCount) return
        val (vid, _) = MediaIds.parseSong(player.getMediaItemAt(next).mediaId) ?: return
        val token = container.api.bearer ?: return
        val url = container.api.streamUrl(vid, container.quality)
        scope.launch(Dispatchers.IO) {
            runCatching {
                val req = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .header("Range", "bytes=0-1")
                    .build()
                container.api.http.newCall(req).execute().use { it.body?.bytes() }
            }
        }
    }

    /** Autoplay: when the last queue item starts, append its recommendations. */
    private fun maybeExtendQueue() {
        if (!container.autoplay) return
        if (container.jam.active) return // shared sessions refill server-side
        if (player.currentMediaItemIndex < player.mediaItemCount - 1) return
        val current = player.currentMediaItem ?: return
        val (vid, _) = MediaIds.parseSong(current.mediaId) ?: return
        if (vid == lastRecoSeed) return
        lastRecoSeed = vid
        scope.launch {
            val recos = runCatching { container.repo.reco(vid) }.getOrDefault(emptyList())
            if (recos.isEmpty()) return@launch
            val queued = (0 until player.mediaItemCount)
                .mapNotNull { MediaIds.parseSong(player.getMediaItemAt(it).mediaId)?.first }
                .toSet()
            val items = recos.filter { it.id !in queued }.take(15).map { tree.playable(it, "reco/$vid") }
            // re-check: the user may have queued something while we fetched
            if (items.isNotEmpty() && player.currentMediaItemIndex == player.mediaItemCount - 1) {
                player.addMediaItems(items)
            }
        }
    }

    private fun songFromMetadata(videoId: String, meta: MediaMetadata, durationMs: Long): Song = Song(
        id = videoId,
        title = meta.title?.toString().orEmpty(),
        artist = meta.artist?.toString().orEmpty(),
        album = meta.albumTitle?.toString().orEmpty(),
        duration = if (durationMs > 0 && durationMs != C.TIME_UNSET) (durationMs / 1000).toInt() else 0,
        image = meta.artworkUri?.toString().orEmpty(),
    )

    // ------------------------------------------------------------------ //

    private inner class LibraryCallback : MediaLibrarySession.Callback {

        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> {
            // no playback-resumption tree (yet) — refuse "recent" roots
            if (params?.isRecent == true) {
                return Futures.immediateFuture(
                    LibraryResult.ofError<MediaItem>(LibraryResult.RESULT_ERROR_NOT_SUPPORTED)
                )
            }
            return Futures.immediateFuture(LibraryResult.ofItem(tree.rootItem(), params))
        }

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = scope.future {
            val children = runCatching { tree.children(parentId) }.getOrNull()
            if (children == null) {
                LibraryResult.ofError<ImmutableList<MediaItem>>(LibraryResult.RESULT_ERROR_BAD_VALUE)
            } else {
                LibraryResult.ofItemList(ImmutableList.copyOf(children), params)
            }
        }

        override fun onGetItem(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> = scope.future {
            runCatching { tree.item(mediaId) }.getOrNull()
                ?.let { LibraryResult.ofItem(it, null) }
                ?: LibraryResult.ofError<MediaItem>(LibraryResult.RESULT_ERROR_BAD_VALUE)
        }

        override fun onSearch(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<Void>> = scope.future {
            val count = runCatching { tree.search(query).size }.getOrDefault(0)
            session.notifySearchResultChanged(browser, query, count, params)
            LibraryResult.ofVoid(params)
        }

        override fun onGetSearchResult(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = scope.future {
            val items = runCatching { tree.search(query) }.getOrDefault(emptyList())
            LibraryResult.ofItemList(ImmutableList.copyOf(items), params)
        }

        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> = scope.future {
            resolveQueue(mediaItems, startIndex, startPositionMs)
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
        ): ListenableFuture<List<MediaItem>> = scope.future {
            mediaItems.mapNotNull { resolveOne(it) }
        }
    }

    /**
     * Items arriving from any controller lost their URIs at the binder, and a
     * car tap is a single item that should become a whole container queue:
     *  - voice search  -> top matching songs
     *  - song|ctx      -> all ctx siblings, starting at that song
     *  - container id  -> its songs (station, mix, playlist, album, artist)
     *  - full queues from the phone UI -> resolved 1:1
     */
    private suspend fun resolveQueue(
        items: List<MediaItem>,
        startIndex: Int,
        startPositionMs: Long,
    ): MediaSession.MediaItemsWithStartPosition {
        if (items.size == 1) {
            val one = items.first()

            val query = one.requestMetadata.searchQuery
            if (!query.isNullOrBlank()) {
                val songs = runCatching { container.repo.search(query).songs }.getOrDefault(emptyList())
                val ctx = MediaIds.search(query)
                return MediaSession.MediaItemsWithStartPosition(
                    songs.take(25).map { tree.playable(it, ctx) }, 0, 0L
                )
            }

            val parsed = MediaIds.parseSong(one.mediaId)
            if (parsed != null) {
                val (vid, ctx) = parsed
                if (ctx != null && !ctx.startsWith("search/")) {
                    val songs = runCatching { tree.songsForContainer(ctx) }.getOrNull().orEmpty()
                    val at = songs.indexOfFirst { it.id == vid }
                    if (at >= 0) {
                        return MediaSession.MediaItemsWithStartPosition(
                            songs.map { tree.playable(it, ctx) }, at, startPositionMs.coerceAtLeast(0L)
                        )
                    }
                }
                resolveOne(one)?.let {
                    return MediaSession.MediaItemsWithStartPosition(listOf(it), 0, startPositionMs.coerceAtLeast(0L))
                }
            } else {
                // a playable container tapped directly (station/mix/playlist/…)
                val songs = runCatching { tree.songsForContainer(one.mediaId) }.getOrNull().orEmpty()
                if (songs.isNotEmpty()) {
                    return MediaSession.MediaItemsWithStartPosition(
                        songs.map { tree.playable(it, one.mediaId) }, 0, 0L
                    )
                }
            }
            return MediaSession.MediaItemsWithStartPosition(emptyList(), 0, 0L)
        }

        val resolved = items.mapNotNull { resolveOne(it) }
        val at = if (startIndex == C.INDEX_UNSET) 0
        else startIndex.coerceIn(0, (resolved.size - 1).coerceAtLeast(0))
        return MediaSession.MediaItemsWithStartPosition(resolved, at, startPositionMs.coerceAtLeast(0L))
    }

    private suspend fun resolveOne(item: MediaItem): MediaItem? {
        val (vid, ctx) = MediaIds.parseSong(item.mediaId) ?: return null
        // MediaMetadata crosses the binder intact — only the URI is stripped.
        if (item.mediaMetadata.title != null) {
            return item.buildUpon()
                .setUri(container.api.streamUrl(vid, container.quality))
                .build()
        }
        val song = runCatching { tree.songForId(vid, ctx) }.getOrNull() ?: Song(id = vid)
        return tree.playable(song, ctx)
    }
}
