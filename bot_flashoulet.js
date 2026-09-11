const { Pool } = require('pg');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
// MAPEO DE CATEGORÍAS A GRUPOS  ← AQUÍ VA
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

console.log('🔌 Conectando a PostgreSQL...');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'railway',
    password: process.env.DB_PASSWORD || 'Knives1997.1',
    port: process.env.DB_PORT || 5432,
});

// =============================================
// INICIALIZAR BOT (CORREGIDO)
// =============================================

console.log('🤖 Inicializando bot de Telegram...');
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot de Telegram inicializado');

// =============================================
// FUNCIÓN: Analizar con DeepSeek
// =============================================

async function analizarConDeepSeek(rutaFoto) {
    console.log(`🤔 Analizando con DeepSeek: ${rutaFoto}`);
    
    try {
        if (!fs.existsSync(rutaFoto)) {
            console.log(`❌ Archivo no existe: ${rutaFoto}`);
            return "No se pudo encontrar la imagen";
        }

        const stats = fs.statSync(rutaFoto);
        console.log(`📊 Tamaño archivo: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

        const imagenBase64 = fs.readFileSync(rutaFoto).toString('base64');
        console.log('✅ Imagen convertida a base64');

        console.log('📤 Enviando a DeepSeek API...');
        
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
        max_tokens: 300
    },
    {
        headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        timeout: 15000
    }
);

        console.log('✅ Respuesta de DeepSeek recibida');
        // DeepSeek devuelve la respuesta en choices[0].message.content
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

async function publicarFoto(id, imagenUrl, descripcion, categoria) {
    // Si no hay categoría o no se pudo identificar, publicar en un grupo por defecto
    let chatId = CHAT_ID; // Grupo por defecto
    
    // Buscar el grupo correspondiente a la categoría
    if (categoria) {
        const categoriaLower = categoria.toLowerCase().trim();
        // Buscar coincidencia exacta o parcial
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
        const rutaFoto = path.join(__dirname, 'camara_backend', 'uploads', path.basename(imagenUrl));
        console.log(`📁 Ruta física: ${rutaFoto}`);

        if (!fs.existsSync(rutaFoto)) {
            console.log(`⚠️ Foto no encontrada: ${rutaFoto}`);
            return false;
        }

        const stats = fs.statSync(rutaFoto);
        console.log(`📊 Tamaño foto a publicar: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

        // Enviar a Telegram
        console.log(`📤 Enviando a Telegram (${chatId})...`);
        
        await bot.sendPhoto(
            chatId,
            rutaFoto,
            { caption: descripcion.substring(0, 1024) }
        );

        console.log(`✅ Foto enviada a Telegram ID ${id}`);

        // Marcar como publicada en BD
        console.log('💾 Actualizando BD: publicado = true');
        
        await pool.query(
            'UPDATE fotos_camara_app SET publicado = true WHERE id = $1',
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
            SELECT id, outlet, imagen_url, producto_identificado
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

async function procesarFotos() {
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

        // Obtener ruta de la foto
        const rutaFoto = path.join(__dirname, 'camara_backend', 'uploads', path.basename(foto.imagen_url));
        
        // ANALIZAR con DeepSeek
console.log('🤔 Analizando con DeepSeek...');
const descripcion = await analizarConDeepSeek(rutaFoto);
console.log(`📝 Descripción generada COMPLETA: ${descripcion}`);
console.log(`📝 Longitud de descripción: ${descripcion.length} caracteres`);

// Extraer categoría de la descripción
let categoria = '';
console.log(`🔍 Extrayendo categoría de la descripción...`);
const categoriaMatch = descripcion.match(/Categoria[:\s]*([^\n]+)/i);
if (categoriaMatch) {
    categoria = categoriaMatch[1].trim();
    console.log(`📌 Categoría detectada: "${categoria}"`);
} else {
    console.log(`⚠️ NO se encontró categoría en la descripción`);
    // Intentar con otro formato
    const categoriaMatch2 = descripcion.match(/Categoria\s*([^\n]+)/i);
    if (categoriaMatch2) {
        categoria = categoriaMatch2[1].trim();
        console.log(`📌 Categoría detectada (sin dos puntos): "${categoria}"`);
    }
}

// PUBLICAR en Telegram (con la categoría)
console.log('📤 Publicando en Telegram...');
const exito = await publicarFoto(foto.id, foto.imagen_url, descripcion, categoria);

        if (exito) {
            procesadas++;
            console.log(`✅ ID ${foto.id} procesado exitosamente`);
        } else {
            fallidas++;
            console.log(`❌ ID ${foto.id} falló`);
        }

        // Pausa entre fotos
        if (fotos.length > 1) {
            console.log('⏳ Esperando 2 segundos antes de siguiente foto...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n📊 Resumen: ${procesadas} procesadas, ${fallidas} fallidas`);
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

// Ejecutar inmediatamente al iniciar
console.log('🚀 Ejecutando primer ciclo...');
procesarFotos();

// Y luego cada 30 segundos
setInterval(procesarFotos, 30000);
console.log('⏰ Timer configurado: 30 segundos');

// =============================================
// MANEJO DE CIERRE
// =============================================

process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando bot...');
    await pool.end();
    console.log('✅ Conexión a BD cerrada');
    process.exit(0);
});