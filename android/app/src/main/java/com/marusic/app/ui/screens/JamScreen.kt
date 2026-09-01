package com.marusic.app.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.PersonRemove
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.data.JamPeek
import com.marusic.app.data.JamSnapshot
import com.marusic.app.playback.JamManager
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.ScreenTitle
import com.marusic.app.ui.SectionTitle
import kotlinx.coroutines.launch

/**
 * Shared listening — both kinds of it, behind one screen (see lib/jam.js):
 *
 *   Jam             everyone is in the same room, so one device makes sound
 *                   and everyone else's phone is a synchronized remote.
 *   Listen together everyone is somewhere else, so every device plays its own
 *                   stream, held to the same moment of the same song.
 *
 * The kind is picked once, when the session starts, and fixed for its life:
 * moving the audio out from under everyone mid-song is not a thing anyone
 * asked for. Transport lives in the mini player / Now Playing, which are
 * session-aware.
 */
@Composable
fun JamScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        container.jam.notes.collect { snackbar.showSnackbar(it) }
    }

    Box(Modifier.fillMaxSize()) {
        if (pc.jam == null) NoSessionContent(pc) else ActiveSessionContent(pc)
        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier.align(Alignment.BottomCenter),
        ) { data -> Snackbar(snackbarData = data) }
    }
}

// ------------------------------------------------------------- the copy ----

/** Everything the two features say differently, in one table. */
private class ModeCopy(
    val title: String,
    val noun: String,
    val icon: ImageVector,
    val blurb: String,
    val start: String,
    val startFrom: String,
    val invited: String,
    val join: String,
    val joinBlurb: String,
    val membersTitle: String,
)

private val SPEAKER_COPY = ModeCopy(
    title = "Jam",
    noun = "jam",
    icon = Icons.Rounded.Groups,
    blurb = "Everyone's in the same room. One device plays the music and everyone " +
        "else's phone becomes a remote — same queue, no echo.",
    start = "Start a jam",
    startFrom = "Start a jam from what's playing",
    invited = "invited you to a jam",
    join = "Join the jam",
    joinBlurb = "One device plays for the room — this one is a remote unless the " +
        "host hands it the audio.",
    membersTitle = "In the jam",
)

private val TOGETHER_COPY = ModeCopy(
    title = "Listen together",
    noun = "listen together",
    icon = Icons.AutoMirrored.Rounded.VolumeUp,
    blurb = "Everyone's somewhere else. Every device plays its own audio, held in " +
        "sync to the same moment of the same song — so hop in a call and listen.",
    start = "Start listening together",
    startFrom = "Listen together from what's playing",
    invited = "invited you to listen together",
    join = "Join and listen",
    joinBlurb = "The music plays on this device, in sync with everyone else's.",
    membersTitle = "Listening together",
)

private fun copyFor(mode: String) =
    if (mode == JamManager.MODE_TOGETHER) TOGETHER_COPY else SPEAKER_COPY

// ---------------------------------------------------------- no session ----

