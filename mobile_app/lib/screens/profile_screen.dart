import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Perfil'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Foto de perfil
            CircleAvatar(
              radius: 50,
              backgroundColor: Theme.of(context).primaryColor.withOpacity(0.2),
              child: const Icon(Icons.person, size: 50),
            ),
            const SizedBox(height: 16),
            
            // Información básica (solo lectura)
            GlassmorphicCard(
              child: Column(
                children: [
                  _buildInfoTile('Nombre', 'Usuario Cliente', editable: false),
                  const Divider(),
                  _buildInfoTile('Correo', 'usuario@email.com', editable: true, icon: Icons.email),
                  const Divider(),
                  _buildInfoTile('Teléfono', '+57 300 123 4567', editable: true, icon: Icons.phone),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Seguridad
            const Text(
              'Seguridad',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            GlassmorphicCard(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text('Cambiar contraseña'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () {
                      // Navegar a cambio de contraseña
                    },
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Ayuda y Soporte
            const Text(
              'Ayuda y Soporte',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            GlassmorphicCard(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.support_agent),
                    title: const Text('Centro de Ayuda'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const SupportScreen()),
                      );
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.policy_outlined),
                    title: const Text('Políticas de Privacidad'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () {
                      // Mostrar políticas
                    },
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Cerrar sesión
            FuturisticButton(
              text: 'Cerrar Sesión',
              icon: Icons.logout,
              gradient: const LinearGradient(
                colors: [Color(0xFFFF4757), Color(0xFFFF006E)],
              ),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => Dialog(
                    backgroundColor: Colors.transparent,
                    child: GlassmorphicCard(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.logout, size: 50, color: Color(0xFFFF4757)),
                          const SizedBox(height: 16),
                          const Text(
                            '¿Cerrar sesión?',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Deberás iniciar sesión nuevamente para continuar',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              Expanded(
                                child: TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text('Cancelar'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FuturisticButton(
                                  text: 'Salir',
                                  onPressed: () {
                                    // Cerrar sesión
                                    Navigator.pop(context);
                                    Navigator.pushReplacementNamed(context, '/login');
                                  },
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(String label, String value, {bool editable = false, IconData? icon}) {
    return ListTile(
      leading: Icon(icon ?? Icons.info_outline),
      title: Text(label, style: TextStyle(color: Colors.grey[400], fontSize: 12)),
      subtitle: Text(value, style: const TextStyle(fontSize: 16)),
      trailing: editable
          ? const Icon(Icons.edit, size: 18, color: Colors.grey)
          : null,
      onTap: editable ? () {
        // Mostrar diálogo de edición
      } : null,
    );
  }
}

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ayuda y Soporte'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GlassmorphicCard(
            child: Column(
              children: [
                _buildContactOption(
                  Icons.email_outlined,
                  'Correo Electrónico',
                  'soporte@supermercado-go.com',
                  () {
                    // Abrir cliente de correo
                  },
                ),
                const Divider(),
                _buildContactOption(
                  Icons.phone_outlined,
                  'Teléfono',
                  '+57 300 123 4567',
                  () {
                    // Llamar
                  },
                ),
                const Divider(),
                _buildContactOption(
                  Icons.chat_outlined,
                  'WhatsApp',
                  'Chatear con soporte',
                  () {
                    // Abrir WhatsApp
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GlassmorphicCard(
            child: Column(
              children: [
                const ListTile(
                  leading: Icon(Icons.question_answer_outlined),
                  title: Text('Preguntas Frecuentes'),
                  trailing: Icon(Icons.arrow_forward_ios, size: 16),
                ),
                const Divider(),
                const ListTile(
                  leading: Icon(Icons.article_outlined),
                  title: Text('Términos y Condiciones'),
                  trailing: Icon(Icons.arrow_forward_ios, size: 16),
                ),
                const Divider(),
                const ListTile(
                  leading: Icon(Icons.privacy_tip_outlined),
                  title: Text('Política de Privacidad'),
                  trailing: Icon(Icons.arrow_forward_ios, size: 16),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactOption(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, size: 30),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.arrow_forward_ios, size: 16),
      onTap: onTap,
    );
  }
}