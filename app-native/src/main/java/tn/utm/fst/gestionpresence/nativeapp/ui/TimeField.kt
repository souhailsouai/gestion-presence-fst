package tn.utm.fst.gestionpresence.nativeapp.ui

import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerDefaults
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import tn.utm.fst.gestionpresence.nativeapp.ui.theme.Uphf

/** « 13.30 », « 13h30 », « 1330 », « 9:5 » → « 13:30 », « 09:05 » ; null si l'heure n'existe pas. */
fun normalizeTime(raw: String): String? {
    val t = raw.trim().lowercase().replace('h', ':').replace('.', ':').replace(',', ':').replace(" ", "")
    val (h, m) = when {
        t.contains(':') -> t.substringBefore(':') to t.substringAfter(':').ifEmpty { "0" }
        t.length in 3..4 && t.all { it.isDigit() } -> t.dropLast(2) to t.takeLast(2)
        t.length in 1..2 && t.all { it.isDigit() } -> t to "0"
        else -> return null
    }
    val hh = h.toIntOrNull() ?: return null; val mm = m.toIntOrNull() ?: return null
    if (hh !in 0..23 || mm !in 0..59) return null
    return "%02d:%02d".format(hh, mm)
}

/**
 * Champ d'heure libre : on tape l'heure (13.30, 13h30…) ou on touche l'horloge pour la choisir.
 * [onChange] ne reçoit que des heures valides « HH:MM ».
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimeField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var text by rememberSaveable(value) { mutableStateOf(value) }
    var pick by remember { mutableStateOf(false) }
    val bad = normalizeTime(text) == null
    OutlinedTextField(
        value = text,
        onValueChange = { v -> text = v.take(5); normalizeTime(v)?.let(onChange) },
        label = { Text(label) },
        singleLine = true,
        isError = bad,
        supportingText = if (bad) ({ Text("ex. 13:30") }) else null,
        trailingIcon = { Icon(Icons.Default.Schedule, "Choisir l’heure", tint = Uphf.Teal, modifier = Modifier.clickable { pick = true }) },
        modifier = modifier
    )
    if (pick) {
        val cur = normalizeTime(text) ?: value
        val st = rememberTimePickerState(cur.take(2).toIntOrNull() ?: 8, cur.takeLast(2).toIntOrNull() ?: 0, is24Hour = true)
        AlertDialog(
            onDismissRequest = { pick = false },
            title = { Text(label) },
            text = { TimePicker(st, colors = TimePickerDefaults.colors(selectorColor = Uphf.Teal)) },
            confirmButton = { TextButton(onClick = { val t = "%02d:%02d".format(st.hour, st.minute); text = t; onChange(t); pick = false }) { Text("OK") } },
            dismissButton = { TextButton(onClick = { pick = false }) { Text("Annuler") } }
        )
    }
}
