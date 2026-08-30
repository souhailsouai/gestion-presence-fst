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
import androidx.compose.foundation.layout.size
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
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AssistChip
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
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
        Surface(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.fillMaxSize()) {
                when (state.screen) {
                    AppScreen.LOGIN -> LoginScreen(state, viewModel)
                    AppScreen.MFA_ENROLL, AppScreen.MFA_CHALLENGE -> MfaScreen(state, viewModel)
                    else -> MainShell(state, viewModel)
                }
                if (state.loading) {
                    Surface(color = Color.White.copy(alpha = 0.78f), modifier = Modifier.fillMaxSize()) {
                        Box(contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator()
                                Spacer(Modifier.height(12.dp))
                                Text("Communication sécurisée avec le serveur…")
                            }
                        }
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
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(color = Navy, shape = MaterialTheme.shapes.extraLarge) {
            Text(
                "FST",
                modifier = Modifier.padding(horizontal = 26.dp, vertical = 12.dp),
                color = Color.White,
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(Modifier.height(18.dp))
        Text("Faculté des Sciences de Tunis", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text("Université de Tunis El Manar", color = Blue, textAlign = TextAlign.Center)
        Text("Gestion de Présence — 2026/2027", color = Gold, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FilterChip(selected = role == "teacher", onClick = { role = "teacher" }, label = { Text("Enseignant") })
            FilterChip(selected = role == "admin", onClick = { role = "admin" }, label = { Text("Administrateur") })
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = { Text("Identifiant") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = credential,
            onValueChange = { credential = it },
            label = { Text("Mot de passe ou PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Notice(state)
        Button(
            onClick = { viewModel.login(identifier.trim(), credential, role) },
            enabled = identifier.isNotBlank() && credential.isNotBlank() && state.online,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        ) {
            Icon(Icons.Default.Lock, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Se connecter")
        }
        if (!state.online) {
            OfflineCard()
        }
    }
}

@Composable
private fun MfaScreen(state: MainUiState, viewModel: MainViewModel) {
    var code by rememberSaveable { mutableStateOf("") }
    val enrolling = state.screen == AppScreen.MFA_ENROLL
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Default.Security, contentDescription = null, tint = Navy, modifier = Modifier.size(64.dp))
        Spacer(Modifier.height(12.dp))
        Text(
            if (enrolling) "Activer la double authentification" else "Double authentification",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(10.dp))
        if (enrolling) {
            Text(
                "Ajoutez un compte TOTP dans votre application d’authentification avec la clé ci-dessous, puis saisissez le code généré.",
                textAlign = TextAlign.Center
            )
            state.mfaEnrollment?.let { enrollment ->
                ElevatedCard(modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Clé secrète", fontWeight = FontWeight.Bold)
                        Text(enrollment.secret, color = Blue)
                        if (enrollment.uri.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text("URI TOTP", fontWeight = FontWeight.Bold)
                            Text(enrollment.uri, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        } else {
            Text("Saisissez le code à 6 chiffres généré par votre application d’authentification.", textAlign = TextAlign.Center)
        }
        OutlinedTextField(
            value = code,
            onValueChange = { if (it.length <= 6) code = it.filter(Char::isDigit) },
            label = { Text("Code à 6 chiffres") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Notice(state)
        Button(
            onClick = { viewModel.verifyMfa(code) },
            enabled = code.length == 6 && state.online,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        ) { Text(if (enrolling) "Activer" else "Vérifier") }
        OutlinedButton(onClick = viewModel::cancelMfa, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Text("Annuler et se déconnecter")
        }
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
                        Text(
                            "${state.profile?.fullName.orEmpty()} • ${state.data?.contract?.academicYear ?: "2026/2027"}",
                            style = MaterialTheme.typography.labelSmall,
                            color = Blue
                        )
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::refresh, enabled = state.online) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualiser")
                    }
                    IconButton(onClick = viewModel::logout) {
                        Icon(Icons.Default.Logout, contentDescription = "Déconnexion")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = state.screen == AppScreen.HOME,
                    onClick = { viewModel.navigate(AppScreen.HOME) },
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    label = { Text("Accueil") }
                )
                NavigationBarItem(
                    selected = state.screen == AppScreen.SESSIONS,
                    onClick = { viewModel.navigate(AppScreen.SESSIONS) },
                    icon = { Icon(Icons.Default.Event, contentDescription = null) },
                    label = { Text("Séances") }
                )
                NavigationBarItem(
                    selected = state.screen == AppScreen.ATTENDANCE,
                    onClick = { viewModel.navigate(AppScreen.ATTENDANCE) },
                    icon = { Icon(Icons.Default.HowToReg, contentDescription = null) },
                    label = { Text("Présence") }
                )
                NavigationBarItem(
                    selected = detailScreen,
                    onClick = { viewModel.navigate(AppScreen.CLASSES) },
                    icon = { Icon(Icons.Default.MoreHoriz, contentDescription = null) },
                    label = { Text("Plus") }
                )
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (!state.online) OfflineCard()
            Notice(state)
            if (detailScreen) MoreNavigation(state, viewModel)
            Box(modifier = Modifier.fillMaxSize()) {
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
                    AppScreen.ACCOUNT -> AccountScreen(state, viewModel)
                    else -> Unit
                }
            }
        }
    }
}

@Composable
private fun MoreNavigation(state: MainUiState, viewModel: MainViewModel) {
    val destinations = buildList {
        add(AppScreen.CLASSES to "Classes")
        add(AppScreen.TIMETABLE to "Emploi du temps")
        add(AppScreen.TEACHERS to "Enseignants")
        add(AppScreen.STUDENTS to "Étudiants")
        add(AppScreen.REPORTS to "Rapports")
        if (state.isAdmin) add(AppScreen.ADMIN to "Administration")
        add(AppScreen.ACCOUNT to "Sécurité")
    }
    LazyRow(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(end = 10.dp)
    ) {
        items(destinations) { (screen, label) ->
            FilterChip(selected = state.screen == screen, onClick = { viewModel.navigate(screen) }, label = { Text(label) })
        }
    }
}

@Composable
private fun Notice(state: MainUiState) {
    val message = state.error ?: state.message ?: return
    val error = state.error != null
    Card(
        colors = CardDefaults.cardColors(containerColor = if (error) Color(0xFFFFE9E7) else Color(0xFFE7F5EC)),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (error) Icons.Default.Warning else Icons.Default.CheckCircle, contentDescription = null, tint = if (error) ErrorRed else Color(0xFF237A3C))
            Spacer(Modifier.width(8.dp))
            Text(message)
        }
    }
}

@Composable
private fun OfflineCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)),
        modifier = Modifier.fillMaxWidth().padding(12.dp)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CloudOff, contentDescription = null, tint = ErrorRed)
            Spacer(Modifier.width(10.dp))
            Column {
                Text("Connexion Internet requise", fontWeight = FontWeight.Bold)
                Text("Les consultations et modifications métier sont bloquées hors ligne.")
            }
        }
    }
}

