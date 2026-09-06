package tn.utm.fst.gestionpresence.nativeapp.planning

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import tn.utm.fst.gestionpresence.nativeapp.feature.main.AppScreen

class PlanningContractTest {
    @Test
    fun `native navigation exposes v16 planning`() {
        assertTrue(
            "L'application Android native doit exposer l'écran PLANNING.",
            AppScreen.entries.any { it.name == "PLANNING" }
        )
    }

    @Test
    fun `v16 planning model exists`() {
        val model = runCatching {
            Class.forName("tn.utm.fst.gestionpresence.nativeapp.core.model.PlanningRow")
        }.getOrNull()
        assertNotNull("Le modèle PlanningRow V16 doit exister.", model)
    }
}
