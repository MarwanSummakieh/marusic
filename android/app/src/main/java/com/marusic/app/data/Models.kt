package com.marusic.app.data

import kotlinx.serialization.Serializable

// Shapes mirror the marusic server's JSON (server.js / lib/db.js / lib/jam.js).
// Every field except ids gets a default so partial snapshots parse; unknown
// fields are ignored globally in ApiClient's Json config.

@Serializable
data class Song(
    val id: String,
    val title: String = "",
    val artist: String = "",
    val artistId: String = "",
    val album: String = "",
    val duration: Int = 0,
    val image: String = "",
)

@Serializable
data class AlbumRef(
    val token: String = "",
    val kind: String = "",
    val title: String = "",
    val artist: String = "",
    val year: String = "",
    val image: String = "",
)

@Serializable
data class ArtistRef(
    val id: String = "",
    val name: String = "",
    val image: String = "",
)

@Serializable
data class PublicPlaylistRef(
    val browseId: String = "",
    val title: String = "",
    val author: String = "",
    val image: String = "",
)

@Serializable
data class SearchResults(
    val songs: List<Song> = emptyList(),
    val albums: List<AlbumRef> = emptyList(),
    val artists: List<ArtistRef> = emptyList(),
    val playlists: List<PublicPlaylistRef> = emptyList(),
)

@Serializable
data class TrendingResponse(
    val singles: List<Song> = emptyList(),
    val releases: List<AlbumRef> = emptyList(),
)

@Serializable
data class AlbumDetail(
    val title: String = "",
    val artist: String = "",
    val year: String = "",
    val image: String = "",
    val songs: List<Song> = emptyList(),
)

@Serializable
data class ArtistDetail(
    val id: String = "",
    val name: String = "",
    val image: String = "",
    val description: String = "",
    val songs: List<Song> = emptyList(),
    val albums: List<AlbumRef> = emptyList(),
    val singles: List<AlbumRef> = emptyList(),
    val related: List<ArtistRef> = emptyList(),
)

@Serializable
data class PublicPlaylistDetail(
    val browseId: String = "",
    val title: String = "",
    val author: String = "",
    val image: String = "",
    val songs: List<Song> = emptyList(),
)

@Serializable
data class UserPlaylist(
    val id: Long,
    val name: String = "",
    val createdAt: Long = 0,
    val songs: List<Song> = emptyList(),
)

@Serializable
data class Library(
    val playlists: List<UserPlaylist> = emptyList(),
    val liked: List<Song> = emptyList(),
    val history: List<Song> = emptyList(),
    val albums: List<AlbumRef> = emptyList(),
    val artists: List<ArtistRef> = emptyList(),
)

@Serializable
data class Mix(
    val id: String = "",
    val title: String = "",
    val basedOn: String = "",
    val image: String = "",
    val songs: List<Song> = emptyList(),
)

@Serializable
data class MixesResponse(val mixes: List<Mix> = emptyList())

@Serializable
data class QuickPicks(
    val songs: List<Song> = emptyList(),
    /** false when the server fell back to trending — no play history to seed from yet. */
    val seeded: Boolean = false,
)

@Serializable
data class RadioStation(val name: String = "", val color: String = "", val image: String = "")

@Serializable
data class RadioQueue(val songs: List<Song> = emptyList(), val next: Int = 0)

@Serializable
data class Lyrics(val lyrics: String = "", val source: String = "")

// ---- downloads ----

@Serializable
data class TrackFormat(
    val id: String = "",
    val ext: String = "",
    val codec: String = "",
    val abr: Double = 0.0,
    val size: Long = 0,
    val lossless: Boolean = false,
    val note: String = "",
)

@Serializable
data class FormatsResponse(
    val formats: List<TrackFormat> = emptyList(),
    val hasLossless: Boolean = false,
)

@Serializable
data class LosslessInfo(
    val available: Boolean = false,
    val provider: String = "",
    val bitDepth: Int = 16,
    val sampleRate: Double = 44.1,
    val matchedTitle: String = "",
    val matchedArtist: String = "",
)

// ---- sharing / import ----

@Serializable
data class ShareTokenResponse(val token: String? = null, val url: String? = null)

@Serializable
data class SharedPlaylist(
    val name: String = "",
    val owner: String = "",
    val songs: List<Song> = emptyList(),
)

/** Shape of a `.marusic.json` export (also what import accepts). */
@Serializable
data class PlaylistExport(
    val app: String = "",
    val name: String = "",
    val exportedAt: String = "",
    val songs: List<Song> = emptyList(),
)

// ---- auth / account / admin ----

@Serializable
data class OkResponse(val ok: Boolean = false)

@Serializable
data class HealthResponse(val ok: Boolean = false, val app: String = "")

@Serializable
data class LoginUser(val name: String = "", val role: String = "")

@Serializable
data class LoginResponse(val ok: Boolean = false, val user: LoginUser? = null)