@Composable
private fun HomeScreen(state: MainUiState) {
    val data = state.data ?: return EmptyState("Aucune donnée disponible.")
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Tableau de bord", style = MaterialTheme.typography.headlineSmall, color = Navy)
            Text("Données centrales Supabase • actualisation en ligne", color = Blue)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("Classes", data.stats.classCount, Icons.Default.Groups, Modifier.weight(1f))
                StatCard("Étudiants", data.stats.studentCount, Icons.Default.People, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("Séances", data.stats.sessionCount, Icons.Default.Event, Modifier.weight(1f))
                StatCard("Appels", data.stats.attendanceCount, Icons.Default.HowToReg, Modifier.weight(1f))
            }
        }
        item { Text("Séances récentes", style = MaterialTheme.typography.titleLarge) }
        items(data.sessions.take(8)) { session ->
            val academicClass = data.classes.firstOrNull { it.id == session.classId }
            SimpleCard(
                title = academicClass?.name ?: "Classe",
                subtitle = "${session.sessionDate} • ${session.startTime}-${session.endTime}${if (session.completedAt != null) " • Terminée" else ""}"
            )
        }
    }
}

@Composable
private fun StatCard(label: String, value: Int, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier = Modifier) {
    ElevatedCard(modifier = modifier) {
        Column(Modifier.fillMaxWidth().padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, tint = Navy)
            Text(value.toString(), style = MaterialTheme.typography.headlineMedium, color = Navy, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelMedium)
        }
    }
}

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
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { SectionTitle("Classes et groupes", "Créer et consulter les groupes affectés.") }
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
                        val name = "$track$number-G$group"
                        viewModel.addClass(name, module, track, number, group, day.ifBlank { null }, start.ifBlank { null }, end.ifBlank { null }, room.ifBlank { null })
                    },
                    enabled = state.online,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Ajouter la classe") }
            }
        }
        items(classes) { item -> ClassCard(item, viewModel) }
        if (classes.isEmpty()) item { EmptyState("Aucune classe.") }
    }
}

