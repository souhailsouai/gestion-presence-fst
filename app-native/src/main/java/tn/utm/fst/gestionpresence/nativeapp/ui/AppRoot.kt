package tn.utm.fst.gestionpresence.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import tn.utm.fst.gestionpresence.nativeapp.data.NativeRepository

private val Navy = Color(0xFF062B5B)
private val Gold = Color(0xFFD59B19)

@Composable
fun AppRoot() {
    val context = LocalContext.current
    remember { NativeRepository.init(context); true }
    var loggedIn by remember { mutableStateOf(NativeRepository.hasSession()) }
    MaterialTheme(colorScheme = lightColorScheme(primary = Navy, secondary = Gold)) {
        if (loggedIn) {
            Dashboard(onLogout = {
                NativeRepository.logout(context)
                loggedIn = false
            })
        } else {
            LoginScreen(onLogin = { loggedIn = true })
        }
    }
}

@Composable
private fun LoginScreen(onLogin: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var identifier by remember { mutableStateOf("") }
    var credential by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf("teacher") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().padding(28.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("FST", style = MaterialTheme.typography.displayMedium, color = Navy)
            Text("Faculté des Sciences de Tunis", style = MaterialTheme.typography.titleLarge)
            Text("Université de Tunis El Manar")
            Text("Gestion de Présence — 2026/2027", color = Gold)
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(mode == "teacher", { mode = "teacher" }, label = { Text("Enseignant") })
                FilterChip(mode == "admin", { mode = "admin" }, label = { Text("Administrateur") })
            }
            OutlinedTextField(identifier, { identifier = it }, label = { Text("Identifiant") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                credential,
                { credential = it },
                label = { Text("Mot de passe / PIN") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
            Button(
                onClick = {
                    scope.launch {
                        busy = true
                        error = ""
                        NativeRepository.login(context, identifier.trim(), credential, mode)
                            .onSuccess { onLogin() }
                            .onFailure { error = it.message ?: "Connexion impossible" }
                        busy = false
                    }
                },
                enabled = !busy && identifier.isNotBlank() && credential.isNotBlank(),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            ) { Text(if (busy) "Connexion…" else "Se connecter") }
        }
    }
}

@Composable
private fun Dashboard(onLogout: () -> Unit) {
    val scope = rememberCoroutineScope()
    val classes by NativeRepository.classes.collectAsState(initial = emptyList())
    val students by NativeRepository.students.collectAsState(initial = emptyList())
    val sessions by NativeRepository.sessions.collectAsState(initial = emptyList())
    val syncState by NativeRepository.syncState.collectAsState()

    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Gestion Présence FST", style = MaterialTheme.typography.headlineSmall, color = Navy)
            Text("${NativeRepository.fullName} • $syncState")
            Text("Année universitaire 2026/2027", color = Gold)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatCard("Classes", classes.size, Modifier.weight(1f))
                StatCard("Étudiants", students.size, Modifier.weight(1f))
                StatCard("Séances", sessions.size, Modifier.weight(1f))
            }
        }
        item {
            Button(onClick = { scope.launch { NativeRepository.sync() } }, modifier = Modifier.fillMaxWidth()) {
                Text("Synchroniser")
            }
        }
        item {
            OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("Changer de compte") }
        }
        item { Text("Classes et groupes", style = MaterialTheme.typography.titleLarge) }
        items(classes) { clazz ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(clazz.name, style = MaterialTheme.typography.titleMedium)
                    Text("${clazz.track}${clazz.classNumber} • Groupe ${clazz.groupNumber} • ${clazz.module}")
                }
            }
        }
        item { Text("Séances récentes", style = MaterialTheme.typography.titleLarge) }
        items(sessions.take(10)) { session ->
            val className = classes.firstOrNull { it.id == session.classId }?.name ?: "Classe"
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(className)
                    Text("${session.sessionDate} • ${session.startTime}-${session.endTime}")
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: Int, modifier: Modifier) {
    Card(modifier) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value.toString(), style = MaterialTheme.typography.headlineMedium, color = Navy)
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}
