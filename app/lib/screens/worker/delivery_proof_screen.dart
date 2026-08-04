import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:signature/signature.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';

class DeliveryProofScreen extends StatefulWidget {
  final int orderId;

  const DeliveryProofScreen({super.key, required this.orderId});

  @override
  State<DeliveryProofScreen> createState() => _DeliveryProofScreenState();
}

class _DeliveryProofScreenState extends State<DeliveryProofScreen> {
  final ImagePicker _imagePicker = ImagePicker();
  final SignatureController _signatureController = SignatureController(
    penStrokeWidth: 3,
    penColor: AppColors.textPrimary,
    exportBackgroundColor: Colors.white,
  );
  final TextEditingController _notesController = TextEditingController();
  final List<File> _photos = [];
  Position? _currentPosition;
  String? _locationError;
  bool _isSubmitting = false;
  bool _isLoadingLocation = true;

  @override
  void initState() {
    super.initState();
    _getLocation();
  }

  @override
  void dispose() {
    _signatureController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _getLocation() async {
    setState(() => _isLoadingLocation = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locationError = 'El GPS está desactivado';
          _isLoadingLocation = false;
        });
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        setState(() {
          _locationError = 'Permiso de ubicación denegado';
          _isLoadingLocation = false;
        });
        return;
      }
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _currentPosition = position;
        _locationError = null;
        _isLoadingLocation = false;
      });
    } catch (e) {
      setState(() {
        _locationError = 'No se pudo obtener la ubicación';
        _isLoadingLocation = false;
      });
    }
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
      );
      if (photo != null) {
        setState(() => _photos.add(File(photo.path)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo acceder a la cámara'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _removePhoto(int index) {
    setState(() => _photos.removeAt(index));
  }

  Future<void> _completeDelivery() async {
    if (_photos.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Toma al menos una foto de la entrega'), backgroundColor: AppColors.accent),
      );
      return;
    }
    if (_currentPosition == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se ha podido obtener la ubicación GPS'), backgroundColor: AppColors.accent),
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      final signatureBytes = await _signatureController.toPngBytes();
      final proofData = {
        'lat': _currentPosition!.latitude,
        'lng': _currentPosition!.longitude,
        'notes': _notesController.text.trim(),
        'has_signature': signatureBytes != null,
        'photo_count': _photos.length,
      };

      for (int i = 0; i < _photos.length; i++) {
        await apiService.postMultipart(
          '/api/orders/${widget.orderId}/proof-photo',
          {'index': i.toString()},
          _photos[i].path,
        );
      }

      await apiService.put(
        ApiEndpoints.workerCompleteDelivery(widget.orderId.toString()),
        proofData,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Entrega confirmada exitosamente'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context, true);
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al confirmar la entrega'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Comprobante de entrega'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildPhotoSection(),
          const SizedBox(height: 20),
          _buildSignatureSection(),
          const SizedBox(height: 20),
          _buildLocationSection(),
          const SizedBox(height: 20),
          _buildNotesSection(),
          const SizedBox(height: 24),
          _buildSubmitButton(),
        ],
      ),
    );
  }

  Widget _buildPhotoSection() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.camera_alt, color: AppColors.primary),
                SizedBox(width: 8),
                Text('Fotos de entrega', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                Spacer(),
                Text('Obligatorias', style: TextStyle(fontSize: 12, color: AppColors.accent, fontWeight: FontWeight.w500)),
              ],
            ),
            const SizedBox(height: 12),
            if (_photos.isEmpty)
              GestureDetector(
                onTap: _takePhoto,
                child: Container(
                  height: 120,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.lightGray,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.gray.withOpacity(0.3), style: BorderStyle.solid),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo, size: 36, color: AppColors.gray),
                      SizedBox(height: 8),
                      Text('Toca para tomar foto', style: TextStyle(color: AppColors.gray, fontSize: 13)),
                    ],
                  ),
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ..._photos.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final file = entry.value;
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(file, width: 100, height: 100, fit: BoxFit.cover),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: GestureDetector(
                            onTap: () => _removePhoto(idx),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
                  if (_photos.length < 5)
                    GestureDetector(
                      onTap: _takePhoto,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: AppColors.lightGray,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.gray.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.add_a_photo, color: AppColors.gray),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignatureSection() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.draw, color: AppColors.primary),
                SizedBox(width: 8),
                Text('Firma del receptor', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              height: 160,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.gray.withOpacity(0.4)),
                borderRadius: BorderRadius.circular(8),
                color: AppColors.surface,
              ),
              child: Signature(
                controller: _signatureController,
                backgroundColor: Colors.white,
                width: double.infinity,
                height: 160,
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => _signatureController.clear(),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Limpiar firma'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationSection() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.my_location, color: AppColors.primary),
                SizedBox(width: 8),
                Text('Ubicación GPS', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            if (_isLoadingLocation)
              const Row(
                children: [
                  SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 12),
                  Text('Obteniendo ubicación...', style: TextStyle(color: AppColors.textSecondary)),
                ],
              )
            else if (_locationError != null)
              Row(
                children: [
                  const Icon(Icons.warning_amber, color: AppColors.accent, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_locationError!, style: const TextStyle(color: AppColors.accent, fontSize: 13))),
                  TextButton(
                    onPressed: _getLocation,
                    child: const Text('Reintentar'),
                  ),
                ],
              )
            else if (_currentPosition != null)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: AppColors.success, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Lat: ${_currentPosition!.latitude.toStringAsFixed(6)}, Lng: ${_currentPosition!.longitude.toStringAsFixed(6)}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.notes, color: AppColors.primary),
                SizedBox(width: 8),
                Text('Notas de la entrega', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Observaciones adicionales (opcional)...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: AppColors.lightGray,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton.icon(
        onPressed: _isSubmitting ? null : _completeDelivery,
        icon: _isSubmitting
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.check_circle),
        label: Text(_isSubmitting ? 'Confirmando entrega...' : 'Confirmar entrega'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    );
  }
}
