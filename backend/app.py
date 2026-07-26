#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Supermercado GO - Backend Seguro y Completo
Incluye: Autenticación, Gestión de Productos, Pedidos, Usuarios, Seguridad, Email OTP
"""

from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import re
import secrets
import hashlib
import threading
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from functools import wraps
import json
import jwt

app = Flask(__name__, static_folder='../web_frontend', static_url_path='')
CORS(app, supports_credentials=True)
app.secret_key = secrets.token_hex(32)

# Rate Limiting para protección contra fuerza bruta
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Configuración segura de cookies
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24)
)

# Variables globales para configuración de email
EMAIL_CONFIG = {
    'smtp_server': '',
    'smtp_port': 587,
    'email_user': '',
    'email_password': '',
    'configured': False
}

# Mutex para operaciones atómicas de pedidos
pedido_lock = threading.Lock()

# Base de datos
DB_PATH = 'supermercado.db'

def init_db():
    """Inicializa la base de datos con todas las tablas necesarias"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabla de usuarios
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'cliente',
            nombre TEXT,
            telefono TEXT,
            foto_perfil TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # Tabla de códigos OTP para recuperación
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used BOOLEAN DEFAULT 0,
            expires_at TIMESTAMP NOT NULL
        )
    ''')
    
    # Tabla de productos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio REAL NOT NULL,
            precio_original REAL,
            categoria TEXT,
            stock INTEGER DEFAULT 0,
            imagen_principal TEXT,
            imagenes TEXT,
            es_promocion BOOLEAN DEFAULT 0,
            tipo_promocion TEXT,
            descuento_porcentaje REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de reseñas (solo 3-5 estrellas visibles)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comentario TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Tabla de carritos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS carts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            cantidad INTEGER DEFAULT 1,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    ''')
    
    # Tabla de pedidos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            total REAL NOT NULL,
            metodo_pago TEXT NOT NULL,
            tipo_entrega TEXT NOT NULL,
            direccion_entrega TEXT,
            latitud REAL,
            longitud REAL,
            trabajador_id INTEGER,
            accepted_at TIMESTAMP,
            picked_up_at TIMESTAMP,
            delivered_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (trabajador_id) REFERENCES users(id)
        )
    ''')
    
    # Tabla de detalles de pedido
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    ''')
    
    # Tabla de promociones
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            imagen TEXT,
            tipo TEXT NOT NULL,
            descuento_porcentaje REAL,
            activo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    ''')
    
    # Tabla de configuración del sistema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Crear usuario admin por defecto si no existe
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    if cursor.fetchone()[0] == 0:
        admin_hash = generate_password_hash('admin123')
        cursor.execute('''
            INSERT INTO users (email, password_hash, role, nombre)
            VALUES (?, ?, ?, ?)
        ''', ('admin@supermercado.com', admin_hash, 'admin', 'Administrador'))
    
    conn.commit()
    conn.close()

def get_db():
    """Obtiene conexión a la base de datos"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def sanitize_input(text):
    """Sanitiza inputs para prevenir XSS"""
    if text is None:
        return None
    text = str(text)
    # Eliminar tags HTML peligrosos
    text = re.sub(r'<[^>]*>', '', text)
    # Escapar caracteres especiales
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('"', '&quot;').replace("'", '&#x27;')
    return text.strip()

def validate_email(email):
    """Valida formato de email estrictamente"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def generate_otp_code():
    """Genera código OTP de 6 dígitos único"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def hash_otp_code(code):
    """Hashea el código OTP para almacenamiento seguro"""
    return hashlib.sha256(code.encode()).hexdigest()

def send_email(to_email, subject, body):
    """Envía email usando configuración SMTP"""
    if not EMAIL_CONFIG['configured']:
        return False, "Email no configurado"
    
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['email_user']
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port'])
        server.starttls()
        server.login(EMAIL_CONFIG['email_user'], EMAIL_CONFIG['email_password'])
        server.send_message(msg)
        server.quit()
        
        return True, "Email enviado correctamente"
    except Exception as e:
        return False, str(e)

def generate_token(user_id, role):
    """Genera un token JWT para el usuario"""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=24),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.secret_key, algorithm='HS256')

def token_required(f):
    """Decorator para validar token JWT"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token faltante'}), 401
        
        try:
            payload = jwt.decode(token, app.secret_key, algorithms=['HS256'])
            request.current_user_id = payload['user_id']
            request.current_user_role = payload['role']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def login_required(f):
    """Decorator para requerir login (soporta session y JWT)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Verificar sesión web primero
        if 'user_id' in session:
            return f(*args, **kwargs)
        
        # Verificar token JWT para apps móviles
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'No autorizado'}), 401
        
        try:
            payload = jwt.decode(token, app.secret_key, algorithms=['HS256'])
            request.current_user_id = payload['user_id']
            request.current_user_role = payload['role']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator para requerir rol admin (soporta session y JWT)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = None
        user_role = None
        
        # Verificar sesión web primero
        if 'user_id' in session:
            user_id = session['user_id']
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT role FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            conn.close()
            if user:
                user_role = user['role']
        else:
            # Verificar token JWT
            token = None
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
            
            if token:
                try:
                    payload = jwt.decode(token, app.secret_key, algorithms=['HS256'])
                    user_id = payload['user_id']
                    user_role = payload['role']
                except:
                    pass
        
        if not user_id or user_role != 'admin':
            return jsonify({'error': 'Acceso denegado'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# ==================== RUTAS DE AUTENTICACIÓN ====================

@app.route('/')
def serve_frontend():
    """Sirve el frontend web"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Sirve archivos estáticos"""
    return send_from_directory(app.static_folder, path)

@app.route('/api/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    """Registro de nuevos usuarios clientes"""
    try:
        data = request.get_json()
        
        email = sanitize_input(data.get('email', ''))
        password = data.get('password', '')
        nombre = sanitize_input(data.get('nombre', ''))
        telefono = sanitize_input(data.get('telefono', ''))
        
        # Validaciones estrictas
        if not email or not password:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Formato de email inválido'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar si el email ya existe
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'El email ya está registrado'}), 409
        
        # Hash de contraseña
        password_hash = generate_password_hash(password)
        
        # Insertar usuario
        cursor.execute('''
            INSERT INTO users (email, password_hash, role, nombre, telefono)
            VALUES (?, ?, 'cliente', ?, ?)
        ''', (email, password_hash, nombre, telefono))
        
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        
        # Iniciar sesión automáticamente
        session['user_id'] = user_id
        session['role'] = 'cliente'
        
        return jsonify({
            'success': True,
            'message': 'Registro exitoso',
            'user': {'id': user_id, 'email': email, 'role': 'cliente'}
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Error en el servidor'}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Login de usuarios"""
    try:
        data = request.get_json()
        
        email = sanitize_input(data.get('email', ''))
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, email, password_hash, role, nombre, telefono, foto_perfil
            FROM users 
            WHERE email = ? AND is_active = 1
        ''', (email,))
        
        user = cursor.fetchone()
        
        if not user or not check_password_hash(user['password_hash'], password):
            conn.close()
            return jsonify({'error': 'Credenciales inválidas'}), 401
        
        # Actualizar último login
        cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
        conn.commit()
        conn.close()
        
        # Iniciar sesión web
        session['user_id'] = user['id']
        session['role'] = user['role']
        session['email'] = user['email']
        
        # Generar token JWT para app móvil
        token = generate_token(user['id'], user['role'])
        
        return jsonify({
            'success': True,
            'message': 'Login exitoso',
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'role': user['role'],
                'nombre': user['nombre'],
                'telefono': user['telefono'],
                'foto_perfil': user['foto_perfil']
            }
        })
        
    except Exception as e:
        return jsonify({'error': 'Error en el servidor'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    """Cerrar sesión"""
    session.clear()
    return jsonify({'success': True, 'message': 'Sesión cerrada'})

@app.route('/api/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")
def forgot_password():
    """Solicitar recuperación de contraseña con OTP"""
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email', ''))
        
        if not email or not validate_email(email):
            return jsonify({'error': 'Email inválido'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar si el email existe
        cursor.execute('SELECT id, nombre FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            # No revelar si el email existe o no por seguridad
            return jsonify({'success': True, 'message': 'Si el email existe, se enviará un código de recuperación'})
        
        # Generar código OTP
        otp_code = generate_otp_code()
        code_hash = hash_otp_code(otp_code)
        expires_at = datetime.now() + timedelta(minutes=5)
        
        # Invalidar códigos anteriores
        cursor.execute('UPDATE otp_codes SET used = 1 WHERE email = ? AND used = 0', (email,))
        
        # Guardar nuevo código
        cursor.execute('''
            INSERT INTO otp_codes (email, code_hash, expires_at)
            VALUES (?, ?, ?)
        ''', (email, code_hash, expires_at))
        
        conn.commit()
        conn.close()
        
        # Enviar email con el código
        subject = "Recuperación de Contraseña - Supermercado GO"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #2c3e50;">Recuperación de Contraseña</h2>
                <p>Hola {user['nombre'] or 'Usuario'},</p>
                <p>Has solicitado recuperar tu contraseña. Tu código de verificación es:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; padding: 15px 30px; background-color: #3498db; color: white; font-size: 24px; font-weight: bold; border-radius: 5px; letter-spacing: 5px;">{otp_code}</span>
                </div>
                <p>Este código expirará en <strong>5 minutos</strong>.</p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #7f8c8d; font-size: 12px;">Supermercado GO - Equipo de Seguridad</p>
            </div>
        </body>
        </html>
        """
        
        send_email(email, subject, body)
        
        return jsonify({'success': True, 'message': 'Si el email existe, se enviará un código de recuperación'})
        
    except Exception as e:
        return jsonify({'error': 'Error en el servidor'}), 500

@app.route('/api/verify-otp', methods=['POST'])
@limiter.limit("10 per hour")
def verify_otp():
    """Verificar código OTP para recuperación"""
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email', ''))
        code = data.get('code', '')
        
        if not email or not code:
            return jsonify({'error': 'Email y código requeridos'}), 400
        
        if len(code) != 6 or not code.isdigit():
            return jsonify({'error': 'Código inválido'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        code_hash = hash_otp_code(code)
        
        cursor.execute('''
            SELECT id FROM otp_codes 
            WHERE email = ? AND code_hash = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
        ''', (email, code_hash))
        
        otp = cursor.fetchone()
        
        if not otp:
            conn.close()
            return jsonify({'error': 'Código inválido o expirado'}), 400
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Código verificado',
            'email': email
        })
        
    except Exception as e:
        return jsonify({'error': 'Error en el servidor'}), 500

@app.route('/api/reset-password', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password():
    """Resetear contraseña después de verificar OTP"""
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email', ''))
        code = data.get('code', '')
        new_password = data.get('new_password', '')
        
        if not email or not code or not new_password:
            return jsonify({'error': 'Todos los campos son requeridos'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        code_hash = hash_otp_code(code)
        
        # Verificar OTP
        cursor.execute('''
            SELECT id FROM otp_codes 
            WHERE email = ? AND code_hash = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
        ''', (email, code_hash))
        
        otp = cursor.fetchone()
        
        if not otp:
            conn.close()
            return jsonify({'error': 'Código inválido o expirado'}), 400
        
        # Actualizar contraseña
        password_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, email))
        
        # Marcar OTP como usado
        cursor.execute('UPDATE otp_codes SET used = 1 WHERE id = ?', (otp['id'],))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Contraseña actualizada correctamente'})
        
    except Exception as e:
        return jsonify({'error': 'Error en el servidor'}), 500

# ==================== RUTAS DE PRODUCTOS ====================

@app.route('/api/products', methods=['GET'])
def get_products():
    """Obtener lista de productos con filtros"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        categoria = request.args.get('categoria')
        search = request.args.get('search')
        es_promocion = request.args.get('promocion')
        
        query = '''
            SELECT id, nombre, descripcion, precio, precio_original, categoria, 
                   stock, imagen_principal, imagenes, es_promocion, tipo_promocion, 
                   descuento_porcentaje, created_at
            FROM products WHERE 1=1
        '''
        params = []
        
        if categoria:
            query += ' AND categoria = ?'
            params.append(categoria)
        
        if search:
            search = sanitize_input(search)
            query += ' AND (nombre LIKE ? OR descripcion LIKE ?)'
            params.extend([f'%{search}%', f'%{search}%'])
        
        if es_promocion == 'true':
            query += ' AND es_promocion = 1'
        
        query += ' ORDER BY created_at DESC'
        
        cursor.execute(query, params)
        products = cursor.fetchall()
        conn.close()
        
        result = []
        for p in products:
            result.append({
                'id': p['id'],
                'nombre': p['nombre'],
                'descripcion': p['descripcion'],
                'precio': p['precio'],
                'precio_original': p['precio_original'],
                'categoria': p['categoria'],
                'stock': p['stock'],
                'imagen_principal': p['imagen_principal'],
                'imagenes': json.loads(p['imagenes']) if p['imagenes'] else [],
                'es_promocion': bool(p['es_promocion']),
                'tipo_promocion': p['tipo_promocion'],
                'descuento_porcentaje': p['descuento_porcentaje']
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener productos'}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Obtener detalle de un producto"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, nombre, descripcion, precio, precio_original, categoria, 
                   stock, imagen_principal, imagenes, es_promocion, tipo_promocion, 
                   descuento_porcentaje, created_at
            FROM products WHERE id = ?
        ''', (product_id,))
        
        product = cursor.fetchone()
        
        if not product:
            conn.close()
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        # Obtener reseñas (solo 3-5 estrellas)
        cursor.execute('''
            SELECT r.id, r.rating, r.comentario, r.created_at, u.nombre
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ? AND r.rating >= 3
            ORDER BY r.created_at DESC
        ''', (product_id,))
        
        reviews = cursor.fetchall()
        conn.close()
        
        result = {
            'id': product['id'],
            'nombre': product['nombre'],
            'descripcion': product['descripcion'],
            'precio': product['precio'],
            'precio_original': product['precio_original'],
            'categoria': product['categoria'],
            'stock': product['stock'],
            'imagen_principal': product['imagen_principal'],
            'imagenes': json.loads(product['imagenes']) if product['imagenes'] else [],
            'es_promocion': bool(product['es_promocion']),
            'tipo_promocion': product['tipo_promocion'],
            'descuento_porcentaje': product['descuento_porcentaje'],
            'reviews': [
                {
                    'id': r['id'],
                    'rating': r['rating'],
                    'comentario': r['comentario'],
                    'created_at': r['created_at'],
                    'nombre': r['nombre']
                } for r in reviews
            ]
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener producto'}), 500

@app.route('/api/products', methods=['POST'])
@login_required
def create_product():
    """Crear producto (solo admin)"""
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Acceso denegado'}), 403
        
        data = request.get_json()
        
        nombre = sanitize_input(data.get('nombre', ''))
        descripcion = sanitize_input(data.get('descripcion', ''))
        precio = float(data.get('precio', 0))
        categoria = sanitize_input(data.get('categoria', ''))
        stock = int(data.get('stock', 0))
        imagen_principal = data.get('imagen_principal', '')
        imagenes = data.get('imagenes', [])
        
        if not nombre or precio <= 0:
            return jsonify({'error': 'Nombre y precio válidos requeridos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO products (nombre, descripcion, precio, categoria, stock, imagen_principal, imagenes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (nombre, descripcion, precio, categoria, stock, imagen_principal, json.dumps(imagenes)))
        
        conn.commit()
        product_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Producto creado',
            'product_id': product_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Error al crear producto'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    """Actualizar producto (solo admin)"""
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Acceso denegado'}), 403
        
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar que el producto existe
        cursor.execute('SELECT id FROM products WHERE id = ?', (product_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        updates = []
        params = []
        
        if 'nombre' in data:
            updates.append('nombre = ?')
            params.append(sanitize_input(data['nombre']))
        
        if 'descripcion' in data:
            updates.append('descripcion = ?')
            params.append(sanitize_input(data['descripcion']))
        
        if 'precio' in data:
            updates.append('precio = ?')
            params.append(float(data['precio']))
        
        if 'stock' in data:
            updates.append('stock = ?')
            params.append(int(data['stock']))
        
        if 'es_promocion' in data:
            updates.append('es_promocion = ?')
            params.append(1 if data['es_promocion'] else 0)
        
        if 'descuento_porcentaje' in data:
            updates.append('descuento_porcentaje = ?')
            params.append(float(data['descuento_porcentaje']))
        
        if 'imagenes' in data:
            updates.append('imagenes = ?')
            params.append(json.dumps(data['imagenes']))
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(product_id)
            
            query = f'UPDATE products SET {", ".join(updates)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        
        return jsonify({'success': True, 'message': 'Producto actualizado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al actualizar producto'}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    """Eliminar producto (solo admin, solo si stock = 0)"""
    try:
        if session.get('role') != 'admin':
            return jsonify({'error': 'Acceso denegado'}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT stock FROM products WHERE id = ?', (product_id,))
        product = cursor.fetchone()
        
        if not product:
            conn.close()
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        if product['stock'] > 0:
            conn.close()
            return jsonify({'error': 'No se puede eliminar un producto con stock mayor a 0'}), 400
        
        cursor.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Producto eliminado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al eliminar producto'}), 500

# ==================== RUTAS DE CARRITO ====================

@app.route('/api/cart', methods=['GET'])
@login_required
def get_cart():
    """Obtener carrito del usuario"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT c.id, c.product_id, c.cantidad, p.nombre, p.precio, p.imagen_principal, p.es_promocion, p.descuento_porcentaje
            FROM carts c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
        ''', (session['user_id'],))
        
        items = cursor.fetchall()
        conn.close()
        
        cart = []
        total = 0
        
        for item in items:
            precio_final = item['precio']
            if item['es_promocion'] and item['descuento_porcentaje']:
                precio_final = item['precio'] * (1 - item['descuento_porcentaje'] / 100)
            
            subtotal = precio_final * item['cantidad']
            total += subtotal
            
            cart.append({
                'id': item['id'],
                'product_id': item['product_id'],
                'cantidad': item['cantidad'],
                'nombre': item['nombre'],
                'precio': item['precio'],
                'precio_final': precio_final,
                'subtotal': subtotal,
                'imagen': item['imagen_principal']
            })
        
        return jsonify({
            'items': cart,
            'total': total
        })
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener carrito'}), 500

@app.route('/api/cart/add', methods=['POST'])
@login_required
def add_to_cart():
    """Agregar producto al carrito"""
    try:
        data = request.get_json()
        product_id = int(data.get('product_id', 0))
        cantidad = int(data.get('cantidad', 1))
        
        if product_id <= 0 or cantidad <= 0:
            return jsonify({'error': 'Datos inválidos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar que el producto existe
        cursor.execute('SELECT id, stock FROM products WHERE id = ?', (product_id,))
        product = cursor.fetchone()
        
        if not product:
            conn.close()
            return jsonify({'error': 'Producto no encontrado'}), 404
        
        # Verificar stock
        cursor.execute('''
            SELECT COALESCE(SUM(cantidad), 0) as total_en_carrito
            FROM carts WHERE user_id = ? AND product_id = ?
        ''', (session['user_id'], product_id))
        
        en_carrito = cursor.fetchone()['total_en_carrito']
        
        if en_carrito + cantidad > product['stock']:
            conn.close()
            return jsonify({'error': 'Stock insuficiente'}), 400
        
        # Verificar si ya está en el carrito
        cursor.execute('''
            SELECT id, cantidad FROM carts 
            WHERE user_id = ? AND product_id = ?
        ''', (session['user_id'], product_id))
        
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute('''
                UPDATE carts SET cantidad = cantidad + ? 
                WHERE user_id = ? AND product_id = ?
            ''', (cantidad, session['user_id'], product_id))
        else:
            cursor.execute('''
                INSERT INTO carts (user_id, product_id, cantidad)
                VALUES (?, ?, ?)
            ''', (session['user_id'], product_id, cantidad))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Producto agregado al carrito'})
        
    except Exception as e:
        return jsonify({'error': 'Error al agregar al carrito'}), 500

@app.route('/api/cart/update/<int:item_id>', methods=['PUT'])
@login_required
def update_cart_item(item_id):
    """Actualizar cantidad de item en carrito"""
    try:
        data = request.get_json()
        cantidad = int(data.get('cantidad', 1))
        
        if cantidad <= 0:
            return jsonify({'error': 'Cantidad inválida'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE carts SET cantidad = cantidad + ? 
            WHERE id = ? AND user_id = ?
        ''', (cantidad, item_id, session['user_id']))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Item no encontrado'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Carrito actualizado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al actualizar carrito'}), 500

@app.route('/api/cart/remove/<int:item_id>', methods=['DELETE'])
@login_required
def remove_from_cart(item_id):
    """Eliminar item del carrito"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM carts WHERE id = ? AND user_id = ?
        ''', (item_id, session['user_id']))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Item no encontrado'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Item eliminado del carrito'})
        
    except Exception as e:
        return jsonify({'error': 'Error al eliminar del carrito'}), 500

@app.route('/api/cart/clear', methods=['DELETE'])
@login_required
def clear_cart():
    """Vaciar carrito completo"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM carts WHERE user_id = ?', (session['user_id'],))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Carrito vaciado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al vaciar carrito'}), 500

# ==================== RUTAS DE PEDIDOS ====================

@app.route('/api/orders', methods=['POST'])
@login_required
def create_order():
    """Crear nuevo pedido"""
    try:
        data = request.get_json()
        
        metodo_pago = data.get('metodo_pago', '')
        tipo_entrega = data.get('tipo_entrega', '')
        direccion_entrega = data.get('direccion_entrega')
        latitud = data.get('latitud')
        longitud = data.get('longitud')
        
        if not metodo_pago or not tipo_entrega:
            return jsonify({'error': 'Método de pago y tipo de entrega requeridos'}), 400
        
        # Validar métodos de pago
        valid_payment_methods = ['nequi', 'bancolombia', 'visa', 'contraentrega']
        if metodo_pago not in valid_payment_methods:
            return jsonify({'error': 'Método de pago inválido'}), 400
        
        # Pago contra entrega requiere ubicación
        if metodo_pago == 'contraentrega' and tipo_entrega == 'ubicacion':
            if not latitud or not longitud:
                return jsonify({'error': 'Ubicación requerida para pago contra entrega'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Obtener items del carrito
        cursor.execute('''
            SELECT c.product_id, c.cantidad, p.precio, p.es_promocion, p.descuento_porcentaje
            FROM carts c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
        ''', (session['user_id'],))
        
        cart_items = cursor.fetchall()
        
        if not cart_items:
            conn.close()
            return jsonify({'error': 'Carrito vacío'}), 400
        
        # Calcular total
        total = 0
        for item in cart_items:
            precio_final = item['precio']
            if item['es_promocion'] and item['descuento_porcentaje']:
                precio_final = item['precio'] * (1 - item['descuento_porcentaje'] / 100)
            total += precio_final * item['cantidad']
        
        # Crear pedido
        cursor.execute('''
            INSERT INTO orders (user_id, total, metodo_pago, tipo_entrega, direccion_entrega, latitud, longitud)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (session['user_id'], total, metodo_pago, tipo_entrega, direccion_entrega, latitud, longitud))
        
        order_id = cursor.lastrowid
        
        # Agregar items del pedido
        for item in cart_items:
            precio_final = item['precio']
            if item['es_promocion'] and item['descuento_porcentaje']:
                precio_final = item['precio'] * (1 - item['descuento_porcentaje'] / 100)
            
            cursor.execute('''
                INSERT INTO order_items (order_id, product_id, cantidad, precio_unitario)
                VALUES (?, ?, ?, ?)
            ''', (order_id, item['product_id'], item['cantidad'], precio_final))
            
            # Actualizar stock
            cursor.execute('''
                UPDATE products SET stock = stock - ? WHERE id = ?
            ''', (item['cantidad'], item['product_id']))
        
        # Vaciar carrito
        cursor.execute('DELETE FROM carts WHERE user_id = ?', (session['user_id'],))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Pedido creado exitosamente',
            'order_id': order_id,
            'total': total
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Error al crear pedido'}), 500

@app.route('/api/orders', methods=['GET'])
@login_required
def get_orders():
    """Obtener pedidos del usuario"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        if session.get('role') == 'cliente':
            # Cliente ve sus propios pedidos
            cursor.execute('''
                SELECT o.*, u.nombre as trabajador_nombre
                FROM orders o
                LEFT JOIN users u ON o.trabajador_id = u.id
                WHERE o.user_id = ?
                ORDER BY o.created_at DESC
            ''', (session['user_id'],))
        elif session.get('role') in ['trabajador', 'admin']:
            # Trabajador/Admin ve todos los pedidos
            cursor.execute('''
                SELECT o.*, u.nombre as cliente_nombre, u.telefono as cliente_telefono,
                       t.nombre as trabajador_nombre
                FROM orders o
                JOIN users u ON o.user_id = u.id
                LEFT JOIN users t ON o.trabajador_id = t.id
                ORDER BY o.created_at DESC
            ''')
        else:
            conn.close()
            return jsonify({'error': 'Rol no válido'}), 403
        
        orders = cursor.fetchall()
        conn.close()
        
        result = []
        for order in orders:
            # Obtener items del pedido
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT oi.cantidad, oi.precio_unitario, p.nombre, p.imagen_principal
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            ''', (order['id'],))
            items = cursor.fetchall()
            conn.close()
            
            result.append({
                'id': order['id'],
                'estado': order['estado'],
                'total': order['total'],
                'metodo_pago': order['metodo_pago'],
                'tipo_entrega': order['tipo_entrega'],
                'direccion_entrega': order['direccion_entrega'],
                'latitud': order['latitud'],
                'longitud': order['longitud'],
                'trabajador_id': order['trabajador_id'],
                'trabajador_nombre': order.get('trabajador_nombre'),
                'cliente_nombre': order.get('cliente_nombre'),
                'cliente_telefono': order.get('cliente_telefono'),
                'created_at': order['created_at'],
                'accepted_at': order['accepted_at'],
                'picked_up_at': order['picked_up_at'],
                'delivered_at': order['delivered_at'],
                'items': [
                    {
                        'cantidad': item['cantidad'],
                        'precio': item['precio_unitario'],
                        'nombre': item['nombre'],
                        'imagen': item['imagen_principal']
                    } for item in items
                ]
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener pedidos'}), 500

@app.route('/api/orders/<int:order_id>/accept', methods=['POST'])
@login_required
def accept_order(order_id):
    """Trabajador acepta pedido (con bloqueo atómico)"""
    try:
        if session.get('role') not in ['trabajador', 'admin']:
            return jsonify({'error': 'Solo trabajadores pueden aceptar pedidos'}), 403
        
        with pedido_lock:
            conn = get_db()
            cursor = conn.cursor()
            
            # Verificar estado del pedido
            cursor.execute('''
                SELECT estado, trabajador_id FROM orders WHERE id = ?
            ''', (order_id,))
            
            order = cursor.fetchone()
            
            if not order:
                conn.close()
                return jsonify({'error': 'Pedido no encontrado'}), 404
            
            if order['estado'] != 'pendiente':
                conn.close()
                return jsonify({'error': 'Pedido ya fue aceptado o está en otro estado'}), 400
            
            # Asignar pedido al trabajador
            cursor.execute('''
                UPDATE orders 
                SET estado = 'aceptado', trabajador_id = ?, accepted_at = CURRENT_TIMESTAMP
                WHERE id = ? AND estado = 'pendiente'
            ''', (session['user_id'], order_id))
            
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'error': 'No se pudo aceptar el pedido (ya fue tomado por otro trabajador)'}), 400
            
            conn.commit()
            conn.close()
            
            return jsonify({'success': True, 'message': 'Pedido aceptado exitosamente'})
            
    except Exception as e:
        return jsonify({'error': 'Error al aceptar pedido'}), 500

@app.route('/api/orders/<int:order_id>/pickup', methods=['POST'])
@login_required
def pickup_order(order_id):
    """Trabajador marca pedido como recogido"""
    try:
        if session.get('role') not in ['trabajador', 'admin']:
            return jsonify({'error': 'Solo trabajadores pueden realizar esta acción'}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE orders 
            SET estado = 'en_camino', picked_up_at = CURRENT_TIMESTAMP
            WHERE id = ? AND trabajador_id = ?
        ''', (order_id, session['user_id']))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'No se pudo actualizar el estado'}), 400
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Pedido marcado como recogido'})
        
    except Exception as e:
        return jsonify({'error': 'Error al actualizar estado'}), 500

@app.route('/api/orders/<int:order_id>/deliver', methods=['POST'])
@login_required
def deliver_order(order_id):
    """Trabajador marca pedido como entregado"""
    try:
        if session.get('role') not in ['trabajador', 'admin']:
            return jsonify({'error': 'Solo trabajadores pueden realizar esta acción'}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE orders 
            SET estado = 'entregado', delivered_at = CURRENT_TIMESTAMP
            WHERE id = ? AND trabajador_id = ?
        ''', (order_id, session['user_id']))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'No se pudo actualizar el estado'}), 400
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Pedido marcado como entregado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al actualizar estado'}), 500

# ==================== RUTAS DE USUARIOS ====================

@app.route('/api/user/profile', methods=['GET'])
@login_required
def get_profile():
    """Obtener perfil del usuario"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, email, nombre, telefono, foto_perfil, created_at, last_login
            FROM users WHERE id = ?
        ''', (session['user_id'],))
        
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'nombre': user['nombre'],
            'telefono': user['telefono'],
            'foto_perfil': user['foto_perfil'],
            'created_at': user['created_at'],
            'last_login': user['last_login']
        })
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener perfil'}), 500

@app.route('/api/user/profile', methods=['PUT'])
@login_required
def update_profile():
    """Actualizar perfil del usuario"""
    try:
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if 'telefono' in data:
            updates.append('telefono = ?')
            params.append(sanitize_input(data['telefono']))
        
        if 'foto_perfil' in data:
            updates.append('foto_perfil = ?')
            params.append(data['foto_perfil'])
        
        if updates:
            params.append(session['user_id'])
            query = f'UPDATE users SET {", ".join(updates)} WHERE id = ?'
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        
        return jsonify({'success': True, 'message': 'Perfil actualizado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al actualizar perfil'}), 500

@app.route('/api/user/change-password', methods=['POST'])
@login_required
def change_password():
    """Cambiar contraseña del usuario"""
    try:
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Contraseñas requeridas'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT password_hash FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        
        if not user or not check_password_hash(user['password_hash'], current_password):
            conn.close()
            return jsonify({'error': 'Contraseña actual inválida'}), 400
        
        new_password_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, session['user_id']))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Contraseña actualizada'})
        
    except Exception as e:
        return jsonify({'error': 'Error al cambiar contraseña'}), 500

@app.route('/api/user/change-email', methods=['POST'])
@login_required
def change_email():
    """Cambiar email del usuario"""
    try:
        data = request.get_json()
        new_email = sanitize_input(data.get('new_email', ''))
        password = data.get('password', '')
        
        if not new_email or not password:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        if not validate_email(new_email):
            return jsonify({'error': 'Formato de email inválido'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar contraseña actual
        cursor.execute('SELECT password_hash FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        
        if not user or not check_password_hash(user['password_hash'], password):
            conn.close()
            return jsonify({'error': 'Contraseña inválida'}), 400
        
        # Verificar si el nuevo email ya existe
        cursor.execute('SELECT id FROM users WHERE email = ?', (new_email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'El email ya está en uso'}), 409
        
        cursor.execute('UPDATE users SET email = ? WHERE id = ?', (new_email, session['user_id']))
        
        conn.commit()
        conn.close()
        
        session['email'] = new_email
        
        return jsonify({'success': True, 'message': 'Email actualizado'})
        
    except Exception as e:
        return jsonify({'error': 'Error al cambiar email'}), 500

# ==================== RUTAS DE ADMINISTRACIÓN ====================

@app.route('/api/admin/configure-email', methods=['POST'])
@admin_required
def configure_email():
    """Configurar servidor SMTP para envío de emails"""
    try:
        data = request.get_json()
        
        smtp_server = data.get('smtp_server', '')
        smtp_port = int(data.get('smtp_port', 587))
        email_user = data.get('email_user', '')
        email_password = data.get('email_password', '')
        
        if not smtp_server or not email_user or not email_password:
            return jsonify({'error': 'Todos los campos son requeridos'}), 400
        
        # Probar conexión
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(email_user, email_password)
            server.quit()
        except Exception as e:
            return jsonify({'error': f'Error de conexión: {str(e)}'}), 400
        
        # Guardar configuración
        EMAIL_CONFIG['smtp_server'] = smtp_server
        EMAIL_CONFIG['smtp_port'] = smtp_port
        EMAIL_CONFIG['email_user'] = email_user
        EMAIL_CONFIG['email_password'] = email_password
        EMAIL_CONFIG['configured'] = True
        
        return jsonify({'success': True, 'message': 'Email configurado correctamente'})
        
    except Exception as e:
        return jsonify({'error': 'Error al configurar email'}), 500

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    """Obtener todos los usuarios (admin)"""
    try:
        role_filter = request.args.get('role')
        search = request.args.get('search')
        
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT id, email, nombre, telefono, role, created_at, last_login, is_active
            FROM users WHERE 1=1
        '''
        params = []
        
        if role_filter:
            query += ' AND role = ?'
            params.append(role_filter)
        
        if search:
            search = sanitize_input(search)
            query += ' AND (email LIKE ? OR nombre LIKE ?)'
            params.extend([f'%{search}%', f'%{search}%'])
        
        query += ' ORDER BY created_at DESC'
        
        cursor.execute(query, params)
        users = cursor.fetchall()
        conn.close()
        
        result = [
            {
                'id': u['id'],
                'email': u['email'],
                'nombre': u['nombre'],
                'telefono': u['telefono'],
                'role': u['role'],
                'created_at': u['created_at'],
                'last_login': u['last_login'],
                'is_active': bool(u['is_active'])
            } for u in users
        ]
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener usuarios'}), 500

@app.route('/api/admin/analytics', methods=['GET'])
@admin_required
def get_analytics():
    """Obtener analíticas del supermercado"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Ventas totales
        cursor.execute('SELECT SUM(total) as total_ventas FROM orders WHERE estado = "entregado"')
        total_ventas = cursor.fetchone()['total_ventas'] or 0
        
        # Pedidos por estado
        cursor.execute('''
            SELECT estado, COUNT(*) as cantidad 
            FROM orders 
            GROUP BY estado
        ''')
        pedidos_por_estado = {row['estado']: row['cantidad'] for row in cursor.fetchall()}
        
        # Productos más vendidos
        cursor.execute('''
            SELECT p.id, p.nombre, SUM(oi.cantidad) as total_vendidos
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            GROUP BY p.id, p.nombre
            ORDER BY total_vendidos DESC
            LIMIT 10
        ''')
        productos_mas_vendidos = [
            {'id': row['id'], 'nombre': row['nombre'], 'total_vendidos': row['total_vendidos']}
            for row in cursor.fetchall()
        ]
        
        # Productos con bajo stock
        cursor.execute('''
            SELECT id, nombre, stock 
            FROM products 
            WHERE stock < 10 AND stock > 0
            ORDER BY stock ASC
            LIMIT 10
        ''')
        productos_bajo_stock = [
            {'id': row['id'], 'nombre': row['nombre'], 'stock': row['stock']}
            for row in cursor.fetchall()
        ]
        
        # Clientes más frecuentes
        cursor.execute('''
            SELECT u.id, u.nombre, u.email, u.telefono, COUNT(o.id) as total_pedidos
            FROM users u
            JOIN orders o ON u.id = o.user_id
            WHERE u.role = 'cliente'
            GROUP BY u.id
            ORDER BY total_pedidos DESC
            LIMIT 10
        ''')
        clientes_frecuentes = [
            {
                'id': row['id'],
                'nombre': row['nombre'],
                'email': row['email'],
                'telefono': row['telefono'],
                'total_pedidos': row['total_pedidos']
            } for row in cursor.fetchall()
        ]
        
        # Empleados activos
        cursor.execute('''
            SELECT id, nombre, email, last_login
            FROM users
            WHERE role IN ('trabajador', 'admin') AND is_active = 1
            ORDER BY last_login DESC
        ''')
        empleados_activos = [
            {
                'id': row['id'],
                'nombre': row['nombre'],
                'email': row['email'],
                'last_login': row['last_login']
            } for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return jsonify({
            'total_ventas': total_ventas,
            'pedidos_por_estado': pedidos_por_estado,
            'productos_mas_vendidos': productos_mas_vendidos,
            'productos_bajo_stock': productos_bajo_stock,
            'clientes_frecuentes': clientes_frecuentes,
            'empleados_activos': empleados_activos
        })
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener analíticas'}), 500

@app.route('/api/admin/promotions', methods=['GET'])
@admin_required
def get_promotions():
    """Obtener todas las promociones"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT pr.id, pr.titulo, pr.descripcion, pr.tipo, pr.descuento_porcentaje, 
                   pr.activo, pr.created_at, pr.expires_at,
                   p.id as product_id, p.nombre as product_name, p.imagen_principal
            FROM promotions pr
            LEFT JOIN products p ON pr.product_id = p.id
            ORDER BY pr.created_at DESC
        ''')
        
        promotions = cursor.fetchall()
        conn.close()
        
        result = [
            {
                'id': p['id'],
                'titulo': p['titulo'],
                'descripcion': p['descripcion'],
                'tipo': p['tipo'],
                'descuento_porcentaje': p['descuento_porcentaje'],
                'activo': bool(p['activo']),
                'created_at': p['created_at'],
                'expires_at': p['expires_at'],
                'product_id': p['product_id'],
                'product_name': p['product_name'],
                'imagen': p['imagen_principal']
            } for p in promotions
        ]
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': 'Error al obtener promociones'}), 500

@app.route('/api/admin/promotions', methods=['POST'])
@admin_required
def create_promotion():
    """Crear nueva promoción"""
    try:
        data = request.get_json()
        
        titulo = sanitize_input(data.get('titulo', ''))
        descripcion = sanitize_input(data.get('descripcion', ''))
        tipo = data.get('tipo', '')
        descuento_porcentaje = float(data.get('descuento_porcentaje', 0))
        product_id = data.get('product_id')
        imagen = data.get('imagen', '')
        
        if not titulo or not tipo:
            return jsonify({'error': 'Título y tipo requeridos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Si hay product_id, actualizar producto también
        if product_id:
            cursor.execute('''
                UPDATE products 
                SET es_promocion = 1, descuento_porcentaje = ?, tipo_promocion = ?
                WHERE id = ?
            ''', (descuento_porcentaje, tipo, product_id))
        
        cursor.execute('''
            INSERT INTO promotions (product_id, titulo, descripcion, tipo, descuento_porcentaje, imagen)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (product_id, titulo, descripcion, tipo, descuento_porcentaje, imagen))
        
        conn.commit()
        promotion_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Promoción creada',
            'promotion_id': promotion_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': 'Error al crear promoción'}), 500

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
