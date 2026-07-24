import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../widgets/app_card.dart';
import '../widgets/futuristic_modal.dart';
import 'client_support_screen.dart';

/// Perfil del cliente, dividido en secciones (estilo Facebook): Perfil,
/// Seguridad y Ayuda. No es una red social -- nombre, apodo, dirección y
/// descripción no son editables aquí; solo foto, contraseña, correo y
/// número, todo con confirmación de contraseña donde aplica.
class ClientProfileScreen extends StatefulWidget {
  const ClientProfileScreen({super.key});
  @override
  State<ClientProfileScreen> createState() => _ClientProfileScreenState();
}

class _ClientProfileScreenState extends State<ClientProfileScreen> {
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _me;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await ApiService.getMyProfile();
      if (mounted) setState(() => _me = me);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
        source: ImageSource.gallery, imageQuality: 80, maxWidth: 1280);
    if (file == null) return;
    setState(() => _saving = true);
    try {
      final bytes = await file.readAsBytes();
      await ApiService.uploadProfilePic(file.path,
          bytes: bytes, mimeType: 'image/jpeg');
      await _load();
      if (mounted) _snack('Foto actualizada', success: true);
    } catch (e) {
      if (mounted) _snack(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _removePhoto() async {
    setState(() => _saving = true);
    try {
      await ApiService.deleteProfilePic();
      await _load();
      if (mounted) _snack('Foto eliminada', success: true);
    } catch (e) {
      if (mounted) _snack(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String msg, {bool success = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor:
          success ? Theme.of(context).colorScheme.primary : Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Cerrar sesión'),
        content: const Text('¿Deseas salir de tu cuenta?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Salir')),
        ],
      ),
    );
    if (ok == true && mounted) {
      NotificationService.stopPolling();
      context.read<AppProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (_loading)
      return Center(child: CircularProgressIndicator(color: scheme.primary));

    final profilePic = _me?['profile_pic'] as String?;
    final displayName =
        _me?['display_name'] as String? ?? ApiService.displayName;
    final email = _me?['email'] as String?;
    final phone = _me?['phone'] as String?;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(
            child: Column(children: [
          Stack(children: [
            CircleAvatar(
              radius: 48,
              backgroundColor: scheme.primary.withValues(alpha: 0.1),
              backgroundImage: profilePic != null
                  ? NetworkImage(ApiService.profilePicUrl(profilePic))
                  : null,
              child: profilePic == null
                  ? Text(
                      displayName.isNotEmpty
                          ? displayName[0].toUpperCase()
                          : '?',
                      style: TextStyle(
                          color: scheme.primary,
                          fontSize: 36,
                          fontWeight: FontWeight.bold))
                  : null,
            ),
            Positioned(
                bottom: 0,
                right: 0,
                child: GestureDetector(
                  onTap: _saving ? null : _pickPhoto,
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                        color: scheme.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2)),
                    child: const Icon(Icons.camera_alt_rounded,
                        color: Colors.white, size: 16),
                  ),
                )),
          ]),
          const SizedBox(height: 10),
          Text(displayName,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          if (profilePic != null)
            TextButton.icon(
              onPressed: _saving ? null : _removePhoto,
              icon:
                  const Icon(Icons.delete_outline, size: 16, color: Colors.red),
              label: const Text('Eliminar foto',
                  style: TextStyle(color: Colors.red, fontSize: 12)),
            ),
        ])),
        const SizedBox(height: 24),
        _SectionLabel('Perfil'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            _InfoTile(
                icon: Icons.email_outlined,
                label: 'Correo',
                value: email ?? '—'),
            const Divider(height: 1),
            _InfoTile(
                icon: Icons.phone_outlined,
                label: 'Celular',
                value: phone ?? '—'),
          ]),
        ),
        const SizedBox(height: 24),
        _SectionLabel('Seguridad'),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            _ActionTile(
              icon: Icons.key_rounded,
              label: 'Cambiar contraseña',
              color: scheme.primary,
              onTap: () => showFuturisticModal(context,
                  builder: (_) => const _ChangePasswordModal()),
            ),
            const Divider(height: 1),
            _ActionTile(
              icon: Icons.email_rounded,
              label: 'Cambiar correo',
              color: const Color(0xFF6A1B9A),
              onTap: () async {
                final ok = await showFuturisticModal<bool>(context,
                    builder: (_) => const _ChangeEmailModal());
                if (ok == true) _load();
              },
            ),
            const Divider(height: 1),
            _ActionTile(
              icon: Icons.phone_android_rounded,
              label: 'Cambiar número',
              color: const Color(0xFF1565C0),
              onTap: () async {
                final ok = await showFuturisticModal<bool>(context,
                    builder: (_) => const _ChangePhoneModal());
                if (ok == true) _load();
              },
            ),
          ]),
        ),
        const SizedBox(height: 24),
        _SectionLabel('Ayuda'),
        AppCard(
          padding: EdgeInsets.zero,
          child: _ActionTile(
            icon: Icons.support_agent_rounded,
            label: 'Ayuda y soporte',
            color: Colors.orange.shade700,
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const ClientSupportScreen())),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _confirmLogout,
            icon: const Icon(Icons.logout_rounded, color: Colors.red),
            label: const Text('Cerrar sesión',
                style:
                    TextStyle(color: Colors.red, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ),
        const SizedBox(height: 32),
      ]),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Colors.black54,
                letterSpacing: 0.5)),
      );
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoTile(
      {required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(label,
            style: const TextStyle(fontSize: 12, color: Colors.black45)),
        subtitle: Text(value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      );
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});
  @override
  Widget build(BuildContext context) => ListTile(
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 18),
        ),
        title: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        trailing:
            Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
        onTap: onTap,
      );
}

