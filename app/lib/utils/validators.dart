String? validateEmail(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'El correo es obligatorio';
  }
  final regex = RegExp(r'^[\w\-.]+@([\w-]+\.)+[\w-]{2,4}$');
  if (!regex.hasMatch(value.trim())) {
    return 'Ingresa un correo válido';
  }
  return null;
}

String? validatePhone(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'El teléfono es obligatorio';
  }
  String cleaned = value.replaceAll(RegExp(r'[\s\-\(\)]'), '');
  if (cleaned.startsWith('+57')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.length != 10) {
    return 'Ingresa un teléfono colombiano válido (10 dígitos)';
  }
  if (!RegExp(r'^3[0-9]{9}$').hasMatch(cleaned)) {
    return 'El teléfono debe comenzar con 3';
  }
  return null;
}

String? validatePassword(String? value) {
  if (value == null || value.isEmpty) {
    return 'La contraseña es obligatoria';
  }
  if (value.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres';
  }
  return null;
}

String? validateName(String? value) {
  if (value == null || value.trim().isEmpty) {
    return 'El nombre es obligatorio';
  }
  if (value.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres';
  }
  return null;
}

String? validateRequired(String? value, [String fieldName = 'Este campo']) {
  if (value == null || value.trim().isEmpty) {
    return '$fieldName es obligatorio';
  }
  return null;
}
