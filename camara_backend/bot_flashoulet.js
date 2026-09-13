const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

console.log('🤖 Iniciando Bot Flashoulet...');

// =============================================
// CONFIGURACIÓN
// =============================================

const BOT_TOKEN = process.env.BOT_TOKEN || "TU_TOKEN";
const CHAT_ID = process.env.CHAT_ID || "ID_GRUPO";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "TU_API_KEY";

console.log('✅ Configuración cargada');

// =============================================
// MAPEO DE CATEGORÍAS A GRUPOS
// =============================================

const GRUPOS = {
    'acuariofilia': process.env.GRUPO_ACUAROFILIA,
    'cocina': process.env.GRUPO_COCINA,
    'computacion': process.env.GRUPO_COMPUTACION,
    'iluminacion': process.env.GRUPO_ILUMINACION,
    'hogar': process.env.GRUPO_HOGAR,
    'herramientas': process.env.GRUPO_HERRAMIENTAS,
    'impresion3d': process.env.GRUPO_IMPRESION3D,
    'mascotas': process.env.GRUPO_MASCOTAS,
    'electronica': process.env.GRUPO_ELECTRONICA,
    'peliculas': process.env.GRUPO_PELICULAS,
    'radiocontrol': process.env.GRUPO_RADIOCONTROL,
    'camping': process.env.GRUPO_CAMPING,
    'agricultura': process.env.GRUPO_AGRICULTURA,
    'juguetes': process.env.GRUPO_JUGUETES,
    'fotografia': process.env.GRUPO_FOTOGRAFIA,
    'deportes': process.env.GRUPO_DEPORTES,
    'videojuegos': process.env.GRUPO_VIDEOJUEGOS,
    'musica': process.env.GRUPO_MUSICA,
    'estetica': process.env.GRUPO_ESTETICA,
    'arte': process.env.GRUPO_ARTE,
    'vehiculos': process.env.GRUPO_VEHICULOS,
    'manualidades': process.env.GRUPO_MANUALIDADES,
    'figuras': process.env.GRUPO_FIGURAS,
    'juegosdemesa': process.env.GRUPO_JUEGOSDEMESA,
    'adaptadores': process.env.GRUPO_ADAPTADORES,
    'erotico': process.env.GRUPO_EROTICO,
};

// =============================================
// POSTGRESQL
// =============================================

console.log('🔌 Conectando a PostgreSQL (Neon)...');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =============================================
// INICIALIZAR BOT
// =============================================

console.log('🤖 Inicializando bot de Telegram...');
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot de Telegram inicializado');

// =============================================
// LOGS DE DIAGNÓSTICO
// =============================================

// Verificar identidad del bot
bot.getMe().then((info) => {
    console.log(`\n✅ INFO DEL BOT:`);
    console.log(`   ID: ${info.id}`);
    console.log(`   Nombre: ${info.first_name}`);
    console.log(`   Username: @${info.username}`);
    console.log(`   Token (primeros 20): ${BOT_TOKEN.substring(0, 20)}...`);
}).catch((error) => {
    console.error(`❌ Error al obtener info del bot: ${error.message}`);
});

