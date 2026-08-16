@file:OptIn(ExperimentalMaterial3Api::class)

package com.marusic.app.ui.screens

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.data.PlaylistExport
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.SolidPill
import com.marusic.app.ui.WebChip
import com.marusic.app.ui.theme.Web
import com.marusic.app.ui.openAlbum
import com.marusic.app.ui.openArtist
import com.marusic.app.ui.openPlaylist
import com.marusic.app.ui.openShared
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val LIB_KINDS = listOf(
    "all" to "All",
    "playlists" to "Playlists",
    "albums" to "Albums",
    "artists" to "Artists",
    "songs" to "Songs",
)

/**
 * The web's `renderLibrary()`: "Your Library" with Import / New playlist,
 * a kind chip row, a filter box, then grouped `.lib-row` lists — cover,
 * name, and a "Type · detail" sub line.
 */
@Composable
fun LibraryScreen(pc: PlayerConnection, nav: NavHostController, initialTab: Int = 0) {
    val context = LocalContext.current
    val container = context.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()

    LaunchedEffect(Unit) { runCatching { container.repo.library() } }

    var kind by rememberSaveable {
        mutableStateOf(
            when (initialTab) {
                1 -> "songs"; 3 -> "albums"; 4 -> "artists"; else -> "all"
            }
        )
    }
    var filter by rememberSaveable { mutableStateOf("") }
    var showCreate by remember { mutableStateOf(false) }
    var showOpenShared by remember { mutableStateOf(false) }
    var importError by remember { mutableStateOf<String?>(null) }

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            try {
                val text = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                } ?: throw IllegalStateException("couldn't read file")
                val parsed = container.api.json.decodeFromString(PlaylistExport.serializer(), text)
                if (parsed.songs.isEmpty()) throw IllegalStateException("no importable songs found")
                container.repo.importPlaylist(parsed.name.ifBlank { "Imported playlist" }, parsed.songs)
            } catch (e: Exception) {
                importError = e.message ?: "Import failed"
            }
        }
    }

    val lib = library
    val show = { k: String -> kind == "all" || kind == k }
    val matches = { name: String, sub: String ->
        filter.isBlank() || "$name $sub".contains(filter, ignoreCase = true)
    }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        // ---- head ----
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Your Library",
                    fontSize = 30.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-1).sp,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { importLauncher.launch(arrayOf("*/*")) }) {
                    Text("Import", color = Web.sub, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                SolidPill("New playlist") { showCreate = true }
            }
        }

        // ---- kind chips ----
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(LIB_KINDS) { (k, label) ->
                    WebChip(label, selected = kind == k) { kind = k }
                }
            }
        }

        // ---- filter ----
        item {
            OutlinedTextField(
                value = filter,
                onValueChange = { filter = it },
                placeholder = { Text("Search your library") },
                leadingIcon = { Icon(Icons.Rounded.Search, null, Modifier.size(18.dp)) },
                trailingIcon = {
                    Row {
                        if (filter.isNotEmpty()) {
                            IconButton(onClick = { filter = "" }) { Icon(Icons.Rounded.Close, "Clear") }
                        }
                        IconButton(onClick = { showOpenShared = true }) {
                            Icon(Icons.Rounded.Link, "Open a shared playlist", tint = Web.sub)
                        }
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            )
        }

        if (lib == null) {
            item {
                Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            return@LazyColumn
        }

        // ---- Pinned ----
        if ((show("songs") || kind == "all") && matches("Liked Songs", "Playlist")) {
            item { LibGroupTitle("Pinned") }
            item {
                LibRow(
                    name = "Liked Songs",
                    sub = "Playlist · ${lib.liked.size} songs",
                    cover = {
                        GradientCover(Icons.Rounded.Favorite, listOf(Color(0xFF4B0FA8), Color(0xFF9C8CF0)))
                    },
                ) { nav.navigate("collection/liked") }
            }
        }

        // ---- Playlists ----
        if (show("playlists")) {
            val rows = lib.playlists.filter { matches(it.name, "Playlist") }
            if (rows.isNotEmpty()) {
                item { LibGroupTitle("Playlists") }
                items(rows, key = { it.id }) { p ->
                    LibRow(
                        name = p.name,
                        sub = "Playlist · ${p.songs.size} songs",
                        cover = { Artwork(p.songs.firstOrNull()?.image, Modifier.size(52.dp), RoundedCornerShape(4.dp)) },
                    ) { nav.openPlaylist(p.id) }
                }
            }
        }

        // ---- Albums ----
        if (show("albums")) {
            val rows = lib.albums.filter { matches(it.title, it.artist) }
            if (rows.isNotEmpty()) {
                item { LibGroupTitle("Albums") }
                items(rows, key = { it.token }) { a ->
                    LibRow(
                        name = a.title,
                        sub = "Album · ${a.artist}",
                        cover = { Artwork(a.image, Modifier.size(52.dp), RoundedCornerShape(4.dp)) },
                    ) { nav.openAlbum(a.token) }
                }
            }
        }

        // ---- Artists ----
        if (show("artists")) {
            val rows = lib.artists.filter { matches(it.name, "Artist") }
            if (rows.isNotEmpty()) {
                item { LibGroupTitle("Artists") }
                items(rows, key = { it.id }) { a ->
                    LibRow(
                        name = a.name,
                        sub = "Artist",
                        cover = { Artwork(a.image, Modifier.size(52.dp), CircleShape) },
                    ) { nav.openArtist(a.id) }
                }
            }
        }

        val empty = lib.playlists.isEmpty() && lib.albums.isEmpty() && lib.artists.isEmpty() && lib.liked.isEmpty()
        if (empty) {
            item {
                Text(
                    "Nothing saved yet. Like a song or save an album and it shows up here.",
                    color = Web.sub,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(24.dp),
                )
            }
        }
    }

    if (showCreate) {
        var name by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreate = false },
            title = { Text("Create playlist") },
            text = { OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true) },
            confirmButton = {
                TextButton(
                    enabled = name.isNotBlank(),
                    onClick = {
                        scope.launch { runCatching { container.repo.createPlaylist(name.trim()) } }
                        showCreate = false
                    },
                ) { Text("Create") }
            },
            dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel") } },
        )
    }

    if (showOpenShared) {
        var input by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showOpenShared = false },
            title = { Text("Open shared playlist") },
            text = {
                Column {
                    Text("Paste a share link or token.", fontSize = 12.sp, color = Web.sub)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(input, { input = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                TextButton(
                    enabled = input.isNotBlank(),
                    onClick = {
                        val token = input.trim().substringAfterLast("shared/").trim('/', '#')
                        showOpenShared = false
                        if (token.isNotBlank()) nav.openShared(token)
                    },
                ) { Text("Open") }
            },
            dismissButton = { TextButton(onClick = { showOpenShared = false }) { Text("Cancel") } },
        )
    }

    importError?.let {
        AlertDialog(
            onDismissRequest = { importError = null },
            title = { Text("Import failed") },
            text = { Text(it) },
            confirmButton = { TextButton(onClick = { importError = null }) { Text("OK") } },
        )
    }
}

