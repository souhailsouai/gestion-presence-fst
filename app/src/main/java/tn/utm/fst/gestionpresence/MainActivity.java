package tn.utm.fst.gestionpresence;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window=getWindow();
        window.setStatusBarColor(Color.rgb(6,43,91));
        window.setNavigationBarColor(Color.WHITE);
        window.getDecorView().setSystemUiVisibility(0);

        webView=new WebView(this);
        webView.setBackgroundColor(Color.rgb(244,247,251));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        setContentView(webView);

        WebSettings s=webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new PdfBridge(),"AndroidPdfBridge");
        webView.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                super.onPageFinished(view,url);
                injectAsset("mobile.css",true);
                injectAsset("mobile.js",false);
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    public final class PdfBridge {
        @JavascriptInterface public void savePdf(String filename,String dataUri){
            runOnUiThread(() -> {
                try {
                    int comma=dataUri.indexOf(',');
                    if(comma<0)throw new IllegalArgumentException("PDF invalide");
                    byte[] bytes=Base64.decode(dataUri.substring(comma+1),Base64.DEFAULT);
                    String safe=filename==null||filename.trim().isEmpty()?"Rapport.pdf":filename.replaceAll("[^a-zA-Z0-9._-]","_");
                    if(!safe.toLowerCase().endsWith(".pdf"))safe += ".pdf";
                    savePdfBytes(safe,bytes);
                    Toast.makeText(MainActivity.this,"PDF enregistré dans Téléchargements",Toast.LENGTH_LONG).show();
                } catch(Exception e) {
                    Toast.makeText(MainActivity.this,"Échec de l'enregistrement PDF",Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    private void savePdfBytes(String filename,byte[] bytes) throws Exception {
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q){
            ContentValues values=new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME,filename);
            values.put(MediaStore.Downloads.MIME_TYPE,"application/pdf");
            values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/GestionPresenceFST");
            Uri uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
            if(uri==null)throw new IllegalStateException("Création PDF impossible");
            try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IllegalStateException("Écriture PDF impossible");out.write(bytes);}
        }else{
            File dir=getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if(dir==null)throw new IllegalStateException("Dossier indisponible");
            File file=new File(dir,filename);
            try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}
        }
    }

    private void injectAsset(String name,boolean css){
        try(BufferedReader r=new BufferedReader(new InputStreamReader(getAssets().open(name),StandardCharsets.UTF_8))){
            StringBuilder b=new StringBuilder();String line;
            while((line=r.readLine())!=null)b.append(line).append('\n');
            String text=b.toString();String quoted=org.json.JSONObject.quote(text);
            String js=css?"(function(){var s=document.createElement('style');s.textContent="+quoted+";document.head.appendChild(s);})();":text;
            webView.evaluateJavascript(js,null);
        }catch(Exception ignored){}
    }

    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
