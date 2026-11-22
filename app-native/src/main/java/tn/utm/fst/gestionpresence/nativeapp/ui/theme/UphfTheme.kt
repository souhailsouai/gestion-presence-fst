package tn.utm.fst.gestionpresence.nativeapp.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Palette inspirée du site de l'UPHF : blanc, bleu canard, ocre, titres bleu nuit. */
object Uphf {
    val Teal = Color(0xFF0B7A9C)
    val TealDark = Color(0xFF086683)
    val TealSoft = Color(0xFFE8F3F7)
    val Ochre = Color(0xFF9A7333)
    val OchreDark = Color(0xFF82602A)
    val OchreSoft = Color(0xFFF6F0E6)
    val Title = Color(0xFF1C3D5E)
    val Text = Color(0xFF4A5866)
    val Muted = Color(0xFF6B7682)
    val Line = Color(0xFFE3E6EA)
    val Background = Color(0xFFF7F8F9)
    val Good = Color(0xFF0B7A9C)
    val Mid = Color(0xFFB08A45)
    val Bad = Color(0xFFB4554B)
    val BadSoft = Color(0xFFF8ECEA)
    val Late = Color(0xFFB08A45)
    val Justified = Color(0xFF6E8FB0)

    fun rateColor(rate: Float): Color = when {
        rate >= 85f -> Good
        rate >= 70f -> Mid
        else -> Bad
    }
}

private val UphfColors = lightColorScheme(
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
    errorContainer = Uphf.BadSoft
)

private val UphfType = Typography(
    displaySmall = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp, color = Uphf.Title),
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
    large = RoundedCornerShape(14.dp),
    extraLarge = RoundedCornerShape(22.dp)
)

@Composable
fun UphfTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = UphfColors, typography = UphfType, shapes = UphfShapes, content = content)
}
