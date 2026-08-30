package tn.utm.fst.gestionpresence.nativeapp.core.model
import org.junit.Assert.assertEquals
import org.junit.Test
class DomainValidationTest { @Test fun gradeAcceptsBounds(){ assertEquals(0.0,Grade.of(0.0).value,0.0); assertEquals(20.0,Grade.of(20.0).value,0.0) }; @Test(expected=IllegalArgumentException::class) fun gradeRejectsNegative(){Grade.of(-0.1)}; @Test(expected=IllegalArgumentException::class) fun gradeRejectsAboveTwenty(){Grade.of(20.1)}; @Test fun academicClassesAreFixed(){assertEquals(listOf("MPI1","MPI2","MPI3","MPI4","MPI5","PC1"),AcademicClass.entries.map{it.name})} }
