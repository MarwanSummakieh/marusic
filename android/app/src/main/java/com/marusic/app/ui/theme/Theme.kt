package com.marusic.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// One-to-one with the web app's :root custom properties (public/styles.css):
// the pink/purple identity from design/mobile-redesign.
object Web {
    val bg = Color(0xFF0B0712)         // --bg
    val panel = Color(0xFF140D20)      // --panel
    val raised = Color(0xFF1D1430)     // --raised
    val raisedHover = Color(0xFF2B1F45)// --raised-hover
    val highlight = Color(0xFF322550)  // --highlight
    val text = Color(0xFFFFFFFF)       // --text
    val sub = Color(0xFFB6A8C9)        // --sub
    val accent = Color(0xFFF0559D)     // --accent
    val accentHover = Color(0xFFFF6CAE)// --accent-hover
    val accent2 = Color(0xFF9B6CF5)    // --accent-2
    val border = Color(0xFF251A38)     // --border
    val sheetMid = Color(0xFF160E22)   // np-sheet gradient midpoint
    val onAccent = Color(0xFF14091D)   // dark ink the mockup sets on gradients
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
