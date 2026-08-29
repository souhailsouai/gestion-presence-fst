package tn.utm.fst.gestionpresence.nativeapp
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import dagger.hilt.android.AndroidEntryPoint
import tn.utm.fst.gestionpresence.nativeapp.ui.AppRoot
@AndroidEntryPoint class MainActivity : ComponentActivity() { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { AppRoot() } } }
