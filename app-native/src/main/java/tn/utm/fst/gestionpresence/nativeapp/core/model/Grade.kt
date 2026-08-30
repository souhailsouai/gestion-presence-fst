package tn.utm.fst.gestionpresence.nativeapp.core.model
@JvmInline value class Grade private constructor(val value: Double) { companion object { fun of(value: Double): Grade { require(value in 0.0..20.0) { "Grade must be between 0 and 20" }; return Grade(value) } } }
