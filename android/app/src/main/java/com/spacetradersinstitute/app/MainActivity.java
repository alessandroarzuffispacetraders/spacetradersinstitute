package com.spacetradersinstitute.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 35/36) forza l'edge-to-edge: il contenuto viene
        // disegnato SOTTO le barre di sistema. Su Android gli inset non arrivano a
        // env(safe-area-inset-*) nel WebView, così input chat e bottom nav finivano
        // coperti dalla barra di navigazione/gesti. Qui disattiviamo l'edge-to-edge:
        // il sistema torna a "insettare" il contenuto tra status bar e nav bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
