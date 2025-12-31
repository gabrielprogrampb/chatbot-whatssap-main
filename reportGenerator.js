// reportGenerator.js
// Módulo para generación de reportes en Excel y envío por email
// Genera reportes diarios y mensuales de consultas, reembolsos y emergencias

const ExcelJS = require('exceljs');
const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');
const { getDatosReporteDiario, getDatosReporteMensual } = require('./database');
require('dotenv').config();

// Cliente de Resend para envío de correos
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Crea un archivo Excel con los datos de solicitudes.
 * Organiza los datos en hojas separadas: Consultas, ECOR, Reembolsos y Emergencias.
 * @param {Array} datos - Array de solicitudes a incluir en el reporte.
 * @param {string} fechaString - Identificador de fecha para el nombre del archivo.
 * @returns {Promise<string>} - Ruta del archivo Excel generado.
 */
async function createExcelReport(datos, fechaString) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AsistenteVirtualClinica';
    workbook.created = new Date();

    // Hoja 1: Consultas Generales
    const consultasSheet = workbook.addWorksheet('Consultas');
    consultasSheet.columns = [
        { header: 'Turno', key: 'numero_turno', width: 12 },
        { header: 'Nombre', key: 'nombre_paciente', width: 20 },
        { header: 'Apellido', key: 'apellido_paciente', width: 20 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Tipo Consulta', key: 'tipo_consulta_detalle', width: 25 },
        { header: 'Nómina', key: 'nomina', width: 15 },
        { header: 'Gerencia', key: 'gerencia', width: 25 },
        { header: 'Hora Registro', key: 'hora_solicitud', width: 15 },
    ];
    // Filtrar solo consultas (excluyendo ECOR)
    const consultasData = datos.filter(d => d.tipo_solicitud === 'consulta');
    consultasSheet.addRows(consultasData);

    // Hoja 2: Exámenes Físicos Anuales (ECOR)
    const ecorSheet = workbook.addWorksheet('ECOR');
    ecorSheet.columns = [
        { header: 'Turno', key: 'numero_turno', width: 12 },
        { header: 'Nombre', key: 'nombre_paciente', width: 20 },
        { header: 'Apellido', key: 'apellido_paciente', width: 20 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Nómina', key: 'nomina', width: 15 },
        { header: 'Gerencia', key: 'gerencia', width: 25 },
        { header: 'Hora Registro', key: 'hora_solicitud', width: 15 },
    ];
    const ecorData = datos.filter(d => d.tipo_solicitud === 'ecor');
    ecorSheet.addRows(ecorData);

    // Hoja 3: Reembolsos (sin campos de nómina ni gerencia)
    const reembolsosSheet = workbook.addWorksheet('Reembolsos');
    reembolsosSheet.columns = [
        { header: 'Turno', key: 'numero_turno', width: 12 },
        { header: 'Nombre', key: 'nombre_paciente', width: 25 },
        { header: 'Apellido', key: 'apellido_paciente', width: 25 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Hora Registro', key: 'hora_solicitud', width: 15 },
    ];
    const reembolsosData = datos.filter(d => d.tipo_solicitud === 'reembolso');
    reembolsosSheet.addRows(reembolsosData);

    // Hoja 4: Emergencias
    const emergenciasSheet = workbook.addWorksheet('Emergencias');
    emergenciasSheet.columns = [
        { header: 'Fecha', key: 'fecha_solicitud', width: 15 },
        { header: 'Hora', key: 'hora_solicitud', width: 15 },
        { header: 'Mensaje', key: 'mensaje', width: 50 },
    ];
    const emergenciasData = datos.filter(d => d.tipo_solicitud === 'emergencia');
    emergenciasSheet.addRows(emergenciasData);

    // Guardar el archivo Excel
    const filePath = path.join(__dirname, `Reporte_Diario_${fechaString}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

/**
 * Envía un correo electrónico con el archivo de reporte adjunto.
 * Utiliza Resend como servicio de envío de correos.
 * @param {string} filePath - Ruta del archivo a adjuntar.
 * @param {Date} fechaDisplay - Fecha para mostrar en el asunto del correo.
 */
async function sendEmailWithAttachment(filePath, fechaDisplay) {
    try {
        console.log(`[Resend] Leyendo el archivo para adjuntar: ${filePath}`);
        const fileContent = fs.readFileSync(filePath);

        await resend.emails.send({
            from: `"Asistente Virtual Clínica" <onboarding@resend.dev>`,
            to: process.env.REPORT_EMAIL_TO,
            subject: `Reporte Diario de Solicitudes - ${fechaDisplay.toLocaleDateString('es-VE')}`,
            text: 'Adjunto se encuentra el reporte diario de consultas y reembolsos generado por el asistente virtual.',
            attachments: [{
                filename: path.basename(filePath),
                content: fileContent,
            }],
        });

        console.log('Correo con reporte enviado exitosamente a través de Resend.');
    } catch (error) {
        console.error('[Resend] Error al enviar el correo:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Genera y envía el reporte diario por correo electrónico.
 * Esta función es llamada por el cron job externo.
 * @param {string} fechaString - Fecha del reporte en formato "YYYY-MM-DD".
 */
async function generateAndEmailReport(fechaString) {
    const fechaDisplay = new Date(fechaString + 'T12:00:00Z');

    console.log(`[REPORTE] Iniciando generación para la fecha: ${fechaString}`);

    try {
        const datos = await getDatosReporteDiario(fechaString);
        console.log(`[REPORTE] Se encontraron ${datos.length} registros.`);

        // Solo enviar correo si hay datos
        if (datos.length === 0) {
            console.log(`[REPORTE] No hay datos para la fecha ${fechaString}. No se enviará correo.`);
            return;
        }

        console.log(`[REPORTE] Procediendo a crear y enviar el reporte.`);

        const filePath = await createExcelReport(datos, fechaString);
        await sendEmailWithAttachment(filePath, fechaDisplay);

        // Eliminar archivo temporal
        fs.unlinkSync(filePath);
        console.log('[REPORTE] Reporte enviado por correo y archivo local eliminado.');

    } catch (error) {
        console.error('[REPORTE] Error crítico al generar o enviar el reporte:', error);
    }
}

/**
 * Genera y envía el reporte diario tanto por WhatsApp como por correo.
 * Esta función se activa con el comando /reporte desde WhatsApp.
 * @param {Object} sock - Socket de WhatsApp.
 * @param {string} recipientJid - JID del destinatario en WhatsApp.
 * @param {string} fechaString - Fecha del reporte en formato "YYYY-MM-DD".
 */
async function generateAndSendReports(sock, recipientJid, fechaString) {
    const fechaDisplay = new Date(fechaString + 'T12:00:00Z');
    console.log(`[COMANDO MANUAL] Iniciando generación de reporte para: ${fechaString}`);

    try {
        const datos = await getDatosReporteDiario(fechaString);

        if (datos.length === 0) {
            console.log(`[COMANDO MANUAL] No hay datos para ${fechaString}.`);
            await sock.sendMessage(recipientJid, { text: `Reporte del día ${fechaDisplay.toLocaleDateString('es-VE')}: No se registraron solicitudes.` });
            return;
        }

        const filePath = await createExcelReport(datos, fechaString);

        // Enviar por WhatsApp
        await sock.sendMessage(recipientJid, {
            document: { url: filePath },
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileName: path.basename(filePath),
            caption: `Reporte de solicitudes para el día ${fechaDisplay.toLocaleDateString('es-VE')}.`
        });
        console.log('[COMANDO MANUAL] Reporte enviado por WhatsApp.');

        // También enviar por correo
        await sendEmailWithAttachment(filePath, fechaDisplay);

        // Eliminar archivo temporal
        fs.unlinkSync(filePath);
        console.log('[COMANDO MANUAL] Archivo de reporte local eliminado.');

    } catch (error) {
        console.error('[COMANDO MANUAL] Error al generar o enviar el reporte:', error);
        await sock.sendMessage(recipientJid, { text: `⚠️ *Error Crítico* ⚠️\nNo se pudo generar el reporte.\nError: ${error.message}` });
    }
}

/**
 * Genera y envía el reporte mensual por WhatsApp.
 * Esta función se activa con el comando /reporte-mensual desde WhatsApp.
 * @param {Object} sock - Socket de WhatsApp.
 * @param {string} recipientJid - JID del destinatario en WhatsApp.
 * @param {string} monthYearString - Mes del reporte en formato "YYYY-MM".
 */
async function generateAndSendMonthlyReport(sock, recipientJid, monthYearString) {
    console.log(`[COMANDO MANUAL] Iniciando generación de reporte mensual para: ${monthYearString}`);

    try {
        const datosMensuales = await getDatosReporteMensual(monthYearString);

        if (datosMensuales.length === 0) {
            console.log(`[COMANDO MANUAL] No hay datos para el mes ${monthYearString}.`);
            await sock.sendMessage(recipientJid, { text: `Reporte mensual de ${monthYearString}: No se registraron solicitudes.` });
            return;
        }

        const filePath = await createExcelReport(datosMensuales, `MENSUAL_${monthYearString}`);

        // Enviar por WhatsApp
        await sock.sendMessage(recipientJid, {
            document: { url: filePath },
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileName: path.basename(filePath),
            caption: `Reporte mensual de solicitudes para ${monthYearString}.`
        });
        console.log('[COMANDO MANUAL] Reporte mensual enviado por WhatsApp.');

        // Eliminar archivo temporal
        fs.unlinkSync(filePath);
        console.log('[COMANDO MANUAL] Archivo de reporte mensual eliminado.');

    } catch (error) {
        console.error('[COMANDO MANUAL] Error al generar el reporte mensual:', error);
        await sock.sendMessage(recipientJid, { text: `⚠️ *Error Crítico* ⚠️\nNo se pudo generar el reporte mensual.\nError: ${error.message}` });
    }
}

module.exports = {
    generateAndSendReports,
    generateAndEmailReport,
    generateAndSendMonthlyReport
};
