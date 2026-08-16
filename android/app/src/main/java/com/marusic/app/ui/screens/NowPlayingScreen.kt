@file:OptIn(ExperimentalMaterial3Api::class)

package com.marusic.app.ui.screens

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Cast
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.data.Song
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.Load
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.formatTimeMs
import com.marusic.app.ui.gradientFor
import com.marusic.app.ui.openArtist
import com.marusic.app.ui.rememberLoad
import com.marusic.app.ui.theme.Web
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * The web app's full-screen `.np-sheet`, one-to-one: title-hashed gradient
 * backdrop, uppercase context label, big art, white transport, and the
 * Lyrics / Queue / Jam / Cast action row.
 */
@Composable
fun NowPlayingScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val song = pc.currentSong

    if (song == null) {
        Column(
            Modifier.fillMaxSize().background(Web.panel),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("Nothing playing", color = Web.sub)
            TextButton(onClick = { nav.popBackStack() }) { Text("Back") }
        }
        return
    }

    val library by container.repo.library.collectAsState()
    val liked = library?.liked?.any { it.id == song.id } == true

    var position by remember { mutableLongStateOf(0L) }
    var dragging by remember { mutableStateOf(false) }
    LaunchedEffect(song.id, pc.isPlaying) {
        while (isActive) {
            if (!dragging) position = pc.positionMs()
            delay(500)
        }
    }

    var sheet by remember { mutableStateOf<String?>(null) } // "queue" | "lyrics"
    var showDownload by remember { mutableStateOf(false) }

    // `.np-sheet` background: accent -10% -> #16161a 55% -> panel 100%
    val accent = gradientFor(song.title)
    Column(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(0f to accent, 0.55f to Web.sheetMid, 1f to Web.panel))
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        // ---- head: close · CONTEXT LABEL · download ----
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) {
                Icon(Icons.Rounded.KeyboardArrowDown, "Close", Modifier.size(22.dp), tint = Web.text)
            }
            Text(
                pc.contextLabel().uppercase(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = Web.text.copy(alpha = 0.85f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            IconButton(onClick = { showDownload = true }) {
                Icon(Icons.Rounded.Download, "Download", Modifier.size(22.dp), tint = Web.text)
            }
        }

        // ---- art: min(82vw, 48vh) ----
        BoxWithConstraints(
            Modifier.fillMaxWidth().weight(1f),
            contentAlignment = Alignment.Center,
        ) {
            val side = minOf(maxWidth * 0.94f, maxHeight)
            Artwork(song.image, Modifier.size(side), shape = RoundedCornerShape(12.dp))
        }

        // ---- meta: title/artist + like ----
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    song.title,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                    color = Web.text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    song.artist,
                    fontSize = 15.sp,
                    color = Web.sub,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .clickable(enabled = song.artistId.isNotBlank()) { nav.openArtist(song.artistId) },
                )
            }
            Spacer(Modifier.width(14.dp))
            IconButton(onClick = {
                scope.launch {
                    runCatching {
                        container.repo.library()
                        container.repo.toggleLike(song)
                    }
                }
            }) {
                Icon(
                    if (liked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    if (liked) "Remove from Liked Songs" else "Save to Liked Songs",
                    Modifier.size(26.dp),
                    tint = if (liked) Web.accent else Web.text,
                )
            }
        }

        // ---- progress ----
        Column {
            val durMs = pc.durationMs.coerceAtLeast(1L)
            val fraction = (position.toFloat() / durMs).coerceIn(0f, 1f)
            Slider(
                value = position.coerceIn(0L, durMs).toFloat(),
                onValueChange = { dragging = true; position = it.toLong() },
                onValueChangeFinished = { pc.seekTo(position); dragging = false },
                enabled = pc.canControl,
                valueRange = 0f..durMs.toFloat(),
                // the web's `.progress-bar`: a 4px rail, filled white, small knob
                track = {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(CircleShape)
                            .background(Web.text.copy(alpha = 0.28f))
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(fraction)
                                .height(4.dp)
                                .clip(CircleShape)
                                .background(Web.text)
                        )
                    }
                },
                thumb = {
                    Box(Modifier.size(12.dp).clip(CircleShape).background(Web.text))
                },
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(formatTimeMs(position), fontSize = 11.5.sp, color = Web.sub)
                Text(formatTimeMs(pc.durationMs), fontSize = 11.5.sp, color = Web.sub)
            }
        }

        // ---- transport ----
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = pc::toggleShuffle, enabled = !pc.inJam) {
                Icon(
                    Icons.Rounded.Shuffle, "Shuffle", Modifier.size(26.dp),
                    tint = if (pc.shuffleOn && !pc.inJam) Web.accent else Web.text,
                )
            }
            IconButton(onClick = pc::previous, enabled = pc.canControl) {
                Icon(Icons.Rounded.SkipPrevious, "Previous", Modifier.size(30.dp), tint = Web.text)
            }
            // `.np2-play` — 68px white disc, black glyph
            Box(
                Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(if (pc.canControl) Web.text else Web.text.copy(alpha = 0.45f))
                    .clickable(enabled = pc.canControl, onClick = pc::togglePlayPause),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (pc.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    if (pc.isPlaying) "Pause" else "Play",
                    Modifier.size(30.dp),
                    tint = Web.bg,
                )
            }
            IconButton(onClick = pc::next, enabled = pc.canControl) {
                Icon(Icons.Rounded.SkipNext, "Next", Modifier.size(30.dp), tint = Web.text)
            }
            IconButton(onClick = pc::cycleRepeat, enabled = !pc.inJam) {
                Icon(
                    if (pc.repeatMode == Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat,
                    "Repeat", Modifier.size(26.dp),
                    tint = if (pc.repeatMode != Player.REPEAT_MODE_OFF && !pc.inJam) Web.accent else Web.text,
                )
            }
        }

        // ---- actions: Lyrics · Queue · Jam · Cast ----
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SheetAction(Icons.Rounded.Mic, "Lyrics") { sheet = "lyrics" }
            SheetAction(Icons.AutoMirrored.Rounded.QueueMusic, "Queue") { sheet = "queue" }
            SheetAction(Icons.Rounded.Groups, "Jam", active = pc.inJam) {
                nav.navigate("jam")
            }
            // native casting isn't wired up yet — dimmed like the web's
            // `.cast-nodevices` state rather than pretending it works
            SheetAction(Icons.Rounded.Cast, "Cast", dimmed = true) {}
        }
    }

    if (showDownload) DownloadSheet(song) { showDownload = false }
    when (sheet) {
        "lyrics" -> LyricsSheet(song) { sheet = null }
        "queue" -> QueueSheet(pc) { sheet = null }
    }
}

