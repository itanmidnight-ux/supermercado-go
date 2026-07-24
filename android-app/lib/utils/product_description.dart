import '../models/product.dart';

/// Descripción corta generada a partir del nombre del producto -- usada en
/// la grilla, el detalle y el carrito para no duplicar la heurística en
/// cada pantalla.
String productDescription(Product p) {
  final n = p.name.toLowerCase();
  if (n.contains('concentrado') || n.contains('alimento')) {
    return 'Alimento balanceado de alta calidad con nutrientes esenciales para el óptimo desarrollo y salud de sus animales.';
  }
  if (n.contains('bulto')) {
    return 'Presentación económica en bulto. Ideal para grandes productores. Excelente relación calidad-precio.';
  }
  if (n.contains('pollo') || n.contains('gallina')) {
    return 'Formulado especialmente para aves de corral. Promueve crecimiento sano y producción eficiente.';
  }
  if (n.contains('cerdo')) {
    return 'Nutrición balanceada para porcinos en todas las etapas de crecimiento. Alta digestibilidad.';
  }
  if (n.contains('bovino') || n.contains('ganado')) {
    return 'Suplemento nutricional premium para bovinos. Optimiza la producción de leche y carne.';
  }
  if (n.contains('perro') || n.contains('mascota')) {
    return 'Alimento premium para su mascota. Ingredientes naturales seleccionados para su bienestar.';
  }
  if (n.contains('vitamina') || n.contains('suplemento')) {
    return 'Suplemento vitamínico esencial. Fortalece el sistema inmune y mejora el rendimiento productivo.';
  }
  return 'Producto de alta calidad, seleccionado para satisfacer las necesidades de sus animales con los mejores estándares nutricionales.';
}
