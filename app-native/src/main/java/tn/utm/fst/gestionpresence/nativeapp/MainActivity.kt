package tn.utm.fst.gestionpresence.nativeapp

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import tn.utm.fst.gestionpresence.nativeapp.ui.AppRoot

/** FragmentActivity : nécessaire pour la boîte de dialogue biométrique d'Android. */
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AppRoot() }
    }
}
