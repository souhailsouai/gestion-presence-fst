package tn.utm.fst.gestionpresence.nativeapp.ui
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
@Composable fun AppRoot(){ MaterialTheme { Surface(Modifier.fillMaxSize()){ Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center,horizontalAlignment=Alignment.CenterHorizontally){ Text("FST",style=MaterialTheme.typography.displayMedium); Spacer(Modifier.height(12.dp)); Text("Gestion de Présence"); Text("2026/2027") } } } }
