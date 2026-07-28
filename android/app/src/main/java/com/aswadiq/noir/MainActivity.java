package com.aswadiq.noir;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NoirPlayerPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        String buildMarker = BuildConfig.IS_TV_BUILD ? " NoirTV" : " NoirMobile";
        String userAgent = webView.getSettings().getUserAgentString();
        if (userAgent != null && !userAgent.contains(buildMarker.trim())) {
            webView.getSettings().setUserAgentString(userAgent + buildMarker);
        }
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        UiModeManager uiModeManager =
            (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        boolean isTelevision =
            uiModeManager != null &&
            uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;

        if (BuildConfig.IS_TV_BUILD && isTelevision) {
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
        }
    }
}
