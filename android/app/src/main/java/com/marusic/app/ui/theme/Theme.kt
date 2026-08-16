package com.marusic.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// One-to-one with the web app's :root custom properties (public/styles.css).
object Web {
    val bg = Color(0xFF000000)         // --bg
    val panel = Color(0xFF121212)      // --panel
    val raised = Color(0xFF181818)     // --raised
    val raisedHover = Color(0xFF282828)// --raised-hover
    val highlight = Color(0xFF2A2A2A)  // --highlight
    val text = Color(0xFFFFFFFF)       // --text
    val sub = Color(0xFFB3B3B3)        // --sub
    val accent = Color(0xFF1DB954)     // --accent
    val accentHover = Color(0xFF1ED760)// --accent-hover
    val border = Color(0xFF292929)     // --border
    val sheetMid = Color(0xFF16161A)   // np-sheet gradient midpoint
}

private val Colors = darkColorScheme(
    primary = Web.accent,
    onPrimary = Color.Black,
    primaryContainer = Web.accentHover,
    onPrimaryContainer = Color.Black,
    secondary = Web.accentHover,
    onSecondary = Color.Black,
    background = Web.bg,
    onBackground = Web.text,
    surface = Web.panel,
    onSurface = Web.text,
    surfaceVariant = Web.raised,
    onSurfaceVariant = Web.sub,
    surfaceContainer = Web.panel,
    surfaceContainerHigh = Web.raised,
    surfaceContainerHighest = Web.raisedHover,
    outline = Web.border,
    outlineVariant = Web.highlight,
    error = Color(0xFFF15E6C),
)

@Composable
fun MarusicTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, content = content)
}