@Composable
private fun ClassCard(item: AcademicClass, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(item.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(item.module, color = Blue)
            Text(listOfNotNull(item.day, item.startTime?.let { start -> item.endTime?.let { "$start-$it" } }, item.room).joinToString(" • "))
            OutlinedButton(onClick = { viewModel.deleteClass(item.id) }, modifier = Modifier.align(Alignment.End)) {
                Icon(Icons.Default.Delete, contentDescription = null)
                Text("Supprimer")
            }
        }
    }
}

@Composable
private fun TimetableScreen(state: MainUiState) {
    val rows = state.data?.classes.orEmpty().filter { it.day != null || it.startTime != null }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Emploi du temps", "Vue des créneaux autorisés.") }
        items(rows) { item ->
            SimpleCard(
                title = "${item.day ?: "Jour"} • ${item.startTime ?: "--:--"}-${item.endTime ?: "--:--"}",
                subtitle = "${item.name} • ${item.module} • ${item.room ?: "Salle non définie"}"
            )
        }
        if (rows.isEmpty()) item { EmptyState("Aucun créneau planifié.") }
    }
}

@Composable
private fun TeachersScreen(state: MainUiState) {
    val rows = state.data?.directory.orEmpty()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Annuaire des enseignants", "Informations institutionnelles autorisées.") }
        items(rows) { item ->
            SimpleCard(
                title = item.teacherName,
                subtitle = listOfNotNull(item.module, item.track?.let { track -> "$track${item.classNumber ?: ""}-G${item.groupNumber ?: ""}" }, item.day, item.room).joinToString(" • ")
            )
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
    var email by rememberSaveable { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Étudiants", "Gestion des étudiants par classe.") }
        item {
            FormCard("Nouvel étudiant") {
                Text("Classe", fontWeight = FontWeight.Bold)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(data.classes) { item ->
                        FilterChip(selectedClassId == item.id, { selectedClassId = item.id }, label = { Text(item.name) })
                    }
                }
                OutlinedTextField(lastName, { lastName = it }, label = { Text("Nom") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(firstName, { firstName = it }, label = { Text("Prénom") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(email, { email = it }, label = { Text("E-mail facultatif") }, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = { viewModel.addStudent(selectedClassId, lastName, firstName, email.ifBlank { null }) },
                    enabled = state.online && selectedClassId.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Ajouter l’étudiant") }
            }
        }
        items(data.students) { student -> StudentCard(student, data.classes, viewModel) }
        if (data.students.isEmpty()) item { EmptyState("Aucun étudiant.") }
    }
}

@Composable
private fun StudentCard(student: Student, classes: List<AcademicClass>, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(student.displayName, fontWeight = FontWeight.Bold)
                Text(classes.firstOrNull { it.id == student.classId }?.name ?: "Classe")
                student.email?.let { Text(it, color = Blue, style = MaterialTheme.typography.bodySmall) }
            }
            IconButton(onClick = { viewModel.deleteStudent(student.id) }) {
                Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = ErrorRed)
            }
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
        item { SectionTitle("Séances", "Création et suivi des séances.") }
        item {
            FormCard("Nouvelle séance") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(data.classes) { item ->
                        FilterChip(selectedClassId == item.id, { selectedClassId = item.id }, label = { Text(item.name) })
                    }
                }
                OutlinedTextField(date, { date = it }, label = { Text("Date AAAA-MM-JJ") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(start, { start = it }, label = { Text("Début") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(end, { end = it }, label = { Text("Fin") }, modifier = Modifier.weight(1f))
                }
                Button(
                    onClick = { viewModel.addSession(selectedClassId, date, start, end) },
                    enabled = state.online && selectedClassId.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Créer la séance") }
            }
        }
        items(data.sessions) { item -> SessionCard(item, data.classes, viewModel) }
        if (data.sessions.isEmpty()) item { EmptyState("Aucune séance.") }
    }
}

@Composable
private fun SessionCard(item: TeachingSession, classes: List<AcademicClass>, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(classes.firstOrNull { it.id == item.classId }?.name ?: "Classe", fontWeight = FontWeight.Bold)
            Text("${item.sessionDate} • ${item.startTime}-${item.endTime}")
            Text(if (item.completedAt == null) "Ouverte" else "Terminée", color = if (item.completedAt == null) Blue else Color(0xFF237A3C))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { viewModel.selectAttendanceSession(item.id) }) { Text("Appel") }
                if (item.completedAt == null) OutlinedButton(onClick = { viewModel.completeSession(item) }) { Text("Terminer") }
                IconButton(onClick = { viewModel.deleteSession(item.id) }) { Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = ErrorRed) }
            }
        }
    }
}

