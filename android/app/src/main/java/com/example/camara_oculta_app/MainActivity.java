package com.example.camara_oculta_app;

import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import androidx.annotation.NonNull;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

public class MainActivity extends FlutterActivity {

    private static final String VOLUME_CHANNEL =
            "com.example.camara_oculta_app/volume";

    private static final String SYSTEM_CHANNEL =
            "com.example.camara_oculta_app/system";

    private MethodChannel volumeChannel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ocultar las barras inmediatamente al abrir la aplicación
        ocultarBarrasDelSistema();
    }

    @Override
    public void configureFlutterEngine(
            @NonNull FlutterEngine flutterEngine) {

        super.configureFlutterEngine(flutterEngine);

        // =====================================================
        // CANAL DE BOTONES DE VOLUMEN
        // =====================================================

        volumeChannel = new MethodChannel(
                flutterEngine.getDartExecutor().getBinaryMessenger(),
                VOLUME_CHANNEL
        );

        // =====================================================
        // CANAL PARA OCULTAR BARRAS DEL SISTEMA
        // =====================================================

        new MethodChannel(
                flutterEngine.getDartExecutor().getBinaryMessenger(),
                SYSTEM_CHANNEL
        ).setMethodCallHandler((call, result) -> {

            if (call.method.equals("hideSystemBars")) {

                ocultarBarrasDelSistema();

                result.success(null);

            } else {

                result.notImplemented();
            }
        });
    }

    // =========================================================
    // BOTONES DE VOLUMEN
    // =========================================================

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
            keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {

            if (volumeChannel != null) {

                volumeChannel.invokeMethod(
                        "volumePressed",
                        null
                );
            }

            return true;
        }

        return super.onKeyDown(keyCode, event);
    }

    // =========================================================
    // OCULTAR BARRAS DE ANDROID
    // =========================================================

    public void ocultarBarrasDelSistema() {

        Window window = getWindow();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {

            WindowInsetsController controller =
                    window.getInsetsController();

            if (controller != null) {

                controller.hide(
                        WindowInsets.Type.statusBars()
                                | WindowInsets.Type.navigationBars()
                );

                controller.setSystemBarsBehavior(
                        WindowInsetsController
                                .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }

        } else {

            window.getDecorView().setSystemUiVisibility(

                    View.SYSTEM_UI_FLAG_FULLSCREEN

                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION

                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN

                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION

                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }
    }

    // =========================================================
    // VOLVER A OCULTAR SI ANDROID RESTAURA LAS BARRAS
    // =========================================================

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {

        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {

            ocultarBarrasDelSistema();
        }
    }
}