import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;

List<CameraDescription>? cameras;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    cameras = await availableCameras();

    debugPrint(
      '📷 Cámaras encontradas: ${cameras?.length ?? 0}',
    );
  } catch (e) {
    debugPrint(
      '❌ Error al obtener cámaras: $e',
    );
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Cámara con Volumen',
      theme: ThemeData(
        useMaterial3: true,
      ),
      home: const CameraScreen(),
    );
  }
}

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  CameraController? _controller;

  bool _isCameraOn = false;
  bool _isLoading = false;
  bool _takingPhoto = false;

  // ============================================================
  // CANAL DE VOLUMEN
  // ============================================================

  static const MethodChannel _platform =
      MethodChannel(
    'com.example.camara_oculta_app/volume',
  );

  // ============================================================
  // CANAL DEL SISTEMA
  // ============================================================

  static const MethodChannel _system =
      MethodChannel(
    'com.example.camara_oculta_app/system',
  );

  // ============================================================
  // SERVIDOR
  // ============================================================

  static const String serverUrl =
      'http://192.168.100.248:3001';

  @override
  void initState() {
    super.initState();

    _initMethodChannel();
  }

  // ============================================================
  // ESCUCHAR BOTONES DE VOLUMEN
  // ============================================================

  void _initMethodChannel() {

    debugPrint('🔄 REINICIANDO METHOD CHANNEL');

    _platform.setMethodCallHandler(
      (call) async {

        debugPrint(
          '🔊 MÉTODO RECIBIDO: ${call.method}',
        );

        if (call.method == 'volumePressed') {

          debugPrint(
            '🔊 VOLUMEN DETECTADO',
          );

          await _takePhoto();

          debugPrint(
            '🔊 PROCESO DE VOLUMEN TERMINADO',
          );
        }
      },
    );
  }

  // ============================================================
  // INICIAR CÁMARA
  // ============================================================

  Future<void> _startCamera() async {

    if (_isLoading || _isCameraOn) {
      return;
    }

    if (cameras == null || cameras!.isEmpty) {

      debugPrint(
        '❌ No se encontró ninguna cámara.',
      );

      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {

      // ========================================================
      // CÁMARA TRASERA
      // ========================================================

      CameraDescription camera =
          cameras!.first;

      debugPrint(
        '📷 Iniciando cámara: ${camera.name}',
      );

      // ========================================================
      // CONTROLADOR
      // ========================================================

      final controller =
          CameraController(
        camera,
        ResolutionPreset.max,
        enableAudio: false,
      );

      // ========================================================
      // INICIALIZAR
      // ========================================================

      await controller.initialize();

      debugPrint(
        '📷 Cámara inicializada',
      );

      // ========================================================
      // FLASH APAGADO
      // ========================================================

      await controller.setFlashMode(
        FlashMode.off,
      );

      debugPrint(
        '💡 Flash apagado',
      );

      if (!mounted) {

        await controller.dispose();

        return;
      }

      _controller = controller;

      // ========================================================
      // OCULTAR BARRAS DE ANDROID
      // ========================================================

      try {

        await _system.invokeMethod(
          'hideSystemBars',
        );

        debugPrint(
          '⬛ Barras del sistema ocultas',
        );

      } catch (e) {

        debugPrint(
          '⚠️ No se pudieron ocultar las barras: $e',
        );
      }

      // ========================================================
      // CÁMARA ACTIVA
      // ========================================================

      setState(() {

        _isCameraOn = true;
        _isLoading = false;

      });

      debugPrint(
        '✅ CÁMARA ACTIVA',
      );

    } catch (e) {

      debugPrint(
        '❌ Error iniciando cámara: $e',
      );

      if (mounted) {

        setState(() {

          _isLoading = false;
          _isCameraOn = false;

        });
      }
    }
  }

  // ============================================================
  // TOMAR FOTO
  // ============================================================

  Future<void> _takePhoto() async {

    debugPrint(
      '📸 _takePhoto() INICIADO',
    );

    // ==========================================================
    // COMPROBAR CÁMARA ACTIVA
    // ==========================================================

    if (!_isCameraOn) {

      debugPrint(
        '❌ Cámara no está activa',
      );

      return;
    }

    // ==========================================================
    // COMPROBAR CONTROLADOR
    // ==========================================================

    if (_controller == null ||
        !_controller!.value.isInitialized) {

      debugPrint(
        '❌ Cámara no está inicializada',
      );

      return;
    }

    // ==========================================================
    // EVITAR DOS CAPTURAS SIMULTÁNEAS
    // ==========================================================

    if (_takingPhoto) {

      debugPrint(
        '⚠️ Cámara todavía está capturando una foto',
      );

      return;
    }

    _takingPhoto = true;

    try {

      // ========================================================
      // FLASH APAGADO
      // ========================================================

      await _controller!.setFlashMode(
        FlashMode.off,
      );

      debugPrint(
        '📸 Preparando captura...',
      );

      // ========================================================
      // TOMAR FOTO
      // ========================================================

      debugPrint(
        '📸 Ejecutando takePicture()...',
      );

      final XFile photo =
          await _controller!.takePicture();

      debugPrint(
        '📸 FOTO TOMADA: ${photo.path}',
      );

      // ========================================================
      // ENVIAR AL SERVIDOR
      // ========================================================

      debugPrint(
        '📡 Enviando foto al servidor...',
      );

      await _sendPhotoToServer(
        photo,
      );

      debugPrint(
        '✅ FOTO ENVIADA CORRECTAMENTE',
      );

    } catch (e) {

      debugPrint(
        '❌ ERROR TOMANDO/ENVIANDO FOTO: $e',
      );

    } finally {

      // ========================================================
      // LIBERAR BLOQUEO
      // ========================================================

      _takingPhoto = false;

      debugPrint(
        '🔓 CÁMARA LIBERADA PARA SIGUIENTE FOTO',
      );
    }
  }

  // ============================================================
  // ENVIAR FOTO AL SERVIDOR
  // ============================================================

   Future<void> _sendPhotoToServer(XFile photo) async {
    debugPrint('📦 Enviando archivo al servidor...');

    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$serverUrl/api/analizar'),
    );

    request.fields['outlet'] = 'No especificado';
    request.fields['producto_identificado'] = 'Foto tomada desde la cámara';

    request.files.add(
      await http.MultipartFile.fromPath(
        'imagen',
        photo.path,
      ),
    );

    debugPrint('📦 Archivo adjuntado: ${photo.path}');

    final response = await request.send();
    final responseBody = await response.stream.bytesToString();

    debugPrint('📡 Servidor respondió: ${response.statusCode}');
    debugPrint('📡 Respuesta: $responseBody');

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Error al enviar foto: ${response.statusCode}');
    }
  }

  // ============================================================
  // DISPOSE
  // ============================================================

  @override
  void dispose() {

    debugPrint(
      '🛑 Cerrando cámara...',
    );

    _controller?.dispose();

    _controller = null;

    // 🔥 LIMPIAR EL HANDLER
    _platform.setMethodCallHandler(null);

    super.dispose();
  }

  // ============================================================
  // INTERFAZ
  // ============================================================

  @override
  Widget build(BuildContext context) {

    // ==========================================================
    // CÁMARA ACTIVA
    // PANTALLA NEGRA
    // ==========================================================

    if (_isCameraOn) {

      return const Scaffold(

        backgroundColor:
            Colors.black,

        body: SizedBox.expand(

          child: ColoredBox(

            color:
                Colors.black,
          ),
        ),
      );
    }

    // ==========================================================
    // PANTALLA INICIAL
    // ==========================================================

    return Scaffold(

      backgroundColor:
          Colors.black,

      body: Center(

        child: _isLoading

            ? const CircularProgressIndicator(
                color: Colors.white,
              )

            : ElevatedButton(

                onPressed:
                    _startCamera,

                child: const Text(

                  'INICIAR',

                  style: TextStyle(
                    fontSize: 18,
                  ),
                ),
              ),
      ),
    );
  }
}