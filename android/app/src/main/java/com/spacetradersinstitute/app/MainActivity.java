package com.spacetradersinstitute.app;

import com.getcapacitor.BridgeActivity;

// NB (1.0.16): MainActivity torna VUOTA. La versione 1.0.14/1.0.15 leggeva gli inset
// di sistema via WindowInsets sul decorView per iniettarli come CSS var, ma sostituire
// il listener del decorView interferiva col layout del WebView su device reali →
// "caricamento infinito" all'avvio (boot ok su emulatore, hang sui telefoni: stessa
// fragilità della saga splash). L'inset della nav bar viene ora gestito lato CSS con un
// valore fisso (vedi ChatPage). Qualsiasi modifica nativa qui va provata sui DEVICE REALI.
public class MainActivity extends BridgeActivity {}