/** The web's `#/liked` collection page. */
@Composable
fun LikedSongsScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val library by container.repo.library.collectAsState()
    LaunchedEffect(Unit) { runCatching { container.repo.library() } }
    val songs = library?.liked.orEmpty()

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            DetailHeader(
                nav = nav,
                image = songs.firstOrNull()?.image,
                title = "Liked Songs",
                subtitle = "Playlist · ${songs.size} songs",
                onPlay = if (songs.isNotEmpty()) {
                    { pc.play(songs, 0, com.marusic.app.playback.MediaIds.LIKED) }
                } else null,
            )
        }
        itemsIndexed(songs, key = { _, s -> s.id }) { i, song ->
            com.marusic.app.ui.SongRow(
                song,
                isCurrent = pc.currentSong?.id == song.id,
                onClick = { pc.play(songs, i, com.marusic.app.playback.MediaIds.LIKED) },
            )
        }
    }
}

/** `.section h2` inside the library list. */
@Composable
private fun LibGroupTitle(text: String) {
    Text(
        text,
        fontSize = 19.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.3).sp,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 4.dp),
    )
}

/** `.lib-row` — 52px cover, name, "Type · detail". */
@Composable
private fun LibRow(
    name: String,
    sub: String,
    cover: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        cover()
        Column(Modifier.padding(start = 12.dp)) {
            Text(
                name,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                sub,
                fontSize = 12.5.sp,
                color = Web.sub,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** The web's `.liked-cover` / `.saves-cover` gradient tiles. */
@Composable
private fun GradientCover(icon: ImageVector, colors: List<Color>) {
    Box(
        Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(Brush.linearGradient(colors)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(22.dp))
    }
}