/** `.np2-action` — 18px glyph + 13px bold label, muted until pressed. */
@Composable
private fun SheetAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    active: Boolean = false,
    dimmed: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .clickable(enabled = !dimmed, onClick = onClick)
            .alpha(if (dimmed) 0.45f else 1f)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val tint = if (active) Web.accent else Web.sub
        Icon(icon, label, Modifier.size(18.dp), tint = tint)
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = tint)
    }
}

// ------------------------------------------------------------- drawers ----

@Composable
internal fun QueueSheet(pc: PlayerConnection, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Web.raised) {
        val queue = pc.queueSongs
        LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
            itemsIndexed(queue) { i, q ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable(enabled = pc.canControl) { pc.seekToItem(i) }
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${i + 1}",
                        fontSize = 12.sp,
                        color = Web.sub,
                        modifier = Modifier.width(30.dp),
                    )
                    Artwork(q.image, Modifier.size(40.dp))
                    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                        Text(
                            q.title,
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (i == pc.queueIndex) Web.accent else Web.text,
                            fontWeight = if (i == pc.queueIndex) FontWeight.Bold else FontWeight.Normal,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            q.artist,
                            style = MaterialTheme.typography.bodySmall,
                            color = Web.sub,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun LyricsSheet(song: Song, onDismiss: () -> Unit) {
    val container = LocalContext.current.appContainer
    val load = rememberLoad(song.id) { container.repo.lyrics(song.id) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Web.raised) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 8.dp),
        ) {
            Text(song.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(song.artist, style = MaterialTheme.typography.bodySmall, color = Web.sub)
            Spacer(Modifier.height(14.dp))
            when (val l = load) {
                is Load.Loading -> CircularProgressIndicator(Modifier.padding(20.dp))
                is Load.Err -> Text("Couldn't load lyrics: ${l.message}", color = MaterialTheme.colorScheme.error)
                is Load.Ok -> {
                    if (l.value.lyrics.isBlank()) {
                        Text("No lyrics available.", color = Web.sub)
                    } else {
                        Text(l.value.lyrics, style = MaterialTheme.typography.bodyLarge, lineHeight = 26.sp)
                        if (l.value.source.isNotBlank()) {
                            Spacer(Modifier.height(12.dp))
                            Text(l.value.source, fontSize = 11.sp, color = Web.sub)
                        }
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
internal fun DownloadSheet(song: Song, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val container = context.appContainer
    val formatsLoad = rememberLoad(song.id) { container.repo.formats(song.id) }
    val losslessLoad = rememberLoad(song.id) { container.repo.lossless(song.title, song.artist) }
    var queuedNote by remember { mutableStateOf<String?>(null) }

    fun enqueue(url: String, fileName: String) {
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val request = DownloadManager.Request(Uri.parse(url))
            .addRequestHeader("Authorization", "Bearer ${container.api.bearer}")
            .setTitle(fileName)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_MUSIC, "marusic/$fileName")
        dm.enqueue(request)
        queuedNote = "Download started: $fileName"
    }

    val baseName = "${song.artist} - ${song.title}".replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120)

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Web.raised) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
            Text("Download", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                baseName,
                style = MaterialTheme.typography.bodySmall,
                color = Web.sub,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            queuedNote?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = Web.accent, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(10.dp))

            (losslessLoad as? Load.Ok)?.value?.takeIf { it.available }?.let { ll ->
                DownloadRow(
                    title = "FLAC · lossless (${ll.bitDepth}-bit/${ll.sampleRate} kHz, ${ll.provider})",
                    subtitle = "${ll.matchedTitle} — ${ll.matchedArtist}",
                ) {
                    enqueue(container.repo.losslessDownloadUrl(song.title, song.artist, baseName), "$baseName.flac")
                }
            }

            DownloadRow("FLAC · converted", "from the best source stream") {
                enqueue(container.repo.downloadUrl(song.id, "flac", baseName), "$baseName.flac")
            }
            DownloadRow("MP3 · converted", "most compatible") {
                enqueue(container.repo.downloadUrl(song.id, "mp3", baseName), "$baseName.mp3")
            }

            when (val f = formatsLoad) {
                is Load.Loading -> CircularProgressIndicator(Modifier.padding(14.dp).size(20.dp), strokeWidth = 2.dp)
                is Load.Err -> Text(
                    "Couldn't list source formats: ${f.message}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
                is Load.Ok -> f.value.formats.forEach { fmt ->
                    DownloadRow(
                        title = "${fmt.ext.uppercase()} · ${fmt.abr.toInt()} kbps",
                        subtitle = "${fmt.codec} · ${"%.1f".format(fmt.size / 1048576.0)} MB · as-is",
                    ) {
                        enqueue(container.repo.downloadUrl(song.id, fmt.id, baseName), "$baseName.${fmt.ext}")
                    }
                }
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun DownloadRow(title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Download, null, tint = Web.accent)
        Column(Modifier.padding(start = 12.dp)) {
            Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Web.sub)
        }
    }
}
