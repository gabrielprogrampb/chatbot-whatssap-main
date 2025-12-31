// database.js
// Módulo de base de datos con auto-detección Supabase vs Datos Mock
// Si Supabase está configurado, usa la base de datos real
// Si no está configurado, usa datos mock en memoria

require('dotenv').config();

// Detectar si Supabase está configurado verificando las variables de entorno
const supabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

if (supabaseConfigured) {
    console.log('✅ Supabase configurado. Conectando a base de datos real...');

    const supabase = require('./supabaseClient');

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

            // Obtener el límite de cupos desde la configuración
            const { data: config, error: configError } = await supabase.from('configuracion').select('valor').eq('clave', claveLimite).single();
            if (configError) throw configError;
            const limiteCupos = parseInt(config.valor, 10);

            const fechaISO = fecha.toISOString().split('T')[0];
            // Consultas y ECOR comparten el mismo límite de cupos
            const tipoQuery = tipo === 'consulta' ? ['consulta', 'ecor'] : ['reembolso'];

            // Contar cuántas solicitudes ya hay para esa fecha
            const { count, error: countError } = await supabase
                .from('solicitudes')
                .select('*', { count: 'exact', head: true })
                .in('tipo_solicitud', tipoQuery)
                .eq('fecha_solicitud', fechaISO);

            if (countError) throw countError;

            return limiteCupos - count;
        } catch (error) {
            console.error('Error al obtener cupos disponibles:', error.message);
            return 0;
        }
    }

    /**
     * Genera el siguiente número de turno para una fecha.
     * El conteo se reinicia cada día gracias a la restricción UNIQUE en la BD.
     * @param {'C' | 'R'} prefijo - C para Consulta, R para Reembolso.
     * @param {Date} fecha - La fecha para el turno.
     * @returns {Promise<string|null>} - El número de turno (ej: "C-001") o null si hay error.
     */
    async function getSiguienteNumeroTurno(prefijo, fecha) {
        try {
            const fechaISO = fecha.toISOString().split('T')[0];
            const tipoSolicitudQuery = (prefijo === 'R') ? ['reembolso'] : ['consulta', 'ecor'];

            // Contar turnos existentes para ese día
            const { count, error } = await supabase
                .from('solicitudes')
                .select('*', { count: 'exact', head: true })
                .eq('fecha_solicitud', fechaISO)
                .in('tipo_solicitud', tipoSolicitudQuery);

            if (error) throw error;

            const nuevoNumero = (count || 0) + 1;
            return `${prefijo}-${String(nuevoNumero).padStart(3, '0')}`;
        } catch (error) {
            console.error('Error al generar el número de turno:', error.message);
            return null;
        }
    }

    /**
     * Crea una nueva solicitud en la base de datos.
     * @param {Object} datosSolicitud - Los datos de la solicitud a crear.
     * @returns {Promise<Object|null>} - La solicitud creada o null si hay error.
     */
    async function crearSolicitud(datosSolicitud) {
        try {
            const { data, error } = await supabase.from('solicitudes').insert([datosSolicitud]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al crear la solicitud en la base de datos:', error.message);
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
            const { data, error } = await supabase
                .from('solicitudes')
                .select('*')
                .eq('fecha_solicitud', fechaString);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener datos para el reporte:', error.message);
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

            const { data, error } = await supabase
                .from('solicitudes')
                .select('*')
                .gte('fecha_solicitud', startDate)
                .lte('fecha_solicitud', endDate);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error al obtener datos para el reporte mensual:', error.message);
            return [];
        }
    }

    /**
     * Verifica si ya existe una cita para una cédula en una fecha específica.
     * @param {string} cedula - La cédula del paciente.
     * @param {Date} fecha - La fecha a verificar.
     * @returns {Promise<boolean>} - True si ya tiene cita, false si no.
     */
    async function checkExistingAppointment(cedula, fecha) {
        try {
            const fechaISO = fecha.toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('solicitudes')
                .select('id')
                .eq('cedula', cedula)
                .eq('fecha_solicitud', fechaISO)
                .in('tipo_solicitud', ['consulta', 'ecor'])
                .maybeSingle();

            if (error) throw error;
            return !!data; // Retorna true si existe, false si no
        } catch (error) {
            console.error('Error al verificar cita existente:', error.message);
            return false;
        }
    }

    module.exports = {
        getCuposDisponibles,
        getSiguienteNumeroTurno,
        crearSolicitud,
        getDatosReporteDiario,
        getDatosReporteMensual,
        checkExistingAppointment,
    };

} else {
    console.log('⚠️ Supabase no configurado. Usando datos mock (sin base de datos).');

    // Cuando Supabase no está configurado, exportamos las funciones mock
    const mockData = require('./mockData');

    module.exports = {
        getCuposDisponibles: mockData.getCuposDisponibles,
        getSiguienteNumeroTurno: mockData.getSiguienteNumeroTurno,
        crearSolicitud: mockData.crearSolicitud,
        getDatosReporteDiario: mockData.getDatosReporteDiario,
        getDatosReporteMensual: mockData.getDatosReporteMensual,
        checkExistingAppointment: mockData.checkExistingAppointment,
    };
}
