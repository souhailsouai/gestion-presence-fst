package tn.utm.fst.gestionpresence.nativeapp.ui

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.HowToReg
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import tn.utm.fst.gestionpresence.nativeapp.core.model.AcademicClass
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceDraft
import tn.utm.fst.gestionpresence.nativeapp.core.model.AttendanceStatus
import tn.utm.fst.gestionpresence.nativeapp.core.model.ReportSummary
import tn.utm.fst.gestionpresence.nativeapp.core.model.Student
import tn.utm.fst.gestionpresence.nativeapp.core.model.TeachingSession
import tn.utm.fst.gestionpresence.nativeapp.feature.main.AppScreen
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainUiState
import tn.utm.fst.gestionpresence.nativeapp.feature.main.MainViewModel

private val Navy = Color(0xFF082E63)
private val Blue = Color(0xFF0B67B2)
private val Gold = Color(0xFFD49A19)
private val PaleBlue = Color(0xFFF0F7FF)
private val ErrorRed = Color(0xFFB3261E)

@Composable
fun AppRoot(viewModel: MainViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Navy,
            secondary = Gold,
            tertiary = Blue,
            background = PaleBlue,
            surface = Color.White,
            error = ErrorRed
        )
    ) {
        Surface(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize()) {
                if (state.screen == AppScreen.LOGIN) LoginScreen(state, viewModel) else MainShell(state, viewModel)
                if (state.loading) {
                    Surface(color = Color.White.copy(alpha = 0.78f), modifier = Modifier.fillMaxSize()) {
                        Box(contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(state: MainUiState, viewModel: MainViewModel) {
    var role by rememberSaveable { mutableStateOf("teacher") }
    var identifier by rememberSaveable { mutableStateOf("") }
    var credential by rememberSaveable { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("FST", style = MaterialTheme.typography.displayMedium, color = Navy, fontWeight = FontWeight.Bold)
        Text("Faculté des Sciences de Tunis", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text("Université de Tunis El Manar", color = Blue)
        Text("Gestion de Présence — 2026/2027", color = Gold, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(role == "teacher", { role = "teacher" }, label = { Text("Enseignant") })
            FilterChip(role == "admin", { role = "admin" }, label = { Text("Administrateur") })
        }
        OutlinedTextField(identifier, { identifier = it }, label = { Text("Identifiant") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(credential, { credential = it }, label = { Text("Mot de passe ou PIN") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        Notice(state)
        Button(onClick = { viewModel.login(identifier.trim(), credential, role) }, enabled = state.online && identifier.isNotBlank() && credential.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Lock, null)
            Spacer(Modifier.width(8.dp))
            Text("Se connecter")
        }
        if (!state.online) OfflineCard()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainShell(state: MainUiState, viewModel: MainViewModel) {
    val detailScreen = state.screen !in setOf(AppScreen.HOME, AppScreen.SESSIONS, AppScreen.ATTENDANCE)
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(screenTitle(state.screen), fontWeight = FontWeight.Bold)
                        Text(state.profile?.fullName.orEmpty(), style = MaterialTheme.typography.labelSmall, color = Blue)
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refresh, enabled = state.online) { Icon(Icons.Default.Refresh, "Actualiser") }
                    IconButton(onClick = viewModel::logout) { Icon(Icons.Default.Logout, "Déconnexion") }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavItem(state.screen == AppScreen.HOME, { viewModel.navigate(AppScreen.HOME) }, Icons.Default.Home, "Accueil")
                NavItem(state.screen == AppScreen.SESSIONS, { viewModel.navigate(AppScreen.SESSIONS) }, Icons.Default.Event, "Séances")
                NavItem(state.screen == AppScreen.ATTENDANCE, { viewModel.navigate(AppScreen.ATTENDANCE) }, Icons.Default.HowToReg, "Présence")
                NavItem(detailScreen, { viewModel.navigate(AppScreen.CLASSES) }, Icons.Default.MoreHoriz, "Plus")
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (!state.online) OfflineCard()
            Notice(state)
            if (detailScreen) MoreNavigation(state, viewModel)
            Box(Modifier.fillMaxSize()) {
                when (state.screen) {
                    AppScreen.HOME -> HomeScreen(state)
                    AppScreen.CLASSES -> ClassesScreen(state, viewModel)
                    AppScreen.TIMETABLE -> TimetableScreen(state)
                    AppScreen.TEACHERS -> TeachersScreen(state)
                    AppScreen.STUDENTS -> StudentsScreen(state, viewModel)
                    AppScreen.SESSIONS -> SessionsScreen(state, viewModel)
                    AppScreen.ATTENDANCE -> AttendanceScreen(state, viewModel)
                    AppScreen.REPORTS -> ReportsScreen(state)
                    AppScreen.ADMIN -> AdminScreen(state, viewModel)
                    AppScreen.ACCOUNT -> ProfileScreen(state, viewModel)
                    AppScreen.LOGIN -> Unit
                }
            }
        }
    }
}

@Composable
private fun NavItem(selected: Boolean, onClick: () -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    NavigationBarItem(selected = selected, onClick = onClick, icon = { Icon(icon, null) }, label = { Text(label) })
}

@Composable
private fun MoreNavigation(state: MainUiState, viewModel: MainViewModel) {
    val destinations = buildList {
        add(AppScreen.CLASSES to "Classes")
        add(AppScreen.TIMETABLE to "Emploi")
        add(AppScreen.TEACHERS to "Enseignants")
        add(AppScreen.STUDENTS to "Étudiants")
        add(AppScreen.REPORTS to "Rapports")
        add(AppScreen.ACCOUNT to "Compte")
        if (state.isAdmin) add(AppScreen.ADMIN to "Administration")
    }
    LazyRow(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(destinations) { (screen, label) -> FilterChip(state.screen == screen, { viewModel.navigate(screen) }, label = { Text(label) }) }
    }
}

@Composable
private fun Notice(state: MainUiState) {
    val message = state.error ?: state.message ?: return
    val error = state.error != null
    Card(colors = CardDefaults.cardColors(containerColor = if (error) Color(0xFFFFE9E7) else Color(0xFFE7F5EC)), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (error) Icons.Default.Warning else Icons.Default.CheckCircle, null, tint = if (error) ErrorRed else Color(0xFF237A3C))
            Spacer(Modifier.width(8.dp))
            Text(message)
        }
    }
}

@Composable
private fun OfflineCard() {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CloudOff, null, tint = ErrorRed)
            Spacer(Modifier.width(8.dp))
            Text("Connexion Internet requise")
        }
    }
}

@Composable
private fun HomeScreen(state: MainUiState) {
    val data = state.data ?: return EmptyState("Aucune donnée disponible.")
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Tableau de bord", "Données centrales Supabase") }
        item { SimpleCard("Classes", data.stats.classCount.toString()) }
        item { SimpleCard("Étudiants", data.stats.studentCount.toString()) }
        item { SimpleCard("Séances", data.stats.sessionCount.toString()) }
        item { SimpleCard("Appels", data.stats.attendanceCount.toString()) }
    }
}

@Composable
private fun ClassesScreen(state: MainUiState, viewModel: MainViewModel) {
    val classes = state.data?.classes.orEmpty()
    var module by rememberSaveable { mutableStateOf("") }
    var track by rememberSaveable { mutableStateOf("MPI") }
    var classNumber by rememberSaveable { mutableStateOf("1") }
    var groupNumber by rememberSaveable { mutableStateOf("1") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Classes et groupes", "Gestion des groupes affectés") }
        item {
            FormCard("Nouvelle classe") {
                OutlinedTextField(module, { module = it }, label = { Text("Module") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(track == "MPI", { track = "MPI" }, label = { Text("MPI") })
                    FilterChip(track == "PC", { track = "PC"; classNumber = "1" }, label = { Text("PC") })
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(classNumber, { classNumber = it.filter(Char::isDigit) }, label = { Text("Classe") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(groupNumber, { groupNumber = it.filter(Char::isDigit) }, label = { Text("Groupe") }, modifier = Modifier.weight(1f))
                }
                Button(onClick = {
                    val cn = classNumber.toIntOrNull() ?: 0
                    val gn = groupNumber.toIntOrNull() ?: 0
                    viewModel.addClass("$track$cn-G$gn", module, track, cn, gn, null, null, null, null)
                }, enabled = state.online, modifier = Modifier.fillMaxWidth()) { Text("Ajouter la classe") }
            }
        }
        items(classes) { item ->
            ElevatedCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(item.name, fontWeight = FontWeight.Bold); Text(item.module, color = Blue) }
                    IconButton({ viewModel.deleteClass(item.id) }) { Icon(Icons.Default.Delete, "Supprimer", tint = ErrorRed) }
                }
            }
        }
    }
}

@Composable
private fun TimetableScreen(state: MainUiState) {
    val rows = state.data?.classes.orEmpty().filter { it.day != null || it.startTime != null }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Emploi du temps", "Créneaux autorisés") }
        items(rows) { item -> SimpleCard("${item.day ?: "Jour"} • ${item.startTime ?: "--:--"}-${item.endTime ?: "--:--"}", "${item.name} • ${item.module} • ${item.room ?: "Salle non définie"}") }
        if (rows.isEmpty()) item { EmptyState("Aucun créneau planifié.") }
    }
}

@Composable
private fun TeachersScreen(state: MainUiState) {
    val rows = state.data?.directory.orEmpty()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Annuaire des enseignants", "Informations institutionnelles autorisées") }
        items(rows) { item ->
            SimpleCard(item.teacherName, listOfNotNull(item.module, item.track, item.day, item.room).joinToString(" • "))
        }
        if (rows.isEmpty()) item { EmptyState("Aucun enseignant visible.") }
    }
}

