import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { PosView } from './components/pos/PosView';
import { ProductsView } from './components/products/ProductsView';
import { StockView } from './components/stock/StockView';
import { CustomersView } from './components/customers/CustomersView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { DashboardView } from './components/dashboard/DashboardView';
import { SettingsView } from './components/settings/SettingsView';
import { PlatformAdminView } from './components/admin/PlatformAdminView';
import { AdminPinModal } from './components/admin/AdminPinModal';

const MainLayout: React.FC = () => {
  const { activeTab, currentUser, isPlatformAdminUnlocked } = useApp();

  const isOwner = currentUser.role === 'owner' || currentUser.role === 'admin';
  const isStockManager = currentUser.role === 'stock_manager' || isOwner;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 bg-slate-50">
          {activeTab === 'pos' && <PosView />}
          {activeTab === 'products' && <ProductsView />}
          {activeTab === 'stock' && (isStockManager ? <StockView /> : <PosView />)}
          {activeTab === 'customers' && <CustomersView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'dashboard' && (isOwner ? <DashboardView /> : <PosView />)}
          {activeTab === 'settings' && (isOwner ? <SettingsView /> : <PosView />)}
          {activeTab === 'admin' && (isPlatformAdminUnlocked ? <PlatformAdminView /> : <PosView />)}
        </main>
      </div>

      {/* Bottom Mobile Navigation for Phone Screens */}
      <MobileNav />

      {/* Master Admin PIN Modal */}
      <AdminPinModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
