@file:OptIn(ExperimentalMaterial3Api::class)

package com.marusic.app.ui.screens

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.Lyrics
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.data.AlbumRef
import com.marusic.app.data.ArtistRef
import com.marusic.app.data.PlaylistExport
import com.marusic.app.data.Song
import com.marusic.app.playback.MediaIds
import com.marusic.app.ui.AddToPlaylistDialog
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.Load
import com.marusic.app.ui.LoadContent
import com.marusic.app.ui.MediaCard
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.ScreenTitle
import com.marusic.app.ui.SectionTitle
import com.marusic.app.ui.SongMenu
import com.marusic.app.ui.SongRow
import com.marusic.app.ui.formatTimeMs
import com.marusic.app.ui.openAlbum
import com.marusic.app.ui.openArtist
import com.marusic.app.ui.openPlaylist
import com.marusic.app.ui.openPublicPlaylist
import com.marusic.app.ui.openShared
import com.marusic.app.ui.rememberLoad
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// ---------------------------------------------------------------- Login ----

@Composable
fun LoginScreen() {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()

    var url by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        if (url.isBlank()) url = container.settings.snapshot().baseUrl
    }

    Column(
        Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "marusic",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            "Sign in to your server",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            label = { Text("Server URL") },
            placeholder = { Text("https://music.example.com") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            modifier = Modifier.fillMaxWidth(),
        )
        error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(18.dp))
        Button(
            enabled = !busy && url.isNotBlank() && email.isNotBlank() && password.isNotEmpty(),
            onClick = {
                busy = true
                error = null
                scope.launch {
                    try {
                        val base = normalizeBase(url)
                        container.api.health(base)
                        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android" }
                        val res = container.api.signIn(base, email.trim(), password, deviceName)
                        container.settings.saveLogin(base, res.token.token, res.token.id, res.userName, res.userRole)
                    } catch (e: Exception) {
                        error = e.message ?: "Sign-in failed"
                    } finally {
                        busy = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (busy) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            } else {
                Text("Sign in")
            }
        }
    }
}

private fun normalizeBase(raw: String): String {
    val t = raw.trim().trimEnd('/')
    return if (t.startsWith("http://") || t.startsWith("https://")) t else "https://$t"
}

// --------------------------------------------------------------- Search ----

