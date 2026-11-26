package tn.utm.fst.gestionpresence.nativeapp

import android.os.Bundle
import android.graphics.Color
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import tn.utm.fst.gestionpresence.nativeapp.ui.AppRoot

/** FragmentActivity : nécessaire pour la boîte de dialogue biométrique d'Android. */
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Écran bord à bord (One UI) : icônes de la barre d'état sombres en mode clair, claires en mode sombre.
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT), navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        setContent { AppRoot() }
    }
}
