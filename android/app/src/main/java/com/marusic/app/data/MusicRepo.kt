package com.marusic.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer

/**
 * All content access for the phone UI and the MediaLibraryService. The
 * library is cached whole (one /api/library call returns everything);
 * discovery endpoints get short TTL caches — the server caches harder.
 */
class MusicRepo(private val api: ApiClient) {

    private val songList = ListSerializer(Song.serializer())

    private fun <T> enc(ser: KSerializer<T>, value: T): String =
        api.json.encodeToString(ser, value)

    // ---- library (single source of truth for user collections) ----

    private val libMutex = Mutex()
    private val _library = MutableStateFlow<Library?>(null)
    val library: StateFlow<Library?> = _library

    suspend fun library(force: Boolean = false): Library = libMutex.withLock {
        _library.value.takeIf { !force && it != null }
            ?: api.get("/api/library", Library.serializer()).also { _library.value = it }
    }

    fun invalidate() {
        _library.value = null
        trending.clear()
        quickPicks.clear()
        mixes.clear()
        stations.clear()
    }

    // ---- discovery ----

    private class Ttl<T>(private val maxAgeMs: Long) {
        private var value: T? = null
        private var at = 0L
        fun get(): T? = value?.takeIf { System.currentTimeMillis() - at < maxAgeMs }
        fun set(v: T): T = v.also { value = it; at = System.currentTimeMillis() }
        fun clear() { value = null }
    }

    private val trending = Ttl<TrendingResponse>(30 * 60 * 1000L)
    // server caches these for 3 h per user; matching it keeps the shelf stable
    // across app restarts instead of reshuffling on every home visit.
    private val quickPicks = Ttl<QuickPicks>(3 * 60 * 60 * 1000L)
    private val mixes = Ttl<List<Mix>>(60 * 60 * 1000L)
    private val stations = Ttl<List<RadioStation>>(6 * 60 * 60 * 1000L)
    // play counts move slowly; an hour keeps the speed dial steady in a session
    private val topPlayed = Ttl<List<Song>>(60 * 60 * 1000L)

    suspend fun trending(): TrendingResponse =
        trending.get() ?: trending.set(api.get("/api/trending", TrendingResponse.serializer()))

    suspend fun quickPicks(): QuickPicks =
        quickPicks.get() ?: quickPicks.set(api.get("/api/quickpicks", QuickPicks.serializer()))

    /** The speed dial's fuel: your most-played tracks, by real play counts. */
    suspend fun topPlayed(): List<Song> =
        topPlayed.get() ?: topPlayed.set(api.get("/api/top-played?limit=12", ListSerializer(Song.serializer())))

    suspend fun mixes(): List<Mix> =
        mixes.get() ?: mixes.set(api.get("/api/mixes", MixesResponse.serializer()).mixes)

    suspend fun radioStations(): List<RadioStation> =
        stations.get() ?: stations.set(api.get("/api/radio/stations", ListSerializer(RadioStation.serializer())))

    suspend fun radioQueue(name: String, seed: String? = null): List<Song> {
        var path = "/api/radio/queue?name=${ApiClient.enc(name)}"
        if (!seed.isNullOrBlank()) path += "&seed=${ApiClient.enc(seed)}"
        return api.get(path, RadioQueue.serializer()).songs
    }

    suspend fun search(q: String): SearchResults =
        api.get("/api/search?q=${ApiClient.enc(q)}", SearchResults.serializer())

    suspend fun suggest(q: String): List<String> =
        api.get("/api/suggest?q=${ApiClient.enc(q)}", ListSerializer(String.serializer()))

    suspend fun album(token: String): AlbumDetail =
        api.get("/api/album/${ApiClient.enc(token)}", AlbumDetail.serializer())

    suspend fun artist(id: String): ArtistDetail =
        api.get("/api/artist/${ApiClient.enc(id)}", ArtistDetail.serializer())

    suspend fun publicPlaylist(browseId: String): PublicPlaylistDetail =
        api.get("/api/playlist/${ApiClient.enc(browseId)}", PublicPlaylistDetail.serializer())

    /** Automix continuation for a track — feeds queue-end autoplay. */
    suspend fun reco(songId: String): List<Song> =
        api.get("/api/reco/${ApiClient.enc(songId)}", songList)

    suspend fun lyrics(songId: String): Lyrics =
        api.get("/api/lyrics/${ApiClient.enc(songId)}", Lyrics.serializer())

    // ---- downloads ----

    suspend fun formats(songId: String): FormatsResponse =
        api.get("/api/formats/${ApiClient.enc(songId)}", FormatsResponse.serializer())

    suspend fun lossless(title: String, artist: String): LosslessInfo =
        api.get(
            "/api/lossless?title=${ApiClient.enc(title)}&artist=${ApiClient.enc(artist)}",
            LosslessInfo.serializer()
        )

    fun downloadUrl(songId: String, fmt: String, name: String): String =
        "${api.baseUrl.trimEnd('/')}/api/download/${ApiClient.enc(songId)}?fmt=${ApiClient.enc(fmt)}&name=${ApiClient.enc(name)}"

    fun losslessDownloadUrl(title: String, artist: String, name: String): String =
        "${api.baseUrl.trimEnd('/')}/api/download-lossless?title=${ApiClient.enc(title)}&artist=${ApiClient.enc(artist)}&name=${ApiClient.enc(name)}"

    // ---- mutations (each response refreshes the relevant library slice) ----

    suspend fun reportHistory(song: Song) {
        val history = api.post("/api/history", enc(SongBody.serializer(), SongBody(song)), songList)
        _library.value = _library.value?.copy(history = history)
    }

