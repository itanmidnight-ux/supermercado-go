// src/middleware/error.js — Manejador centralizado de errores
const config = require('../config');

/**
 * Manejador de errores para Express.
 * Debe registrarse como el último middleware (después de todas las rutas).
 */
function errorHandler(err, req, res, _next) {
  // Log del error completo en el servidor (sin exponer detalles al cliente)
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${err.message || err}`);
  if (config.nodeEnv !== 'production') {
    console.error(err.stack);
  }

  // Errores conocidos de validación
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }

  // Errores de multer (upload de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (2MB)' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Campo de archivo inesperado en la petición' });
  }

  // Error de clave foránea en SQLite
  if (err.message && err.message.includes('FOREIGN KEY')) {
    return res.status(409).json({ error: 'No se puede completar la operación por una restricción de datos relacionados' });
  }

  // Error de unicidad (UNIQUE constraint)
  if (err.message && err.message.includes('UNIQUE constraint')) {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
  }

  // Error de CHECK constraint
  if (err.message && err.message.includes('CHECK constraint')) {
    return res.status(400).json({ error: 'Los datos proporcionados no cumplen con las reglas de validación' });
  }

  // Status por defecto
  const status = err.status || err.statusCode || 500;
  const message = status >= 500
    ? 'Error interno del servidor. Intente nuevamente.'
    : (err.message || 'Ha ocurrido un error inesperado');

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
