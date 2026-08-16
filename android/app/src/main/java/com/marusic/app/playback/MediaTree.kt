package com.marusic.app.playback

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.marusic.app.AppContainer
import com.marusic.app.data.Song

/**
 * Media id scheme shared by the browse tree, the phone UI, and queue
 * resolution. Playable songs encode their source container so a single tap
 * in the car can be expanded into the full sibling queue:
 *
 *   song/<videoId>|<containerId>    e.g. "song/dQw4w9WgXcQ|playlist/5"
 *
 * Container ids double as browse-tree node ids.
 */
object MediaIds {
    const val ROOT = "root"
    const val HOME = "home"
    const val LIBRARY = "library"
    const val RADIO = "radio"
    const val TRENDING = "home/trending"
    const val RELEASES = "home/releases"
    const val LIKED = "library/liked"
    const val HISTORY = "library/history"
    const val PLAYLISTS = "library/playlists"
    const val ALBUMS = "library/albums"
    const val ARTISTS = "library/artists"

    fun song(videoId: String, ctx: String?): String =
        if (ctx.isNullOrBlank()) "song/$videoId" else "song/$videoId|$ctx"

    fun playlist(id: Long) = "playlist/$id"
    fun album(token: String) = "album/$token"
    fun artist(id: String) = "artist/$id"
    fun mix(index: Int) = "mix/$index"
    fun station(name: String) = "station/$name"
    fun search(query: String) = "search/$query"
    fun ytPlaylist(browseId: String) = "ytpl/$browseId"

    /** "song/<vid>|<ctx>" -> (vid, ctx?) — null if not a song id. */
    fun parseSong(mediaId: String): Pair<String, String?>? {
        if (!mediaId.startsWith("song/")) return null
        val rest = mediaId.removePrefix("song/")
        val sep = rest.indexOf('|')
        return if (sep < 0) rest to null
        else rest.take(sep) to rest.substring(sep + 1).ifBlank { null }
    }
}

/**
 * The Android Auto browse tree. Root tabs: Home / Library / Radio. All data
 * comes from MusicRepo (which caches), so browsing stays snappy in the car.
 */
class MediaTree(private val container: AppContainer) {

    private val repo get() = container.repo

    // last search kept so onSearch + onGetSearchResult don't fetch twice
    @Volatile private var lastSearch: Pair<String, List<MediaItem>>? = null

    fun rootItem(): MediaItem = folder(MediaIds.ROOT, "marusic")

