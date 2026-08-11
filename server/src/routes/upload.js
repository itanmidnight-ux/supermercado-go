// src/routes/upload.js — Ruta de subida de imágenes [admin]
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Router } = express;
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const config = require('../config');

const router = Router();

// Configuración de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '..', '..', 'data/uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `img_${crypto.randomUUID()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
    fields: 10,
    parts: 11,
  },
});

function hasValidImageSignature(filePath, mimetype) {
  const header = fs.readFileSync(filePath).subarray(0, 12);
  if (mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === 'image/webp') return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

/**
 * POST /api/upload/image — Subir imagen [admin]
 */
router.post('/image', authMiddleware(['admin']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
  }

  if (!hasValidImageSignature(req.file.path, req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'El contenido del archivo no coincide con una imagen válida' });
  }

  const url = `/uploads/${req.file.filename}`;
  res.json({
    data: {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
    message: 'Imagen subida exitosamente',
  });
});

module.exports = router;
