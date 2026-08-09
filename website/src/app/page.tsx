'use client';

import { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavStore } from '@/store/navigation-store';
import { useDataStore } from '@/store/data-store';
import { Header } from '@/components/supermarket/layout/Header';
import { Footer } from '@/components/supermarket/layout/Footer';
import { HomePage } from '@/components/supermarket/pages/HomePage';
import { CatalogPage } from '@/components/supermarket/pages/CatalogPage';
import { ProductDetailPage } from '@/components/supermarket/pages/ProductDetailPage';
import { CartPage } from '@/components/supermarket/pages/CartPage';
import { CheckoutPage } from '@/components/supermarket/pages/CheckoutPage';
import { AuthPage } from '@/components/supermarket/pages/AuthPage';
import { AccountPage } from '@/components/supermarket/pages/AccountPage';
import { OrdersPage } from '@/components/supermarket/pages/OrdersPage';
import { OrderDetailPage } from '@/components/supermarket/pages/OrderDetailPage';
import { FavoritesPage } from '@/components/supermarket/pages/FavoritesPage';
import { ContactPage } from '@/components/supermarket/pages/ContactPage';
import { AboutPage } from '@/components/supermarket/pages/AboutPage';
import { FaqPage } from '@/components/supermarket/pages/FaqPage';
import { LegalPage } from '@/components/supermarket/pages/LegalPage';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminProducts } from '@/components/admin/AdminProducts';
import { AdminCategories } from '@/components/admin/AdminCategories';
import { AdminOrders } from '@/components/admin/AdminOrders';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { AdminWorkers } from '@/components/admin/AdminWorkers';
import { AdminClients } from '@/components/admin/AdminClients';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminRecords } from '@/components/admin/AdminRecords';
import { WorkerLayout } from '@/components/worker/WorkerLayout';
import { WorkerOrders } from '@/components/worker/WorkerOrders';
import { WorkerDelivery } from '@/components/worker/WorkerDelivery';
import { WorkerHistory } from '@/components/worker/WorkerHistory';
import { ToastProvider } from '@/components/ui/toaster';
import { CookieConsent } from '@/components/supermarket/cookies/CookieConsent';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function PageRouter() {
  const { currentPage } = useNavStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'catalog': return <CatalogPage />;
      case 'product-detail': return <ProductDetailPage />;
      case 'cart': return <CartPage />;
      case 'checkout': return <CheckoutPage />;
      case 'login': case 'register': return <AuthPage />;
      case 'account': return <AccountPage />;
      case 'orders': return <OrdersPage />;
      case 'order-detail': return <OrderDetailPage />;
      case 'favorites': return <FavoritesPage />;
      case 'contact': return <ContactPage />;
      case 'about': return <AboutPage />;
      case 'faq': return <FaqPage />;
      case 'terms': return <LegalPage type="terms" />;
      case 'privacy': return <LegalPage type="privacy" />;
      case 'admin-dashboard': return <AdminLayout currentPage={currentPage}><AdminDashboard /></AdminLayout>;
      case 'admin-products': return <AdminLayout currentPage={currentPage}><AdminProducts /></AdminLayout>;
      case 'admin-categories': return <AdminLayout currentPage={currentPage}><AdminCategories /></AdminLayout>;
      case 'admin-orders': return <AdminLayout currentPage={currentPage}><AdminOrders /></AdminLayout>;
      case 'admin-users': return <AdminLayout currentPage={currentPage}><AdminUsers /></AdminLayout>;
      case 'admin-settings': return <AdminLayout currentPage={currentPage}><AdminSettings /></AdminLayout>;
      case 'admin-workers': return <AdminLayout currentPage={currentPage}><AdminWorkers /></AdminLayout>;
      case 'admin-clients': return <AdminLayout currentPage={currentPage}><AdminClients /></AdminLayout>;
      case 'admin-analytics': return <AdminLayout currentPage={currentPage}><AdminAnalytics /></AdminLayout>;
      case 'admin-records': return <AdminLayout currentPage={currentPage}><AdminRecords /></AdminLayout>;
      case 'worker-orders': return <WorkerLayout currentPage={currentPage}><WorkerOrders /></WorkerLayout>;
      case 'worker-delivery': return <WorkerLayout currentPage={currentPage}><WorkerDelivery /></WorkerLayout>;
      case 'worker-history': return <WorkerLayout currentPage={currentPage}><WorkerHistory /></WorkerLayout>;
      default: return <HomePage />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentPage} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        {renderPage()}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const { currentPage, navigate } = useNavStore();
  const fetchAll = useDataStore((s) => s.fetchAll);
  const isAdmin = currentPage.startsWith('admin');
  const isWorker = currentPage.startsWith('worker');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && currentPage !== 'home') navigate('home');
  }, [currentPage, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {!isAdmin && !isWorker && <Header />}
        <div className="flex-1">
          <PageRouter />
        </div>
        {!isAdmin && !isWorker && <Footer />}
      </div>
      <CookieConsent />
    </ToastProvider>
  );
}
