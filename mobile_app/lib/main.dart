import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/product_provider.dart';

void main() {
  runApp(const SupermercadoGOApp());
}

class SupermercadoGOApp extends StatelessWidget {
  const SupermercadoGOApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
      ],
      child: MaterialApp(
        title: 'Supermercado GO',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: const Color(0xFF00D4FF),
          scaffoldBackgroundColor: const Color(0xFF0A0A0A),
          fontFamily: 'Poppins',
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF00D4FF),
            secondary: Color(0xFF7B2CBF),
            surface: Color(0xFF14141E),
            background: Color(0xFF0A0A0A),
          ),
          cardTheme: CardTheme(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.transparent,
            elevation: 0,
            centerTitle: true,
          ),
        ),
        home: const LoginScreen(),
      ),
    );
  }
}