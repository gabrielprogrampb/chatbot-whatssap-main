# WhatsApp Clinic Chatbot 🏥

Chatbot inteligente para WhatsApp que permite a pacientes agendar citas médicas, solicitar reembolsos y reportar emergencias. Utiliza IA (Google Gemini/OpenRouter) para procesar lenguaje natural y notas de voz.

## ✨ Características

- **Agendamiento de Citas**: Consultas integrales, reposos médicos y exámenes físicos (ECOR)
- **Solicitud de Reembolsos**: Proceso guiado paso a paso
- **Atención de Emergencias**: Redirección inmediata a contacto de emergencia
- **Transcripción de Voz**: Procesamiento de notas de voz con Whisper (HuggingFace/OpenAI)
- **IA Conversacional**: Google Gemini como motor principal, OpenRouter como respaldo
- **Reportes Automáticos**: Generación de reportes diarios/mensuales en Excel enviados por email
- **Modo Demo**: Funciona sin base de datos usando datos mock

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/whatsapp-clinic-chatbot.git
cd whatsapp-clinic-chatbot

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

## ⚙️ Configuración

Copia `.env.example` a `.env` y configura las variables:

### Obligatorias (para IA)
```env
# Al menos una de estas para transcripción de voz
HUGGINGFACE_API_KEY=tu_api_key
OPENAI_API_KEY=tu_api_key

# Al menos una de estas para conversación IA
GOOGLE_API_KEY=tu_api_key
OPENROUTER_API_KEY=tu_api_key
```

### Opcionales (Base de Datos)
```env
# Si no se configuran, el bot usa datos mock en memoria
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_KEY=tu_service_key
```

### Para Reportes por Email
```env
RESEND_API_KEY=tu_api_key
REPORT_EMAIL=email@ejemplo.com
```

## 🏃 Ejecución

```bash
# Modo desarrollo
npm start

# El bot mostrará un código QR para vincular WhatsApp
```

Al iniciar, verás uno de estos mensajes:
- `✅ Supabase configurado. Conectando a base de datos real...`
- `⚠️ Supabase no configurado. Usando datos mock (sin base de datos).`

## 📱 Comandos de Administrador

Envía estos comandos desde el número configurado en `REPORT_WHATSAPP_NUMBER`:

| Comando | Descripción |
|---------|-------------|
| `/reporte` | Genera reporte del día anterior |
| `/reporte 2024-01-15` | Genera reporte de fecha específica |
| `/reporte-mensual` | Genera reporte del mes actual |
| `/reporte-mensual 2024-01` | Genera reporte de mes específico |

## 🗂️ Estructura del Proyecto

```
├── index.js           # Punto de entrada, conexión WhatsApp
├── messageHandler.js  # Manejo de mensajes entrantes
├── aiHandler.js       # Procesamiento con IA (Gemini/OpenRouter)
├── database.js        # Capa de datos (auto-detecta Supabase o Mock)
├── mockData.js        # Datos mock para modo demo
├── reportGenerator.js # Generación de reportes Excel
├── supabaseClient.js  # Cliente de Supabase
└── .env.example       # Plantilla de configuración
```

## 🔧 Tecnologías Utilizadas

- **WhatsApp**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **IA**: Google Generative AI, OpenRouter
- **Transcripción**: Whisper (HuggingFace/OpenAI)
- **Base de Datos**: Supabase (PostgreSQL)
- **Reportes**: ExcelJS, Resend (emails)
- **Servidor**: Express.js

## 📄 Licencia

ISC