// Capturar errores de polling
bot.on('polling_error', (error) => {
    console.error(`\n❌ ERROR DE POLLING:`);
    console.error(`   Código: ${error.code}`);
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Timestamp: ${new Date().toISOString()}`);
});

// Capturar errores generales
bot.on('error', (error) => {
    console.error(`\n❌ ERROR GENERAL: ${error.message}`);
});

// Capturar mensajes recibidos
bot.on('message', (msg) => {
    console.log(`\n📩 MENSAJE RECIBIDO:`);
    console.log(`   De: ${msg.from?.first_name} (@${msg.from?.username})`);
    console.log(`   Chat ID: ${msg.chat.id}`);
    console.log(`   Chat tipo: ${msg.chat.type}`);
    console.log(`   Texto: ${msg.text || 'Sin texto'}`);
});

// =============================================
// FUNCIÓN: Analizar con DeepSeek
// =============================================

let llamadasHoy = 0; // 🔥 PROTECCIÓN 2
const MAX_LLAMADAS_DIA = 50;

async function analizarConDeepSeek(imagenBase64) {
    // 🔥 VERIFICAR LÍMITE DIARIO
    if (llamadasHoy >= MAX_LLAMADAS_DIA) {
        console.log(`⚠️ Límite diario alcanzado (${MAX_LLAMADAS_DIA}). No se analizará más hoy.`);
        return "Límite diario alcanzado";
    }

    console.log(`🤔 Analizando con DeepSeek (base64)`);
    console.log(`📊 Llamadas hoy: ${llamadasHoy}/${MAX_LLAMADAS_DIA}`);
    
    try {
        if (!imagenBase64) {
            console.log(`❌ No hay imagen base64`);
            return "No se pudo encontrar la imagen";
        }

        console.log(`📊 Tamaño base64: ${(imagenBase64.length / 1024 / 1024).toFixed(2)}MB`);

        console.log('📤 Enviando a DeepSeek API...');
        console.log(`📤 Modelo: deepseek-v4-flash-vision-exp`);
        console.log(`📤 Tamaño base64: ${imagenBase64.length} caracteres`);
        
        const response = await axios.post(
            'https://api.deepseek.com/chat/completions',
            {
                model: "deepseek-v4-flash-vision-exp",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe este producto en este formato exacto:\nNombre: [nombre]\nCategoria: [elige UNA: acuariofilia, cocina, computacion, iluminacion, hogar, herramientas, impresion3d, mascotas, electronica, peliculas, radiocontrol, camping, agricultura, juguetes, fotografia, deportes, videojuegos, musica, estetica, arte, vehiculos, manualidades, figuras, juegosdemesa, adaptadores, erotico]\nDescripcion: [descripcion]"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${imagenBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        llamadasHoy++; // 🔥 INCREMENTAR CONTADOR
        console.log(`✅ Respuesta de DeepSeek recibida (llamada #${llamadasHoy})`);
        console.log(`📦 Status HTTP: ${response.status}`);
        console.log(`📦 Data completa: ${JSON.stringify(response.data, null, 2)}`);
        console.log(`📦 Choices: ${JSON.stringify(response.data?.choices)}`);
        console.log(`📦 Finish reason: ${response.data?.choices?.[0]?.finish_reason}`);
        
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const contenido = response.data.choices[0].message.content;
            console.log(`📝 DeepSeek respuesta COMPLETA:`);
            console.log('>>> ' + JSON.stringify(contenido, null, 2));
            console.log('>>> Longitud: ' + contenido.length + ' caracteres');
            return contenido;
        }
        console.log('⚠️ No se encontró respuesta en choices');
        return "Artículo no identificado";

    } catch (error) {
        console.error('❌ Error DeepSeek:', error.message);
        if (error.response) {
            console.error('❌ Status:', error.response.status);
            console.error('❌ Data:', error.response.data);
        }
        return "Error al analizar la imagen";
    }
}

// =============================================
// FUNCIÓN: Publicar en Telegram
// =============================================

