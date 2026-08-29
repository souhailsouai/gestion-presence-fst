package tn.utm.fst.gestionpresence.nativeapp
import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File
class ArchitectureContractTest { @Test fun `native app source does not reference WebView`(){ val root=File("src/main/java"); val combined=root.walkTopDown().filter{it.isFile&&it.extension=="kt"}.joinToString("\n"){it.readText()}; assertFalse(combined.contains("android.webkit.WebView")); assertFalse(combined.contains("file:///android_asset")) } }
