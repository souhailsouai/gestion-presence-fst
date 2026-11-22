package tn.utm.fst.gestionpresence.nativeapp.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HowToReg
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.TextStyle
import java.util.Locale
import tn.utm.fst.gestionpresence.nativeapp.BuildConfig
import tn.utm.fst.gestionpresence.nativeapp.R
import tn.utm.fst.gestionpresence.nativeapp.core.model.AcademicClass
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceDraft
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceRecord
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.core.model.PlanSession
import tn.utm.fst.gestionpresence.nativeapp.core.model.ReportSummary
import tn.utm.fst.gestionpresence.nativeapp.core.model.Student
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeachingSession
import tn.utm.fst.gestionpresence.nativeapp.data.repository.RepositoryData
import tn.utm.fst.gestionpresence.nativeapp.feature.main.AppScreen
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainViewModel
import tn.utm.fst.gestionpresence.nativeapp.ui.components.AnimatedWaves
import tn.utm.fst.gestionpresence.nativeapp.ui.components.WaveLayer
import tn.utm.fst.gestionpresence.nativeapp.ui.components.WaveLine
import tn.utm.fst.gestionpresence.nativeapp.ui.theme.Uphf
import tn.utm.fst.gestionpresence.nativeapp.ui.theme.UphfTheme

/* ------------------------------------------------------------------ */
/*  Outils                                                              */
/* ------------------------------------------------------------------ */

private const val S2_START = "2027-01-11"
private val FR = Locale.FRENCH

private fun classOf(groupName: String): String = groupName.replace(Regex("-G\\d+$"), "")
private fun groupOf(groupName: String): Int? = Regex("-G(\\d+)$").find(groupName)?.groupValues?.get(1)?.toIntOrNull()
private fun semesterOf(date: String): String = if (date >= S2_START) "S2" else "S1"
private fun fmt(date: String): String = runCatching { val d = LocalDate.parse(date.take(10)); "%02d/%02d/%04d".format(d.dayOfMonth, d.monthValue, d.year) }.getOrDefault(date)
private fun shortDate(date: String): String = fmt(date).take(5)
private fun dayName(date: String): String = runCatching { LocalDate.parse(date.take(10)).dayOfWeek.getDisplayName(TextStyle.FULL, FR).replaceFirstChar { it.uppercase() } }.getOrDefault("")
private fun shortName(name: String?): String = (name ?: "—").removePrefix("Dr. ").removePrefix("Dr ")
private fun today(): String = LocalDate.now().toString()
private fun currentSemester(): String = semesterOf(today())
private fun initials(name: String): String = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifBlank { "?" }

private data class Tally(val total: Int, val present: Int, val absent: Int, val late: Int, val justified: Int, val makeup: Int) {
    val rate: Float get() = if (total == 0) 0f else 100f * (present + late) / total
}

private fun tally(records: List<AttendanceRecord>) = Tally(
    total = records.size,
    present = records.count { it.status == AttendanceStatus.PRESENT },
    absent = records.count { it.status == AttendanceStatus.ABSENT },
    late = records.count { it.status == AttendanceStatus.LATE },
    justified = records.count { it.status == AttendanceStatus.JUSTIFIED },
    makeup = records.count { it.makeupDate != null }
)

private fun statusColor(status: AttendanceStatus): Color = when (status) {
    AttendanceStatus.PRESENT -> Uphf.Good
    AttendanceStatus.ABSENT -> Uphf.Bad
    AttendanceStatus.LATE -> Uphf.Late
    AttendanceStatus.JUSTIFIED -> Uphf.Justified
}

private fun statusShort(status: AttendanceStatus): String = when (status) {
    AttendanceStatus.PRESENT -> "P"
    AttendanceStatus.ABSENT -> "A"
    AttendanceStatus.LATE -> "R"
    AttendanceStatus.JUSTIFIED -> "J"
}

private fun RepositoryData.className(classId: String): String = classes.firstOrNull { it.id == classId }?.name ?: "Classe"
private fun RepositoryData.teacher(id: String?): String = id?.let { teacherNames[it] } ?: "—"

/* ------------------------------------------------------------------ */
/*  Racine                                                              */
/* ------------------------------------------------------------------ */

@Composable
fun AppRoot(viewModel: MainViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    UphfTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Uphf.Background) {
            Box(modifier = Modifier.fillMaxSize()) {
                val kind = when (state.screen) {
                    AppScreen.LOGIN -> 0
                    AppScreen.MFA_ENROLL, AppScreen.MFA_CHALLENGE -> 1
                    else -> 2
                }
                AnimatedContent(targetState = kind, transitionSpec = { fadeIn(tween(350)) togetherWith fadeOut(tween(200)) }, label = "root") { k ->
                    when (k) {
                        0 -> LoginScreen(state, viewModel)
                        1 -> MfaScreen(state, viewModel)
                        else -> MainShell(state, viewModel)
                    }
                }
                if (state.loading) {
                    if (state.data == null) {
                        Surface(color = Color.White.copy(alpha = 0.85f), modifier = Modifier.fillMaxSize()) {
                            Box(contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    CircularProgressIndicator(color = Uphf.Teal)
                                    Spacer(Modifier.height(12.dp))
                                    Text("Connexion sécurisée…", color = Uphf.Text)
                                }
                            }
                        }
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter), color = Uphf.Teal, trackColor = Uphf.TealSoft)
                    }
                }
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Connexion                                                           */
/* ------------------------------------------------------------------ */

