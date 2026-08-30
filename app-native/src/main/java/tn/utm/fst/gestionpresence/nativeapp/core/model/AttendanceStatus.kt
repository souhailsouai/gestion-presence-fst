package tn.utm.fst.gestionpresence.nativeapp.core.model

enum class AttendanceStatus(val wireValue: String, val label: String) {
    PRESENT("present", "Présent"),
    ABSENT("absent", "Absent"),
    LATE("retard", "Retard"),
    JUSTIFIED("justifie", "Justifié");

    companion object {
        fun fromWire(value: String?): AttendanceStatus =
            entries.firstOrNull { it.wireValue == value } ?: PRESENT
    }
}
