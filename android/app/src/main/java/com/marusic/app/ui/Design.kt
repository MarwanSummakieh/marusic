package com.marusic.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.marusic.app.ui.theme.Web

/**
 * The web app's content-type visual language (public/styles.css "Content-type
 * visual language"): every browsable thing has a hue, a corner mark and a
 * chip, so you can tell a mix from a single before reading the label.
 */
enum class MediaKind(val label: String, val tint: Color, val icon: ImageVector) {
    Playlist("Playlist", Color(0xFFA06CF5), Icons.AutoMirrored.Rounded.QueueMusic),
    Mix("Mix", Color(0xFFF0559D), Icons.Rounded.AutoAwesome),
    Single("Single", Color(0xFFF5B23C), Icons.Rounded.Album),
    Album("Album", Color(0xFF4A9DFF), Icons.Rounded.Album),
    Ep("EP", Color(0xFF2AD4C0), Icons.Rounded.Album),
    Station("Station", Color(0xFFFF5C8A), Icons.Rounded.GraphicEq),
    Artist("Artist", Color(0xFFB3B3B3), Icons.Rounded.Person),
}

/** `.type-chip` — 18px pill, 10.5px w800, type-tinted on a 15% wash. */
@Composable
fun TypeChip(kind: MediaKind) {
    Box(
        Modifier
            .clip(CircleShape)
            .background(kind.tint.copy(alpha = 0.15f))
            .padding(horizontal = 7.dp, vertical = 2.dp)
    ) {
        Text(
            kind.label.uppercase(),
            color = kind.tint,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.4.sp,
            lineHeight = 14.sp,
        )
    }
}

/**
 * `.card` — cover with the type's corner mark and silhouette, a green play
 * button on the art, then title and a sub row of `type-chip` + text.
 */
@Composable
fun ContentCard(
    title: String,
    sub: String?,
    image: String?,
    kind: MediaKind?,
    width: Dp = 148.dp,
    round: Boolean = false,
    showPlay: Boolean = true,
    onPlay: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .width(width)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(6.dp)
    ) {
        Box {
            // playlist/mix get the "stacked sheets" bars above the cover
            if (kind == MediaKind.Mix || kind == MediaKind.Playlist) {
                Column(Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
                    Box(
                        Modifier
                            .fillMaxWidth(0.72f)
                            .align(Alignment.CenterHorizontally)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(kind.tint.copy(alpha = 0.55f))
                    )
                    Spacer(Modifier.height(2.dp))
                    Box(
                        Modifier
                            .fillMaxWidth(0.86f)
                            .align(Alignment.CenterHorizontally)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(kind.tint.copy(alpha = 0.8f))
                    )
                }
            }

            Box(Modifier.padding(top = if (kind == MediaKind.Mix || kind == MediaKind.Playlist) 14.dp else 0.dp)) {
                Artwork(
                    image,
                    Modifier.size(width - 12.dp),
                    shape = if (round || kind == MediaKind.Station) CircleShape else RoundedCornerShape(6.dp),
                )

                // `.art-mark` — the type's badge in its own hue
                if (kind != null) {
                    Box(
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(kind.tint),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(kind.icon, kind.label, tint = Color.Black, modifier = Modifier.size(13.dp))
                    }
                }

                // `.card-play` is hover-only on the web, so touch layouts never
                // show it — tapping the card is what starts playback.
            }
        }

        Spacer(Modifier.height(8.dp))
        Text(
            title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            Modifier.padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (kind != null) TypeChip(kind)
            if (!sub.isNullOrBlank()) {
                Text(
                    sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = Web.sub,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** `.shortcut` — the squat tiles at the top of the web home. */
@Composable
fun ShortcutTile(
    label: String,
    icon: ImageVector,
    gradient: List<Color>,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color.White.copy(alpha = 0.10f))
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(56.dp)
                .background(androidx.compose.ui.graphics.Brush.linearGradient(gradient)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(24.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 12.dp),
        )
    }
}

/** `.section h2` */
@Composable
fun WebSectionTitle(text: String, action: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.3).sp,
            modifier = Modifier.weight(1f),
        )
        action?.invoke()
    }
}

/** `.chip` / `.chip.on` — the filter pills (white when active). */
@Composable
fun WebChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(CircleShape)
            .background(if (selected) Web.text else Color.White.copy(alpha = 0.07f))
            .clickable(onClick = onClick)
            .padding(horizontal = 15.dp, vertical = 7.dp)
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) Web.bg else Web.text,
        )
    }
}

/** `.btn-solid` — the green call-to-action pill. */
@Composable
fun SolidPill(text: String, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(CircleShape)
            .background(Web.accent)
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 9.dp)
    ) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.Black)
    }
}

/** `.btn-outline` — the pill buttons like "Customise". */
@Composable
fun OutlinePill(text: String, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(CircleShape)
            .border(1.dp, Web.sub.copy(alpha = 0.5f), CircleShape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Web.text)
    }
}

/** The palette `gradientFor()` hashes titles into for sheet/album backdrops. */
private val GRADIENTS = listOf(
    Color(0xFF8C1932), Color(0xFF1E3264), Color(0xFF537A1C), Color(0xFFA56752),
    Color(0xFF503750), Color(0xFF0F5A52), Color(0xFFAF2896), Color(0xFF7D4B32),
)

fun gradientFor(seed: String): Color =
    GRADIENTS[(seed.sumOf { it.code }.mod(GRADIENTS.size))]

/** Circular avatar with the user's initial — the web topbar's account button. */
@Composable
fun AvatarButton(name: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(
                androidx.compose.ui.graphics.Brush.linearGradient(
                    listOf(Web.accent, Web.accent2)
                )
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trim().firstOrNull()?.uppercase() ?: "?",
            color = Web.onAccent,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 15.sp,
        )
    }
}