@Composable
private fun LoginScreen(state: MainUiState, viewModel: MainViewModel) {
    var role by rememberSaveable { mutableStateOf("teacher") }
    var identifier by rememberSaveable { mutableStateOf("") }
    var credential by rememberSaveable { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(Color.White)) {
        AnimatedWaves(
            modifier = Modifier.align(Alignment.BottomCenter),
            height = 170.dp,
            layers = listOf(
                WaveLayer(Uphf.Ochre.copy(alpha = 0.30f), 0.10f, 520f, 1.0f, 0.42f),
                WaveLayer(Uphf.Teal.copy(alpha = 0.55f), 0.12f, 680f, -1.3f, 0.55f),
                WaveLayer(Uphf.Title, 0.09f, 820f, 0.8f, 0.72f)
            ),
            durationMillis = 11000
        )
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                LogoTile(R.drawable.utm_logo, 76.dp)
                LogoTile(R.drawable.fst_logo, 128.dp)
            }
            Spacer(Modifier.height(22.dp))
            Text("Gestion de Présence des TP", style = MaterialTheme.typography.headlineMedium, color = Uphf.Title, textAlign = TextAlign.Center)
            Spacer(Modifier.height(6.dp))
            Text("Faculté des Sciences de Tunis", color = Uphf.Title, fontWeight = FontWeight.SemiBold)
            Text("Université de Tunis El Manar", color = Uphf.Text)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                WaveLine(Uphf.Teal, Modifier.width(36.dp))
                Text("  Année universitaire 2026/2027  ", color = Uphf.Ochre, fontWeight = FontWeight.Bold)
                WaveLine(Uphf.Teal, Modifier.width(36.dp))
            }
            Spacer(Modifier.height(22.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth().widthIn(max = 460.dp)
            ) {
                Box(Modifier.fillMaxWidth().height(5.dp).background(Uphf.Teal))
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(Uphf.Teal), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Lock, null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("Connexion sécurisée", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                            Text("Mêmes identifiants que le site", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                        }
                    }
                    Segmented(listOf("teacher" to "Enseignant", "admin" to "Administrateur"), role) { role = it }
                    OutlinedTextField(identifier, { identifier = it }, label = { Text("Identifiant") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        credential, { credential = it }, label = { Text("Mot de passe ou PIN") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Notice(state, padded = false)
                    Button(
                        onClick = { viewModel.login(identifier.trim(), credential, role) },
                        enabled = identifier.isNotBlank() && credential.isNotBlank() && state.online,
                        shape = RoundedCornerShape(50),
                        colors = ButtonDefaults.buttonColors(containerColor = Uphf.Teal),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        Icon(Icons.Default.Lock, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Se connecter", fontWeight = FontWeight.Bold)
                    }
                    if (!state.online) OfflineCard()
                }
            }
            Spacer(Modifier.height(150.dp))
        }
    }
}

@Composable
private fun LogoTile(res: Int, width: androidx.compose.ui.unit.Dp) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(3.dp), shape = RoundedCornerShape(14.dp)) {
        Image(painterResource(res), contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.padding(8.dp).width(width).height(76.dp))
    }
}

@Composable
private fun MfaScreen(state: MainUiState, viewModel: MainViewModel) {
    var code by rememberSaveable { mutableStateOf("") }
    val enrolling = state.screen == AppScreen.MFA_ENROLL
    Column(
        modifier = Modifier.fillMaxSize().background(Color.White).verticalScroll(rememberScrollState()).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(Modifier.size(72.dp).clip(CircleShape).background(Uphf.TealSoft), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Security, null, tint = Uphf.Teal, modifier = Modifier.size(38.dp))
        }
        Spacer(Modifier.height(14.dp))
        Text(if (enrolling) "Activer la double authentification" else "Double authentification", style = MaterialTheme.typography.headlineSmall, color = Uphf.Title, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        if (enrolling) {
            Text("Ajoutez un compte dans votre application d’authentification avec la clé ci-dessous, puis saisissez le code généré.", textAlign = TextAlign.Center, color = Uphf.Text)
            state.mfaEnrollment?.let { enrollment ->
                InfoCard(Modifier.padding(vertical = 14.dp)) {
                    Text("Clé secrète", fontWeight = FontWeight.Bold, color = Uphf.Title)
                    Text(enrollment.secret, color = Uphf.Teal)
                }
            }
        } else {
            Text("Saisissez le code à 6 chiffres de votre application d’authentification.", textAlign = TextAlign.Center, color = Uphf.Text)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            code, { if (it.length <= 6) code = it.filter(Char::isDigit) }, label = { Text("Code à 6 chiffres") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth()
        )
        Notice(state, padded = false)
        Button(onClick = { viewModel.verifyMfa(code) }, enabled = code.length == 6 && state.online, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(50.dp)) {
            Text(if (enrolling) "Activer" else "Vérifier", fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = viewModel::cancelMfa, modifier = Modifier.padding(top = 6.dp)) { Text("Annuler et se déconnecter") }
    }
}

/* ------------------------------------------------------------------ */
/*  Coquille principale                                                 */
/* ------------------------------------------------------------------ */

private data class Tab(val screen: AppScreen, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab(AppScreen.HOME, "Accueil", Icons.Default.Home),
    Tab(AppScreen.SESSIONS, "Séances", Icons.Default.Event),
    Tab(AppScreen.PLANNING, "Planning", Icons.Default.CalendarMonth),
    Tab(AppScreen.STUDENTS, "Étudiants", Icons.Default.People),
    Tab(AppScreen.MORE, "Plus", Icons.Default.MoreHoriz)
)

private fun tabOf(screen: AppScreen): AppScreen = when (screen) {
    AppScreen.ATTENDANCE -> AppScreen.SESSIONS
    AppScreen.STUDENT_DETAIL -> AppScreen.STUDENTS
    AppScreen.CLASSES, AppScreen.TIMETABLE, AppScreen.TEACHERS, AppScreen.REPORTS, AppScreen.ADMIN, AppScreen.ACCOUNT, AppScreen.STATS -> AppScreen.MORE
    else -> screen
}

private fun backOf(screen: AppScreen): AppScreen? = when (screen) {
    AppScreen.ATTENDANCE -> AppScreen.SESSIONS
    AppScreen.STUDENT_DETAIL -> AppScreen.STUDENTS
    AppScreen.CLASSES, AppScreen.TIMETABLE, AppScreen.TEACHERS, AppScreen.REPORTS, AppScreen.ADMIN, AppScreen.ACCOUNT, AppScreen.STATS -> AppScreen.MORE
    else -> null
}

@Composable
private fun MainShell(state: MainUiState, viewModel: MainViewModel) {
    val current = tabOf(state.screen)
    Scaffold(
        containerColor = Uphf.Background,
        topBar = { TopBar(state, viewModel) },
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
                TABS.forEach { tab ->
                    NavigationBarItem(
                        selected = current == tab.screen,
                        onClick = { viewModel.navigate(tab.screen) },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(tab.label, maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.White,
                            indicatorColor = Uphf.Teal,
                            selectedTextColor = Uphf.Teal,
                            unselectedIconColor = Uphf.Muted,
                            unselectedTextColor = Uphf.Muted
                        )
                    )
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (!state.online) OfflineCard()
            Notice(state)
            AnimatedContent(
                targetState = state.screen,
                transitionSpec = { (fadeIn(tween(260)) + slideInVertically(tween(320)) { it / 18 }) togetherWith fadeOut(tween(140)) },
                label = "screen"
            ) { screen ->
                Box(Modifier.fillMaxSize()) {
                    when (screen) {
                        AppScreen.HOME -> HomeScreen(state, viewModel)
                        AppScreen.SESSIONS -> SessionsScreen(state, viewModel)
                        AppScreen.ATTENDANCE -> AttendanceScreen(state, viewModel)
                        AppScreen.PLANNING -> PlanningScreen(state)
                        AppScreen.STUDENTS -> StudentsScreen(state, viewModel)
                        AppScreen.STUDENT_DETAIL -> StudentDetailScreen(state, viewModel)
                        AppScreen.STATS -> StatsScreen(state)
                        AppScreen.MORE -> MoreScreen(state, viewModel)
                        AppScreen.CLASSES -> ClassesScreen(state, viewModel)
                        AppScreen.TIMETABLE -> TimetableScreen(state)
                        AppScreen.TEACHERS -> TeachersScreen(state)
                        AppScreen.REPORTS -> ReportsScreen(state)
                        AppScreen.ADMIN -> AdminScreen(state, viewModel)
                        AppScreen.ACCOUNT -> AccountScreen(state, viewModel)
                        else -> Unit
                    }
                }
            }
        }
    }
}

@Composable
private fun TopBar(state: MainUiState, viewModel: MainViewModel) {
    Column(Modifier.fillMaxWidth().background(Color.White)) {
        Box(Modifier.fillMaxWidth().height(4.dp).background(Uphf.Teal))
        Row(Modifier.fillMaxWidth().padding(start = 6.dp, end = 6.dp, top = 8.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            val back = backOf(state.screen)
            if (back != null) {
                IconButton(onClick = { viewModel.navigate(back) }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour", tint = Uphf.Title) }
            } else {
                Spacer(Modifier.width(10.dp))
                Image(painterResource(R.drawable.fst_logo), contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.height(30.dp).width(52.dp))
                Spacer(Modifier.width(8.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(screenTitle(state.screen), style = MaterialTheme.typography.titleLarge, color = Uphf.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${shortName(state.profile?.fullName)} · ${currentSemester()} · 2026/2027", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted, maxLines = 1)
            }
            IconButton(onClick = viewModel::refresh, enabled = state.online) { Icon(Icons.Default.Refresh, contentDescription = "Actualiser", tint = Uphf.Teal) }
        }
        WaveLine(Uphf.Teal.copy(alpha = 0.45f), Modifier.fillMaxWidth(), height = 8.dp)
    }
}

/* ------------------------------------------------------------------ */
/*  Éléments communs                                                    */
/* ------------------------------------------------------------------ */

@Composable
private fun Segmented(options: List<Pair<String, String>>, selected: String, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(Color(0xFFF1F4F6)).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (key, label) ->
            val on = key == selected
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(50)).background(if (on) Uphf.Teal else Color.Transparent).clickable { onSelect(key) }.padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) { Text(label, color = if (on) Color.White else Uphf.Text, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, maxLines = 1) }
        }
    }
}

@Composable
private fun ChipRow(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { (key, label) ->
            FilterChip(
                selected = key == selected,
                onClick = { onSelect(key) },
                label = { Text(label, fontWeight = FontWeight.SemiBold) },
                shape = RoundedCornerShape(6.dp),
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Uphf.Teal, selectedLabelColor = Color.White, labelColor = Uphf.Title)
            )
        }
    }
}

@Composable
private fun InfoCard(modifier: Modifier = Modifier, accent: Color? = null, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val base = modifier.fillMaxWidth()
    Card(
        modifier = if (onClick != null) base.clickable(onClick = onClick) else base,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line)
    ) {
        Row {
            if (accent != null) Box(Modifier.width(4.dp).height(IntrinsicSizeFallback).background(accent))
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
        }
    }
}