@Composable
private fun StudentsScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    var selectedClassId by rememberSaveable { mutableStateOf(data.classes.firstOrNull()?.id.orEmpty()) }
    var lastName by rememberSaveable { mutableStateOf("") }
    var firstName by rememberSaveable { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Étudiants", "Gestion des étudiants par classe") }
        item {
            FormCard("Nouvel étudiant") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(data.classes) { item -> FilterChip(selectedClassId == item.id, { selectedClassId = item.id }, label = { Text(item.name) }) } }
                OutlinedTextField(lastName, { lastName = it }, label = { Text("Nom") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(firstName, { firstName = it }, label = { Text("Prénom") }, modifier = Modifier.fillMaxWidth())
                Button({ viewModel.addStudent(selectedClassId, lastName, firstName, null) }, enabled = state.online && selectedClassId.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Ajouter l’étudiant") }
            }
        }
        items(data.students) { student -> StudentCard(student, data.classes, viewModel) }
    }
}

@Composable
private fun StudentCard(student: Student, classes: List<AcademicClass>, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text(student.displayName, fontWeight = FontWeight.Bold); Text(classes.firstOrNull { it.id == student.classId }?.name ?: "Classe") }
            IconButton({ viewModel.deleteStudent(student.id) }) { Icon(Icons.Default.Delete, "Supprimer", tint = ErrorRed) }
        }
    }
}