@Composable
fun SearchScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val focus = LocalFocusManager.current

    var query by rememberSaveable { mutableStateOf("") }
    var submitted by rememberSaveable { mutableStateOf<String?>(null) }
    var suggestions by remember { mutableStateOf<List<String>>(emptyList()) }
    var retry by remember { mutableIntStateOf(0) }

    LaunchedEffect(query) {
        if (query.isBlank() || query == submitted) {
            suggestions = emptyList()
            return@LaunchedEffect
        }
        delay(250)
        suggestions = runCatching { container.repo.suggest(query) }.getOrDefault(emptyList())
    }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Songs, albums, artists…") },
            leadingIcon = { Icon(Icons.Rounded.Search, null) },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = { query = ""; submitted = null }) {
                        Icon(Icons.Rounded.Close, "Clear")
                    }
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {
                if (query.isNotBlank()) {
                    submitted = query
                    suggestions = emptyList()
                    focus.clearFocus()
                }
            }),
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )

        val sub = submitted
        when {
            sub == null && suggestions.isNotEmpty() -> {
                LazyColumn {
                    items(suggestions) { s ->
                        Text(
                            s,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    query = s
                                    submitted = s
                                    suggestions = emptyList()
                                    focus.clearFocus()
                                }
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                        )
                    }
                }
            }

            sub != null -> {
                val load = rememberLoad(sub, retry) { container.repo.search(sub) }
                LoadContent(load, onRetry = { retry++ }) { results ->
                    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
                        if (results.songs.isNotEmpty()) {
                            item { SectionTitle("Songs") }
                            itemsIndexed(results.songs) { i, song ->
                                SongRow(
                                    song,
                                    isCurrent = pc.currentSong?.id == song.id,
                                    onClick = { pc.play(results.songs, i, MediaIds.search(sub)) },
                                )
                            }
                        }
                        if (results.albums.isNotEmpty()) {
                            item { SectionTitle("Albums") }
                            item {
                                LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                                    items(results.albums) { a ->
                                        MediaCard(a.title, a.artist, a.image) { nav.openAlbum(a.token) }
                                    }
                                }
                            }
                        }
                        if (results.artists.isNotEmpty()) {
                            item { SectionTitle("Artists") }
                            item {
                                LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                                    items(results.artists) { a ->
                                        MediaCard(a.name, null, a.image, round = true) { nav.openArtist(a.id) }
                                    }
                                }
                            }
                        }
                        if (results.playlists.isNotEmpty()) {
                            item { SectionTitle("Playlists") }
                            item {
                                LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                                    items(results.playlists) { p ->
                                        MediaCard(p.title, p.author, p.image) { nav.openPublicPlaylist(p.browseId) }
                                    }
                                }
                            }
                        }
                        if (results.songs.isEmpty() && results.albums.isEmpty() &&
                            results.artists.isEmpty() && results.playlists.isEmpty()
                        ) {
                            item {
                                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                                    Text("No results", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------- Detail header ----

@Composable
internal fun DetailHeader(
    nav: NavHostController,
    image: String?,
    title: String,
    subtitle: String?,
    round: Boolean = false,
    onPlay: (() -> Unit)?,
    actions: @Composable () -> Unit = {},
) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back")
            }
            Spacer(Modifier.weight(1f))
            actions()
        }
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Artwork(
                image,
                Modifier.size(168.dp),
                shape = if (round) CircleShape else RoundedCornerShape(10.dp),
            )
            Spacer(Modifier.height(14.dp))
            Text(
                title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (onPlay != null) {
                Spacer(Modifier.height(12.dp))
                Button(onClick = onPlay) {
                    Icon(Icons.Rounded.PlayArrow, null)
                    Spacer(Modifier.width(6.dp))
                    Text("Play")
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

// ------------------------------------------------------- User playlist ----

@Composable
fun PlaylistScreen(pc: PlayerConnection, nav: NavHostController, playlistId: Long) {
    val context = LocalContext.current
    val container = context.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()

    LaunchedEffect(Unit) { runCatching { container.repo.library() } }

    val playlist = library?.playlists?.firstOrNull { it.id == playlistId }
    var showRename by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }
    var showShare by remember { mutableStateOf(false) }
    var pendingExport by remember { mutableStateOf<String?>(null) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        val text = pendingExport
        pendingExport = null
        if (uri != null && text != null) {
            scope.launch(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(text) }
                }
            }
        }
    }

    if (playlist == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    val ctx = MediaIds.playlist(playlistId)
    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            var menu by remember { mutableStateOf(false) }
            DetailHeader(
                nav = nav,
                image = playlist.songs.firstOrNull()?.image,
                title = playlist.name,
                subtitle = "${playlist.songs.size} songs",
                onPlay = if (playlist.songs.isNotEmpty()) {
                    { pc.play(playlist.songs, 0, ctx) }
                } else null,
                actions = {
                    Box {
                        IconButton(onClick = { menu = true }) { Icon(Icons.Rounded.MoreVert, "More") }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            DropdownMenuItem(text = { Text("Share") }, onClick = { menu = false; showShare = true })
                            DropdownMenuItem(text = { Text("Export (.marusic.json)") }, onClick = {
                                menu = false
                                scope.launch {
                                    runCatching {
                                        pendingExport = container.repo.exportPlaylistJson(playlistId)
                                        exportLauncher.launch("${playlist.name}.marusic.json")
                                    }
                                }
                            })
                            DropdownMenuItem(text = { Text("Rename") }, onClick = { menu = false; showRename = true })
                            DropdownMenuItem(text = { Text("Delete") }, onClick = { menu = false; showDelete = true })
                        }
                    }
                },
            )
        }
        itemsIndexed(playlist.songs, key = { _, s -> s.id }) { i, song ->
            SongRow(
                song,
                isCurrent = pc.currentSong?.id == song.id,
                onClick = { pc.play(playlist.songs, i, ctx) },
                trailing = {
                    SongMenu(song) { dismiss ->
                        if (i > 0) {
                            DropdownMenuItem(
                                text = { Text("Move up") },
                                leadingIcon = { Icon(Icons.Rounded.ArrowUpward, null) },
                                onClick = {
                                    dismiss()
                                    scope.launch {
                                        runCatching {
                                            container.repo.reorderPlaylist(playlistId, moveId(playlist.songs, i, i - 1))
                                        }
                                    }
                                },
                            )
                        }
                        if (i < playlist.songs.size - 1) {
                            DropdownMenuItem(
                                text = { Text("Move down") },
                                leadingIcon = { Icon(Icons.Rounded.ArrowDownward, null) },
                                onClick = {
                                    dismiss()
                                    scope.launch {
                                        runCatching {
                                            container.repo.reorderPlaylist(playlistId, moveId(playlist.songs, i, i + 1))
                                        }
                                    }
                                },
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("Remove from playlist") },
                            onClick = {
                                dismiss()
                                scope.launch { runCatching { container.repo.removeFromPlaylist(playlistId, song.id) } }
                            },
                        )
                    }
                },
            )
        }
    }

    if (showRename) {
        var name by remember { mutableStateOf(playlist.name) }
        AlertDialog(
            onDismissRequest = { showRename = false },
            title = { Text("Rename playlist") },
            text = { OutlinedTextField(name, { name = it }, singleLine = true) },
            confirmButton = {
                TextButton(
                    enabled = name.isNotBlank(),
                    onClick = {
                        scope.launch { runCatching { container.repo.renamePlaylist(playlistId, name.trim()) } }
                        showRename = false
                    },
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showRename = false }) { Text("Cancel") } },
        )
    }

    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("Delete \"${playlist.name}\"?") },
            confirmButton = {
                TextButton(onClick = {
                    showDelete = false
                    scope.launch {
                        runCatching { container.repo.deletePlaylist(playlistId) }
                        nav.popBackStack()
                    }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Cancel") } },
        )
    }

    if (showShare) SharePlaylistDialog(playlistId) { showShare = false }
}