@Serializable
data class DeviceTokenResponse(val id: Long = 0, val name: String = "", val token: String = "")

@Serializable
data class MeResponse(val name: String = "", val email: String = "", val role: String = "")

@Serializable
data class NameChangeResponse(val ok: Boolean = false, val name: String = "")

@Serializable
data class AdminUser(
    val id: Long = 0,
    val email: String = "",
    val name: String = "",
    val role: String = "",
    val active: Int = 1,
    val created: Long = 0,
)

@Serializable
data class AdminInvite(
    val token: String = "",
    val email: String = "",
    val name: String = "",
    val role: String = "",
    val used: Int = 0,
    val created: Long = 0,
)

@Serializable
data class AdminUsersResponse(
    val users: List<AdminUser> = emptyList(),
    val invites: List<AdminInvite> = emptyList(),
)

@Serializable
data class InviteResponse(val token: String = "", val url: String = "")

// ---- mutation responses ----

@Serializable
data class LikedToggleResponse(val liked: Boolean = false, val songs: List<Song> = emptyList())

@Serializable
data class AlbumsToggleResponse(val saved: Boolean = false, val albums: List<AlbumRef> = emptyList())

@Serializable
data class ArtistsToggleResponse(val followed: Boolean = false, val artists: List<ArtistRef> = emptyList())

@Serializable
data class AddSongResponse(val added: Boolean = false, val playlist: UserPlaylist? = null)

// ---- jam (lib/jam.js wire formats) ----

@Serializable
data class JamMember(
    val id: Long = 0,
    val name: String = "",
    val host: Boolean = false,
    val connected: Boolean = false,
)

@Serializable
data class JamSettings(val guestsControl: Boolean = true, val autoplay: Boolean = true)

@Serializable
data class JamYou(val id: Long = 0, val isHost: Boolean = false, val canControl: Boolean = true)

@Serializable
data class JamSnapshot(
    val code: String = "",
    val hostId: Long = 0,
    val speakerId: String = "",
    val speakerOnline: Boolean = false,
    val you: JamYou = JamYou(),
    val members: List<JamMember> = emptyList(),
    val settings: JamSettings = JamSettings(),
    val queue: List<Song> = emptyList(),
    val index: Int = -1,
    val playing: Boolean = false,
    val pos: Double = 0.0,
    val at: Long = 0,
    val now: Long = 0,
)

@Serializable
data class JamWrapper(val jam: JamSnapshot? = null)

@Serializable
data class JamPeek(
    val code: String = "",
    val host: String = "",
    val members: Int = 0,
    val current: Song? = null,
    val playing: Boolean = false,
)

@Serializable
data class JamSyncEvent(
    val index: Int = -1,
    val playing: Boolean = false,
    val pos: Double = 0.0,
    val at: Long = 0,
    val now: Long = 0,
)

@Serializable
data class JamNote(val type: String = "", val name: String = "", val left: String = "")

@Serializable
data class JamMembersEvent(
    val hostId: Long = 0,
    val speakerId: String = "",
    val speakerOnline: Boolean = false,
    val members: List<JamMember> = emptyList(),
    val note: JamNote? = null,
)

@Serializable
data class JamQueueEvent(
    val queue: List<Song> = emptyList(),
    val index: Int = -1,
    val added: Int = 0,
    val by: String = "",
)

@Serializable
data class JamSettingsEvent(val settings: JamSettings = JamSettings())

// ---- request bodies ----

@Serializable
data class SongBody(val song: Song)

@Serializable
data class SongsBody(val songs: List<Song>)

@Serializable
data class AlbumBody(val album: AlbumRef)

@Serializable
data class ArtistBody(val artist: ArtistRef)

@Serializable
data class NameBody(val name: String)

@Serializable
data class LoginBody(val email: String, val password: String)

@Serializable
data class PasswordBody(val current: String, val next: String)

@Serializable
data class IdsBody(val ids: List<String>)

@Serializable
data class ImportBody(val name: String, val songs: List<Song>)

@Serializable
data class ActiveBody(val active: Boolean)

@Serializable
data class InviteBody(val email: String, val name: String, val role: String)

@Serializable
data class CodeBody(val code: String)

@Serializable
data class UserIdBody(val userId: Long)

@Serializable
data class DeviceBody(val deviceId: String)

@Serializable
data class JamCreateBody(
    val queue: List<Song> = emptyList(),
    val index: Int = 0,
    val pos: Double = 0.0,
    val playing: Boolean = false,
    val deviceId: String = "",
)

@Serializable
data class JamSettingsBody(val guestsControl: Boolean? = null, val autoplay: Boolean? = null)

@Serializable
data class PlayIndexBody(val index: Int? = null)

@Serializable
data class SeekBody(val pos: Double)

@Serializable
data class EndedBody(val index: Int, val deviceId: String)