@Composable
private fun SessionsScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    var selectedClassId by rememberSaveable { mutableStateOf(data.classes.firstOrNull()?.id.orEmpty()) }
    var date by rememberSaveable { mutableStateOf(java.time.LocalDate.now().toString()) }
    var start by rememberSaveable { mutableStateOf("08:00") }
    var end by rememberSaveable { mutableStateOf("10:00") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Séances", "Création et suivi") }
        item {
            FormCard("Nouvelle séance") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(data.classes) { item -> FilterChip(selectedClassId == item.id, { selectedClassId = item.id }, label = { Text(item.name) }) } }
                OutlinedTextField(date, { date = it }, label = { Text("Date AAAA-MM-JJ") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(start, { start = it }, label = { Text("Début") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(end, { end = it }, label = { Text("Fin") }, modifier = Modifier.weight(1f))
                }
                Button({ viewModel.addSession(selectedClassId, date, start, end) }, enabled = state.online && selectedClassId.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Créer la séance") }
            }
        }
        items(data.sessions) { item -> SessionCard(item, data.classes, viewModel) }
    }
}

@Composable
private fun SessionCard(item: TeachingSession, classes: List<AcademicClass>, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(classes.firstOrNull { it.id == item.classId }?.name ?: "Classe", fontWeight = FontWeight.Bold)
            Text("${item.sessionDate} • ${item.startTime}-${item.endTime}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button({ viewModel.selectAttendanceSession(item.id) }) { Text("Appel") }
                if (item.completedAt == null) OutlinedButton({ viewModel.completeSession(item) }) { Text("Terminer") }
                IconButton({ viewModel.deleteSession(item.id) }) { Icon(Icons.Default.Delete, "Supprimer", tint = ErrorRed) }
            }
        }
    }
}

@Composable
private fun AttendanceScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val selected = data.sessions.firstOrNull { it.id == state.selectedSessionId }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Saisie des présences", "Enregistrement atomique avec contrôle de révision") }
        item { LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(data.sessions) { item -> FilterChip(state.selectedSessionId == item.id, { viewModel.selectAttendanceSession(item.id) }, label = { Text("${item.sessionDate} ${item.startTime}") }) } } }
        if (selected == null) {
            item { EmptyState("Sélectionnez une séance.") }
        } else {
            val students = data.students.filter { it.classId == selected.classId }
            items(students) { student -> AttendanceRow(student, state.attendanceDrafts[student.id] ?: AttendanceDraft(student.id), viewModel) }
            item { Button(viewModel::saveAttendance, enabled = state.online && students.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text("Enregistrer la feuille") } }
        }
    }
}

