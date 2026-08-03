package com.aswadiq.noir;

import android.content.pm.ActivityInfo;
import android.content.Context;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NoirPlayer")
public class NoirPlayerPlugin extends Plugin {
    @PluginMethod
    public void enterFullscreen(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            if (BuildConfig.IS_TV_BUILD) {
                call.resolve();
                return;
            }

            Window window = getActivity().getWindow();
            getActivity().setRequestedOrientation(
                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            );
            WindowCompat.setDecorFitsSystemWindows(window, false);

            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            call.resolve();
        });
    }

    @PluginMethod
    public void exitFullscreen(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            if (BuildConfig.IS_TV_BUILD) {
                call.resolve();
                return;
            }

            Window window = getActivity().getWindow();
            getActivity().setRequestedOrientation(
                ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            );
            WindowCompat.setDecorFitsSystemWindows(window, true);

            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            controller.show(WindowInsetsCompat.Type.systemBars());
            call.resolve();
        });
    }

    @PluginMethod
    public void showKeyboard(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            WebView webView = getBridge().getWebView();
            webView.requestFocus();
            InputMethodManager inputMethodManager =
                (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            if (inputMethodManager != null) {
                inputMethodManager.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hideKeyboard(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            WebView webView = getBridge().getWebView();
            InputMethodManager inputMethodManager =
                (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            if (inputMethodManager != null) {
                inputMethodManager.hideSoftInputFromWindow(webView.getWindowToken(), 0);
            }
            call.resolve();
        });
    }
}