private fun moveId(songs: List<Song>, from: Int, to: Int): List<String> {
    val ids = songs.map { it.id }.toMutableList()
    val id = ids.removeAt(from)
    ids.add(to, id)
    return ids
}

@Composable
private fun SharePlaylistDialog(playlistId: Long, onDismiss: () -> Unit) {
    val container = LocalContext.current.appContainer
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var token by remember { mutableStateOf<String?>(null) }
    var loaded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        token = runCatching { container.repo.shareToken(playlistId) }.getOrNull()
        loaded = true
    }

    val link = token?.let { "${container.api.baseUrl}/#/shared/$it" }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Share playlist") },
        text = {
            when {
                !loaded -> CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                link == null -> Text("Create a members-only link — anyone signed in to this server can view and copy the playlist.")
                else -> Column {
                    Text(link, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Members-only: viewers must be signed in.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = {
            if (link == null) {
                TextButton(enabled = loaded, onClick = {
                    scope.launch {
                        runCatching { token = container.repo.createShare(playlistId).token }
                    }
                }) { Text("Create link") }
            } else {
                TextButton(onClick = {
                    clipboard.setText(androidx.compose.ui.text.AnnotatedString(link))
                }) { Text("Copy link") }
            }
        },
        dismissButton = {
            Row {
                if (link != null) {
                    TextButton(onClick = {
                        scope.launch { runCatching { container.repo.revokeShare(playlistId) }; token = null }
                    }) { Text("Revoke", color = MaterialTheme.colorScheme.error) }
                }
                TextButton(onClick = onDismiss) { Text("Close") }
            }
        },
    )
}

// ---------------------------------------------------------------- Album ----

@Composable
fun AlbumScreen(pc: PlayerConnection, nav: NavHostController, token: String) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()
    var tick by remember { mutableIntStateOf(0) }

    val load = rememberLoad(token, tick) { container.repo.album(token) }
    val saved = library?.albums?.any { it.token == token } == true

    LoadContent(load, onRetry = { tick++ }) { album ->
        val ctx = MediaIds.album(token)
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                DetailHeader(
                    nav = nav,
                    image = album.image,
                    title = album.title,
                    subtitle = listOf(album.artist, album.year).filter { it.isNotBlank() }.joinToString(" · "),
                    onPlay = if (album.songs.isNotEmpty()) {
                        { pc.play(album.songs, 0, ctx) }
                    } else null,
                    actions = {
                        IconButton(onClick = {
                            scope.launch {
                                runCatching {
                                    container.repo.library()
                                    container.repo.toggleAlbum(
                                        AlbumRef(token = token, title = album.title, artist = album.artist, year = album.year, image = album.image)
                                    )
                                }
                            }
                        }) {
                            Icon(
                                if (saved) Icons.Rounded.Bookmark else Icons.Rounded.BookmarkBorder,
                                if (saved) "Remove from library" else "Save to library",
                                tint = if (saved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                )
            }
            itemsIndexed(album.songs, key = { _, s -> s.id }) { i, song ->
                SongRow(song, pc.currentSong?.id == song.id, onClick = { pc.play(album.songs, i, ctx) })
            }
        }
    }
}

// --------------------------------------------------------------- Artist ----

@Composable
fun ArtistScreen(pc: PlayerConnection, nav: NavHostController, artistId: String) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()
    var tick by remember { mutableIntStateOf(0) }

    val load = rememberLoad(artistId, tick) { container.repo.artist(artistId) }
    val followed = library?.artists?.any { it.id == artistId } == true

    LoadContent(load, onRetry = { tick++ }) { artist ->
        val ctx = MediaIds.artist(artistId)
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                DetailHeader(
                    nav = nav,
                    image = artist.image,
                    title = artist.name,
                    subtitle = null,
                    round = true,
                    onPlay = if (artist.songs.isNotEmpty()) {
                        { pc.play(artist.songs, 0, ctx) }
                    } else null,
                    actions = {
                        androidx.compose.material3.OutlinedButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        container.repo.library()
                                        container.repo.toggleArtist(ArtistRef(artistId, artist.name, artist.image))
                                    }
                                }
                            },
                            modifier = Modifier.padding(end = 12.dp),
                        ) {
                            Text(if (followed) "Following" else "Follow")
                        }
                    },
                )
            }
            if (artist.description.isNotBlank()) {
                item {
                    Text(
                        artist.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 4,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
                    )
                }
            }
            if (artist.songs.isNotEmpty()) {
                item { SectionTitle("Songs") }
                itemsIndexed(artist.songs, key = { i, s -> "s$i${s.id}" }) { i, song ->
                    SongRow(song, pc.currentSong?.id == song.id, onClick = { pc.play(artist.songs, i, ctx) })
                }
            }
            if (artist.albums.isNotEmpty()) {
                item { SectionTitle("Albums") }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                        items(artist.albums) { a ->
                            MediaCard(a.title, a.year.ifBlank { null }, a.image) { nav.openAlbum(a.token) }
                        }
                    }
                }
            }
            if (artist.singles.isNotEmpty()) {
                item { SectionTitle("Singles") }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                        items(artist.singles) { a ->
                            MediaCard(a.title, a.year.ifBlank { null }, a.image) { nav.openAlbum(a.token) }
                        }
                    }
                }
            }
            if (artist.related.isNotEmpty()) {
                item { SectionTitle("Fans also like") }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 12.dp)) {
                        items(artist.related) { a ->
                            MediaCard(a.name, null, a.image, round = true) { nav.openArtist(a.id) }
                        }
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------ Public playlist ----

@Composable
fun PublicPlaylistScreen(pc: PlayerConnection, nav: NavHostController, browseId: String) {
    val container = LocalContext.current.appContainer
    var tick by remember { mutableIntStateOf(0) }
    val load = rememberLoad(browseId, tick) { container.repo.publicPlaylist(browseId) }

    LoadContent(load, onRetry = { tick++ }) { playlist ->
        val ctx = MediaIds.ytPlaylist(browseId)
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                DetailHeader(
                    nav = nav,
                    image = playlist.image,
                    title = playlist.title,
                    subtitle = playlist.author,
                    onPlay = if (playlist.songs.isNotEmpty()) {
                        { pc.play(playlist.songs, 0, ctx) }
                    } else null,
                )
            }
            itemsIndexed(playlist.songs, key = { i, s -> "p$i${s.id}" }) { i, song ->
                SongRow(song, pc.currentSong?.id == song.id, onClick = { pc.play(playlist.songs, i, ctx) })
            }
        }
    }
}