@Composable
private fun NoSessionContent(pc: PlayerConnection) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()

    // the toggle only changes what you are about to start; a session's own
    // kind is fixed once it exists
    var mode by remember { mutableStateOf(container.jamMode) }
    val copy = copyFor(mode)

    var code by remember { mutableStateOf("") }
    var peek by remember { mutableStateOf<JamPeek?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        ScreenTitle("Listen with friends")

        SectionTitle("Start")
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (option in listOf(JamManager.MODE_SPEAKER, JamManager.MODE_TOGETHER)) {
                        val c = copyFor(option)
                        FilterChip(
                            selected = mode == option,
                            onClick = {
                                if (mode == option) return@FilterChip
                                mode = option
                                scope.launch { container.settings.setJamMode(option) }
                            },
                            label = { Text(c.title) },
                            leadingIcon = { Icon(c.icon, null, Modifier.size(18.dp)) },
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    copy.blurb,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                val queue = pc.queueSongs
                Text(
                    if (queue.isEmpty()) "Starts empty — anyone can add songs."
                    else "Starts with your current queue (${queue.size} songs).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    enabled = !busy,
                    onClick = {
                        busy = true
                        error = null
                        scope.launch {
                            try {
                                val (songs, index, posPlaying) = pc.jamSeed()
                                container.jam.create(
                                    songs, index, posPlaying.first, posPlaying.second, mode,
                                )
                            } catch (e: Exception) {
                                error = e.message ?: "Couldn't start"
                            } finally {
                                busy = false
                            }
                        }
                    },
                ) { Text(if (pc.queueSongs.isEmpty()) copy.start else copy.startFrom) }
            }
        }

        SectionTitle("Join")
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            Column(Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase().take(6); peek = null },
                    label = { Text("Join code") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                peek?.let { p ->
                    // the code decides the kind, not the toggle above
                    val c = copyFor(p.mode)
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "${p.host} ${c.invited} · ${p.members} in",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    p.current?.let { cur ->
                        Text(
                            "${if (p.playing) "Playing" else "Paused"}: ${cur.title} — ${cur.artist}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Text(
                        c.joinBlurb,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(10.dp))
                Row {
                    OutlinedButton(
                        enabled = !busy && code.length == 6,
                        onClick = {
                            busy = true
                            error = null
                            scope.launch {
                                peek = try {
                                    container.jam.peek(code)
                                } catch (e: Exception) {
                                    error = e.message
                                    null
                                }
                                busy = false
                            }
                        },
                        modifier = Modifier.padding(end = 10.dp),
                    ) { Text("Preview") }
                    Button(
                        enabled = !busy && code.length == 6,
                        onClick = {
                            busy = true
                            error = null
                            scope.launch {
                                try {
                                    container.jam.join(code)
                                } catch (e: Exception) {
                                    error = e.message ?: "Couldn't join"
                                } finally {
                                    busy = false
                                }
                            }
                        },
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        else Text(peek?.let { copyFor(it.mode).join } ?: "Join")
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

// ------------------------------------------------------ active session ----

/** One queue row, with the section heading it opens (null when it continues one). */
private class QueueRow(val heading: String?, val index: Int)

/**
 * What people queued comes first, then what autoplay filled in — two sections,
 * so it's obvious a new pick jumps ahead of the suggestions (lib/jam.js sorts
 * the queue that way; `auto` marks the tail).
 */
private fun queueRows(jam: JamSnapshot): List<QueueRow> {
    val rows = mutableListOf<QueueRow>()
    val cur = jam.index
    for (i in 0 until cur.coerceAtLeast(0)) {
        rows += QueueRow(if (i == 0) "Played" else null, i)
    }
    if (cur in jam.queue.indices) rows += QueueRow("Now playing", cur)
    val after = ((cur + 1).coerceAtLeast(0) until jam.queue.size).toList()
    val queued = after.takeWhile { !jam.queue[it].auto }
    val autos = after.drop(queued.size)
    queued.forEachIndexed { n, i ->
        rows += QueueRow(if (n == 0) (if (autos.isEmpty()) "Next up" else "Next in queue") else null, i)
    }
    autos.forEachIndexed { n, i ->
        rows += QueueRow(if (n == 0) "Next up · Autoplay" else null, i)
    }
    return rows
}

@Composable
private fun ActiveSessionContent(pc: PlayerConnection) {
    val container = LocalContext.current.appContainer
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val jam = pc.jam ?: return
    val copy = copyFor(jam.mode)
    val together = jam.mode == JamManager.MODE_TOGETHER
    var confirmEnd by remember { mutableStateOf(false) }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            ScreenTitle(copy.title) {
                if (jam.you.isHost) {
                    TextButton(onClick = { confirmEnd = true }) {
                        Text("End", color = MaterialTheme.colorScheme.error)
                    }
                }
                TextButton(onClick = { scope.launch { container.jam.leave() } }) {
                    Text("Leave")
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) {
                Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "Share this code",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            jam.code.chunked(1).joinToString(" "),
                            style = MaterialTheme.typography.headlineMedium.copy(letterSpacing = 2.sp),
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        IconButton(onClick = {
                            clipboard.setText(AnnotatedString(jam.code))
                        }) {
                            Icon(Icons.Rounded.ContentCopy, "Copy code", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    if (together) {
                        // no speaker to be online or offline: every connected
                        // device is its own
                        val listening = jam.members.count { it.connected }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.AutoMirrored.Rounded.VolumeUp, null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                "Playing on every device — " +
                                    (if (listening == 1) "you're" else "$listening people are") +
                                    " hearing this in sync. Voice chat is on you.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 6.dp),
                            )
                        }
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Rounded.Speaker, null,
                                tint = if (jam.speakerOnline || pc.isJamSpeaker) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(
                                when {
                                    pc.isJamSpeaker -> "Playing on this phone"
                                    jam.speakerOnline -> "Speaker connected elsewhere"
                                    else -> "Speaker offline — no audio anywhere"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 6.dp),
                            )
                        }
                        if (jam.you.isHost && !pc.isJamSpeaker) {
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(onClick = { scope.launch { container.jam.playHere() } }) {
                                Text("Play here instead")
                            }
                        }
                    }
                }
            }
        }

        if (jam.you.isHost) {
            item {
                Column(Modifier.padding(horizontal = 16.dp)) {
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(
                            checked = jam.settings.guestsControl,
                            onCheckedChange = { scope.launch { container.jam.setSettings(guestsControl = it) } },
                        )
                        Text("Guests can control playback", Modifier.padding(start = 10.dp))
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(
                            checked = jam.settings.autoplay,
                            onCheckedChange = { scope.launch { container.jam.setSettings(autoplay = it) } },
                        )
                        Text("Autoplay when the queue ends", Modifier.padding(start = 10.dp))
                    }
                }
            }
        }

        item { SectionTitle("${copy.membersTitle} (${jam.members.size})") }
        itemsIndexed(jam.members, key = { _, m -> m.id }) { _, member ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(10.dp)
                        .background(
                            if (member.connected) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.outline,
                            CircleShape,
                        )
                )
                Text(
                    member.name,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(start = 12.dp).weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (member.host) {
                    Icon(Icons.Rounded.Star, "Host", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                }
                if (jam.you.isHost && !member.host) {
                    IconButton(onClick = { scope.launch { container.jam.kick(member.id) } }) {
                        Icon(Icons.Rounded.PersonRemove, "Remove", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item { SectionTitle("Queue (${jam.queue.size})") }
        if (jam.queue.isEmpty()) {
            item {
                Text(
                    "The queue is empty — browse anywhere in the app and tap songs to add them.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
        items(queueRows(jam), key = { "${it.index}${jam.queue[it.index].id}" }) { row ->
            val song = jam.queue[row.index]
            val isCurrent = row.index == jam.index
            row.heading?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
                )
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = jam.you.canControl) { scope.launch { container.jam.playAt(row.index) } }
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Artwork(song.image, Modifier.size(44.dp))
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(
                        song.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        song.artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (jam.you.canControl && !isCurrent) {
                    IconButton(onClick = { scope.launch { container.jam.removeAt(row.index) } }) {
                        Icon(Icons.Rounded.Close, "Remove from the queue", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false },
            title = { Text("End this for everyone?") },
            text = { Text("Everyone in the ${copy.noun} loses the queue and the music stops.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmEnd = false
                    scope.launch { container.jam.end() }
                }) { Text("End", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Cancel") } },
        )
    }
}
