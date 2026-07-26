// ========================================
// SUPERMERCADO GO - LÓGICA DE LOGIN
// Seguridad, Validaciones, API Integration
// ========================================

const API_URL = window.location.origin;

// Estado de la aplicación
let currentEmail = '';
let otpCode = '';

// ========================================
// NAVEGACIÓN ENTRE FORMULARIOS
// ========================================

function showForm(formId) {
    // Ocultar todos los formularios
    document.querySelectorAll('.form-card').forEach(form => {
        form.classList.remove('active');
        setTimeout(() => {
            if (!form.classList.contains('active')) {
                form.style.display = 'none';
            }
        }, 300);
    });

    // Mostrar formulario seleccionado con animación
    setTimeout(() => {
        const targetForm = document.getElementById(formId);
        targetForm.style.display = 'block';
        setTimeout(() => {
            targetForm.classList.add('active');
        }, 50);
    }, 300);
}

function showLogin() {
    showForm('loginForm');
}

function showRegister() {
    showForm('registerForm');
}

function showForgotPassword() {
    showForm('forgotForm');
}

function showVerify(email) {
    currentEmail = email;
    document.getElementById('verifyEmail').value = email;
    showForm('verifyForm');
    
    // Limpiar inputs OTP
    document.querySelectorAll('.otp-digit').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('.otp-digit')[0].focus();
}

function showReset(email, code) {
    currentEmail = email;
    otpCode = code;
    document.getElementById('resetEmail').value = email;
    document.getElementById('resetCode').value = code;
    showForm('resetForm');
}

// ========================================
// UTILIDADES
// ========================================

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Auto eliminar después de 4 segundos
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 4000);
}

function validateEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// ========================================
// MANEJO DE INPUTS OTP
// ========================================

document.querySelectorAll('.otp-digit').forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Solo permitir números
        if (!/^\d*$/.test(value)) {
            e.target.value = '';
            return;
        }
        
        // Mover al siguiente input automáticamente
        if (value && index < 5) {
            document.querySelectorAll('.otp-digit')[index + 1].focus();
        }
        
        // Verificar si todos los campos están llenos
        const allFilled = Array.from(document.querySelectorAll('.otp-digit'))
            .every(input => input.value.length === 1);
        
        if (allFilled && index === 5) {
            // Auto enviar cuando se completa el último dígito
            // verifyOTP();
        }
    });
    
    input.addEventListener('keydown', (e) => {
        // Mover al input anterior con backspace
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            document.querySelectorAll('.otp-digit')[index - 1].focus();
        }
    });
    
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').slice(0, 6);
        
        if (/^\d+$/.test(pasteData)) {
            const digits = pasteData.split('');
            document.querySelectorAll('.otp-digit').forEach((input, i) => {
                if (digits[i]) {
                    input.value = digits[i];
                }
            });
            
            // Enfocar el último input lleno o el siguiente vacío
            const nextEmpty = Array.from(document.querySelectorAll('.otp-digit'))
                .findIndex(input => !input.value);
            
            if (nextEmpty !== -1) {
                document.querySelectorAll('.otp-digit')[nextEmpty].focus();
            } else {
                document.querySelectorAll('.otp-digit')[5].focus();
            }
        }
    });
});

// ========================================
// REGISTRO DE USUARIO
// ========================================

document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('registerNombre').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const telefono = document.getElementById('registerTelefono').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    // Validaciones
    if (!nombre || !email || !telefono || !password || !confirmPassword) {
        showToast('Todos los campos son requeridos', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Formato de email inválido', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nombre,
                email,
                telefono,
                password
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('¡Registro exitoso! Redirigiendo...', 'success');
            setTimeout(() => {
                // Redirigir a la página principal o dashboard
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            showToast(data.error || 'Error en el registro', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
});

// ========================================
// LOGIN DE USUARIO
// ========================================

document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Email y contraseña requeridos', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(`¡Bienvenido! Redirigiendo...`, 'success');
            
            // Redirigir según el rol del usuario
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = '/admin/dashboard';
                } else if (data.user.role === 'trabajador') {
                    window.location.href = '/trabajador/dashboard';
                } else {
                    window.location.href = '/cliente/dashboard';
                }
            }, 1500);
        } else {
            showToast(data.error || 'Credenciales inválidas', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
});

// ========================================
// RECUPERACIÓN DE CONTRASEÑA
// ========================================

document.getElementById('forgotFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value.trim();
    
    if (!email || !validateEmail(email)) {
        showToast('Email inválido', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/api/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok || data.success) {
            showToast('Si el email existe, recibirás un código de verificación', 'success');
            setTimeout(() => {
                showVerify(email);
            }, 1500);
        } else {
            showToast(data.error || 'Error al enviar código', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
});

// ========================================
// VERIFICACIÓN DE CÓDIGO OTP
// ========================================

document.getElementById('verifyFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('verifyEmail').value;
    const code = Array.from(document.querySelectorAll('.otp-digit'))
        .map(input => input.value).join('');
    
    if (code.length !== 6) {
        showToast('Ingresa el código completo de 6 dígitos', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/api/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, code }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok || data.success) {
            showToast('Código verificado correctamente', 'success');
            setTimeout(() => {
                showReset(email, code);
            }, 1000);
        } else {
            showToast(data.error || 'Código inválido o expirado', 'error');
            
            // Animación de shake en los inputs
            document.querySelectorAll('.otp-digit').forEach(input => {
                input.classList.add('shake');
                setTimeout(() => input.classList.remove('shake'), 500);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
});

async function resendCode() {
    const email = document.getElementById('verifyEmail').value;
    
    if (!email) {
        showToast('Email no disponible', 'error');
        return;
    }
    
    showToast('Enviando nuevo código...', 'info');
    
    try {
        const response = await fetch(`${API_URL}/api/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok || data.success) {
            showToast('Nuevo código enviado', 'success');
            
            // Limpiar inputs OTP
            document.querySelectorAll('.otp-digit').forEach(input => {
                input.value = '';
            });
            document.querySelectorAll('.otp-digit')[0].focus();
        } else {
            showToast(data.error || 'Error al reenviar código', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    }
}

// ========================================
// RESET DE CONTRASEÑA
// ========================================

document.getElementById('resetFormElement').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    const code = document.getElementById('resetCode').value;
    const newPassword = document.getElementById('resetPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    
    if (!newPassword || !confirmPassword) {
        showToast('Ambas contraseñas son requeridas', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch(`${API_URL}/api/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                code,
                new_password: newPassword
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok || data.success) {
            showToast('Contraseña actualizada correctamente', 'success');
            setTimeout(() => {
                showLogin();
            }, 2000);
        } else {
            showToast(data.error || 'Error al actualizar contraseña', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión. Intente nuevamente.', 'error');
    } finally {
        setLoading(submitBtn, false);
    }
});

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que el formulario de login esté visible
    showLogin();
    
    // Prevenir navegación hacia atrás en historial después de logout
    if (performance.navigation.type === performance.navigation.TYPE_BACK_FORWARD) {
        // Verificar si hay sesión activa
        fetch(`${API_URL}/api/user/profile`, {
            credentials: 'include'
        }).then(response => {
            if (!response.ok) {
                // No hay sesión, permanecer en login
                showLogin();
            }
        }).catch(() => {
            // Error de conexión, permanecer en login
            showLogin();
        });
    }
});

// Prevenir recarga de página accidental
window.addEventListener('beforeunload', (e) => {
    // Solo mostrar advertencia si hay un formulario en proceso
    const loadingButtons = document.querySelectorAll('.btn-primary.loading');
    if (loadingButtons.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});
