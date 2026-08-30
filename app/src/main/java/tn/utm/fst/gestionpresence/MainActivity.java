package tn.utm.fst.gestionpresence;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;
    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window=getWindow(); window.setStatusBarColor(Color.rgb(6,43,91)); window.setNavigationBarColor(Color.WHITE); window.getDecorView().setSystemUiVisibility(0);
        webView=new WebView(this); webView.setBackgroundColor(Color.rgb(244,247,251)); webView.setOverScrollMode(View.OVER_SCROLL_NEVER); webView.setVerticalScrollBarEnabled(false); webView.setHorizontalScrollBarEnabled(false); setContentView(webView);
        WebSettings s=webView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setAllowFileAccess(true); s.setAllowContentAccess(true); s.setMediaPlaybackRequiresUserGesture(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setLoadWithOverviewMode(false); s.setUseWideViewPort(false); s.setSupportZoom(false); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false); s.setTextZoom(100);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true); webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);injectAsset("mobile.css",true);injectAsset("mobile.js",false);injectAsset("fst_patch.css",true);injectAsset("fst_patch.js",false);}});
        webView.loadUrl("file:///android_asset/index.html");
    }
    private void injectAsset(String name, boolean css){try(BufferedReader r=new BufferedReader(new InputStreamReader(getAssets().open(name),StandardCharsets.UTF_8))){StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line).append('\n');String text=b.toString();String quoted=org.json.JSONObject.quote(text);String js=css?"(function(){var s=document.createElement('style');s.textContent="+quoted+";document.head.appendChild(s);})();":text;webView.evaluateJavascript(js,null);}catch(Exception e){android.util.Log.e("GestionPresenceFST","Unable to inject "+name,e);}}
    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
