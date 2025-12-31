// mockData.js
// Módulo de datos mock para funcionamiento sin base de datos

/**
 * Almacenamiento en memoria para solicitudes
 */
let solicitudes = [];
let idCounter = 1;

/**
 * Configuración de cupos disponibles
 */
const configuracion = {
    cupos_consulta: 15,
    cupos_consulta_miercoles: 10,
    cupos_reembolso: 20
};

/**
 * Reinicia los datos mock (útil para testing)
 */
function resetMockData() {
    solicitudes = [];
    idCounter = 1;
}

/**
 * Obtiene los cupos disponibles para un tipo de solicitud en una fecha.
 * @param {'consulta' | 'reembolso'} tipo - El tipo de solicitud.
 * @param {Date} fecha - La fecha para verificar cupos.
 * @returns {Promise<number>} - Número de cupos disponibles.
 */
async function getCuposDisponibles(tipo, fecha) {
    try {
        const diaSemana = fecha.getDay();
        let claveLimite = `cupos_${tipo}`;
        // Los miércoles tienen menos cupos para consultas
        if (tipo === 'consulta' && diaSemana === 3) {
            claveLimite = 'cupos_consulta_miercoles';
        }

        const limiteCupos = configuracion[claveLimite] || 15;
        const fechaISO = fecha.toISOString().split('T')[0];
        const tipoQuery = tipo === 'consulta' ? ['consulta', 'ecor'] : ['reembolso'];

        // Contar solicitudes existentes para esa fecha
        const count = solicitudes.filter(s =>
            tipoQuery.includes(s.tipo_solicitud) &&
            s.fecha_solicitud === fechaISO
        ).length;

        return limiteCupos - count;
    } catch (error) {
        console.error('[MOCK] Error al obtener cupos disponibles:', error.message);
        return 0;
    }
}

/**
 * Genera el siguiente número de turno para una fecha.
 * El conteo se reinicia cada día.
 * @param {'C' | 'R'} prefijo - C para Consulta, R para Reembolso.
 * @param {Date} fecha - La fecha para el turno.
 * @returns {Promise<string>} - El número de turno (ej: "C-001").
 */
async function getSiguienteNumeroTurno(prefijo, fecha) {
    try {
        const fechaISO = fecha.toISOString().split('T')[0];
        const tipoSolicitudQuery = (prefijo === 'R') ? ['reembolso'] : ['consulta', 'ecor'];

        // Contar turnos existentes para ese día y tipo
        const count = solicitudes.filter(s =>
            s.fecha_solicitud === fechaISO &&
            tipoSolicitudQuery.includes(s.tipo_solicitud)
        ).length;

        const nuevoNumero = count + 1;
        return `${prefijo}-${String(nuevoNumero).padStart(3, '0')}`;
    } catch (error) {
        console.error('[MOCK] Error al generar el número de turno:', error.message);
        return null;
    }
}

/**
 * Crea una nueva solicitud en el almacenamiento mock.
 * @param {Object} datosSolicitud - Los datos de la solicitud a crear.
 * @returns {Promise<Object|null>} - La solicitud creada o null si hay error.
 */
async function crearSolicitud(datosSolicitud) {
    try {
        const nuevaSolicitud = {
            id: idCounter++,
            ...datosSolicitud,
            created_at: new Date().toISOString()
        };
        solicitudes.push(nuevaSolicitud);
        console.log('[MOCK] Solicitud creada:', nuevaSolicitud);
        return nuevaSolicitud;
    } catch (error) {
        console.error('[MOCK] Error al crear la solicitud:', error.message);
        return null;
    }
}

/**
 * Obtiene las solicitudes de un día específico para generar reportes.
 * @param {string} fechaString - La fecha en formato "YYYY-MM-DD".
 * @returns {Promise<Array>} - Array de solicitudes del día.
 */
async function getDatosReporteDiario(fechaString) {
    try {
        return solicitudes.filter(s => s.fecha_solicitud === fechaString);
    } catch (error) {
        console.error('[MOCK] Error al obtener datos del reporte:', error.message);
        return [];
    }
}

/**
 * Obtiene las solicitudes de un mes específico para reportes mensuales.
 * @param {string} mesString - El mes en formato "YYYY-MM".
 * @returns {Promise<Array>} - Array de solicitudes del mes.
 */
async function getDatosReporteMensual(mesString) {
    try {
        const startDate = `${mesString}-01`;
        const [year, month] = mesString.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${mesString}-${lastDay}`;

        return solicitudes.filter(s =>
            s.fecha_solicitud >= startDate &&
            s.fecha_solicitud <= endDate
        );
    } catch (error) {
        console.error('[MOCK] Error al obtener datos del reporte mensual:', error.message);
        return [];
    }
}

/**
 * Verifica si ya existe una cita para una cédula en una fecha específica.
 * Evita que un paciente agende dos citas el mismo día.
 * @param {string} cedula - La cédula del paciente.
 * @param {Date} fecha - La fecha a verificar.
 * @returns {Promise<boolean>} - True si ya tiene cita, false si no.
 */
async function checkExistingAppointment(cedula, fecha) {
    try {
        const fechaISO = fecha.toISOString().split('T')[0];
        const existente = solicitudes.find(s =>
            s.cedula === cedula &&
            s.fecha_solicitud === fechaISO &&
            ['consulta', 'ecor'].includes(s.tipo_solicitud)
        );
        return !!existente;
    } catch (error) {
        console.error('[MOCK] Error al verificar cita existente:', error.message);
        return false;
    }
}

/**
 * Obtiene todas las solicitudes (para debugging/testing)
 * @returns {Array} - Todas las solicitudes en memoria.
 */
function getAllSolicitudes() {
    return solicitudes;
}

module.exports = {
    getCuposDisponibles,
    getSiguienteNumeroTurno,
    crearSolicitud,
    getDatosReporteDiario,
    getDatosReporteMensual,
    checkExistingAppointment,
    resetMockData,
    getAllSolicitudes
};