private val IntrinsicSizeFallback = 72.dp

@Composable
private fun SectionHeader(title: String, subtitle: String? = null) {
    Column(Modifier.padding(top = 6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = Uphf.Title)
        WaveLine(Uphf.Teal, Modifier.width(84.dp).padding(top = 2.dp), height = 8.dp)
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = Uphf.Muted, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun Tag(text: String, color: Color = Uphf.Teal) {
    Box(Modifier.background(color).padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, color = Color.White, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun AnimatedBar(fraction: Float, color: Color, modifier: Modifier = Modifier, height: androidx.compose.ui.unit.Dp = 10.dp) {
    val animated by animateFloatAsState(targetValue = fraction.coerceIn(0f, 1f), animationSpec = tween(900), label = "bar")
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(50)).background(Color(0xFFEDF1F5))) {
        Box(Modifier.fillMaxWidth(animated).fillMaxHeight().clip(RoundedCornerShape(50)).background(color))
    }
}

@Composable
private fun Kpi(value: String, label: String, color: Color, icon: ImageVector, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line)) {
        Column(Modifier.padding(14.dp)) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(color.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = color, modifier = Modifier.size(18.dp)) }
            Spacer(Modifier.height(8.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, color = color)
            Text(label, style = MaterialTheme.typography.bodySmall, color = Uphf.Muted, maxLines = 2)
        }
    }
}

@Composable
private fun Notice(state: MainUiState, padded: Boolean = true) {
    val message = state.error ?: state.message ?: return
    val error = state.error != null
    Card(
        colors = CardDefaults.cardColors(containerColor = if (error) Uphf.BadSoft else Uphf.TealSoft),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth().padding(horizontal = if (padded) 14.dp else 0.dp, vertical = 6.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (error) Icons.Default.Warning else Icons.Default.CheckCircle, null, tint = if (error) Uphf.Bad else Uphf.Teal)
            Spacer(Modifier.width(8.dp))
            Text(message, color = Uphf.Title)
        }
    }
}

@Composable
private fun OfflineCard() {
    Card(colors = CardDefaults.cardColors(containerColor = Uphf.BadSoft), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CloudOff, null, tint = Uphf.Bad)
            Spacer(Modifier.width(10.dp))
            Column {
                Text("Connexion Internet requise", fontWeight = FontWeight.Bold, color = Uphf.Title)
                Text("Reconnectez-vous au réseau pour consulter et enregistrer.", color = Uphf.Text)
            }
        }
    }
}

@Composable
private fun EmptyState(message: String, icon: ImageVector = Icons.Default.School) {
    Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(64.dp).clip(CircleShape).background(Uphf.TealSoft), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Uphf.Teal, modifier = Modifier.size(32.dp)) }
            Spacer(Modifier.height(10.dp))
            Text(message, textAlign = TextAlign.Center, color = Uphf.Text)
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Accueil                                                             */
/* ------------------------------------------------------------------ */

