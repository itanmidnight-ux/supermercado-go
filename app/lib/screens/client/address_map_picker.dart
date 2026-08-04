import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import '../../utils/constants.dart';

class AddressMapPicker extends StatefulWidget {
  final double? initialLat;
  final double? initialLng;

  const AddressMapPicker({super.key, this.initialLat, this.initialLng});

  @override
  State<AddressMapPicker> createState() => _AddressMapPickerState();
}

class _AddressMapPickerState extends State<AddressMapPicker> {
  late final MapController _mapController;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  LatLng? _pickedLocation;
  String _addressText = '';
  bool _isLoadingLocation = false;
  bool _isReverseGeocoding = false;
  List<Map<String, String>> _searchResults = [];
  bool _isSearching = false;

  static const double _defaultLat = 7.8939;
  static const double _defaultLng = -72.5078;

  @override
  void initState() {
    super.initState();
    _pickedLocation = (widget.initialLat != null && widget.initialLng != null)
        ? LatLng(widget.initialLat!, widget.initialLng!)
        : LatLng(_defaultLat, _defaultLng);
    _mapController = MapController();
    _reverseGeocode();
  }

  @override
  void dispose() {
    _mapController.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _reverseGeocode() async {
    if (_pickedLocation == null) return;
    setState(() => _isReverseGeocoding = true);
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=${_pickedLocation!.latitude}&lon=${_pickedLocation!.longitude}&addressdetails=1&accept-language=es',
      );
      final response = await http.get(url, headers: {'User-Agent': 'SupermercadosGoApp'});
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _addressText = data['display_name'] as String? ?? '';
        });
      }
    } catch (_) {
      // Reverse geocode failed silently
    } finally {
      setState(() => _isReverseGeocoding = false);
    }
  }

  Future<void> _searchAddress(String query) async {
    if (query.trim().isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _isSearching = true);
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search?format=json&q=${Uri.encodeComponent(query)}&countrycodes=co&limit=5&accept-language=es',
      );
      final response = await http.get(url, headers: {'User-Agent': 'SupermercadosGoApp'});
      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List;
        setState(() {
          _searchResults = list.map((e) {
            final item = e as Map<String, dynamic>;
            return {
              'display_name': item['display_name'] as String? ?? '',
              'lat': (item['lat'] as String?) ?? '',
              'lon': (item['lon'] as String?) ?? '',
            };
          }).toList();
        });
      }
    } catch (_) {
      // Search failed silently
    } finally {
      setState(() => _isSearching = false);
    }
  }

  Future<void> _moveToCurrentLocation() async {
    setState(() => _isLoadingLocation = true);
    try {
      // Use last known or default location for Cúcuta
      setState(() {
        _pickedLocation = const LatLng(_defaultLat, _defaultLng);
      });
      _mapController.move(_pickedLocation!, 16);
      await _reverseGeocode();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ubicación actual aproximada (Cúcuta)')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo obtener la ubicación'), backgroundColor: AppColors.error),
      );
    } finally {
      setState(() => _isLoadingLocation = false);
    }
  }

  void _selectSearchResult(Map<String, String> result) {
    final lat = double.tryParse(result['lat']!);
    final lng = double.tryParse(result['lon']!);
    if (lat == null || lng == null) return;
    setState(() {
      _pickedLocation = LatLng(lat, lng);
      _addressText = result['display_name']!;
      _searchResults = [];
      _searchController.clear();
      _searchFocusNode.unfocus();
    });
    _mapController.move(_pickedLocation!, 16);
  }

  void _confirmLocation() {
    if (_pickedLocation == null || _addressText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona una ubicación válida'), backgroundColor: AppColors.error),
      );
      return;
    }
    Navigator.pop(context, {
      'lat': _pickedLocation!.latitude,
      'lng': _pickedLocation!.longitude,
      'address': _addressText,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Seleccionar ubicación'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Stack(
        children: [
          Column(
            children: [
              _buildSearchBar(),
              if (_searchResults.isNotEmpty) _buildSearchResults(),
              Expanded(child: _buildMap()),
              _buildBottomSheet(),
            ],
          ),
          if (_isLoadingLocation || _isReverseGeocoding)
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: TextField(
        controller: _searchController,
        focusNode: _searchFocusNode,
        decoration: InputDecoration(
          hintText: 'Buscar dirección...',
          prefixIcon: const Icon(Icons.search, color: AppColors.gray),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 20),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchResults = []);
                  },
                )
              : null,
          filled: true,
          fillColor: AppColors.lightGray,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        onChanged: (value) {
          setState(() {});
          if (value.length >= 3) {
            _searchAddress(value);
          } else {
            setState(() => _searchResults = []);
          }
        },
        onSubmitted: (value) => _searchAddress(value),
      ),
    );
  }

  Widget _buildSearchResults() {
    return Container(
      constraints: const BoxConstraints(maxHeight: 200),
      color: AppColors.surface,
      child: _isSearching
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            )
          : ListView.separated(
              shrinkWrap: true,
              itemCount: _searchResults.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final result = _searchResults[index];
                return ListTile(
                  leading: const Icon(Icons.location_on, color: AppColors.primary, size: 20),
                  title: Text(
                    result['display_name']!,
                    style: const TextStyle(fontSize: 12),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  dense: true,
                  onTap: () => _selectSearchResult(result),
                );
              },
            ),
    );
  }

  Widget _buildMap() {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _pickedLocation!,
        initialZoom: 16,
        onTap: (_, point) async {
          setState(() => _pickedLocation = point);
          await _reverseGeocode();
        },
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.supermercadosgo.app',
        ),
        MarkerLayer(
          markers: [
            if (_pickedLocation != null)
              Marker(
                point: _pickedLocation!,
                width: 40,
                height: 40,
                child: const Icon(Icons.location_on, color: AppColors.primary, size: 40),
              ),
          ],
        ),
        Align(
          alignment: Alignment.bottomRight,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FloatingActionButton.small(
                  heroTag: 'current_loc',
                  onPressed: _moveToCurrentLocation,
                  backgroundColor: AppColors.surface,
                  child: const Icon(Icons.my_location, color: AppColors.primary),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'zoom_in',
                  onPressed: () => _mapController.move(_mapController.camera.center, _mapController.camera.zoom + 1),
                  backgroundColor: AppColors.surface,
                  child: const Icon(Icons.add, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'zoom_out',
                  onPressed: () => _mapController.move(_mapController.camera.center, _mapController.camera.zoom - 1),
                  backgroundColor: AppColors.surface,
                  child: const Icon(Icons.remove, color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomSheet() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        boxShadow: [BoxShadow(blurRadius: 10, offset: Offset(0, -2), color: Colors.black12)],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.location_on, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _addressText.isEmpty ? 'Toca el mapa para seleccionar' : _addressText,
                    style: TextStyle(
                      fontSize: 13,
                      color: _addressText.isEmpty ? AppColors.gray : AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: _confirmLocation,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text(
                'Confirmar ubicación',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