// ── Modales de seguridad ─────────────────────────────────────────

class _ChangePasswordModal extends StatefulWidget {
  const _ChangePasswordModal();
  @override
  State<_ChangePasswordModal> createState() => _ChangePasswordModalState();
}

class _ChangePasswordModalState extends State<_ChangePasswordModal> {
  final _curCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _new2Ctrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _curCtrl.dispose();
    _newCtrl.dispose();
    _new2Ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_newCtrl.text != _new2Ctrl.text) {
      setState(() => _error = 'Las contraseñas no coinciden');
      return;
    }
    if (_newCtrl.text.length < 8) {
      setState(() => _error = 'Mínimo 8 caracteres');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.changePassword(_curCtrl.text, _newCtrl.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) => _SecurityModalShell(
        icon: Icons.key_rounded,
        title: 'Cambiar contraseña',
        loading: _loading,
        error: _error,
        onSubmit: _submit,
        children: [
          _pw(_curCtrl, 'Contraseña actual'),
          const SizedBox(height: 10),
          _pw(_newCtrl, 'Nueva contraseña'),
          const SizedBox(height: 10),
          _pw(_new2Ctrl, 'Confirmar nueva contraseña'),
        ],
      );

  Widget _pw(TextEditingController c, String label) => TextField(
        controller: c,
        obscureText: true,
        decoration: InputDecoration(
            labelText: label,
            filled: true,
            fillColor: const Color(0xFFF8FAF8),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.grey.shade200))),
      );
}

class _ChangeEmailModal extends StatefulWidget {
  const _ChangeEmailModal();
  @override
  State<_ChangeEmailModal> createState() => _ChangeEmailModalState();
}

class _ChangeEmailModalState extends State<_ChangeEmailModal> {
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!RegExp(r'^[\w.+\-]+@[\w\-]+\.[a-z]{2,}$')
        .hasMatch(_emailCtrl.text.trim())) {
      setState(() => _error = 'Correo inválido');
      return;
    }
    if (_pwCtrl.text.isEmpty) {
      setState(() => _error = 'Confirma tu contraseña actual');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.updateEmail(_emailCtrl.text.trim(), _pwCtrl.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) => _SecurityModalShell(
        icon: Icons.email_rounded,
        title: 'Cambiar correo',
        loading: _loading,
        error: _error,
        onSubmit: _submit,
        children: [
          TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: InputDecoration(
                  labelText: 'Nuevo correo',
                  filled: true,
                  fillColor: const Color(0xFFF8FAF8),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: Colors.grey.shade200)))),
          const SizedBox(height: 10),
          TextField(
              controller: _pwCtrl,
              obscureText: true,
              decoration: InputDecoration(
                  labelText: 'Contraseña actual',
                  filled: true,
                  fillColor: const Color(0xFFF8FAF8),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: Colors.grey.shade200)))),
        ],
      );
}

class _ChangePhoneModal extends StatefulWidget {
  const _ChangePhoneModal();
  @override
  State<_ChangePhoneModal> createState() => _ChangePhoneModalState();
}

class _ChangePhoneModalState extends State<_ChangePhoneModal> {
  final _phoneCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final digits = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10 || !digits.startsWith('3')) {
      setState(
          () => _error = 'Celular colombiano de 10 dígitos (ej: 3138207044)');
      return;
    }
    if (_pwCtrl.text.isEmpty) {
      setState(() => _error = 'Confirma tu contraseña actual');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.updatePhone(digits, _pwCtrl.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) => _SecurityModalShell(
        icon: Icons.phone_android_rounded,
        title: 'Cambiar número',
        loading: _loading,
        error: _error,
        onSubmit: _submit,
        children: [
          TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                  labelText: 'Nuevo celular',
                  hintText: 'Ej: 3138207044',
                  filled: true,
                  fillColor: const Color(0xFFF8FAF8),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: Colors.grey.shade200)))),
          const SizedBox(height: 10),
          TextField(
              controller: _pwCtrl,
              obscureText: true,
              decoration: InputDecoration(
                  labelText: 'Contraseña actual',
                  filled: true,
                  fillColor: const Color(0xFFF8FAF8),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: Colors.grey.shade200)))),
        ],
      );
}

/// Cascarón compartido por los 3 modales de seguridad -- mismo header,
/// manejo de error y botón de confirmar.
class _SecurityModalShell extends StatelessWidget {
  final IconData icon;
  final String title;
  final List<Widget> children;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;
  const _SecurityModalShell({
    required this.icon,
    required this.title,
    required this.children,
    required this.loading,
    required this.error,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FuturisticModalCard(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ModalCloseButton(),
            Icon(icon, size: 36, color: scheme.primary),
            const SizedBox(height: 8),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1A1A))),
            const SizedBox(height: 16),
            ...children,
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(error!,
                    style: const TextStyle(
                        color: Color(0xFFD32F2F), fontSize: 12)),
              ),
            const SizedBox(height: 14),
            SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed: loading ? null : onSubmit,
                  style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                  child: loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('Confirmar'),
                )),
          ]),
    );
  }
}
