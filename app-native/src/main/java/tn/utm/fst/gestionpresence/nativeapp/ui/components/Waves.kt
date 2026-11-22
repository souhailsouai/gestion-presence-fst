package tn.utm.fst.gestionpresence.nativeapp.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.sin

/** Une couche de vague : couleur, amplitude (fraction de la hauteur), longueur d'onde (px), vitesse relative. */
data class WaveLayer(val color: Color, val amplitude: Float, val wavelength: Float, val speed: Float, val baseline: Float)

private fun DrawScope.drawWave(layer: WaveLayer, phase: Float) {
    val w = size.width
    val h = size.height
    val path = Path()
    val base = h * layer.baseline
    val amp = h * layer.amplitude
    path.moveTo(0f, h)
    var x = 0f
    while (x <= w + 4f) {
        val y = base + amp * sin((2 * PI * (x / layer.wavelength) + phase * layer.speed).toFloat())
        path.lineTo(x, y)
        x += 6f
    }
    path.lineTo(w, h)
    path.close()
    drawPath(path, layer.color)
}

/** Vagues animées qui défilent doucement (utilisées en bas des en-têtes et de l'écran de connexion). */
@Composable
fun AnimatedWaves(
    modifier: Modifier = Modifier,
    height: Dp = 56.dp,
    layers: List<WaveLayer>,
    durationMillis: Int = 9000,
    animated: Boolean = true
) {
    if (!animated) {
        Canvas(modifier = modifier.fillMaxWidth().height(height)) { layers.forEach { drawWave(it, 0.6f) } }
        return
    }
    val transition = rememberInfiniteTransition(label = "waves")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(durationMillis, easing = LinearEasing), RepeatMode.Restart),
        label = "phase"
    )
    Canvas(modifier = modifier.fillMaxWidth().height(height)) {
        layers.forEach { drawWave(it, phase) }
    }
}

/** Fine ligne ondulée animée (séparateur). */
@Composable
fun WaveLine(color: Color, modifier: Modifier = Modifier, height: Dp = 10.dp, animated: Boolean = true) {
    if (!animated) {
        Canvas(modifier = modifier.height(height)) {
            val path = Path(); val mid = size.height / 2; var x = 0f
            path.moveTo(0f, mid)
            while (x <= size.width) { path.lineTo(x, mid + (size.height * 0.32f) * sin((2 * PI * (x / 60f)).toFloat())); x += 3f }
            drawPath(path, color, style = Stroke(width = 3.dp.toPx()))
        }
        return
    }
    val transition = rememberInfiniteTransition(label = "waveline")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(6000, easing = LinearEasing), RepeatMode.Restart),
        label = "linephase"
    )
    Canvas(modifier = modifier.height(height)) {
        val path = Path()
        val mid = size.height / 2
        var x = 0f
        path.moveTo(0f, mid)
        while (x <= size.width) {
            path.lineTo(x, mid + (size.height * 0.32f) * sin((2 * PI * (x / 60f) + phase).toFloat()))
            x += 3f
        }
        drawPath(path, color, style = Stroke(width = 3.dp.toPx()))
    }
}
