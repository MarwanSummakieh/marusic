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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.PersonRemove
import androidx.compose.material.icons.rounded.Speaker
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.ScreenTitle
import com.marusic.app.ui.SectionTitle
import kotlinx.coroutines.launch

/**
 * Shared listening. No jam: start one (seeded from whatever is playing) or
 * join by code. In a jam: code + members + host settings + the live queue.
 * Transport lives in the mini player / Now Playing, which are jam-aware.
 */
@Composable
fun JamScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        container.jam.notes.collect { snackbar.showSnackbar(it) }
    }

    Box(Modifier.fillMaxSize()) {
        val jam = pc.jam
        if (jam == null) {
            NoJamContent(pc)
        } else {
            ActiveJamContent(pc)
        }
        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier.align(Alignment.BottomCenter),
        ) { data -> Snackbar(snackbarData = data) }
    }
}

// ------------------------------------------------------------- no jam ----

@Composable
private fun NoJamContent(pc: PlayerConnection) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()

    var code by remember { mutableStateOf("") }
    var peek by remember { mutableStateOf<JamPeek?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        ScreenTitle("Jam")
        Text(
            "Listen together in real time. One device is the speaker; everyone is the DJ.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp),
        )

        SectionTitle("Start a jam")
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            Column(Modifier.padding(16.dp)) {
                val queue = pc.queueSongs
                Text(
                    if (queue.isEmpty()) "Starts empty — anyone can add songs."
                    else "Starts with your current queue (${queue.size} songs) and this phone as the speaker.",
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
                                container.jam.create(songs, index, posPlaying.first, posPlaying.second)
                            } catch (e: Exception) {
                                error = e.message ?: "Couldn't start the jam"
                            } finally {
                                busy = false
                            }
                        }
                    },
                ) { Text("Start jam") }
            }
        }

        SectionTitle("Join a jam")
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
                    Spacer(Modifier.height(10.dp))
                    Text("${p.host}'s jam · ${p.members} listening", style = MaterialTheme.typography.bodyMedium)
                    p.current?.let { cur ->
                        Text(
                            "${if (p.playing) "Playing" else "Paused"}: ${cur.title} — ${cur.artist}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
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
                        else Text("Join")
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

// --------------------------------------------------------- active jam ----

@Composable
private fun ActiveJamContent(pc: PlayerConnection) {
    val container = LocalContext.current.appContainer
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val jam = pc.jam ?: return
    var confirmEnd by remember { mutableStateOf(false) }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            ScreenTitle("Jam") {
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

        item { SectionTitle("Listening (${jam.members.size})") }
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
                    "Queue is empty — browse anywhere in the app and tap songs to add them.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
        itemsIndexed(jam.queue, key = { i, s -> "$i${s.id}" }) { i, song ->
            val isCurrent = i == jam.index
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = jam.you.canControl) { scope.launch { container.jam.playAt(i) } }
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
                    IconButton(onClick = { scope.launch { container.jam.removeAt(i) } }) {
                        Icon(Icons.Rounded.Close, "Remove from queue", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }

    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false },
            title = { Text("End the jam for everyone?") },
            confirmButton = {
                TextButton(onClick = {
                    confirmEnd = false
                    scope.launch { container.jam.end() }
                }) { Text("End jam", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Cancel") } },
        )
    }
}
