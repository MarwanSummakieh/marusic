@file:OptIn(ExperimentalMaterial3Api::class)

package com.marusic.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyHorizontalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.marusic.app.R
import com.marusic.app.appContainer
import com.marusic.app.data.AlbumRef
import com.marusic.app.data.Song
import com.marusic.app.playback.MediaIds
import com.marusic.app.ui.Artwork
import com.marusic.app.ui.AvatarButton
import com.marusic.app.ui.ContentCard
import com.marusic.app.ui.Load
import com.marusic.app.ui.MediaKind
import com.marusic.app.ui.OutlinePill
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.ShortcutTile
import com.marusic.app.ui.WebSectionTitle
import com.marusic.app.ui.openAlbum
import com.marusic.app.ui.rememberLoad
import com.marusic.app.ui.theme.Web
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * The web home, row for row: brand bar, time-of-day greeting with Customise,
 * shortcut tiles, "Made for you", "Jump back in", "Trending", "Radio".
 * Each row loads independently so one failure can't blank the page.
 */
@Composable
fun HomeScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    val library by container.repo.library.collectAsState()
    val settings by container.settings.flow.collectAsState(initial = null)
    var mixTick by remember { mutableIntStateOf(0) }
    var quickTick by remember { mutableIntStateOf(0) }
    var trendTick by remember { mutableIntStateOf(0) }
    var radioTick by remember { mutableIntStateOf(0) }
    var customising by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { runCatching { container.repo.library() } }
    val mixesLoad = rememberLoad(mixTick) { container.repo.mixes() }
    val quickLoad = rememberLoad(quickTick) { container.repo.quickPicks() }
    val trendingLoad = rememberLoad(trendTick) { container.repo.trending() }
    val radioLoad = rememberLoad(radioTick) { container.repo.radioStations() }

    val s = settings
    val visible = { id: String -> s?.rowVisible(id) ?: true }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        // ---- brand bar ----
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(painterResource(R.drawable.ic_brand_record), null, Modifier.size(28.dp))
                Text(
                    "Marusic",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                    modifier = Modifier.padding(start = 8.dp).weight(1f),
                )
                AvatarButton(s?.userName.orEmpty()) { nav.navigate("profile") }
            }
        }

        // ---- greeting + Customise ----
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 18.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    greeting(),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.6).sp,
                    modifier = Modifier.weight(1f),
                )
                OutlinePill("Customise") { customising = true }
            }
        }

        // ---- shortcuts ----
        val hasShortcuts = library?.liked.orEmpty().isNotEmpty() || library?.albums.orEmpty().isNotEmpty()
        if (visible("shortcuts") && hasShortcuts) {
            item {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    if (library?.liked.orEmpty().isNotEmpty()) {
                        ShortcutTile(
                            "Liked Songs",
                            Icons.Rounded.Favorite,
                            listOf(Color(0xFF4B0FA8), Color(0xFF9C8CF0)),
                            Modifier.fillMaxWidth(),
                        ) { nav.navigate("library?tab=1") }
                    }
                    if (library?.albums.orEmpty().isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        ShortcutTile(
                            "Saved albums",
                            Icons.Rounded.Bookmark,
                            listOf(Color(0xFF0F5A52), Color(0xFF2AD4C0)),
                            Modifier.fillMaxWidth(),
                        ) { nav.navigate("library?tab=3") }
                    }
                }
            }
        }

        // ---- Quick picks ----
        // The web's speed dial: single tracks stacked four deep, paging
        // sideways. Not cards — none of these have an inside to open.
        if (visible("quickpicks")) {
            when (val q = quickLoad) {
                is Load.Ok -> {
                    val picks = q.value.songs
                    if (picks.isNotEmpty()) {
                        item {
                            WebSectionTitle("Quick picks") {
                                OutlinePill("Play all") { pc.play(picks, 0, MediaIds.QUICKPICKS) }
                            }
                        }
                        item {
                            Text(
                                if (q.value.seeded) "Built from what you play most — one tap each."
                                else "Trending right now. Play a few songs and these become yours.",
                                fontSize = 13.sp,
                                color = Web.sub,
                                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 10.dp),
                            )
                        }
                        item {
                            LazyHorizontalGrid(
                                rows = GridCells.Fixed(QUICK_PICK_ROWS),
                                contentPadding = PaddingValues(horizontal = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(QUICK_PICK_ROW_HEIGHT * QUICK_PICK_ROWS),
                            ) {
                                itemsIndexed(picks) { i, song ->
                                    QuickPickTile(song, pc.currentSong?.id == song.id) {
                                        pc.play(picks, i, MediaIds.QUICKPICKS)
                                    }
                                }
                            }
                        }
                    }
                }
                is Load.Err -> item { RowError("Quick picks", q.message) { quickTick++ } }
                is Load.Loading -> Unit
            }
        }

        // ---- Made for you ----
        if (visible("mixes")) {
            when (val m = mixesLoad) {
                is Load.Ok -> if (m.value.isNotEmpty()) {
                    item { WebSectionTitle("Made for you") }
                    item {
                        LazyRow(contentPadding = PaddingValues(horizontal = 10.dp)) {
                            itemsIndexed(m.value) { i, mix ->
                                ContentCard(
                                    title = mix.title,
                                    sub = mix.basedOn.removePrefix("Based on "),
                                    image = mix.image,
                                    kind = MediaKind.Mix,
                                    onPlay = { pc.play(mix.songs, 0, MediaIds.mix(i)) },
                                ) { pc.play(mix.songs, 0, MediaIds.mix(i)) }
                            }
                        }
                    }
                }
                is Load.Err -> item { RowError("Made for you", m.message) { mixTick++ } }
                is Load.Loading -> Unit
            }
        }

        // ---- Jump back in ----
        val history = library?.history.orEmpty()
        if (visible("history") && history.isNotEmpty()) {
            item { WebSectionTitle("Jump back in") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 10.dp)) {
                    itemsIndexed(history.take(14)) { i, song ->
                        ContentCard(
                            title = song.title,
                            sub = song.artist,
                            image = song.image,
                            kind = MediaKind.Single,
                            onPlay = { pc.play(history, i, MediaIds.HISTORY) },
                        ) { pc.play(history, i, MediaIds.HISTORY) }
                    }
                }
            }
        }

        // ---- Trending ----
        if (visible("trending")) {
            when (val t = trendingLoad) {
                is Load.Loading -> item {
                    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is Load.Err -> item { RowError("Trending", t.message) { trendTick++ } }
                is Load.Ok -> {
                    val singles = t.value.singles
                    val releases = t.value.releases
                    if (singles.isNotEmpty() || releases.isNotEmpty()) {
                        item { WebSectionTitle("Trending") }
                        item {
                            LazyRow(contentPadding = PaddingValues(horizontal = 10.dp)) {
                                if (singles.isNotEmpty()) {
                                    item {
                                        ContentCard(
                                            title = "Trending Singles",
                                            sub = "${singles.size} tracks",
                                            image = singles.first().image,
                                            kind = MediaKind.Playlist,
                                            onPlay = { pc.play(singles, 0, MediaIds.TRENDING) },
                                        ) { pc.play(singles, 0, MediaIds.TRENDING) }
                                    }
                                }
                                items(releases) { r ->
                                    ContentCard(
                                        title = r.title,
                                        sub = listOf(r.artist, r.year).filter { it.isNotBlank() }.joinToString(" · "),
                                        image = r.image,
                                        kind = releaseKind(r),
                                        showPlay = false,
                                    ) { nav.openAlbum(r.token) }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ---- Radio ----
        if (visible("radio")) {
            (radioLoad as? Load.Ok)?.value?.take(12)?.takeIf { it.isNotEmpty() }?.let { stations ->
                item { WebSectionTitle("Radio") }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 10.dp)) {
                        items(stations) { station ->
                            ContentCard(
                                title = station.name,
                                sub = null,
                                image = station.image,
                                kind = MediaKind.Station,
                                width = 130.dp,
                                onPlay = {
                                    scope.launch {
                                        runCatching {
                                            pc.play(
                                                container.repo.radioQueue(station.name), 0,
                                                MediaIds.station(station.name),
                                            )
                                        }
                                    }
                                },
                            ) {
                                scope.launch {
                                    runCatching {
                                        pc.play(
                                            container.repo.radioQueue(station.name), 0,
                                            MediaIds.station(station.name),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (customising && s != null) {
        ModalBottomSheet(onDismissRequest = { customising = false }, containerColor = Web.raised) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                Text("Customise home", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                Text(
                    "Choose which rows appear.",
                    fontSize = 13.sp,
                    color = Web.sub,
                    modifier = Modifier.padding(top = 2.dp, bottom = 10.dp),
                )
                listOf(
                    "shortcuts" to "Shortcuts",
                    "quickpicks" to "Quick picks",
                    "mixes" to "Made for you",
                    "history" to "Jump back in",
                    "trending" to "Trending",
                    "radio" to "Radio",
                ).forEach { (id, label) ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(label, Modifier.weight(1f))
                        Switch(
                            checked = s.rowVisible(id),
                            onCheckedChange = { on -> scope.launch { container.settings.toggleRow(id, on) } },
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

/** One quick-pick cell: art, title, artist. Four of these stack per column. */
private val QUICK_PICK_ROWS = 4
private val QUICK_PICK_ROW_HEIGHT = 64.dp

@Composable
private fun QuickPickTile(song: Song, isCurrent: Boolean, onPlay: () -> Unit) {
    Row(
        Modifier
            .width(288.dp)
            .height(QUICK_PICK_ROW_HEIGHT)
            .clickable(onClick = onPlay)
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Artwork(song.image, Modifier.size(48.dp))
        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
            Text(
                song.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isCurrent) Web.accent else Web.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                song.artist.ifBlank { "Unknown Artist" },
                fontSize = 12.sp,
                color = Web.sub,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun greeting(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
    in 0..11 -> "Good morning"
    in 12..17 -> "Good afternoon"
    else -> "Good evening"
}

/** Explore returns albums and EPs in one list; `kind` tells them apart. */
internal fun releaseKind(r: AlbumRef): MediaKind = when (r.kind.lowercase()) {
    "ep" -> MediaKind.Ep
    "single" -> MediaKind.Single
    "playlist" -> MediaKind.Playlist
    else -> MediaKind.Album
}

@Composable
internal fun RowError(section: String, message: String, onRetry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(section, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            Text("Couldn't load: $message", fontSize = 12.sp, color = Web.sub)
        }
        TextButton(onClick = onRetry) { Text("Retry") }
    }
}