async function publicarFoto(id, imagenBase64, descripcion, categoria) {
    let chatId = CHAT_ID;
    
    if (categoria) {
        const categoriaLower = categoria.toLowerCase().trim();
        for (const [key, value] of Object.entries(GRUPOS)) {
            if (categoriaLower.includes(key) || key.includes(categoriaLower)) {
                chatId = value;
                console.log(`📌 Categoría "${categoria}" → Grupo: ${key} (${chatId})`);
                break;
            }
        }
    }

    console.log(`📤 Publicando foto ID ${id} en chat: ${chatId}...`);
    
    try {
        if (!imagenBase64) {
            console.log(`⚠️ No hay imagen base64 para ID ${id}`);
            return false;
        }

        // Convertir base64 a buffer
        const buffer = Buffer.from(imagenBase64, 'base64');
        console.log(`📊 Tamaño foto: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

        console.log(`📤 Enviando a Telegram (${chatId})...`);
        
        await bot.sendPhoto(
            chatId,
            buffer,
            { caption: descripcion.substring(0, 1024) }
        );

        console.log(`✅ Foto enviada a Telegram ID ${id}`);

        console.log('💾 Actualizando BD: publicado = true, borrando imagen');
        
        await pool.query(
            'UPDATE fotos_camara_app SET publicado = true, imagen_base64 = NULL WHERE id = $1',
            [id]
        );

        console.log(`✅ Publicado ID ${id}: ${imagenUrl}`);
        return true;

    } catch (error) {
        console.error(`❌ Error publicando ID ${id}:`, error.message);
        if (error.response) {
            console.error('❌ Telegram error:', error.response.body);
        }
        return false;
    }
}

// =============================================
// FUNCIÓN: Buscar fotos pendientes
// =============================================

async function buscarFotosPendientes() {
    console.log('🔍 Consultando BD por fotos pendientes...');
    
    try {
        const result = await pool.query(`
            SELECT id, outlet, imagen_url, producto_identificado, imagen_base64
            FROM fotos_camara_app
            WHERE publicado = false OR publicado IS NULL
            ORDER BY fecha_creacion ASC
            LIMIT 5
        `);

        console.log(`📊 ${result.rows.length} fotos pendientes encontradas`);
        return result.rows;

    } catch (error) {
        console.error('❌ Error consultando BD:', error.message);
        return [];
    }
}

// =============================================
// PROCESAR FOTOS PENDIENTES
// =============================================

let procesando = false; // 🔥 PROTECCIÓN 1

async function procesarFotos() {
    // Si ya hay un procesamiento en curso, saltar
    if (procesando) {
        console.log('⏳ Ya hay un procesamiento en curso, saltando...');
        return;
    }
    procesando = true;

    try {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n🔍 [${timestamp}] Buscando fotos pendientes...`);

    const fotos = await buscarFotosPendientes();

    if (fotos.length === 0) {
        console.log('⏳ No hay fotos pendientes');
        return;
    }

    console.log(`📸 Procesando ${fotos.length} fotos...`);

    let procesadas = 0;
    let fallidas = 0;

    for (const foto of fotos) {
        console.log(`\n🔄 Procesando ID ${foto.id}...`);
        console.log(`🏪 Outlet: ${foto.outlet || 'No especificado'}`);
        console.log(`📸 Imagen: ${foto.imagen_url}`);

        console.log('🤔 Analizando con DeepSeek...');
        const descripcion = await analizarConDeepSeek(foto.imagen_base64);
        console.log(`📝 Descripción generada COMPLETA: ${descripcion}`);
        console.log(`📝 Longitud de descripción: ${descripcion.length} caracteres`);

        let categoria = '';
        console.log(`🔍 Extrayendo categoría de la descripción...`);
        const categoriaMatch = descripcion.match(/Categoria[:\s]*([^\n]+)/i);
        if (categoriaMatch) {
            categoria = categoriaMatch[1].trim();
            console.log(`📌 Categoría detectada: "${categoria}"`);
        } else {
            console.log(`⚠️ NO se encontró categoría en la descripción`);
            const categoriaMatch2 = descripcion.match(/Categoria\s*([^\n]+)/i);
            if (categoriaMatch2) {
                categoria = categoriaMatch2[1].trim();
                console.log(`📌 Categoría detectada (sin dos puntos): "${categoria}"`);
            }
        }

        console.log('📤 Publicando en Telegram...');
        const exito = await publicarFoto(foto.id, foto.imagen_base64, descripcion, categoria);

        if (exito) {
            procesadas++;
            console.log(`✅ ID ${foto.id} procesado exitosamente`);
        } else {
            fallidas++;
            console.log(`❌ ID ${foto.id} falló`);
        }

        if (fotos.length > 1) {
            console.log('⏳ Esperando 2 segundos antes de siguiente foto...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n📊 Resumen: ${procesadas} procesadas, ${fallidas} fallidas`);
    } finally {
        procesando = false; // 🔥 LIBERAR SIEMPRE
    }
}

// =============================================
// COMANDOS DE TELEGRAM
// =============================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '🤖 *Flashoulet Bot*\n\n' +
        'Bot que publica automáticamente fotos de productos.\n\n' +
        '📌 *Comandos disponibles:*\n' +
        '/status - Estado del sistema\n' +
        '/procesar - Forzar procesamiento\n' +
        '/help - Mostrar ayuda',
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const result = await pool.query(
            'SELECT COUNT(*) as total FROM fotos_camara_app'
        );
        const pendientes = await pool.query(
            'SELECT COUNT(*) as pendientes FROM fotos_camara_app WHERE publicado = false OR publicado IS NULL'
        );
        
        bot.sendMessage(chatId,
            `📊 *Estado del Sistema*\n\n` +
            `📸 Total de fotos: ${result.rows[0].total}\n` +
            `⏳ Pendientes: ${pendientes.rows[0].pendientes}\n` +
            `🟢 Servidor: Activo\n` +
            `🤖 Bot: Funcionando\n` +
            `🕐 Última verificación: ${new Date().toLocaleTimeString()}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        bot.sendMessage(chatId, '❌ Error obteniendo estado');
    }
});

bot.onText(/\/procesar/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🔄 Iniciando procesamiento manual...');
    await procesarFotos();
    bot.sendMessage(chatId, '✅ Procesamiento completado');
});

// =============================================
// INICIAR BOT
// =============================================

console.log('\n====================================');
console.log('🤖 Bot Flashoulet iniciado');
console.log('⏱️  Consultando BD cada 30 segundos');
console.log('====================================\n');

console.log('🚀 Ejecutando primer ciclo...');
procesarFotos();

setInterval(procesarFotos, 30000);
console.log('⏰ Timer configurado: 30 segundos');

// 🔥 PROTECCIÓN 3: Reiniciar contador a medianoche
setInterval(() => {
    const ahora = new Date();
    if (ahora.getHours() === 0 && ahora.getMinutes() < 1) {
        llamadasHoy = 0;
        console.log('🔄 Contador de llamadas reiniciado');
    }
}, 60000);

// =============================================
// MANEJO DE CIERRE
// =============================================

// =============================================
// SERVIDOR WEB PARA RENDER (HEALTH CHECK)
// =============================================

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.status(200).send('Bot Flashoulet funcionando');
});

app.listen(PORT, () => {
    console.log(`✅ Health check corriendo en puerto ${PORT}`);
});

// =============================================
// MANEJO DE CIERRE
// =============================================

process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando bot...');
    await pool.end();
    console.log('✅ Conexión a BD cerrada');
    process.exit(0);
});