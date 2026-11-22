# Native app rules.
# Noms de classes conservés : erreurs lisibles, aucune réflexion cassée.
-dontobfuscate
# Ktor / OkHttp : classes optionnelles absentes sur Android.
-dontwarn org.slf4j.**
-dontwarn io.ktor.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn java.lang.management.**
-keep class io.ktor.client.engine.okhttp.** { *; }
-keep class kotlinx.serialization.json.** { *; }
-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod
