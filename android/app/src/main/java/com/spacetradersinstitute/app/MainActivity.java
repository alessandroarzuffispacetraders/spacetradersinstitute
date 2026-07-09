package com.spacetradersinstitute.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Espone al WebView l'altezza REALE della barra di sistema inferiore
        // (navigation/gesture bar) come CSS var `--sys-nav-bottom` (px CSS = dp).
        // Con l'edge-to-edge (targetSdk 36) la WebView disegna sotto le barre ma
        // env(safe-area-inset-bottom) resta 0 su Android → la barra di scrittura chat
        // finiva sotto la nav bar. Qui leggiamo l'inset dal sistema e lo passiamo al CSS.

        // 1) Valore immediato dalle risorse di sistema (sempre disponibile, no timing):
        //    così il CSS ha subito un valore sensato al primo paint.
        int navRes = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        int navPx = navRes > 0 ? getResources().getDimensionPixelSize(navRes) : 0;
        float density = getResources().getDisplayMetrics().density;
        injectNavBottom(Math.round(navPx / density));

        // 2) Listener sul DECOR VIEW (riceve sempre gli inset, a differenza della WebView
        //    i cui inset possono essere consumati dai parent): aggiorna col valore reale
        //    corrente (gesture vs 3-tasti, rotazione...).
        final View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            int bottomPx = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
            float d = getResources().getDisplayMetrics().density;
            injectNavBottom(Math.round(bottomPx / d));
            return insets; // non consumiamo: gli altri handler continuano a ricevere gli inset
        });
        ViewCompat.requestApplyInsets(decor);
    }

    private void injectNavBottom(int dp) {
        android.util.Log.d("IST-insets", "sys-nav-bottom dp=" + dp);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--sys-nav-bottom','" + dp + "px')", null));
    }
}