    suspend fun clearHistory() {
        api.delete("/api/history", songList)
        _library.value = _library.value?.copy(history = emptyList())
    }

    suspend fun toggleLike(song: Song): Boolean {
        val res = api.post("/api/liked/toggle", enc(SongBody.serializer(), SongBody(song)), LikedToggleResponse.serializer())
        _library.value = _library.value?.copy(liked = res.songs)
        return res.liked
    }

    suspend fun toggleAlbum(album: AlbumRef): Boolean {
        val res = api.post("/api/albums/toggle", enc(AlbumBody.serializer(), AlbumBody(album)), AlbumsToggleResponse.serializer())
        _library.value = _library.value?.copy(albums = res.albums)
        return res.saved
    }

    suspend fun toggleArtist(artist: ArtistRef): Boolean {
        val res = api.post("/api/artists/toggle", enc(ArtistBody.serializer(), ArtistBody(artist)), ArtistsToggleResponse.serializer())
        _library.value = _library.value?.copy(artists = res.artists)
        return res.followed
    }

    // ---- playlists ----

    suspend fun createPlaylist(name: String): UserPlaylist {
        val created = api.post("/api/playlists", enc(NameBody.serializer(), NameBody(name)), UserPlaylist.serializer())
        _library.value = _library.value?.let { it.copy(playlists = it.playlists + created) }
        return created
    }

    suspend fun addToPlaylist(playlistId: Long, song: Song): Boolean {
        val res = api.post("/api/playlists/$playlistId/songs", enc(SongBody.serializer(), SongBody(song)), AddSongResponse.serializer())
        res.playlist?.let(::replacePlaylist)
        return res.added
    }

    suspend fun removeFromPlaylist(playlistId: Long, songId: String) {
        replacePlaylist(
            api.delete("/api/playlists/$playlistId/songs/${ApiClient.enc(songId)}", UserPlaylist.serializer())
        )
    }

    suspend fun renamePlaylist(playlistId: Long, name: String) {
        replacePlaylist(
            api.put("/api/playlists/$playlistId", enc(NameBody.serializer(), NameBody(name)), UserPlaylist.serializer())
        )
    }

    suspend fun deletePlaylist(playlistId: Long) {
        api.deleteQuiet("/api/playlists/$playlistId")
        _library.value = _library.value?.let { lib ->
            lib.copy(playlists = lib.playlists.filterNot { it.id == playlistId })
        }
    }

    suspend fun reorderPlaylist(playlistId: Long, ids: List<String>) {
        replacePlaylist(
            api.put("/api/playlists/$playlistId/order", enc(IdsBody.serializer(), IdsBody(ids)), UserPlaylist.serializer())
        )
    }

    // ---- sharing / import / export ----

    suspend fun shareToken(playlistId: Long): String? =
        api.get("/api/playlists/$playlistId/share", ShareTokenResponse.serializer()).token

    suspend fun createShare(playlistId: Long): ShareTokenResponse =
        api.post("/api/playlists/$playlistId/share", "{}", ShareTokenResponse.serializer())

    suspend fun revokeShare(playlistId: Long) {
        api.deleteQuiet("/api/playlists/$playlistId/share")
    }

    suspend fun sharedPlaylist(token: String): SharedPlaylist =
        api.get("/api/shared/${ApiClient.enc(token)}", SharedPlaylist.serializer())

    suspend fun copyShared(token: String): UserPlaylist {
        val copied = api.post("/api/shared/${ApiClient.enc(token)}/copy", "{}", UserPlaylist.serializer())
        _library.value = _library.value?.let { it.copy(playlists = it.playlists + copied) }
        return copied
    }

    suspend fun exportPlaylistJson(playlistId: Long): String =
        api.getRaw("/api/playlists/$playlistId/export")

    suspend fun importPlaylist(name: String, songs: List<Song>): UserPlaylist {
        val imported = api.post(
            "/api/playlists/import",
            enc(ImportBody.serializer(), ImportBody(name, songs)),
            UserPlaylist.serializer()
        )
        _library.value = _library.value?.let { it.copy(playlists = it.playlists + imported) }
        return imported
    }

    // ---- account / admin ----

    suspend fun me(): MeResponse = api.get("/api/me", MeResponse.serializer())

    suspend fun changeName(name: String): String =
        api.post("/api/account/name", enc(NameBody.serializer(), NameBody(name)), NameChangeResponse.serializer()).name

    /** Server kills every cookie session on success; our device token survives. */
    suspend fun changePassword(current: String, next: String) {
        api.post(
            "/api/account/password",
            enc(PasswordBody.serializer(), PasswordBody(current, next)),
            OkResponse.serializer()
        )
    }

    suspend fun adminUsers(): AdminUsersResponse =
        api.get("/api/admin/users", AdminUsersResponse.serializer())

    /** Everyone on this instance — visible to non-admins too (no emails). */
    suspend fun members(): List<AdminUser> =
        api.get("/api/members", ListSerializer(AdminUser.serializer()))

    suspend fun adminInvite(email: String, name: String, role: String): InviteResponse =
        api.post("/api/admin/invite", enc(InviteBody.serializer(), InviteBody(email, name, role)), InviteResponse.serializer())

    suspend fun adminSetActive(userId: Long, active: Boolean) {
        api.post("/api/admin/user/$userId/active", enc(ActiveBody.serializer(), ActiveBody(active)), OkResponse.serializer())
    }

    suspend fun adminDeleteUser(userId: Long) {
        api.deleteQuiet("/api/admin/user/$userId")
    }

    private fun replacePlaylist(updated: UserPlaylist) {
        _library.value = _library.value?.let { lib ->
            lib.copy(playlists = lib.playlists.map { if (it.id == updated.id) updated else it })
        }
    }
}
