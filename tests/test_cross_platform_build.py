from pathlib import Path

root = Path(__file__).resolve().parents[1]
workflow_apk = (root / '.github/workflows/build-apk.yml').read_text(encoding='utf-8')
workflow_win = (root / '.github/workflows/build-windows.yml').read_text(encoding='utf-8') if (root / '.github/workflows/build-windows.yml').exists() else ''
android_activity = (root / 'app/src/main/java/tn/utm/fst/gestionpresence/MainActivity.java').read_text(encoding='utf-8')
windows_csproj = (root / 'windows/GestionPresenceFST/GestionPresenceFST.csproj').read_text(encoding='utf-8')
windows_main = (root / 'windows/GestionPresenceFST/MainWindow.xaml.cs').read_text(encoding='utf-8')

assert 'scripts/build_shared_html.py' in workflow_apk, 'APK workflow must generate the canonical shared HTML.'
assert 'cp web/index.html app/src/main/assets/index.html' in workflow_apk, 'APK must embed web/index.html.'
assert workflow_win, 'Windows workflow is missing.'
assert 'scripts/build_shared_html.py' in workflow_win, 'Windows workflow must generate the canonical shared HTML.'
assert 'dotnet publish' in workflow_win, 'Windows workflow must publish the .exe.'
assert '<EmbeddedResource Include="..\\..\\web\\index.html"' in windows_csproj, 'Windows must embed the canonical HTML inside the EXE.'
assert 'GetManifestResourceStream' in windows_main, 'Windows must load the embedded HTML resource at runtime.'
assert 'publish/windows/Gestion-Presence-FST.exe' in workflow_win, 'Windows workflow must verify the EXE.'
assert 'file:///android_asset/index.html' in android_activity, 'Android must load the embedded canonical HTML.'
print('cross-platform build contract OK')
