package tn.utm.fst.gestionpresence.nativeapp.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Palette FST (style One UI 9) : bleu canard profond, ocre, titres bleu nuit ; mode sombre automatique. */
object Uphf {
    /** Suit le thème du téléphone (réglé par [UphfTheme]). Lecture observée : tout se redessine au changement. */
    var dark by mutableStateOf(false)
    private fun c(light: Long, night: Long) = Color(if (dark) night else light)
    val Teal get() = c(0xFF0A6E8C, 0xFF5BB8D6)
    val TealDark get() = c(0xFF085A73, 0xFF7FD0EA)
    val TealSoft get() = c(0xFFE6F1F5, 0xFF12384A)
    /** Texte posé sur un fond Teal. */
    val OnTeal get() = c(0xFFFFFFFF, 0xFF0E1418)
    val Ochre get() = c(0xFF9A7333, 0xFFE2C08A)
    val OchreDark get() = c(0xFF82602A, 0xFFE9CC9C)
    val OchreSoft get() = c(0xFFF6F0E6, 0xFF3A2F1C)
    val Title get() = c(0xFF1C3D5E, 0xFFE8EEF2)
    val Text get() = c(0xFF4A5866, 0xFFC5CED6)
    val Muted get() = c(0xFF5E6A76, 0xFF9AA7B2)
    val Line get() = c(0xFFE3E6EA, 0xFF26313A)
    /** Fond gris clair des écrans et blocs blancs arrondis (One UI). */
    val Background get() = c(0xFFF2F4F5, 0xFF0E1418)
    val Surface get() = c(0xFFFFFFFF, 0xFF1B242B)
    val Good get() = Teal
    val Mid get() = c(0xFFB08A45, 0xFFE2C08A)
    val Bad get() = c(0xFFB4554B, 0xFFF09A8F)
    val BadSoft get() = c(0xFFF8ECEA, 0xFF3A1F1C)
    val Late get() = Mid
    val Justified get() = c(0xFF6E8FB0, 0xFF9DB8D4)

    fun rateColor(rate: Float): Color = when {
        rate >= 85f -> Good
        rate >= 70f -> Mid
        else -> Bad
    }
}

private fun uphfColors() = (if (Uphf.dark) darkColorScheme(
    primary = Uphf.Teal, onPrimary = Uphf.OnTeal, primaryContainer = Uphf.TealSoft, onPrimaryContainer = Uphf.TealDark,
    secondary = Uphf.Ochre, onSecondary = Color(0xFF1D1A14), secondaryContainer = Uphf.OchreSoft, onSecondaryContainer = Uphf.OchreDark,
    tertiary = Uphf.Title, background = Uphf.Background, onBackground = Uphf.Title, surface = Uphf.Surface, onSurface = Uphf.Title,
    surfaceVariant = Color(0xFF222C34), onSurfaceVariant = Uphf.Text, outline = Uphf.Line, outlineVariant = Uphf.Line, error = Uphf.Bad, errorContainer = Uphf.BadSoft,
    surfaceContainer = Uphf.Surface, surfaceContainerHigh = Color(0xFF222C34), surfaceContainerLow = Uphf.Surface
) else lightColorScheme(
    primary = Uphf.Teal,
    onPrimary = Color.White,
    primaryContainer = Uphf.TealSoft,
    onPrimaryContainer = Uphf.TealDark,
    secondary = Uphf.Ochre,
    onSecondary = Color(0xFF1D1A14),
    secondaryContainer = Uphf.OchreSoft,
    onSecondaryContainer = Uphf.OchreDark,
    tertiary = Uphf.Title,
    background = Uphf.Background,
    onBackground = Uphf.Title,
    surface = Color.White,
    onSurface = Uphf.Title,
    surfaceVariant = Color(0xFFF1F4F6),
    onSurfaceVariant = Uphf.Text,
    outline = Uphf.Line,
    outlineVariant = Uphf.Line,
    error = Uphf.Bad,
    errorContainer = Uphf.BadSoft,
    surfaceContainer = Color.White,
    surfaceContainerHigh = Color.White,
    surfaceContainerLow = Color.White
))

private val UphfType = Typography(
    displaySmall = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp),
    headlineSmall = TextStyle(fontSize = 23.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold),
    titleSmall = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
)

private val UphfShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

@Composable
fun UphfTheme(content: @Composable () -> Unit) {
    Uphf.dark = isSystemInDarkTheme()
    MaterialTheme(colorScheme = uphfColors(), typography = UphfType, shapes = UphfShapes, content = content)
}
