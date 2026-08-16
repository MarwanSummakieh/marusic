package com.marusic.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.marusic.app.appContainer
import com.marusic.app.playback.MediaIds
import com.marusic.app.ui.ContentCard
import com.marusic.app.ui.Load
import com.marusic.app.ui.MediaKind
import com.marusic.app.ui.PlayerConnection
import com.marusic.app.ui.WebSectionTitle
import com.marusic.app.ui.openAlbum
import com.marusic.app.ui.rememberLoad
import com.marusic.app.ui.theme.Web
import kotlinx.coroutines.launch

/**
 * The Discover tab: endless radio stations plus what's new. Stations use the
 * web's per-genre hue; releases carry the album/EP type chips.
 */
@Composable
fun DiscoverScreen(pc: PlayerConnection, nav: NavHostController) {
    val container = LocalContext.current.appContainer
    val scope = rememberCoroutineScope()
    var stationTick by remember { mutableIntStateOf(0) }
    var trendTick by remember { mutableIntStateOf(0) }
    var starting by remember { mutableStateOf<String?>(null) }

    val stationsLoad = rememberLoad(stationTick) { container.repo.radioStations() }
    val trendingLoad = rememberLoad(trendTick) { container.repo.trending() }

    fun playStation(name: String) {
        starting = name
        scope.launch {
            runCatching { pc.play(container.repo.radioQueue(name), 0, MediaIds.station(name)) }
            starting = null
        }
    }

    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Text(
                "Discover",
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.6).sp,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp),
            )
        }

        when (val t = trendingLoad) {
            is Load.Err -> item { RowError("New releases", t.message) { trendTick++ } }
            is Load.Ok -> if (t.value.releases.isNotEmpty()) {
                item { WebSectionTitle("New releases") }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 10.dp)) {
                        items(t.value.releases) { r ->
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
            is Load.Loading -> Unit
        }

        item { WebSectionTitle("Stations") }
        when (val st = stationsLoad) {
            is Load.Loading -> item {
                Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is Load.Err -> item { RowError("Stations", st.message) { stationTick++ } }
            is Load.Ok -> items(st.value.chunked(2)) { pair ->
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    pair.forEach { station ->
                        val tint = parseHexColor(station.color) ?: MediaKind.Station.tint
                        Card(
                            onClick = { playStation(station.name) },
                            colors = CardDefaults.cardColors(containerColor = Web.raised),
                            modifier = Modifier.weight(1f),
                        ) {
                            Row(
                                Modifier.fillMaxWidth().padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(Modifier.size(12.dp).background(tint, CircleShape))
                                Text(
                                    station.name,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f).padding(start = 10.dp),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (starting == station.name) {
                                    CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                                }
                            }
                        }
                    }
                    if (pair.size == 1) Box(Modifier.weight(1f)) {}
                }
            }
        }
    }
}

internal fun parseHexColor(hex: String): Color? = runCatching {
    if (hex.isBlank()) null else Color(android.graphics.Color.parseColor(hex))
}.getOrNull()
