import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../providers/settings_provider.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _banners = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadBanners();
    _loading = false;
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBanners() async {
    try {
      final sp = context.read<SettingsProvider>();
      final resp = await http.get(
        Uri.parse('${sp.serverUrl}/api/banners?all=1'),
        headers: {'Content-Type': 'application/json'},
      );
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        setState(() => _banners = List<Map<String, dynamic>>.from(data['banners'] ?? []));
      }
    } catch (_) {}
  }

  void _showBannerDialog(Map<String, dynamic>? b) {
    final titleCtrl = TextEditingController(text: b?['title'] ?? '');
    final subCtrl = TextEditingController(text: b?['subtitle'] ?? '');
    final imgCtrl = TextEditingController(text: b?['image_url'] ?? '');
    String bgColor = b?['bg_color'] ?? '#00B860';
    bool active = b?['is_active'] == 1;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(b == null ? 'Nuevo Banner' : 'Editar Banner'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Título *')),
                const SizedBox(height: 8),
                TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subtítulo')),
                const SizedBox(height: 8),
                TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL de imagen')),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: bgColor,
                  decoration: const InputDecoration(labelText: 'Color de fondo'),
                  items: ['#00B860', '#FF8C00', '#1a7a3a', '#FFD93D', '#1565C0', '#6A1B9A']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setDlg(() => bgColor = v!),
                ),
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
            ElevatedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Guardar')),
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
      appBar: const CustomAppBar(title: 'Configuración', showBack: true),
      body: Column(
        children: [
          TabBar(
            controller: _tabCtrl,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.gray,
            indicatorColor: AppColors.primary,
            tabs: const [Tab(text: 'Negocio'), Tab(text: 'Entrega'), Tab(text: 'Carrusel')],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text('Datos del negocio', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                    const SizedBox(height: 12),
                    const ListTile(leading: Icon(Icons.store), title: Text('Supermercados Go'), subtitle: Text('KDX 1-2B Los Mangos, Cúcuta')),
                    const ListTile(leading: Icon(Icons.phone), title: Text('+57 304 401 6277')),
                    const ListTile(leading: Icon(Icons.email), title: Text('admin@supermercado.go')),
                    const ListTile(leading: Icon(Icons.schedule), title: Text('6:00 AM - 6:00 PM')),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Guardado'), backgroundColor: AppColors.primary),
                      ),
                      child: const Text('Guardar Cambios'),
                    ),
                  ],
                ),
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text('Zona de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                    const SizedBox(height: 4),
                    const Text('Configura las zonas donde realizas entregas.', style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 12),
                    const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Cúcuta'))),
                    const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Los Patios'))),
                    const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Villa del Rosario'))),
                    const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Pamplonita'))),
                    const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('El Zulia'))),
                    const SizedBox(height: 16),
                    const Text('Costos de envío', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 8),
                    const Card(child: ListTile(leading: Icon(Icons.delivery_dining, color: AppColors.primary), title: Text('Costo estándar'), subtitle: Text('\$4.900'))),
                    const Card(child: ListTile(leading: Icon(Icons.local_shipping, color: AppColors.success), title: Text('Envío gratis desde'), subtitle: Text('\$50.000'))),
                  ],
                ),
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(children: const [
                      Icon(Icons.banner, color: AppColors.primary),
                      SizedBox(width: 8),
                      Text('Banners del Carrusel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                      Expanded(child: SizedBox()),
                    ]),
                    const SizedBox(height: 8),
                    const Text('Administra los banners que se muestran en la pantalla principal de la app.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    const SizedBox(height: 12),
                    ..._banners.map((b) => Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ListTile(
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(color: _parseColor(b['bg_color'] ?? '#00B860'), borderRadius: BorderRadius.circular(8)),
                              child: const Icon(Icons.image, color: Colors.white),
                            ),
                            title: Text(b['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(b['subtitle'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(b['is_active'] == 1 ? Icons.check_circle : Icons.cancel, color: b['is_active'] == 1 ? AppColors.success : AppColors.gray, size: 20),
                              const SizedBox(width: 4),
                              const Icon(Icons.chevron_right),
                            ]),
                            onTap: () => _showBannerDialog(b),
                          ),
                        )),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 45,
                      child: ElevatedButton.icon(
                        onPressed: () => _showBannerDialog(null),
                        icon: const Icon(Icons.add),
                        label: const Text('Agregar Banner'),
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
