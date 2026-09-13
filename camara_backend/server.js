const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = 3001;

// =====================================================
// MIDDLEWARES
// =====================================================

console.log('🔧 Configurando middlewares...');

app.use(cors());

app.use(express.json({
    limit: '50mb'
}));
console.log('✅ JSON limit: 50mb');

app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
}));
console.log('✅ URL encoded limit: 50mb');

console.log('✅ Middlewares configurados');

// =====================================================
// CARPETA PARA GUARDAR LAS FOTOS
// =====================================================

const uploadsDir = path.join(__dirname, 'uploads');
console.log(`📁 Ruta de uploads: ${uploadsDir}`);

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {
        recursive: true
    });
    console.log('📁 Carpeta uploads creada');
} else {
    console.log('📁 Carpeta uploads ya existe');
}

app.use('/uploads', express.static(uploadsDir));
console.log(`📁 Archivos estáticos: /uploads -> ${uploadsDir}`);

// =====================================================
// POSTGRESQL
// =====================================================

console.log('🔌 Conectando a PostgreSQL...');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =====================================================
// COMPROBAR CONEXIÓN Y TABLA
// =====================================================

const comprobarBaseDatos = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Conexión con PostgreSQL correcta');

        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'fotos_camara_app'
            );
        `);

        if (result.rows[0].exists) {
            console.log('✅ Tabla fotos_camara_app encontrada');
        } else {
            console.log('⚠️ La tabla fotos_camara_app NO existe');
        }
    } catch (error) {
        console.error('❌ Error conectando con PostgreSQL:', error.message);
    }
};

comprobarBaseDatos();

// =====================================================
// RUTA PRINCIPAL
// =====================================================

app.get('/', (req, res) => {
    console.log('📡 GET / - Petición recibida');
    res.json({
        success: true,
        mensaje: 'Servidor de cámara funcionando'
    });
});

// =====================================================
// RECIBIR FOTO DESDE FLUTTER
// =====================================================


const upload = multer({ dest: uploadsDir });

app.post('/api/analizar', upload.single('imagen'), async (req, res) => {
    try {
        const { outlet, producto_identificado } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No se recibió ninguna imagen'
            });
        }

        const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const filepath = path.join(uploadsDir, filename);
        fs.renameSync(file.path, filepath);

        const imagenUrl = `/uploads/${filename}`;

      // Leer la imagen y convertirla a base64
const imagenBuffer = fs.readFileSync(filepath);
const imagenBase64 = imagenBuffer.toString('base64');

const result = await pool.query(
    `INSERT INTO fotos_camara_app (outlet, imagen_url, producto_identificado, imagen_base64)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [outlet || null, imagenUrl, producto_identificado || 'Foto tomada desde la cámara', imagenBase64]
);

        res.json({
            success: true,
            mensaje: 'Foto guardada correctamente',
            foto: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// OBTENER TODAS LAS FOTOS
// =====================================================

app.get('/api/fotos', async (req, res) => {
    console.log('📡 GET /api/fotos - Listando fotos');
    
    try {
        const result = await pool.query(`
            SELECT
                id,
                outlet,
                imagen_url,
                producto_identificado,
                fecha_creacion
            FROM fotos_camara_app
            ORDER BY fecha_creacion DESC
        `);

        console.log(`✅ ${result.rows.length} fotos encontradas`);

        res.json({
            success: true,
            fotos: result.rows
        });

    } catch (error) {
        console.error('❌ Error obteniendo fotos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// OBTENER UNA FOTO POR ID
// =====================================================

app.get('/api/fotos/:id', async (req, res) => {
    console.log(`📡 GET /api/fotos/${req.params.id} - Buscando foto`);
    
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                id,
                outlet,
                imagen_url,
                producto_identificado,
                fecha_creacion
            FROM fotos_camara_app
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Foto ${id} no encontrada`);
            return res.status(404).json({
                success: false,
                error: 'Foto no encontrada'
            });
        }

        console.log(`✅ Foto ${id} encontrada`);

        res.json({
            success: true,
            foto: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Error buscando foto:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(
    port,
    '0.0.0.0',
    () => {
        console.log('');
        console.log('====================================');
        console.log('🚀 SERVIDOR DE CÁMARA INICIADO');
        console.log(`📡 Puerto: ${port}`);
        console.log(`📁 Fotos: ${uploadsDir}`);
        console.log(`📊 Límite de imagen: 50MB`);
        console.log(`🔄 Compresión: DESACTIVADA - Imagen original`);
        console.log('====================================');
        console.log('');
    }
);