@Composable
private fun AttendanceRow(student: Student, draft: AttendanceDraft, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(student.displayName, fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { items(AttendanceStatus.entries) { status -> FilterChip(draft.status == status, { viewModel.updateAttendanceStatus(student.id, status) }, label = { Text(status.label) }) } }
            OutlinedTextField(draft.comment, { viewModel.updateAttendanceComment(student.id, it) }, label = { Text("Commentaire") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(draft.grade?.toString().orEmpty(), { viewModel.updateAttendanceGrade(student.id, it) }, label = { Text("Note /20 facultative") }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ReportsScreen(state: MainUiState) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Rapports", "Synthèse des données centrales") }
        items(state.reports) { report -> ReportCard(report) }
        if (state.reports.isEmpty()) item { EmptyState("Aucun rapport disponible.") }
    }
}

@Composable
private fun ReportCard(report: ReportSummary) {
    SimpleCard(report.title, "Total ${report.totalRecords} • Présents ${report.present} • Absents ${report.absent} • Retards ${report.late} • Justifiés ${report.justified}${report.averageGrade?.let { " • Moyenne %.2f/20".format(it) } ?: ""}")
}

@Composable
private fun AdminScreen(state: MainUiState, viewModel: MainViewModel) {
    if (!state.isAdmin) return EmptyState("Droits administrateur requis.")
    var username by rememberSaveable { mutableStateOf("") }
    var fullName by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var adminPin by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle("Administration", "Actions privilégiées journalisées et réservées aux administrateurs")
        FormCard("Créer un enseignant") {
            OutlinedTextField(username, { username = it }, label = { Text("Identifiant") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(fullName, { fullName = it }, label = { Text("Nom complet") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Mot de passe initial") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button({ viewModel.adminCreateTeacher(username, fullName, password) }, enabled = state.online, modifier = Modifier.fillMaxWidth()) { Text("Créer le compte") }
        }
        FormCard("PIN administrateur") {
            OutlinedTextField(adminPin, { if (it.length <= 12) adminPin = it.filter(Char::isDigit) }, label = { Text("Nouveau PIN 6 à 12 chiffres") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button({ viewModel.adminSetPin(adminPin) }, enabled = state.online && adminPin.length >= 6, modifier = Modifier.fillMaxWidth()) { Text("Modifier le PIN") }
        }
    }
}

@Composable
private fun ProfileScreen(state: MainUiState, viewModel: MainViewModel) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Compte", "Informations du compte connecté") }
        item { SimpleCard(state.profile?.fullName ?: "Compte", "${state.profile?.username ?: state.profile?.email.orEmpty()} • rôle ${state.profile?.role ?: "teacher"}") }
        item { OutlinedButton(viewModel::logout, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Logout, null); Spacer(Modifier.width(8.dp)); Text("Se déconnecter") } }
    }
}

@Composable
private fun FormCard(title: String, content: @Composable Column.() -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(title, fontWeight = FontWeight.Bold); content() } }
}

@Composable
private fun SimpleCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(title, fontWeight = FontWeight.Bold); if (subtitle.isNotBlank()) Text(subtitle) } }
}

@Composable
private fun SectionTitle(title: String, subtitle: String) {
    Column { Text(title, style = MaterialTheme.typography.headlineSmall, color = Navy); Text(subtitle, color = Blue); Spacer(Modifier.height(4.dp)); HorizontalDivider() }
}

@Composable
private fun EmptyState(message: String) {
    Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Default.School, null, tint = Blue); Spacer(Modifier.height(8.dp)); Text(message, textAlign = TextAlign.Center) } }
}

private fun screenTitle(screen: AppScreen): String = when (screen) {
    AppScreen.HOME -> "Gestion Présence FST"
    AppScreen.CLASSES -> "Classes et groupes"
    AppScreen.TIMETABLE -> "Emploi du temps"
    AppScreen.TEACHERS -> "Enseignants"
    AppScreen.STUDENTS -> "Étudiants"
    AppScreen.SESSIONS -> "Séances"
    AppScreen.ATTENDANCE -> "Présence"
    AppScreen.REPORTS -> "Rapports"
    AppScreen.ADMIN -> "Administration"
    AppScreen.ACCOUNT -> "Compte"
    AppScreen.LOGIN -> "Gestion Présence FST"
}
