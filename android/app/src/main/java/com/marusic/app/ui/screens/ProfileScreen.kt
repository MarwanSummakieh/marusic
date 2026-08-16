@file:OptIn(ExperimentalMaterial3Api::class)

package com.marusic.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.data.AdminUser
import com.marusic.app.playback.MediaIds
import com.marusic.app.ui.Load
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.SolidPill
import com.marusic.app.ui.SongRow
import com.marusic.app.ui.rememberLoad
import com.marusic.app.ui.theme.Web
import kotlinx.coroutines.launch

private val PROFILE_TABS = listOf(
    "overview" to "Overview",
    "friends" to "Friends",
    "history" to "Listening history",
    "settings" to "Settings",
)

/**
 * The web's `renderProfile()`: gradient avatar hero, sub-tab strip, then
 * Overview stats / Friends (members) / Listening history / Settings.
 */
@Composable
fun ProfileScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val settings by container.settings.flow.collectAsState(initial = null)
    val library by container.repo.library.collectAsState()
    var tab by rememberSaveable { mutableStateOf("overview") }
    var message by remember { mutableStateOf<String?>(null) }
    val s = settings ?: return

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        // ---- hero ----
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(84.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF1ED760), Color(0xFF00C8FF), Color(0xFFC45CFF))
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        s.userName.trim().firstOrNull()?.uppercase() ?: "?",
                        fontSize = 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFF08080A),
                    )
                }
                Column(Modifier.padding(start = 16.dp)) {
                    Text(
                        "PROFILE",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = Web.sub,
                    )
                    Text(
                        s.userName.ifBlank { "You" },
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-1.2).sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        buildString {
                            append(s.baseUrl.substringAfter("://"))
                            if (s.userRole == "admin") append(" · Admin")
                        },
                        fontSize = 13.sp,
                        color = Web.sub,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        // ---- subtabs ----
        item {
            Column {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 8.dp),
                ) {
                    PROFILE_TABS.forEach { (key, label) ->
                        val active = tab == key
                        Column(
                            Modifier
                                .clickable { tab = key }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (active) Web.text else Web.sub,
                            )
                            Spacer(Modifier.height(10.dp))
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(2.dp)
                                    .background(if (active) Web.accent else Color.Transparent)
                            )
                        }
                    }
                }
                HorizontalDivider(color = Web.border)
            }
        }

        message?.let {
            item {
                Text(
                    it,
                    color = Web.accent,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
        }

        when (tab) {
            "overview" -> {
                item {
                    val lib = library
                    Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                        listOf(
                            listOf("Liked songs" to lib?.liked?.size, "Playlists" to lib?.playlists?.size),
                            listOf("Albums" to lib?.albums?.size, "Artists" to lib?.artists?.size),
                            listOf("Recently played" to lib?.history?.size, null),
                        ).forEach { pair ->
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                pair.forEach { entry ->
                                    if (entry == null) {
                                        Box(Modifier.weight(1f)) {}
                                    } else {
                                        StatCard(entry.second ?: 0, entry.first, Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
                item { ProfileSectionTitle("Members") }
                item { MembersPanel(isAdmin = s.userRole == "admin", onMessage = { message = it }) }
            }

            "friends" -> item {
                MembersPanel(isAdmin = s.userRole == "admin", onMessage = { message = it })
            }

            "history" -> {
                val history = library?.history.orEmpty()
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Recently played",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.weight(1f),
                        )
                        if (history.isNotEmpty()) {
                            val scope = rememberCoroutineScope()
                            TextButton(onClick = {
                                scope.launch { runCatching { container.repo.clearHistory() } }
                            }) { Text("Clear history", color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
                        }
                    }
                }
                if (history.isEmpty()) {
                    item {
                        Text(
                            "Nothing played yet.",
                            color = Web.sub,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(horizontal = 16.dp),
                        )
                    }
                }
                itemsIndexed(history, key = { _, song -> song.id }) { i, song ->
                    SongRow(
                        song,
                        isCurrent = pc.currentSong?.id == song.id,
                        onClick = { pc.play(history, i, MediaIds.HISTORY) },
                    )
                }
            }

            "settings" -> item { SettingsPanel(pc, onMessage = { message = it }) }
        }
    }
}

/** `.stat` — big number over a muted label, on a raised card. */
@Composable
private fun StatCard(value: Int, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Web.raised)
            .border(1.dp, Web.border, RoundedCornerShape(10.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Text("$value", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp)
        Text(label, fontSize = 12.5.sp, color = Web.sub)
    }
}

@Composable
private fun ProfileSectionTitle(text: String) {
    Text(
        text,
        fontSize = 19.sp,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

/** `.panel-card` — the bordered block settings rows live in. */
@Composable
private fun PanelCard(content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Web.raised)
            .border(1.dp, Web.border, RoundedCornerShape(10.dp))
            .padding(horizontal = 16.dp)
    ) { content() }
}

/** `.set-row` — label + note on the left, control on the right. */
@Composable
private fun SetRow(label: String, note: String, control: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(note, fontSize = 12.5.sp, color = Web.sub)
        }
        Spacer(Modifier.width(16.dp))
        control()
    }
}

/**
 * `loadMembers()` — everyone on the instance. Admins get enable/disable,
 * delete and invites; everyone else just sees who they share the server with.
 */
@Composable
private fun MembersPanel(isAdmin: Boolean, onMessage: (String) -> Unit) {
    val container = LocalContext.current.appContainer
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var tick by remember { mutableIntStateOf(0) }
    var showInvite by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Pair<Long, String>?>(null) }

    val load = rememberLoad(tick, isAdmin) {
        if (isAdmin) container.repo.adminUsers()
        else com.marusic.app.data.AdminUsersResponse(users = container.repo.members())
    }

    Column(Modifier.fillMaxWidth()) {
        when (val l = load) {
            is Load.Loading -> CircularProgressIndicator(
                Modifier.padding(16.dp).size(22.dp), strokeWidth = 2.dp
            )
            is Load.Err -> Row(
                Modifier.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Couldn't load members: ${l.message}",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { tick++ }) { Text("Retry") }
            }
            is Load.Ok -> {
                l.value.users.forEach { u ->
                    MemberRow(
                        user = u,
                        isAdmin = isAdmin,
                        onToggle = { active ->
                            scope.launch {
                                runCatching { container.repo.adminSetActive(u.id, active) }
                                tick++
                            }
                        },
                        onDelete = { deleteTarget = u.id to (u.email.ifBlank { u.name }) },
                    )
                }
                val pending = l.value.invites.filter { it.used == 0 }
                if (pending.isNotEmpty()) {
                    Text(
                        "Pending invites",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = Web.sub,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                    pending.forEach { inv ->
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(inv.email, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(
                                    "${inv.name}${if (inv.role == "admin") " · admin" else ""}",
                                    fontSize = 12.sp,
                                    color = Web.sub,
                                )
                            }
                            IconButton(onClick = {
                                clipboard.setText(
                                    AnnotatedString("${container.api.baseUrl}/invite.html?token=${inv.token}")
                                )
                                onMessage("Invite link copied")
                            }) {
                                Icon(Icons.Rounded.ContentCopy, "Copy invite link", tint = Web.sub)
                            }
                        }
                    }
                }
                if (isAdmin) {
                    Box(Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                        SolidPill("Invite someone") { showInvite = true }
                    }
                }
            }
        }
    }

    if (showInvite) {
        var email by remember { mutableStateOf("") }
        var name by remember { mutableStateOf("") }
        var admin by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf<String?>(null) }
        var link by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { showInvite = false; if (link != null) tick++ },
            title = { Text("Invite someone") },
            text = {
                Column {
                    if (link == null) {
                        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true)
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Switch(checked = admin, onCheckedChange = { admin = it })
                            Text("Admin", Modifier.padding(start = 8.dp))
                        }
                        err?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                    } else {
                        Text("Send them this link — they'll pick their own password:")
                        Spacer(Modifier.height(8.dp))
                        Text(link!!, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                if (link == null) {
                    TextButton(
                        enabled = email.isNotBlank() && name.isNotBlank(),
                        onClick = {
                            scope.launch {
                                try {
                                    val res = container.repo.adminInvite(
                                        email.trim(), name.trim(), if (admin) "admin" else "member"
                                    )
                                    link = container.api.baseUrl + res.url
                                } catch (e: Exception) {
                                    err = e.message
                                }
                            }
                        },
                    ) { Text("Create invite") }
                } else {
                    TextButton(onClick = {
                        clipboard.setText(AnnotatedString(link!!))
                        onMessage("Invite link copied")
                    }) { Text("Copy link") }
                }
            },
            dismissButton = {
                TextButton(onClick = { showInvite = false; if (link != null) tick++ }) { Text("Close") }
            },
        )
    }

    deleteTarget?.let { (id, who) ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete $who?") },
            text = { Text("Their library, playlists, and sessions are removed permanently.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteTarget = null
                    scope.launch {
                        runCatching { container.repo.adminDeleteUser(id) }
                        tick++
                    }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
}

/** `.friend-row` — avatar, name, sub, and (for admins) the controls. */
@Composable
private fun MemberRow(
    user: AdminUser,
    isAdmin: Boolean,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(Web.accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                user.name.trim().firstOrNull()?.uppercase() ?: "?",
                color = Color.Black,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 13.sp,
            )
        }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(user.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val sub = buildString {
                if (user.email.isNotBlank()) append(user.email)
                if (user.role == "admin") {
                    if (isNotEmpty()) append(" · ")
                    append("Admin")
                }
                if (user.active == 0) append(" · disabled")
            }
            if (sub.isNotBlank()) {
                Text(sub, fontSize = 12.sp, color = Web.sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (isAdmin) {
            Switch(checked = user.active == 1, onCheckedChange = onToggle)
            IconButton(onClick = onDelete) {
                Icon(Icons.Rounded.Delete, "Delete member", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

/** `profileSettings()` — Playback panel, Account panel, then sign out. */
@Composable
private fun SettingsPanel(pc: PlayerConnection, onMessage: (String) -> Unit) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val settings by container.settings.flow.collectAsState(initial = null)
    val s = settings ?: return

    var qualityOpen by remember { mutableStateOf(false) }
    var showRename by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth()) {
        ProfileSectionTitle("Playback")
        PanelCard {
            SetRow("Audio quality", "Higher quality uses more bandwidth.") {
                Box {
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Web.highlight)
                            .border(1.dp, Web.border, RoundedCornerShape(6.dp))
                            .clickable { qualityOpen = true }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(s.quality.replaceFirstChar { it.uppercase() }, fontSize = 14.sp)
                    }
                    DropdownMenu(expanded = qualityOpen, onDismissRequest = { qualityOpen = false }) {
                        listOf("high", "medium", "low").forEach { q ->
                            DropdownMenuItem(
                                text = { Text(q.replaceFirstChar { it.uppercase() }) },
                                onClick = {
                                    qualityOpen = false
                                    scope.launch { container.settings.setQuality(q) }
                                },
                            )
                        }
                    }
                }
            }
            HorizontalDivider(color = Web.border)
            SetRow("Autoplay", "Keep playing similar songs when the queue runs out.") {
                Switch(
                    checked = s.autoplay,
                    onCheckedChange = { on -> scope.launch { container.settings.setAutoplay(on) } },
                )
            }
        }

        ProfileSectionTitle("Account")
        PanelCard {
            SetRow("Display name", s.userName.ifBlank { "Not set" }) {
                IconButton(onClick = { showRename = true }) {
                    Icon(Icons.Rounded.Edit, "Change name", tint = Web.sub)
                }
            }
            HorizontalDivider(color = Web.border)
            SetRow("Password", "Signs out browsers; this app stays signed in.") {
                TextButton(onClick = { showPassword = true }) { Text("Change") }
            }
            HorizontalDivider(color = Web.border)
            SetRow("Server", s.baseUrl) {}
        }

        Box(Modifier.padding(16.dp)) {
            TextButton(onClick = {
                scope.launch {
                    runCatching { container.api.deleteQuiet("/api/device/tokens/${s.tokenId}") }
                    pc.stop()
                    container.settings.clearLogin()
                }
            }) { Text("Sign out", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold) }
        }
    }

    if (showRename) {
        var name by remember { mutableStateOf(s.userName) }
        var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { showRename = false },
            title = { Text("Display name") },
            text = {
                Column {
                    OutlinedTextField(name, { name = it }, singleLine = true)
                    err?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = name.isNotBlank(),
                    onClick = {
                        scope.launch {
                            try {
                                val saved = container.repo.changeName(name.trim())
                                container.settings.setUserName(saved)
                                showRename = false
                                onMessage("Name updated")
                            } catch (e: Exception) {
                                err = e.message
                            }
                        }
                    },
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showRename = false }) { Text("Cancel") } },
        )
    }

    if (showPassword) {
        var current by remember { mutableStateOf("") }
        var next by remember { mutableStateOf("") }
        var confirm by remember { mutableStateOf("") }
        var err by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { showPassword = false },
            title = { Text("Change password") },
            text = {
                Column {
                    OutlinedTextField(current, { current = it }, label = { Text("Current password") }, singleLine = true, visualTransformation = PasswordVisualTransformation())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(next, { next = it }, label = { Text("New password (8+)") }, singleLine = true, visualTransformation = PasswordVisualTransformation())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(confirm, { confirm = it }, label = { Text("Repeat new password") }, singleLine = true, visualTransformation = PasswordVisualTransformation())
                    err?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !busy && current.isNotEmpty() && next.length >= 8 && next == confirm,
                    onClick = {
                        busy = true
                        err = null
                        scope.launch {
                            try {
                                container.repo.changePassword(current, next)
                                showPassword = false
                                onMessage("Password changed")
                            } catch (e: Exception) {
                                err = e.message
                            } finally {
                                busy = false
                            }
                        }
                    },
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp) else Text("Change")
                }
            },
            dismissButton = { TextButton(onClick = { showPassword = false }) { Text("Cancel") } },
        )
    }
}