@Composable
private fun HomeScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Aucune donnée disponible.")
    val me = state.profile?.id
    val mine = data.sessions.filter { it.teacherId == me }.ifEmpty { if (state.isAdmin) data.sessions else emptyList() }
    val todays = mine.filter { it.sessionDate == today() }
    val mineIds = mine.map { it.id }.toSet()
    val records = data.attendance.filter { it.sessionId in mineIds && semesterOf(data.sessions.firstOrNull { s -> s.id == it.sessionId }?.sessionDate ?: today()) == currentSemester() }
    val t = tally(records)
    val upcoming = data.plan.filter { it.date >= today() }.flatMap { p -> p.slots.filter { it.teacherId == me }.map { p to it } }.take(3)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(14.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line)) {
                Box {
                    AnimatedWaves(
                        modifier = Modifier.align(Alignment.BottomCenter), height = 46.dp,
                        layers = listOf(WaveLayer(Uphf.Teal.copy(alpha = 0.14f), 0.18f, 420f, 1f, 0.45f), WaveLayer(Uphf.Ochre.copy(alpha = 0.14f), 0.16f, 300f, -1.4f, 0.6f))
                    )
                    Column(Modifier.padding(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 40.dp)) {
                        Tag("${dayName(today())} ${fmt(today())}")
                        Spacer(Modifier.height(10.dp))
                        Text("Bonjour, ${shortName(state.profile?.fullName)}", style = MaterialTheme.typography.headlineSmall, color = Uphf.Title)
                        Text(
                            if (todays.isEmpty()) "Aucune séance prévue aujourd’hui." else "${todays.size} séance(s) aujourd’hui — touchez pour faire l’appel.",
                            color = Uphf.Text
                        )
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Kpi("${"%.0f".format(t.rate)} %", "présence (${currentSemester()})", Uphf.rateColor(t.rate), Icons.Default.HowToReg, Modifier.weight(1f))
                Kpi("${t.absent}", "absences", Uphf.Bad, Icons.Default.Warning, Modifier.weight(1f))
                Kpi("${mine.count { semesterOf(it.sessionDate) == currentSemester() }}", "séances", Uphf.Title, Icons.Default.Event, Modifier.weight(1f))
            }
        }
        if (todays.isNotEmpty()) {
            item { SectionHeader("Aujourd’hui") }
            items(todays) { s -> SessionCard(s, data, viewModel) }
        }
        if (upcoming.isNotEmpty()) {
            item { SectionHeader("Mes prochains TP (S2)") }
            items(upcoming) { (p, slot) ->
                InfoCard(accent = Uphf.Ochre) {
                    Text("${dayName(p.date)} ${fmt(p.date)} · ${p.startTime}–${p.endTime}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                    Text("${p.className} · G${slot.groupNo}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                    Text("${slot.manipulation}${data.manipulationTitles[slot.manipulation]?.let { " — $it" } ?: ""}${slot.room?.let { " · Salle $it" } ?: ""}", color = Uphf.Teal, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        item { SectionHeader("Dernières séances") }
        items(mine.filter { it.sessionDate <= today() }.take(6)) { s -> SessionCard(s, data, viewModel) }
        if (mine.isEmpty()) item { EmptyState("Aucune séance à votre nom.", Icons.Default.Event) }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

/* ------------------------------------------------------------------ */
/*  Séances                                                             */
/* ------------------------------------------------------------------ */

@Composable
private fun SessionCard(s: TeachingSession, data: RepositoryData, viewModel: MainViewModel) {
    val recs = data.attendance.filter { it.sessionId == s.id }
    val t = tally(recs)
    val name = data.className(s.classId)
    InfoCard(accent = if (recs.isEmpty()) Uphf.Ochre else Uphf.Teal, onClick = { viewModel.selectAttendanceSession(s.id) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                Text("${dayName(s.sessionDate)} ${fmt(s.sessionDate)} · ${s.startTime}–${s.endTime}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                Text(shortName(data.teacher(s.teacherId)), color = Uphf.Text, style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Default.ChevronRight, null, tint = Uphf.Muted)
        }
        if (recs.isEmpty()) {
            Text("Appel non saisi", color = Uphf.Ochre, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AnimatedBar(t.rate / 100f, Uphf.rateColor(t.rate), Modifier.weight(1f), 8.dp)
                Text("  ${t.present + t.late}/${t.total}", color = Uphf.Title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun SessionsScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val me = state.profile?.id
    var scope by rememberSaveable { mutableStateOf(if (state.isAdmin) "all" else "mine") }
    var sem by rememberSaveable { mutableStateOf(currentSemester()) }
    var query by rememberSaveable { mutableStateOf("") }
    val list = data.sessions
        .filter { scope == "all" || it.teacherId == me }
        .filter { semesterOf(it.sessionDate) == sem }
        .filter { query.isBlank() || data.className(it.classId).contains(query.trim(), ignoreCase = true) }
        .sortedWith(compareByDescending<TeachingSession> { it.sessionDate }.thenBy { data.className(it.classId) })
    val byDate = list.groupBy { it.sessionDate }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Segmented(listOf("mine" to "Mes séances", "all" to "Toutes"), scope) { scope = it }
                Segmented(listOf("S1" to "Semestre 1", "S2" to "Semestre 2"), sem) { sem = it }
                OutlinedTextField(query, { query = it }, leadingIcon = { Icon(Icons.Default.Search, null) }, placeholder = { Text("Classe ou groupe (ex. MPI1-B)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        }
        byDate.forEach { (date, sessions) ->
            item {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Text("${dayName(date)} ${fmt(date)}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                    Spacer(Modifier.width(8.dp))
                    Text("${sessions.size} groupe(s)", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                }
            }
            items(sessions) { s -> SessionCard(s, data, viewModel) }
        }
        if (list.isEmpty()) item { EmptyState(if (sem == "S2") "Aucune séance S2 enregistrée pour l’instant." else "Aucune séance.", Icons.Default.Event) }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

/* ------------------------------------------------------------------ */
/*  Appel                                                               */
/* ------------------------------------------------------------------ */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AttendanceScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val selected = data.sessions.firstOrNull { it.id == state.selectedSessionId }
        ?: return EmptyState("Choisissez une séance dans « Séances » pour faire l’appel.", Icons.Default.HowToReg)
    val students = data.students.filter { it.classId == selected.classId }
    val saved = data.attendance.filter { it.sessionId == selected.id }.associateBy { it.studentId }
    val drafts = students.map { state.attendanceDrafts[it.id] ?: AttendanceDraft(it.id) }
    val counts = AttendanceStatus.entries.associateWith { st -> drafts.count { it.status == st } }
    var makeupFor by remember { mutableStateOf<AttendanceRecord?>(null) }
    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                InfoCard(accent = Uphf.Teal) {
                    Tag(semesterOf(selected.sessionDate))
                    Text(data.className(selected.classId), style = MaterialTheme.typography.headlineSmall, color = Uphf.Title)
                    Text("${dayName(selected.sessionDate)} ${fmt(selected.sessionDate)} · ${selected.startTime}–${selected.endTime} · ${shortName(data.teacher(selected.teacherId))}", color = Uphf.Text)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        AttendanceStatus.entries.forEach { st ->
                            Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(statusColor(st).copy(alpha = 0.10f)).padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("${counts[st] ?: 0}", style = MaterialTheme.typography.titleLarge, color = statusColor(st))
                                Text(st.label, style = MaterialTheme.typography.bodySmall, color = Uphf.Text, maxLines = 1)
                            }
                        }
                    }
                }
            }
            item {
                OutlinedButton(onClick = viewModel::markAllPresent, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.DoneAll, null); Spacer(Modifier.width(8.dp)); Text("Tous présents")
                }
            }
            items(students, key = { it.id }) { student ->
                val draft = state.attendanceDrafts[student.id] ?: AttendanceDraft(student.id)
                AttendanceRow(student, draft, saved[student.id], viewModel) { makeupFor = it }
            }
            if (students.isEmpty()) item { EmptyState("Aucun étudiant dans ce groupe.") }
        }
        ExtendedFloatingActionButton(
            onClick = viewModel::saveAttendance,
            containerColor = Uphf.Ochre,
            contentColor = Color(0xFF1D1A14),
            shape = RoundedCornerShape(50),
            icon = { Icon(Icons.Default.Save, null) },
            text = { Text("Enregistrer l’appel", fontWeight = FontWeight.Bold) },
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp)
        )
    }
    makeupFor?.let { rec -> MakeupDialog(onDismiss = { makeupFor = null }) { date -> makeupFor = null; viewModel.setMakeup(rec.id, date) } }
}

@Composable
private fun AttendanceRow(student: Student, draft: AttendanceDraft, saved: AttendanceRecord?, viewModel: MainViewModel, onMakeup: (AttendanceRecord) -> Unit) {
    var expanded by rememberSaveable(student.id) { mutableStateOf(false) }
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(36.dp).clip(CircleShape).background(statusColor(draft.status).copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                    Text(initials(student.displayName), color = statusColor(draft.status), fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f).clickable { expanded = !expanded }) {
                    Text(student.displayName, fontWeight = FontWeight.SemiBold, color = Uphf.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    saved?.makeupDate?.let { Text("Rattrapé le ${fmt(it)}", color = Uphf.Ochre, style = MaterialTheme.typography.bodySmall) }
                }
                AttendanceStatus.entries.forEach { st ->
                    val on = draft.status == st
                    Box(
                        Modifier.padding(start = 4.dp).size(38.dp).clip(CircleShape)
                            .background(if (on) statusColor(st) else Color.White)
                            .border(1.5.dp, if (on) statusColor(st) else Uphf.Line, CircleShape)
                            .clickable { viewModel.updateAttendanceStatus(student.id, st) },
                        contentAlignment = Alignment.Center
                    ) { Text(statusShort(st), color = if (on) Color.White else Uphf.Text, fontWeight = FontWeight.Bold) }
                }
            }
            if (saved != null && saved.status == AttendanceStatus.ABSENT && saved.makeupDate == null) {
                TextButton(onClick = { onMakeup(saved) }, contentPadding = PaddingValues(0.dp)) {
                    Icon(Icons.Default.Replay, null, tint = Uphf.Ochre, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Marquer « Rattrapé »…", color = Uphf.Ochre)
                }
            }
            if (expanded) {
                OutlinedTextField(draft.comment, { viewModel.updateAttendanceComment(student.id, it) }, label = { Text("Commentaire") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    draft.grade?.toString().orEmpty(), { viewModel.updateAttendanceGrade(student.id, it) }, label = { Text("Note /20 (facultative)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MakeupDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    val picker = rememberDatePickerState(initialSelectedDateMillis = System.currentTimeMillis())
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val millis = picker.selectedDateMillis ?: System.currentTimeMillis()
                onConfirm(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString())
            }) { Text("Enregistrer le rattrapage") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } }
    ) { DatePicker(state = picker, title = { Text("Date du rattrapage", modifier = Modifier.padding(start = 24.dp, top = 16.dp)) }) }
}

/* ------------------------------------------------------------------ */
/*  Planning S1 / S2                                                    */
/* ------------------------------------------------------------------ */

private val CLASS_ORDER = listOf("MPI1-A", "MPI1-B", "MPI1-C", "MPI1-D", "MPI1-E", "PC1-A")

@Composable
private fun PlanningScreen(state: MainUiState) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val me = state.profile?.id
    var sem by rememberSaveable { mutableStateOf(currentSemester()) }
    var mode by rememberSaveable { mutableStateOf("class") }
    var cls by rememberSaveable { mutableStateOf("MPI1-A") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Segmented(listOf("S1" to "Semestre 1", "S2" to "Semestre 2"), sem) { sem = it }
                Segmented(listOf("class" to "Par classe", "mine" to "Mes créneaux"), mode) { mode = it }
                if (mode == "class") ChipRow(CLASS_ORDER.map { it to it }, cls) { cls = it }
            }
        }
        if (sem == "S2") {
            if (data.plan.isEmpty()) {
                item { EmptyState("Le planning du S2 n’est pas encore généré.\nIl se prépare sur le site (Semestres → S2).", Icons.Default.CalendarMonth) }
            } else if (mode == "class") {
                val list = data.plan.filter { it.className == cls }
                items(list) { p -> PlanCard(p, data, me) }
                if (list.isEmpty()) item { EmptyState("Aucune séance S2 pour $cls.") }
            } else {
                val mine = data.plan.flatMap { p -> p.slots.filter { it.teacherId == me }.map { p to it } }
                items(mine) { (p, slot) ->
                    InfoCard(accent = Uphf.Teal) {
                        Text("${dayName(p.date)} ${fmt(p.date)} · ${p.startTime}–${p.endTime}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                        Text("${p.className} · G${slot.groupNo}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                        Text("${slot.manipulation}${data.manipulationTitles[slot.manipulation]?.let { " — $it" } ?: ""}${slot.room?.let { " · Salle $it" } ?: ""}", color = Uphf.Teal, fontWeight = FontWeight.SemiBold)
                    }
                }
                if (mine.isEmpty()) item { EmptyState("Aucun créneau S2 à votre nom.") }
            }
        } else {
            val s1 = data.sessions.filter { semesterOf(it.sessionDate) == "S1" }
            if (mode == "class") {
                val byDate = s1.filter { classOf(data.className(it.classId)) == cls }.groupBy { it.sessionDate }.toSortedMap()
                byDate.forEach { (date, sessions) ->
                    item {
                        InfoCard(accent = Uphf.Teal) {
                            Text("${dayName(date)} ${fmt(date)}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                            sessions.sortedBy { groupOf(data.className(it.classId)) ?: 0 }.chunked(2).forEach { pair ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    pair.forEach { s ->
                                        Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(Uphf.TealSoft).padding(8.dp)) {
                                            Text("G${groupOf(data.className(s.classId)) ?: "?"}", fontWeight = FontWeight.Bold, color = Uphf.Teal)
                                            Text(shortName(data.teacher(s.teacherId)), style = MaterialTheme.typography.bodySmall, color = Uphf.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        }
                                    }
                                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
                if (byDate.isEmpty()) item { EmptyState("Aucune séance S1 pour $cls.") }
            } else {
                val mine = s1.filter { it.teacherId == me }.sortedByDescending { it.sessionDate }
                items(mine) { s ->
                    InfoCard(accent = Uphf.Teal) {
                        Text("${dayName(s.sessionDate)} ${fmt(s.sessionDate)} · ${s.startTime}–${s.endTime}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
                        Text(data.className(s.classId), style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                    }
                }
                if (mine.isEmpty()) item { EmptyState("Aucune séance S1 à votre nom.") }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun PlanCard(p: PlanSession, data: RepositoryData, me: String?) {
    InfoCard(accent = if (p.locked) Uphf.Ochre else Uphf.Teal) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("${dayName(p.date)} ${fmt(p.date)}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                Text("${p.startTime}–${p.endTime} · passage ${p.occurrence}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
            }
            if (p.locked) Icon(Icons.Default.Lock, null, tint = Uphf.Ochre, modifier = Modifier.size(18.dp))
        }
        p.slots.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                pair.forEach { slot ->
                    val mine = slot.teacherId != null && slot.teacherId == me
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(if (mine) Uphf.OchreSoft else Uphf.TealSoft).padding(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("G${slot.groupNo}", fontWeight = FontWeight.Bold, color = Uphf.Title)
                            Spacer(Modifier.width(6.dp))
                            Text(slot.manipulation, fontWeight = FontWeight.ExtraBold, color = Uphf.Teal)
                            slot.room?.let { Text(" · $it", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall) }
                        }
                        Text(shortName(data.teacher(slot.teacherId)), style = MaterialTheme.typography.bodySmall, color = Uphf.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Étudiants                                                           */
/* ------------------------------------------------------------------ */

@Composable
private fun StudentsScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    var query by rememberSaveable { mutableStateOf("") }
    var cls by rememberSaveable { mutableStateOf("all") }
    val byStudent = data.attendance.groupBy { it.studentId }
    val list = data.students
        .filter { cls == "all" || classOf(data.className(it.classId)) == cls }
        .filter { s -> query.isBlank() || query.trim().split(' ').all { w -> s.displayName.contains(w, ignoreCase = true) } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(query, { query = it }, leadingIcon = { Icon(Icons.Default.Search, null) }, placeholder = { Text("Rechercher un étudiant…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                ChipRow(listOf("all" to "Toutes") + CLASS_ORDER.map { it to it }, cls) { cls = it }
                Text("${list.size} étudiant(s)", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
        items(list.take(300), key = { it.id }) { s ->
            val t = tally(byStudent[s.id].orEmpty())
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth().clickable { viewModel.openStudent(s.id) }) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).clip(CircleShape).background(Uphf.TealSoft), contentAlignment = Alignment.Center) { Text(initials(s.displayName), color = Uphf.Teal, fontWeight = FontWeight.Bold) }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.displayName, fontWeight = FontWeight.SemiBold, color = Uphf.Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(data.className(s.classId), style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                        if (t.total > 0) AnimatedBar(t.rate / 100f, Uphf.rateColor(t.rate), Modifier.padding(top = 4.dp), 6.dp)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (t.total > 0) "${"%.0f".format(t.rate)} %" else "—", color = Uphf.rateColor(t.rate), fontWeight = FontWeight.Bold)
                        if (t.absent > 0) Text("${t.absent} abs.", color = Uphf.Bad, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        if (list.isEmpty()) item { EmptyState("Aucun étudiant trouvé.", Icons.Default.Search) }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun StudentDetailScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val student = data.students.firstOrNull { it.id == state.selectedStudentId } ?: return EmptyState("Étudiant introuvable.")
    val sessionsById = data.sessions.associateBy { it.id }
    val history = data.attendance.filter { it.studentId == student.id }.sortedByDescending { sessionsById[it.sessionId]?.sessionDate ?: "" }
    val t = tally(history)
    var makeupFor by remember { mutableStateOf<AttendanceRecord?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard(accent = Uphf.Teal) {
                Text(student.displayName, style = MaterialTheme.typography.headlineSmall, color = Uphf.Title)
                Text(data.className(student.classId), color = Uphf.Text)
                AnimatedBar(t.rate / 100f, Uphf.rateColor(t.rate), Modifier.padding(top = 6.dp))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Kpi("${"%.0f".format(t.rate)} %", "présence", Uphf.rateColor(t.rate), Icons.Default.HowToReg, Modifier.weight(1f))
                Kpi("${t.absent}", "absences", Uphf.Bad, Icons.Default.Warning, Modifier.weight(1f))
                Kpi("${t.makeup}", "rattrapages", Uphf.Ochre, Icons.Default.Replay, Modifier.weight(1f))
            }
        }
        item { SectionHeader("Historique") }
        items(history) { rec ->
            val s = sessionsById[rec.sessionId]
            InfoCard(accent = statusColor(rec.status)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(s?.let { "${dayName(it.sessionDate)} ${fmt(it.sessionDate)}" } ?: "Séance", fontWeight = FontWeight.SemiBold, color = Uphf.Title)
                        Text(s?.let { "${data.className(it.classId)} · ${shortName(data.teacher(it.teacherId))}" } ?: "", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                    }
                    Box(Modifier.clip(RoundedCornerShape(6.dp)).background(statusColor(rec.status)).padding(horizontal = 10.dp, vertical = 4.dp)) {
                        Text(if (rec.makeupDate != null) "Rattrapé" else rec.status.label, color = Color.White, style = MaterialTheme.typography.labelMedium)
                    }
                }
                if (rec.makeupDate != null) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Rattrapé le ${fmt(rec.makeupDate)}", color = Uphf.Ochre, modifier = Modifier.weight(1f))
                        TextButton(onClick = { viewModel.setMakeup(rec.id, null) }) { Text("Annuler", color = Uphf.Bad) }
                    }
                } else if (rec.status == AttendanceStatus.ABSENT) {
                    TextButton(onClick = { makeupFor = rec }, contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Default.Replay, null, tint = Uphf.Ochre, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Marquer « Rattrapé »…", color = Uphf.Ochre)
                    }
                }
            }
        }
        if (history.isEmpty()) item { EmptyState("Aucune présence enregistrée.") }
        item { Spacer(Modifier.height(24.dp)) }
    }
    makeupFor?.let { rec -> MakeupDialog(onDismiss = { makeupFor = null }) { date -> makeupFor = null; viewModel.setMakeup(rec.id, date) } }
}

/* ------------------------------------------------------------------ */
/*  Statistiques                                                        */
/* ------------------------------------------------------------------ */

@Composable
private fun Donut(t: Tally, modifier: Modifier = Modifier) {
    val sweep by animateFloatAsState(targetValue = 1f, animationSpec = tween(1000), label = "donut")
    val parts = listOf(
        (t.present - t.makeup).coerceAtLeast(0) to Uphf.Good,
        t.makeup to Uphf.Ochre,
        t.late to Uphf.Late.copy(alpha = 0.6f),
        t.justified to Uphf.Justified,
        t.absent to Uphf.Bad
    ).filter { it.first > 0 }
    Box(modifier.size(150.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(150.dp)) {
            val stroke = 26.dp.toPx()
            val d = size.minDimension - stroke
            var start = -90f
            drawArc(Color(0xFFEDF1F5), 0f, 360f, false, topLeft = Offset(stroke / 2, stroke / 2), size = Size(d, d), style = Stroke(stroke))
            parts.forEach { (n, c) ->
                val angle = 360f * n / t.total.coerceAtLeast(1) * sweep
                drawArc(c, start, angle, false, topLeft = Offset(stroke / 2, stroke / 2), size = Size(d, d), style = Stroke(stroke, cap = StrokeCap.Butt))
                start += angle
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${"%.1f".format(t.rate)} %", style = MaterialTheme.typography.titleLarge, color = Uphf.Title)
            Text("présence", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
        }
    }
}

@Composable
private fun StatsScreen(state: MainUiState) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    var sem by rememberSaveable { mutableStateOf(currentSemester()) }
    var cls by rememberSaveable { mutableStateOf("all") }
    val sessionsById = data.sessions.associateBy { it.id }
    val rows = data.attendance.mapNotNull { rec -> sessionsById[rec.sessionId]?.let { s -> Triple(rec, s, data.className(s.classId)) } }
        .filter { semesterOf(it.second.sessionDate) == sem }
    val filtered = rows.filter { cls == "all" || classOf(it.third) == cls }
    val t = tally(filtered.map { it.first })
    val bars = if (cls == "all") filtered.groupBy { classOf(it.third) } else filtered.groupBy { it.third }
    val alwaysAbsent = filtered.groupBy { it.first.studentId }.filter { (_, l) -> l.size >= 2 && l.all { it.first.status == AttendanceStatus.ABSENT } }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Segmented(listOf("S1" to "Semestre 1", "S2" to "Semestre 2"), sem) { sem = it }
                ChipRow(listOf("all" to "Toutes") + CLASS_ORDER.map { it to it }, cls) { cls = it }
            }
        }
        if (filtered.isEmpty()) {
            item { EmptyState("Aucune présence enregistrée pour ce choix.", Icons.Default.BarChart) }
        } else {
            item {
                InfoCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Donut(t)
                        Spacer(Modifier.width(16.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Legend(Uphf.Good, "Présents", t.present - t.makeup)
                            Legend(Uphf.Ochre, "Rattrapés", t.makeup)
                            Legend(Uphf.Late, "Retards", t.late)
                            Legend(Uphf.Justified, "Justifiés", t.justified)
                            Legend(Uphf.Bad, "Absents", t.absent)
                        }
                    }
                }
            }
            item { SectionHeader(if (cls == "all") "Par classe" else "Groupes de $cls") }
            items(bars.toSortedMap().entries.toList()) { (key, list) ->
                val bt = tally(list.map { it.first })
                InfoCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(key, fontWeight = FontWeight.Bold, color = Uphf.Title, modifier = Modifier.weight(1f))
                        Text("${"%.1f".format(bt.rate)} %", fontWeight = FontWeight.ExtraBold, color = Uphf.rateColor(bt.rate))
                    }
                    AnimatedBar(bt.rate / 100f, Uphf.rateColor(bt.rate))
                    Text("${bt.present + bt.late}/${bt.total} · ${bt.absent} absence(s)${if (bt.makeup > 0) " · ${bt.makeup} rattrapage(s)" else ""}", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                }
            }
            item { SectionHeader("Absents à toutes les séances", "${alwaysAbsent.size} étudiant(s)") }
            items(alwaysAbsent.entries.toList()) { (studentId, l) ->
                val st = data.students.firstOrNull { it.id == studentId }
                InfoCard(accent = Uphf.Bad) {
                    Text(st?.displayName ?: "Étudiant", fontWeight = FontWeight.SemiBold, color = Uphf.Title)
                    Text("${st?.let { data.className(it.classId) } ?: ""} · ${l.size} séance(s)", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted)
                }
            }
        }
        item { Text("Une case vide du cahier n’est jamais comptée comme absence. Une absence rattrapée compte comme présence.", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted) }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun Legend(color: Color, label: String, value: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(12.dp).clip(RoundedCornerShape(3.dp)).background(color))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Uphf.Text, modifier = Modifier.width(84.dp))
        Text("$value", fontWeight = FontWeight.Bold, color = Uphf.Title)
    }
}

/* ------------------------------------------------------------------ */
/*  Plus                                                                */
/* ------------------------------------------------------------------ */

@Composable
private fun MoreScreen(state: MainUiState, viewModel: MainViewModel) {
    val entries = buildList {
        add(Triple(AppScreen.STATS, "Statistiques", Icons.Default.BarChart))
        add(Triple(AppScreen.CLASSES, "Classes et groupes", Icons.Default.Groups))
        add(Triple(AppScreen.TIMETABLE, "Emploi du temps", Icons.Default.EventAvailable))
        add(Triple(AppScreen.TEACHERS, "Enseignants", Icons.Default.School))
        add(Triple(AppScreen.REPORTS, "Rapports", Icons.Default.Assessment))
        if (state.isAdmin) add(Triple(AppScreen.ADMIN, "Administration", Icons.Default.AdminPanelSettings))
        add(Triple(AppScreen.ACCOUNT, "Sécurité du compte", Icons.Default.Security))
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            InfoCard(accent = Uphf.Teal) {
                Text(state.profile?.fullName ?: "Compte", style = MaterialTheme.typography.titleLarge, color = Uphf.Title)
                Text("${state.profile?.username ?: state.profile?.email.orEmpty()} · ${if (state.isAdmin) "Administrateur" else "Enseignant"}", color = Uphf.Muted)
            }
        }
        items(entries) { (screen, label, icon) ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth().clickable { viewModel.navigate(screen) }) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).clip(CircleShape).background(Uphf.TealSoft), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Uphf.Teal) }
                    Spacer(Modifier.width(12.dp))
                    Text(label, fontWeight = FontWeight.SemiBold, color = Uphf.Title, modifier = Modifier.weight(1f))
                    Icon(Icons.Default.ChevronRight, null, tint = Uphf.Muted)
                }
            }
        }
        item {
            OutlinedButton(onClick = viewModel::logout, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Icon(Icons.AutoMirrored.Filled.Logout, null); Spacer(Modifier.width(8.dp)); Text("Se déconnecter")
            }
        }
        item { Text("Version ${BuildConfig.VERSION_NAME} · Faculté des Sciences de Tunis", style = MaterialTheme.typography.bodySmall, color = Uphf.Muted, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
    }
}

/* ------------------------------------------------------------------ */
/*  Écrans de gestion (repris de la version précédente, restylés)       */
/* ------------------------------------------------------------------ */

@Composable
private fun ClassesScreen(state: MainUiState, viewModel: MainViewModel) {
    val classes = state.data?.classes.orEmpty()
    var module by rememberSaveable { mutableStateOf("") }
    var track by rememberSaveable { mutableStateOf("MPI") }
    var classNumber by rememberSaveable { mutableStateOf("1") }
    var groupNumber by rememberSaveable { mutableStateOf("1") }
    var day by rememberSaveable { mutableStateOf("") }
    var start by rememberSaveable { mutableStateOf("") }
    var end by rememberSaveable { mutableStateOf("") }
    var room by rememberSaveable { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionHeader("Classes et groupes", "${classes.size} groupe(s)") }
        if (state.isAdmin) item {
            FormCard("Nouveau groupe") {
                OutlinedTextField(module, { module = it }, label = { Text("Module") }, modifier = Modifier.fillMaxWidth())
                Segmented(listOf("MPI" to "MPI", "PC" to "PC"), track) { track = it; if (it == "PC") classNumber = "1" }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(classNumber, { classNumber = it.filter(Char::isDigit) }, label = { Text("Classe") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(groupNumber, { groupNumber = it.filter(Char::isDigit) }, label = { Text("Groupe") }, modifier = Modifier.weight(1f))
                }
                OutlinedTextField(day, { day = it }, label = { Text("Jour") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(start, { start = it }, label = { Text("Début HH:mm") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(end, { end = it }, label = { Text("Fin HH:mm") }, modifier = Modifier.weight(1f))
                }
                OutlinedTextField(room, { room = it }, label = { Text("Salle") }, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = {
                        val number = classNumber.toIntOrNull() ?: 0
                        val group = groupNumber.toIntOrNull() ?: 0
                        viewModel.addClass("$track$number-G$group", module, track, number, group, day.ifBlank { null }, start.ifBlank { null }, end.ifBlank { null }, room.ifBlank { null })
                    },
                    enabled = state.online, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()
                ) { Text("Ajouter le groupe") }
            }
        }
        items(classes) { item -> ClassCard(item, state.isAdmin, viewModel) }
        if (classes.isEmpty()) item { EmptyState("Aucune classe.") }
    }
}

@Composable
private fun ClassCard(item: AcademicClass, admin: Boolean, viewModel: MainViewModel) {
    InfoCard(accent = Uphf.Teal) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(item.name, style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                Text(item.module, color = Uphf.Teal)
                val details = listOfNotNull(item.day, item.startTime?.let { s -> item.endTime?.let { "$s-$it" } }, item.room).joinToString(" · ")
                if (details.isNotBlank()) Text(details, color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
            }
            if (admin) IconButton(onClick = { viewModel.deleteClass(item.id) }) { Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = Uphf.Bad) }
        }
    }
}

@Composable
private fun TimetableScreen(state: MainUiState) {
    val rows = state.data?.classes.orEmpty().filter { it.day != null || it.startTime != null }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionHeader("Emploi du temps", "Créneaux des groupes") }
        items(rows) { item ->
            InfoCard(accent = Uphf.Teal) {
                Text("${item.day ?: "Jour"} · ${item.startTime ?: "--:--"}–${item.endTime ?: "--:--"}", style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
                Text("${item.name} · ${item.module} · ${item.room ?: "Salle non définie"}", color = Uphf.Muted)
            }
        }
        if (rows.isEmpty()) item { EmptyState("Aucun créneau planifié.") }
    }
}

@Composable
private fun TeachersScreen(state: MainUiState) {
    val names = state.data?.teacherNames.orEmpty().entries.sortedBy { it.value }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { SectionHeader("Enseignants", "${names.size} enseignant(s)") }
        items(names) { (_, name) ->
            InfoCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(38.dp).clip(CircleShape).background(Uphf.OchreSoft), contentAlignment = Alignment.Center) { Text(initials(shortName(name)), color = Uphf.Ochre, fontWeight = FontWeight.Bold) }
                    Spacer(Modifier.width(12.dp))
                    Text(name, fontWeight = FontWeight.SemiBold, color = Uphf.Title)
                }
            }
        }
        if (names.isEmpty()) item { EmptyState("Aucun enseignant visible.") }
    }
}

@Composable
private fun ReportsScreen(state: MainUiState) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionHeader("Rapports", "Synthèse par groupe") }
        items(state.reports.filter { it.totalRecords > 0 }) { report -> ReportCard(report) }
        if (state.reports.none { it.totalRecords > 0 }) item { EmptyState("Aucun rapport disponible.") }
    }
}

@Composable
private fun ReportCard(report: ReportSummary) {
    val rate = if (report.totalRecords == 0) 0f else 100f * (report.present + report.late) / report.totalRecords
    InfoCard(accent = Uphf.rateColor(rate)) {
        Text(report.title, fontWeight = FontWeight.Bold, color = Uphf.Title)
        AnimatedBar(rate / 100f, Uphf.rateColor(rate))
        Text("Présents ${report.present} · Absents ${report.absent} · Retards ${report.late} · Justifiés ${report.justified}", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
        report.averageGrade?.let { Text("Moyenne : ${"%.2f".format(it)}/20", color = Uphf.Teal) }
    }
}

@Composable
private fun AdminScreen(state: MainUiState, viewModel: MainViewModel) {
    if (!state.isAdmin) return EmptyState("Droits administrateur requis.")
    var username by rememberSaveable { mutableStateOf("") }
    var fullName by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var adminPin by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader("Administration", "Actions protégées et journalisées")
        FormCard("Créer un enseignant") {
            OutlinedTextField(username, { username = it }, label = { Text("Identifiant") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(fullName, { fullName = it }, label = { Text("Nom complet") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Mot de passe initial") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button(onClick = { viewModel.adminCreateTeacher(username, fullName, password) }, enabled = state.online, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Créer le compte") }
        }
        FormCard("PIN administrateur") {
            OutlinedTextField(adminPin, { if (it.length <= 12) adminPin = it.filter(Char::isDigit) }, label = { Text("Nouveau PIN (6 à 12 chiffres)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button(onClick = { viewModel.adminSetPin(adminPin) }, enabled = state.online && adminPin.length >= 6, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) { Text("Modifier le PIN") }
        }
        Text("Le planning du S2, les groupes et les dates exclues se gèrent sur le site (Semestres → S2).", color = Uphf.Muted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun AccountScreen(state: MainUiState, viewModel: MainViewModel) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionHeader("Sécurité du compte", "Appareils de double authentification") }
        items(state.factors) { factor ->
            InfoCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Security, null, tint = Uphf.Teal)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(factor.friendlyName, fontWeight = FontWeight.Bold, color = Uphf.Title)
                        Text(factor.status, color = Uphf.Muted)
                    }
                    OutlinedButton(onClick = { viewModel.removeMfa(factor.id) }, shape = RoundedCornerShape(50)) { Text("Retirer") }
                }
            }
        }
        item {
            Button(onClick = viewModel::beginMfaEnrollment, enabled = state.online, shape = RoundedCornerShape(50), modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Security, null); Spacer(Modifier.width(8.dp)); Text("Ajouter un appareil")
            }
        }
    }
}

@Composable
private fun FormCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Uphf.Line), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Uphf.Title)
            HorizontalDivider(color = Uphf.Line)
            content()
        }
    }
}

private fun screenTitle(screen: AppScreen): String = when (screen) {
    AppScreen.HOME -> "Accueil"
    AppScreen.SESSIONS -> "Séances"
    AppScreen.ATTENDANCE -> "Appel"
    AppScreen.PLANNING -> "Planning"
    AppScreen.STUDENTS -> "Étudiants"
    AppScreen.STUDENT_DETAIL -> "Fiche étudiant"
    AppScreen.STATS -> "Statistiques"
    AppScreen.MORE -> "Plus"
    AppScreen.CLASSES -> "Classes et groupes"
    AppScreen.TIMETABLE -> "Emploi du temps"
    AppScreen.TEACHERS -> "Enseignants"
    AppScreen.REPORTS -> "Rapports"
    AppScreen.ADMIN -> "Administration"
    AppScreen.ACCOUNT -> "Sécurité"
    else -> "Gestion Présence FST"
}
