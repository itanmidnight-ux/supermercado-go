import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/settings_provider.dart';
import '../../services/storage_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class AdminBannersScreen extends StatefulWidget {
  const AdminBannersScreen({super.key});

  @override
  State<AdminBannersScreen> createState() => _AdminBannersScreenState();
}

class _AdminBannersScreenState extends State<AdminBannersScreen> {
  List<Map<String, dynamic>> _banners = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBanners();
  }

  Future<void> _loadBanners() async {
    setState(() => _loading = true);
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(
        Uri.parse('${sp.serverUrl}/api/banners?all=1'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      );
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        setState(() => _banners = List<Map<String, dynamic>>.from(data['banners'] ?? []));
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _saveBanner(Map<String, dynamic> body, {String? id}) async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
      if (id != null) {
        await http.put(Uri.parse('${sp.serverUrl}/api/banners/$id'), headers: headers, body: jsonEncode(body));
      } else {
        await http.post(Uri.parse('${sp.serverUrl}/api/banners'), headers: headers, body: jsonEncode(body));
      }
      if (mounted) {
        _loadBanners();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(id != null ? 'Banner actualizado' : 'Banner creado'),
          backgroundColor: AppColors.primary,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al guardar banner'), backgroundColor: AppColors.error));
      }
    }
  }

  Future<void> _deleteBanner(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar banner'),
        content: const Text('¿Estás seguro de eliminar este banner?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.delete(Uri.parse('${sp.serverUrl}/api/banners/$id'), headers: {'Authorization': 'Bearer $token'});
      if (mounted) {
        _loadBanners();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Banner eliminado'), backgroundColor: AppColors.primary));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al eliminar'), backgroundColor: AppColors.error));
      }
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> b) async {
    final newActive = (b['is_active'] == 1) ? 0 : 1;
    await _saveBanner({'is_active': newActive}, id: b['id'] as String);
  }

  void _showBannerDialog(Map<String, dynamic>? b) {
    final isEdit = b != null;
    final titleCtrl = TextEditingController(text: b?['title'] ?? '');
    final subCtrl = TextEditingController(text: b?['subtitle'] ?? '');
    final imgCtrl = TextEditingController(text: b?['image_url'] ?? '');
    String bgColor = b?['bg_color'] ?? '#00B860';
    String textColor = b?['text_color'] ?? '#FFFFFF';
    String linkType = b?['link_type'] ?? 'none';
    final linkValCtrl = TextEditingController(text: b?['link_value'] ?? '');
    final sortOrderCtrl = TextEditingController(text: (b?['sort_order'] ?? 0).toString());
    bool active = b?['is_active'] == 1;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(isEdit ? 'Editar Banner' : 'Nuevo Banner'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Título *')),
                const SizedBox(height: 8),
                TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subtítulo (opcional)')),
                const SizedBox(height: 8),
                TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL de imagen (opcional)')),
                const SizedBox(height: 12),
                const Text('Color de fondo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Row(children: [
                  Container(width: 36, height: 36, decoration: BoxDecoration(color: _parseColor(bgColor), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.gray))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: TextEditingController(text: bgColor), decoration: const InputDecoration(labelText: '#Hex', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 10)), onChanged: (v) => setDlg(() => bgColor = v.startsWith('#') ? v : '#$v'))),
                ]),
                const SizedBox(height: 8),
                const Text('Color de texto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Row(children: [
                  Container(width: 36, height: 36, decoration: BoxDecoration(color: _parseColor(textColor), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.gray))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: TextEditingController(text: textColor), decoration: const InputDecoration(labelText: '#Hex', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 10)), onChanged: (v) => setDlg(() => textColor = v.startsWith('#') ? v : '#$v'))),
                ]),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: linkType,
                  decoration: const InputDecoration(labelText: 'Tipo de enlace'),
                  items: const [
                    DropdownMenuItem(value: 'none', child: Text('Sin enlace')),
                    DropdownMenuItem(value: 'category', child: Text('Categoría')),
                    DropdownMenuItem(value: 'product', child: Text('Producto')),
                    DropdownMenuItem(value: 'promo', child: Text('Promoción')),
                  ],
                  onChanged: (v) => setDlg(() => linkType = v!),
                ),
                if (linkType != 'none')
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: TextField(
                      controller: linkValCtrl,
                      decoration: InputDecoration(
                        labelText: 'ID del ${linkType == 'category' ? 'categoría' : linkType == 'product' ? 'producto' : 'promoción'}',
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                TextField(controller: sortOrderCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Orden')),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('Activo'),
                  value: active,
                  onChanged: (v) => setDlg(() => active = v),
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppColors.primary,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (titleCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('El título es obligatorio'), backgroundColor: AppColors.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                final body = {
                  'title': titleCtrl.text.trim(),
                  'subtitle': subCtrl.text.trim().isEmpty ? null : subCtrl.text.trim(),
                  'image_url': imgCtrl.text.trim().isEmpty ? null : imgCtrl.text.trim(),
                  'bg_color': bgColor,
                  'text_color': textColor,
                  'link_type': linkType,
                  'link_value': linkType != 'none' ? linkValCtrl.text.trim() : null,
                  'sort_order': int.tryParse(sortOrderCtrl.text) ?? 0,
                  'is_active': active,
                };
                if (isEdit) {
                  await _saveBanner(body, id: b!['id'] as String);
                } else {
                  await _saveBanner(body);
                }
              },
              child: Text(isEdit ? 'Guardar' : 'Crear'),
            ),
          ],
        ),
      ),
    );
  }

  static Color _parseColor(String hex) {
    try {
      return Color(int.parse(hex.replaceFirst('#', '0xFF')));
    } catch (_) {
      return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: const Text('Banners'),
        actions: [
          IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => _showBannerDialog(null)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _banners.isEmpty
              ? const EmptyState(icon: Icons.banner_outlined, title: 'Sin banners', subtitle: 'Agrega banners para el carrusel principal')
              : RefreshIndicator(
                  onRefresh: _loadBanners,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _banners.length,
                    itemBuilder: (_, i) {
                      final b = _banners[i];
                      final bgCol = _parseColor(b['bg_color'] ?? '#00B860');
                      final isActive = b['is_active'] == 1;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(color: bgCol, borderRadius: BorderRadius.circular(10)),
                              child: (b['image_url'] != null && (b['image_url'] as String).isNotEmpty)
                                  ? ClipRRect(borderRadius: BorderRadius.circular(10), child: CachedNetworkImage(imageUrl: b['image_url'] as String, fit: BoxFit.cover))
                                  : const Icon(Icons.image, color: Colors.white, size: 24),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    Expanded(child: Text(b['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis)),
                                    Container(
                                      width: 16,
                                      height: 16,
                                      margin: const EdgeInsets.only(left: 6),
                                      decoration: BoxDecoration(color: bgCol, shape: BoxShape.circle, border: Border.all(color: AppColors.gray, width: 0.5)),
                                    ),
                                  ]),
                                  if (b['subtitle'] != null && (b['subtitle'] as String).isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(b['subtitle'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  ],
                                  const SizedBox(height: 4),
                                  Row(children: [
                                    if (b['link_type'] != null && b['link_type'] != 'none')
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                                        margin: const EdgeInsets.only(right: 6),
                                        child: Text('${b['link_type']}: ${b['link_value'] ?? ''}', style: const TextStyle(fontSize: 10, color: Colors.blue)),
                                      ),
                                    Text('Orden: ${b['sort_order'] ?? 0}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                  ]),
                                ],
                              ),
                            ),
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Switch(
                                  value: isActive,
                                  onChanged: (_) => _toggleActive(b),
                                  activeColor: AppColors.success,
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                Row(mainAxisSize: MainAxisSize.min, children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit, color: AppColors.primary, size: 20),
                                    onPressed: () => _showBannerDialog(b),
                                    constraints: const BoxConstraints(),
                                    padding: const EdgeInsets.all(4),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete, color: AppColors.error, size: 20),
                                    onPressed: () => _deleteBanner(b['id'] as String),
                                    constraints: const BoxConstraints(),
                                    padding: const EdgeInsets.all(4),
                                  ),
                                ]),
                              ],
                            ),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showBannerDialog(null),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
