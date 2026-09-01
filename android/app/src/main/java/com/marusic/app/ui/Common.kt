package com.marusic.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.marusic.app.appContainer
import com.marusic.app.data.Song
import kotlinx.coroutines.launch

// ---- async content loading ----

sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ok<T>(val value: T) : Load<T>
    data class Err(val message: String) : Load<Nothing>
}

@Composable
fun <T> rememberLoad(vararg keys: Any?, block: suspend () -> T): Load<T> {
    val state = produceState<Load<T>>(Load.Loading, *keys) {
        value = Load.Loading
        value = try {
            Load.Ok(block())
        } catch (e: Exception) {
            Load.Err(e.message ?: "Something went wrong")
        }
    }
    return state.value
}

@Composable
fun <T> LoadContent(
    load: Load<T>,
    onRetry: (() -> Unit)? = null,
    content: @Composable (T) -> Unit,
) {
    when (load) {
        is Load.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is Load.Err -> Column(
            Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(load.message, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (onRetry != null) {
                Spacer(Modifier.height(12.dp))
                Button(onClick = onRetry) { Text("Retry") }
            }
        }
        is Load.Ok -> content(load.value)
    }
}

// ---- small building blocks ----

fun formatTime(totalSeconds: Int): String {
    if (totalSeconds <= 0) return "0:00"
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "%d:%02d".format(m, s)
}

fun formatTimeMs(ms: Long): String = formatTime((ms / 1000).toInt())

@Composable
fun Artwork(
    url: String?,
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(6.dp),
) {
    val m = modifier.clip(shape).background(MaterialTheme.colorScheme.surfaceVariant)
    if (url.isNullOrBlank()) {
        Box(m, contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.MusicNote, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = m,
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 8.dp),
    )
}

@Composable
fun ScreenTitle(text: String, actions: @Composable () -> Unit = {}) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        actions()
    }
}

/** Horizontally-scrolled card for albums / artists / mixes / playlists. */
@Composable
fun MediaCard(
    title: String,
    subtitle: String?,
    image: String?,
    size: Dp = 132.dp,
    round: Boolean = false,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .width(size)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(6.dp),
    ) {
        Artwork(
            image,
            Modifier.size(size - 12.dp),
            shape = if (round) CircleShape else RoundedCornerShape(8.dp),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (!subtitle.isNullOrBlank()) {
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// ---- song rows + actions ----

@Composable
fun SongRow(
    song: Song,
    isCurrent: Boolean,
    onClick: () -> Unit,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Artwork(song.image, Modifier.size(48.dp))
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(
                song.title,
                style = MaterialTheme.typography.bodyLarge,
                color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground,
                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                song.artist.ifBlank { "Unknown Artist" },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (song.duration > 0) {
            Text(
                formatTime(song.duration),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (trailing != null) trailing() else SongMenu(song)
    }
}

/**
 * Overflow menu every song row gets: like toggle + add-to-playlist, plus any
 * screen-specific [extraItems] (e.g. "Remove from playlist").
 */
@Composable
fun SongMenu(
    song: Song,
    extraItems: @Composable (dismiss: () -> Unit) -> Unit = {},
) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf(false) }
    var showAdd by remember { mutableStateOf(false) }
    val library by container.repo.library.collectAsState()
    val liked = library?.liked?.any { it.id == song.id } == true

    Box {
        IconButton(onClick = { open = true }) {
            Icon(Icons.Rounded.MoreVert, "More", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(if (liked) "Remove from Liked" else "Add to Liked") },
                leadingIcon = {
                    Icon(if (liked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, null)
                },
                onClick = {
                    open = false
                    scope.launch { runCatching { container.repo.toggleLike(song) } }
                },
            )
            DropdownMenuItem(
                text = { Text("Add to playlist") },
                leadingIcon = { Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, null) },
                onClick = {
                    open = false
                    showAdd = true
                },
            )
            extraItems { open = false }
        }
    }
    if (showAdd) AddToPlaylistDialog(song) { showAdd = false }
}

@Composable
fun AddToPlaylistDialog(song: Song, onDismiss: () -> Unit) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()
    var newName by remember { mutableStateOf("") }

    LaunchedEffect(Unit) { runCatching { container.repo.library() } }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add to playlist") },
        text = {
            Column {
                library?.playlists.orEmpty().forEach { p ->
                    TextButton(
                        onClick = {
                            scope.launch {
                                runCatching { container.repo.addToPlaylist(p.id, song) }
                                onDismiss()
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("${p.name}  ·  ${p.songs.size}", maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text("New playlist") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(
                        enabled = newName.isNotBlank(),
                        onClick = {
                            scope.launch {
                                runCatching {
                                    val p = container.repo.createPlaylist(newName.trim())
                                    container.repo.addToPlaylist(p.id, song)
                                }
                                onDismiss()
                            }
                        },
                    ) {
                        Icon(Icons.Rounded.Add, "Create and add")
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

// ---- mini player ----

@Composable
fun MiniPlayer(pc: PlayerConnection, onOpen: () -> Unit) {
    if (!pc.hasMedia) return
    val song = pc.currentSong ?: return
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
    ) {
        Row(
            Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Artwork(song.image, Modifier.size(42.dp))
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (pc.inJam) {
                        Text(
                            if (pc.isTogether) "TOGETHER" else "JAM",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(end = 6.dp),
                        )
                    }
                    Text(
                        song.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    song.artist,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = pc::togglePlayPause, enabled = pc.canControl) {
                Icon(
                    if (pc.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    if (pc.isPlaying) "Pause" else "Play",
                )
            }
            IconButton(onClick = pc::next, enabled = pc.canControl) {
                Icon(Icons.Rounded.SkipNext, "Next")
            }
        }
    }
}