@Composable
private fun AttendanceScreen(state: MainUiState, viewModel: MainViewModel) {
    val data = state.data ?: return EmptyState("Données indisponibles.")
    val selected = data.sessions.firstOrNull { it.id == state.selectedSessionId }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Saisie des présences", "Enregistrement atomique avec contrôle de révision.") }
        item {
            Text("Séance", fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(data.sessions) { item ->
                    FilterChip(
                        selected = state.selectedSessionId == item.id,
                        onClick = { viewModel.selectAttendanceSession(item.id) },
                        label = { Text("${item.sessionDate} ${item.startTime}") }
                    )
                }
            }
        }
        if (selected == null) {
            item { EmptyState("Sélectionnez une séance pour effectuer l’appel.") }
        } else {
            item {
                Text(
                    "Révision serveur : ${state.attendanceRevision} • ${data.classes.firstOrNull { it.id == selected.classId }?.name.orEmpty()}",
                    color = Blue
                )
            }
            val students = data.students.filter { it.classId == selected.classId }
            items(students) { student ->
                val draft = state.attendanceDrafts[student.id] ?: AttendanceDraft(student.id)
                AttendanceRow(student, draft, viewModel)
            }
            item {
                Button(
                    onClick = viewModel::saveAttendance,
                    enabled = state.online && students.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.HowToReg, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Enregistrer la feuille")
                }
            }
        }
    }
}