// ------------------------------------------------------ Shared playlist ----

@Composable
fun SharedPlaylistScreen(pc: PlayerConnection, nav: NavHostController, token: String) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    var tick by remember { mutableIntStateOf(0) }
    var copied by remember { mutableStateOf(false) }
    val load = rememberLoad(token, tick) { container.repo.sharedPlaylist(token) }

    LoadContent(load, onRetry = { tick++ }) { shared ->
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                DetailHeader(
                    nav = nav,
                    image = shared.songs.firstOrNull()?.image,
                    title = shared.name,
                    subtitle = "shared by ${shared.owner} · ${shared.songs.size} songs",
                    onPlay = if (shared.songs.isNotEmpty()) {
                        { pc.play(shared.songs, 0, null) }
                    } else null,
                    actions = {
                        TextButton(
                            enabled = !copied,
                            onClick = {
                                scope.launch {
                                    runCatching { container.repo.copyShared(token) }
                                        .onSuccess { copied = true }
                                }
                            },
                        ) { Text(if (copied) "Saved ✓" else "Save a copy") }
                    },
                )
            }
            itemsIndexed(shared.songs, key = { i, s -> "sh$i${s.id}" }) { i, song ->
                SongRow(song, pc.currentSong?.id == song.id, onClick = { pc.play(shared.songs, i, null) })
            }
        }
    }
}

