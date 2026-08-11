import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  List<Map<String, dynamic>> _users = [];
  bool _isLoading = true;
  String? _error;
  String _roleFilter = 'all';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_roleFilter != 'all') queryParams['role'] = _roleFilter;
      final response = await apiService.get(ApiEndpoints.adminUsers, queryParams: queryParams);
      final raw = response['data'] ?? response['users'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _users = list.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar usuarios';
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredUsers {
    final query = _searchController.text.toLowerCase().trim();
    return _users.where((u) {
      final matchSearch = query.isEmpty ||
          (u['name']?.toString().toLowerCase().contains(query) ?? false) ||
          (u['email']?.toString().toLowerCase().contains(query) ?? false);
      final matchRole = _roleFilter == 'all' || (u['role'] ?? '') == _roleFilter;
      return matchSearch && matchRole;
    }).toList();
  }

  Future<void> _toggleActive(Map<String, dynamic> user) async {
    final newActive = !(user['is_active'] ?? true);
    try {
      await apiService.put(ApiEndpoints.adminUser(user['id'].toString()), {'is_active': newActive});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(newActive ? 'Usuario activado' : 'Usuario desactivado'),
          backgroundColor: AppColors.success,
        ));
        _loadUsers();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
      }
    }
  }

  String _getRoleLabel(String role) {
    const map = {'admin': 'Administrador', 'worker': 'Repartidor', 'client': 'Cliente'};
    return map[role] ?? role;
  }

  Color _getRoleColor(String role) {
    switch (role) {
      case 'admin':
        return AppColors.primary;
      case 'worker':
        return AppColors.accent;
      default:
        return AppColors.gray;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: const Text('Usuarios'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add, color: Colors.white),
            onPressed: () => Navigator.pushNamed(context, '/admin/user-form', arguments: {'id': null}).then((_) => _loadUsers()),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadUsers,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildFilterBar(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Buscar por nombre o email...',
                          prefixIcon: const Icon(Icons.search),
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    Expanded(
                      child: _filteredUsers.isEmpty
                          ? EmptyState(icon: Icons.people_outline, title: 'Sin usuarios', subtitle: 'No hay usuarios para los filtros seleccionados')
                          : RefreshIndicator(
                              onRefresh: _loadUsers,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _filteredUsers.length,
                                itemBuilder: (context, index) => _buildUserCard(_filteredUsers[index]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.surface,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildChip('Todos', 'all'),
            const SizedBox(width: 6),
            _buildChip('Admin', 'admin'),
            const SizedBox(width: 6),
            _buildChip('Repartidores', 'worker'),
            const SizedBox(width: 6),
            _buildChip('Clientes', 'client'),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String label, String role) {
    final isActive = _roleFilter == role;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isActive ? Colors.white : AppColors.textSecondary)),
      selected: isActive,
      onSelected: (_) => setState(() => _roleFilter = role),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.lightGray,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildUserCard(Map<String, dynamic> user) {
    final role = user['role'] as String? ?? 'client';
    final roleColor = _getRoleColor(role);
    final isActive = user['is_active'] ?? true;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/admin/user-form', arguments: {'id': user['id']}).then((_) => _loadUsers()),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: roleColor.withOpacity(0.1),
                child: Text(
                  (user['name'] as String? ?? '?')[0].toUpperCase(),
                  style: TextStyle(color: roleColor, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text(user['name'] as String? ?? 'Sin nombre', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: roleColor.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                        child: Text(_getRoleLabel(role), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: roleColor)),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text(user['email'] as String? ?? '-', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    if (user['phone'] != null) Text(user['phone'].toString(), style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                  ],
                ),
              ),
              Switch(
                value: isActive,
                onChanged: (_) => _toggleActive(user),
                activeColor: AppColors.success,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