@Composable
private fun AttendanceRow(student: Student, draft: AttendanceDraft, viewModel: MainViewModel) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(student.displayName, fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(AttendanceStatus.entries) { status ->
                    FilterChip(
                        selected = draft.status == status,
                        onClick = { viewModel.updateAttendanceStatus(student.id, status) },
                        label = { Text(status.label) }
                    )
                }
            }
            OutlinedTextField(
                value = draft.comment,
                onValueChange = { viewModel.updateAttendanceComment(student.id, it) },
                label = { Text("Commentaire") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = draft.grade?.toString().orEmpty(),
                onValueChange = { viewModel.updateAttendanceGrade(student.id, it) },
                label = { Text("Note /20 facultative") },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun ReportsScreen(state: MainUiState) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Rapports", "Synthèse calculée depuis les données centrales.") }
        items(state.reports) { report -> ReportCard(report) }
        if (state.reports.isEmpty()) item { EmptyState("Aucun rapport disponible.") }
    }
}

@Composable
private fun ReportCard(report: ReportSummary) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(report.title, fontWeight = FontWeight.Bold)
            Text("Total : ${report.totalRecords}")
            Text("Présents ${report.present} • Absents ${report.absent} • Retards ${report.late} • Justifiés ${report.justified}")
            report.averageGrade?.let { Text("Moyenne : ${"%.2f".format(it)}/20", color = Blue) }
        }
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
        SectionTitle("Administration", "Actions privilégiées protégées par MFA et journalisées.")
        FormCard("Créer un enseignant") {
            OutlinedTextField(username, { username = it }, label = { Text("Identifiant") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(fullName, { fullName = it }, label = { Text("Nom complet") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(password, { password = it }, label = { Text("Mot de passe initial") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button(onClick = { viewModel.adminCreateTeacher(username, fullName, password) }, enabled = state.online, modifier = Modifier.fillMaxWidth()) {
                Text("Créer le compte")
            }
        }
        FormCard("PIN administrateur") {
            OutlinedTextField(adminPin, { if (it.length <= 12) adminPin = it.filter(Char::isDigit) }, label = { Text("Nouveau PIN 6 à 12 chiffres") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            Button(onClick = { viewModel.adminSetPin(adminPin) }, enabled = state.online && adminPin.length >= 6, modifier = Modifier.fillMaxWidth()) {
                Text("Modifier le PIN")
            }
        }
        SimpleCard("Sécurité", "Les changements de rôle, suppressions et restaurations restent réservés aux procédures administrées et auditables.")
    }
}

@Composable
private fun AccountScreen(state: MainUiState, viewModel: MainViewModel) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { SectionTitle("Sécurité du compte", "Gérer les appareils TOTP associés.") }
        item {
            SimpleCard(
                title = state.profile?.fullName ?: "Compte",
                subtitle = "${state.profile?.username ?: state.profile?.email.orEmpty()} • rôle ${state.profile?.role ?: "teacher"}"
            )
        }
        items(state.factors) { factor ->
            ElevatedCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Security, contentDescription = null, tint = Navy)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(factor.friendlyName, fontWeight = FontWeight.Bold)
                        Text(factor.status)
                    }
                    OutlinedButton(onClick = { viewModel.removeMfa(factor.id) }) { Text("Retirer") }
                }
            }
        }
        item {
            Button(onClick = viewModel::beginMfaEnrollment, enabled = state.online, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Security, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Ajouter un appareil TOTP")
            }
        }
        item {
            OutlinedButton(onClick = viewModel::logout, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Logout, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Se déconnecter")
            }
        }
    }
}

@Composable
private fun FormCard(title: String, content: @Composable Column.() -> Unit) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
private fun SimpleCard(title: String, subtitle: String) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            if (subtitle.isNotBlank()) Text(subtitle)
        }
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String) {
    Column {
        Text(title, style = MaterialTheme.typography.headlineSmall, color = Navy)
        Text(subtitle, color = Blue)
        Spacer(Modifier.height(4.dp))
        HorizontalDivider()
    }
}

@Composable
private fun EmptyState(message: String) {
    Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.School, contentDescription = null, tint = Blue, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(8.dp))
            Text(message, textAlign = TextAlign.Center)
        }
    }
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
    AppScreen.ACCOUNT -> "Sécurité"
    else -> "Gestion Présence FST"
}
