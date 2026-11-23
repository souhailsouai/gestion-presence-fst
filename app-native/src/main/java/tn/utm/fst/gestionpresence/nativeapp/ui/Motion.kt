package tn.utm.fst.gestionpresence.nativeapp.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.IntOffset
import tn.utm.fst.gestionpresence.nativeapp.feature.main.AppScreen

/**
 * Mouvements de l'application, dans l'esprit de One UI :
 * ressorts sans rebond excessif, déplacements courts, fondus rapides.
 */
object Motion {
    /** Ressort principal : rapide et amorti (aucun rebond visible). */
    val slide = spring<IntOffset>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow)

    /** Profondeur de navigation : 0 pour les onglets, 1 pour les écrans ouverts depuis un onglet. */
    fun depth(s: AppScreen): Int = when (s) {
        AppScreen.HOME, AppScreen.SESSIONS, AppScreen.PLANNING, AppScreen.STUDENTS, AppScreen.MORE -> 0
        else -> 1
    }

    /** Transition entre deux écrans : glissement en avant / en arrière, fondu-zoom entre onglets. */
    fun screens(scope: AnimatedContentTransitionScope<AppScreen>): ContentTransform = with(scope) {
        val from = depth(initialState)
        val to = depth(targetState)
        when {
            to > from -> (slideInHorizontally(slide) { it / 4 } + fadeIn(tween(220, easing = FastOutSlowInEasing)))
                .togetherWith(slideOutHorizontally(slide) { -it / 10 } + fadeOut(tween(120)))
            to < from -> (slideInHorizontally(slide) { -it / 10 } + fadeIn(tween(220, easing = FastOutSlowInEasing)))
                .togetherWith(slideOutHorizontally(slide) { it / 4 } + fadeOut(tween(120)))
            else -> (fadeIn(tween(220, delayMillis = 50, easing = FastOutSlowInEasing)) + scaleIn(tween(260, delayMillis = 50, easing = FastOutSlowInEasing), initialScale = 0.96f))
                .togetherWith(fadeOut(tween(90)))
        }.using(SizeTransform(clip = false))
    }
}

/** Clic avec léger enfoncement « ressort » (cartes, rangées). */
fun Modifier.bounceClick(enabled: Boolean = true, onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = Spring.StiffnessMedium),
        label = "press"
    )
    this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = androidx.compose.material3.ripple(), enabled = enabled, onClick = onClick)
}
