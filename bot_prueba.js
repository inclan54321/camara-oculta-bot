const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🧪 Iniciando Bot de Prueba...');

// =============================================
// CONFIGURACIÓN
// =============================================

const BOT_TOKEN = process.env.BOT_TOKEN || "TU_TOKEN";
const CHAT_ID = process.env.CHAT_ID || "ID_GRUPO";

console.log('✅ Configuración cargada');
console.log(`📱 CHAT_ID configurado: ${CHAT_ID}`);

// =============================================
// POSTGRESQL
// =============================================

console.log('🔌 Conectando a PostgreSQL...');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'railway',
    password: process.env.DB_PASSWORD || 'Knives1997.1',
    port: process.env.DB_PORT || 5432,
});

// =============================================
// INICIALIZAR BOT
// =============================================

console.log('🤖 Inicializando bot de Telegram...');
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot de Telegram inicializado');

// =============================================
// COMANDO /start
// =============================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Mensaje /start recibido de: ${chatId}`);
    bot.sendMessage(chatId, 
        '🧪 *Bot de Prueba*\n\n' +
        'Este bot prueba la conexión con Telegram.\n\n' +
        '📌 *Comandos:*\n' +
        '/test - Enviar mensaje de prueba\n' +
        '/foto - Enviar la última foto de la BD\n' +
        '/chatid - Mostrar tu CHAT_ID\n' +
        '/procesar - Procesar fotos pendientes',
        { parse_mode: 'Markdown' }
    );
});

// =============================================
// COMANDO /chatid
// =============================================

bot.onText(/\/chatid/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Comando /chatid de: ${chatId}`);
    bot.sendMessage(chatId, 
        `🔑 *Tu CHAT_ID es:*\n\`${chatId}\``,
        { parse_mode: 'Markdown' }
    );
});

// =============================================
// COMANDO /test
// =============================================

bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Comando /test de: ${chatId}`);
    bot.sendMessage(chatId, '✅ ¡Conexión exitosa! El bot funciona correctamente.');
});

// =============================================
// COMANDO /foto (enviar última foto)
// =============================================

bot.onText(/\/foto/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Comando /foto de: ${chatId}`);

    try {
        const result = await pool.query(`
            SELECT id, imagen_url, producto_identificado
            FROM fotos_camara_app
            ORDER BY id DESC
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            bot.sendMessage(chatId, '❌ No hay fotos en la base de datos.');
            return;
        }

        const foto = result.rows[0];
        const rutaFoto = path.join(__dirname, 'camara_backend', 'uploads', path.basename(foto.imagen_url));

        if (!fs.existsSync(rutaFoto)) {
            bot.sendMessage(chatId, `❌ El archivo no existe: ${rutaFoto}`);
            return;
        }

        const caption = 
            `📸 *Foto ID: ${foto.id}*\n` +
            `📝 *Descripción:* ${foto.producto_identificado || 'Sin descripción'}\n` +
            `📁 *Ruta:* ${foto.imagen_url}`;

        await bot.sendPhoto(chatId, rutaFoto, { caption, parse_mode: 'Markdown' });
        console.log(`✅ Foto ID ${foto.id} enviada a ${chatId}`);

    } catch (error) {
        console.error('❌ Error al enviar foto:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// =============================================
// COMANDO /procesar (procesar fotos pendientes)
// =============================================

bot.onText(/\/procesar/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Comando /procesar de: ${chatId}`);
    bot.sendMessage(chatId, '🔄 Procesando fotos pendientes...');

    try {
        const result = await pool.query(`
            SELECT id, imagen_url, producto_identificado
            FROM fotos_camara_app
            WHERE publicado = false OR publicado IS NULL
            ORDER BY id ASC
            LIMIT 5
        `);

        if (result.rows.length === 0) {
            bot.sendMessage(chatId, '⏳ No hay fotos pendientes.');
            return;
        }

        let enviadas = 0;
        for (const foto of result.rows) {
            const rutaFoto = path.join(__dirname, 'camara_backend', 'uploads', path.basename(foto.imagen_url));

            if (!fs.existsSync(rutaFoto)) {
                bot.sendMessage(chatId, `⚠️ Archivo no encontrado: ${foto.imagen_url}`);
                continue;
            }

            const caption = 
                `📸 *Foto Pendiente ID: ${foto.id}*\n` +
                `📝 *Descripción:* ${foto.producto_identificado || 'Sin descripción'}`;

            await bot.sendPhoto(chatId, rutaFoto, { caption, parse_mode: 'Markdown' });
            
            // Marcar como publicada
            await pool.query(
                'UPDATE fotos_camara_app SET publicado = true WHERE id = $1',
                [foto.id]
            );

            enviadas++;
            console.log(`✅ Foto ID ${foto.id} enviada y marcada como publicada`);
            
            // Esperar entre fotos para no saturar
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        bot.sendMessage(chatId, `✅ Se enviaron ${enviadas} de ${result.rows.length} fotos pendientes.`);

    } catch (error) {
        console.error('❌ Error en /procesar:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// =============================================
// COMANDO /status
// =============================================

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 Comando /status de: ${chatId}`);

    try {
        const total = await pool.query('SELECT COUNT(*) FROM fotos_camara_app');
        const pendientes = await pool.query(
            'SELECT COUNT(*) FROM fotos_camara_app WHERE publicado = false OR publicado IS NULL'
        );

        bot.sendMessage(chatId,
            `📊 *Estado del Sistema*\n\n` +
            `📸 Total de fotos: ${total.rows[0].count}\n` +
            `⏳ Pendientes: ${pendientes.rows[0].count}\n` +
            `🤖 Bot: Funcionando\n` +
            `📱 CHAT_ID actual: ${chatId}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// =============================================
// INICIAR BOT
// =============================================

console.log('\n====================================');
console.log('🧪 Bot de Prueba iniciado');
console.log('📱 Comandos disponibles:');
console.log('  /start   - Menú principal');
console.log('  /test    - Probar conexión');
console.log('  /chatid  - Mostrar tu CHAT_ID');
console.log('  /foto    - Enviar última foto');
console.log('  /procesar - Procesar fotos pendientes');
console.log('  /status  - Estado del sistema');
console.log('====================================\n');

// =============================================
// MANEJO DE CIERRE
// =============================================

process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando bot de prueba...');
    await pool.end();
    console.log('✅ Conexión a BD cerrada');
    process.exit(0);
});