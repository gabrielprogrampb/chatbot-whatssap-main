// index.js
// Punto de entrada principal del chatbot de WhatsApp
// Este archivo maneja la conexión con WhatsApp y el servidor Express

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const express = require('express');
const fs = require('fs');
const pino = require('pino');
const { handleMessage } = require('./messageHandler');
const { generateAndEmailReport } = require('./reportGenerator');
require('dotenv').config();

// Carpeta donde se guarda la autenticación de WhatsApp
const authFolder = path.join(__dirname, 'auth_info_baileys');
// Descomenta las siguientes líneas para forzar un nuevo código QR
// if (fs.existsSync(authFolder)) {
//     console.log('[Inicio] Eliminando carpeta de autenticación antigua para forzar un nuevo QR.');
//     fs.rmSync(authFolder, { recursive: true, force: true });
// }

// Configuración del servidor Express
const app = express();
const port = process.env.PORT || 3000;

// Ruta principal de salud del servidor
app.get('/', (req, res) => {
    res.send('¡El chatbot de la clínica está vivo!');
});

// Endpoint para disparar reportes automáticos vía cron job externo
app.get('/trigger-report', async (req, res) => {
    const { secret } = req.query;
    console.log(`[CRON-WEB] Secreto recibido: '${secret}'`);
    console.log(`[CRON-WEB] Secreto esperado: '${process.env.CRON_SECRET}'`);

    // Verificar que el secreto sea correcto
    if (secret !== process.env.CRON_SECRET) {
        console.log('[CRON-WEB] La comparación de secretos falló.');
        return res.status(401).send('Clave secreta no válida.');
    }

    // Responder inmediatamente para no bloquear el cron job
    res.status(202).send('Tarea de reporte aceptada. Se ejecutará en segundo plano.');
    console.log('✅ [CRON-WEB] ¡La comparación de secretos fue exitosa!');

    try {
        const fechaString = getReportDateString();
        console.log(`[CRON-WEB] Calculada fecha para el reporte: ${fechaString}`);
        await generateAndEmailReport(fechaString);
        console.log('✅ [CRON-WEB] Tarea de reporte finalizada exitosamente.');
    } catch (error) {
        console.error('❌ [CRON-WEB] Ocurrió un error crítico durante la ejecución:', error);
    }
});

app.listen(port, () => {
    console.log(`Servidor web escuchando en el puerto ${port}.`);
});

/**
 * Calcula la fecha del reporte basándose en el día actual.
 * Los lunes genera el reporte del viernes (3 días antes).
 * Los demás días genera el reporte del día anterior.
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
function getReportDateString() {
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Caracas" }));
    const diaDeLaSemana = ahora.getDay();
    let fechaDelReporte = new Date(ahora);

    if (diaDeLaSemana === 1) {
        // Si es lunes, reportar el viernes (3 días antes)
        fechaDelReporte.setDate(ahora.getDate() - 3);
    } else {
        // Cualquier otro día, reportar el día anterior
        fechaDelReporte.setDate(ahora.getDate() - 1);
    }

    return fechaDelReporte.toLocaleDateString('en-CA');
}

/**
 * Función principal que establece la conexión con WhatsApp.
 * Maneja la autenticación, reconexión y recepción de mensajes.
 */
async function connectToWhatsApp() {
    try {
        // Cargar estado de autenticación guardado
        const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, 'auth_info_baileys'));

        // Obtener la versión más reciente de Baileys para evitar bloqueos
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[Inicio] Usando la versión de Baileys: ${version.join('.')}, ¿Es la más reciente?: ${isLatest}`);

        // Crear el socket de WhatsApp
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'error' }), // Nivel 'error' para reducir ruido en consola
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: state,
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: undefined
        });

        // Manejar actualizaciones de conexión
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Si hay un código QR nuevo, mostrarlo
            if (qr) {
                const encodedQr = encodeURIComponent(qr);
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQr}`;
                console.log('------------------------------------------------');
                console.log('¡Nuevo código QR! Abre este enlace en tu navegador:');
                console.log(qrUrl);
                console.log('------------------------------------------------');
            }

            // Si la conexión se cierra, intentar reconectar
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Conexión cerrada, reconectando...', shouldReconnect);
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('¡Conexión abierta y exitosa!');
            }
        });

        // Guardar credenciales cuando se actualicen
        sock.ev.on('creds.update', saveCreds);

        // Manejar mensajes entrantes
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];

            // Ignorar mensajes vacíos o propios
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;

            // Ignorar estados y grupos
            if (from === 'status@broadcast' || from.endsWith('@g.us')) return;

            try {
                await handleMessage(sock, msg);
            } catch (error) {
                console.error(`Error fatal al manejar un mensaje de ${from}:`, error);
            }
        });
    } catch (error) {
        console.error("Error crítico en la función connectToWhatsApp:", error);
        // Reintentar conexión después de 15 segundos
        setTimeout(connectToWhatsApp, 15000);
    }
}

console.log('El bot está listo. El reporte automático se activará mediante un cron job web externo.');
connectToWhatsApp();