    suspend fun children(parentId: String): List<MediaItem>? = when {
        parentId == MediaIds.ROOT -> listOf(
            folder(MediaIds.HOME, "Home"),
            folder(MediaIds.LIBRARY, "Library", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_PLAYLISTS),
            folder(MediaIds.RADIO, "Radio", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS),
        )

        parentId == MediaIds.HOME -> buildList {
            add(folder(MediaIds.TRENDING, "Trending", playable = true))
            add(folder(MediaIds.RELEASES, "New releases", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_ALBUMS))
            runCatching { repo.mixes() }.getOrDefault(emptyList()).forEachIndexed { i, mix ->
                add(
                    folder(
                        MediaIds.mix(i), mix.title, subtitle = mix.basedOn, image = mix.image,
                        playable = true, mediaType = MediaMetadata.MEDIA_TYPE_PLAYLIST,
                    )
                )
            }
        }

        parentId == MediaIds.RELEASES -> repo.trending().releases.map { r ->
            folder(
                MediaIds.album(r.token), r.title, subtitle = r.artist, image = r.image,
                playable = true, mediaType = MediaMetadata.MEDIA_TYPE_ALBUM,
            )
        }

        parentId == MediaIds.LIBRARY -> listOf(
            folder(MediaIds.LIKED, "Liked Songs", playable = true, mediaType = MediaMetadata.MEDIA_TYPE_PLAYLIST),
            folder(MediaIds.HISTORY, "Recently Played", playable = true, mediaType = MediaMetadata.MEDIA_TYPE_PLAYLIST),
            folder(MediaIds.PLAYLISTS, "Playlists", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_PLAYLISTS),
            folder(MediaIds.ALBUMS, "Albums", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_ALBUMS),
            folder(MediaIds.ARTISTS, "Artists", mediaType = MediaMetadata.MEDIA_TYPE_FOLDER_ARTISTS),
        )

        parentId == MediaIds.PLAYLISTS -> repo.library().playlists.map { p ->
            folder(
                MediaIds.playlist(p.id), p.name, subtitle = "${p.songs.size} songs",
                image = p.songs.firstOrNull()?.image,
                playable = true, mediaType = MediaMetadata.MEDIA_TYPE_PLAYLIST,
            )
        }

        parentId == MediaIds.ALBUMS -> repo.library().albums.map { a ->
            folder(
                MediaIds.album(a.token), a.title, subtitle = a.artist, image = a.image,
                playable = true, mediaType = MediaMetadata.MEDIA_TYPE_ALBUM,
            )
        }

        parentId == MediaIds.ARTISTS -> repo.library().artists.map { a ->
            folder(
                MediaIds.artist(a.id), a.name, image = a.image,
                playable = true, mediaType = MediaMetadata.MEDIA_TYPE_ARTIST,
            )
        }

        parentId == MediaIds.RADIO -> repo.radioStations().map { s ->
            MediaItem.Builder()
                .setMediaId(MediaIds.station(s.name))
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(s.name)
                        .setIsBrowsable(false)
                        .setIsPlayable(true)
                        .setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION)
                        .build()
                )
                .build()
        }

        else -> songsForContainer(parentId)?.map { songItem(it, parentId) }
    }

    suspend fun item(mediaId: String): MediaItem? {
        MediaIds.parseSong(mediaId)?.let { (vid, ctx) ->
            return songForId(vid, ctx)?.let { songItem(it, ctx) }
        }
        // cheap non-exhaustive lookup: enough for the hosts that call it
        return when (mediaId) {
            MediaIds.ROOT -> rootItem()
            MediaIds.HOME -> folder(MediaIds.HOME, "Home")
            MediaIds.LIBRARY -> folder(MediaIds.LIBRARY, "Library")
            MediaIds.RADIO -> folder(MediaIds.RADIO, "Radio")
            else -> null
        }
    }

    /** Voice/search results for the car: songs only. */
    suspend fun search(query: String): List<MediaItem> {
        lastSearch?.let { (q, items) -> if (q == query) return items }
        val ctx = MediaIds.search(query)
        val items = repo.search(query).songs.map { songItem(it, ctx) }
        lastSearch = query to items
        return items
    }

    /**
     * The queue a container id expands to — null when the id isn't a
     * playable container. This is what turns one tapped song into its
     * album/playlist/mix/station siblings.
     */
    suspend fun songsForContainer(ctx: String): List<Song>? = when {
        ctx == MediaIds.TRENDING -> repo.trending().singles
        ctx == MediaIds.LIKED -> repo.library().liked
        ctx == MediaIds.HISTORY -> repo.library().history
        ctx.startsWith("mix/") -> {
            val i = ctx.removePrefix("mix/").toIntOrNull() ?: -1
            repo.mixes().getOrNull(i)?.songs
        }
        ctx.startsWith("playlist/") -> {
            val id = ctx.removePrefix("playlist/").toLongOrNull()
            repo.library().playlists.firstOrNull { it.id == id }?.songs
        }
        ctx.startsWith("album/") -> repo.album(ctx.removePrefix("album/")).songs
        ctx.startsWith("artist/") -> repo.artist(ctx.removePrefix("artist/")).songs
        ctx.startsWith("station/") -> repo.radioQueue(ctx.removePrefix("station/"))
        ctx.startsWith("search/") -> repo.search(ctx.removePrefix("search/")).songs
        ctx.startsWith("reco/") -> repo.reco(ctx.removePrefix("reco/"))
        ctx.startsWith("ytpl/") -> repo.publicPlaylist(ctx.removePrefix("ytpl/")).songs
        else -> null
    }

    suspend fun songForId(videoId: String, ctx: String?): Song? {
        if (ctx != null) {
            runCatching { songsForContainer(ctx) }.getOrNull()
                ?.firstOrNull { it.id == videoId }?.let { return it }
        }
        val lib = runCatching { repo.library() }.getOrNull() ?: return null
        return (lib.liked.asSequence() + lib.history.asSequence() +
                lib.playlists.asSequence().flatMap { it.songs.asSequence() })
            .firstOrNull { it.id == videoId }
    }

    /** Fully-resolved item the player can load (URI + metadata). */
    fun playable(song: Song, ctx: String?): MediaItem =
        MediaItem.Builder()
            .setMediaId(MediaIds.song(song.id, ctx))
            .setUri(container.api.streamUrl(song.id, container.quality))
            .setMediaMetadata(songMetadata(song))
            .build()

    private fun folder(
        id: String,
        title: String,
        subtitle: String? = null,
        image: String? = null,
        playable: Boolean = false,
        mediaType: Int = MediaMetadata.MEDIA_TYPE_FOLDER_MIXED,
    ): MediaItem =
        MediaItem.Builder()
            .setMediaId(id)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setArtworkUri(image?.takeIf { it.isNotBlank() }?.let(Uri::parse))
                    .setIsBrowsable(true)
                    .setIsPlayable(playable)
                    .setMediaType(mediaType)
                    .build()
            )
            .build()
}

// Top level so the phone UI builds identical queue items to the browse tree.

/** Browse/queue entry for a song (no URI — those never cross the binder). */
fun songItem(song: Song, ctx: String?): MediaItem =
    MediaItem.Builder()
        .setMediaId(MediaIds.song(song.id, ctx))
        .setMediaMetadata(songMetadata(song))
        .build()

fun songMetadata(song: Song): MediaMetadata =
    MediaMetadata.Builder()
        .setTitle(song.title.ifBlank { "Unknown Title" })
        .setArtist(song.artist)
        .setSubtitle(song.artist)
        .setAlbumTitle(song.album)
        .setArtworkUri(song.image.takeIf { it.isNotBlank() }?.let(Uri::parse))
        .setIsBrowsable(false)
        .setIsPlayable(true)
        .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        // artistId rides along so the phone UI can jump to the artist page
        .setExtras(Bundle().apply { putString("artistId", song.artistId) })
        .build()
