package com.marusic.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.marusic.app.appContainer
import com.marusic.app.ui.screens.AlbumScreen
import com.marusic.app.ui.screens.ArtistScreen
import com.marusic.app.ui.screens.DiscoverScreen
import com.marusic.app.ui.screens.HomeScreen
import com.marusic.app.ui.screens.JamScreen
import com.marusic.app.ui.screens.LibraryScreen
import com.marusic.app.ui.screens.LikedSongsScreen
import com.marusic.app.ui.screens.LoginScreen
import com.marusic.app.ui.screens.NowPlayingScreen
import com.marusic.app.ui.screens.PlaylistScreen
import com.marusic.app.ui.screens.ProfileScreen
import com.marusic.app.ui.screens.PublicPlaylistScreen
import com.marusic.app.ui.screens.SearchScreen
import com.marusic.app.ui.screens.SharedPlaylistScreen
import com.marusic.app.ui.theme.MarusicTheme

class MainActivity : ComponentActivity() {

    private lateinit var playerConnection: PlayerConnection

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        playerConnection = PlayerConnection(this)

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            MarusicTheme {
                AppRoot(playerConnection)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        playerConnection.connect()
    }

    override fun onStop() {
        playerConnection.release()
        super.onStop()
    }
}

@Composable
private fun AppRoot(pc: PlayerConnection) {
    val container = LocalContext.current.appContainer
    val settings by container.settings.flow.collectAsState(initial = null)
    val s = settings
    when {
        s == null ->
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {}
        !s.loggedIn -> LoginScreen()
        else -> MainScaffold(pc)
    }
}

private data class TabDest(val route: String, val label: String, val icon: ImageVector)

// same five destinations as the web app's .mobile-nav
private val TABS = listOf(
    TabDest("home", "Home", Icons.Rounded.Home),
    TabDest("search", "Search", Icons.Rounded.Search),
    TabDest("discover", "Discover", Icons.Rounded.AutoAwesome),
    TabDest("library", "Library", Icons.Rounded.LibraryMusic),
    TabDest("profile", "Profile", Icons.Rounded.Person),
)

@Composable
private fun MainScaffold(pc: PlayerConnection) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    // strip the optional query part so "library?tab={tab}" still matches its tab
    val route = backStack?.destination?.route?.substringBefore("?")

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (route != "now") {
                Column {
                    MiniPlayer(pc) { nav.navigate("now") }
                    NavigationBar {
                        TABS.forEach { tab ->
                            NavigationBarItem(
                                selected = route == tab.route,
                                onClick = {
                                    nav.navigate(tab.route) {
                                        popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(tab.icon, tab.label) },
                                label = { Text(tab.label) },
                            )
                        }
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = "home",
            modifier = Modifier.padding(padding),
        ) {
            composable("home") { HomeScreen(pc, nav) }
            composable("search") { SearchScreen(pc, nav) }
            composable("discover") { DiscoverScreen(pc, nav) }
            composable(
                "library?tab={tab}",
                arguments = listOf(navArgument("tab") { defaultValue = "0" }),
            ) { entry ->
                LibraryScreen(pc, nav, entry.arguments?.getString("tab")?.toIntOrNull() ?: 0)
            }
            composable("profile") { ProfileScreen(pc, nav) }
            composable("collection/liked") { LikedSongsScreen(pc, nav) }
            composable("jam") { JamScreen(pc, nav) }
            composable("now") { NowPlayingScreen(pc, nav) }
            composable("playlist/{id}") { entry ->
                PlaylistScreen(pc, nav, entry.arguments?.getString("id")?.toLongOrNull() ?: -1L)
            }
            composable("album/{token}") { entry ->
                AlbumScreen(pc, nav, entry.arguments?.getString("token").orEmpty())
            }
            composable("artist/{id}") { entry ->
                ArtistScreen(pc, nav, entry.arguments?.getString("id").orEmpty())
            }
            composable("ytpl/{browseId}") { entry ->
                PublicPlaylistScreen(pc, nav, entry.arguments?.getString("browseId").orEmpty())
            }
            composable("shared/{token}") { entry ->
                SharedPlaylistScreen(pc, nav, entry.arguments?.getString("token").orEmpty())
            }
        }
    }
}

fun NavHostController.openAlbum(token: String) = navigate("album/${android.net.Uri.encode(token)}")
fun NavHostController.openArtist(id: String) = navigate("artist/${android.net.Uri.encode(id)}")
fun NavHostController.openPlaylist(id: Long) = navigate("playlist/$id")
fun NavHostController.openPublicPlaylist(browseId: String) = navigate("ytpl/${android.net.Uri.encode(browseId)}")
fun NavHostController.openShared(token: String) = navigate("shared/${android.net.Uri.encode(token)}")
