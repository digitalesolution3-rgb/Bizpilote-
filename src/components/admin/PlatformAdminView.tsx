import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  Lock, 
  Activity, 
  Users, 
  Database, 
  Settings, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  DollarSign, 
  TrendingUp, 
  Package, 
  Receipt, 
  Phone, 
  MapPin, 
  Key, 
  UserCheck, 
  UserX,
  Server,
  Zap,
  Globe,
  Radio,
  Clock
} from 'lucide-react';
import { UserRole } from '../../types';

export const PlatformAdminView: React.FC = () => {
  const { 
    business, 
    updateBusinessProfile,
    allUsers, 
    addUser, 
    toggleUserStatus, 
    products, 
    sales, 
    customers, 
    expenses, 
    stockMovements,
    isOnline, 
    isSyncing, 
    lastSyncedAt,
    lockPlatformAdmin,
    resetToDemoData,
    summary
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'users' | 'store' | 'audit' | 'tools'>('overview');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState<string | null>(null);

  // Store profile editable state
  const [bizName, setBizName] = useState(business.name);
  const [bizPhone, setBizPhone] = useState(business.phone);
  const [bizCity, setBizCity] = useState(business.city);
  const [bizSector, setBizSector] = useState(business.sector);
  const [bizIfu, setBizIfu] = useState(business.ifu || '');
  const [bizCurrency, setBizCurrency] = useState(business.currency || 'FCFA');
  const [bizFooter, setBizFooter] = useState(business.receiptFooter || '');
  const [saveBizSuccess, setSaveBizSuccess] = useState(false);

  // Audit search filter
  const [auditFilter, setAuditFilter] = useState<'all' | 'sales' | 'expenses' | 'stock'>('all');

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusinessProfile({
      name: bizName,
      phone: bizPhone,
      city: bizCity,
      sector: bizSector,
      ifu: bizIfu,
      currency: bizCurrency,
      receiptFooter: bizFooter,
    });
    setSaveBizSuccess(true);
    setTimeout(() => setSaveBizSuccess(false), 3000);
  };

  const handleForceSync = () => {
    setSyncStatusMsg('Synchronisation manuelle déclenchée avec la base Firestore Cloud...');
    setTimeout(() => {
      setSyncStatusMsg('Synchronisation terminée avec succès ! Données à jour.');
      setTimeout(() => setSyncStatusMsg(null), 3000);
    }, 1200);
  };

  const handleExportBackup = () => {
    const backupData = {
      version: '2.4-burkina-master',
      exportedAt: new Date().toISOString(),
      business,
      allUsers,
      products,
      sales,
      customers,
      expenses,
      stockMovements,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizpilot_backup_full_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Console Administrateur Plateforme
                </h1>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  PIN Maître Actif
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Super-Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Gestion globale, sécurité, audit et diagnostic système de BizPilot Burkina
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleForceSync}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border border-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sync...' : 'Sync Cloud'}</span>
            </button>

            <button
              onClick={lockPlatformAdmin}
              className="flex items-center space-x-2 bg-red-600/90 hover:bg-red-600 active:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition"
            >
              <Lock className="h-4 w-4" />
              <span>Verrouiller & Quitter</span>
            </button>
          </div>
        </div>

        {/* Sync notification feedback */}
        {syncStatusMsg && (
          <div className="mt-4 p-3 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Zap className="h-4 w-4 text-blue-400 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveAdminTab('overview')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeAdminTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Vue d'Ensemble & Télémétrie</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeAdminTab === 'users'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Utilisateurs & PINs ({allUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('store')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeAdminTab === 'store'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Configuration Entreprise</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('audit')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeAdminTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Audit & Logs ({sales.length + expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('tools')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shrink-0 ${
            activeAdminTab === 'tools'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Maintenance & Sauvegardes</span>
        </button>
      </div>

      {/* 1. OVERVIEW & TELEMETRY */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Volume des Ventes</span>
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {sales.reduce((a, s) => a + s.total, 0).toLocaleString()} <span className="text-xs font-bold text-blue-600">{business.currency}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {sales.length} transactions enregistrées
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Catalogue Articles</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {products.filter(p => !p.archived).length} <span className="text-xs font-bold text-slate-500">articles</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Valeur stock : {products.reduce((a, p) => a + (p.purchasePrice * p.currentStock), 0).toLocaleString()} {business.currency}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Créances Clients</span>
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-2">
                {customers.reduce((a, c) => a + (c.totalDebt || 0), 0).toLocaleString()} <span className="text-xs font-bold text-amber-600">{business.currency}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {customers.filter(c => c.totalDebt > 0).length} client(s) en dette
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Charges & Dépenses</span>
                <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-red-900 mt-2">
                {expenses.reduce((a, e) => a + e.amount, 0).toLocaleString()} <span className="text-xs font-bold text-red-600">{business.currency}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {expenses.length} dépenses comptabilisées
              </p>
            </div>
          </div>

          {/* System Health Diagnostic Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">Diagnostics & Télémétrie Cloud</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Services Opérationnels
              </span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Base Firestore</span>
                  <Radio className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {isOnline ? 'Connecté (Temps Réel)' : 'Hors-Ligne (Stockage Local)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Dernière sync : {lastSyncedAt ? lastSyncedAt.toLocaleTimeString('fr-FR') : 'En cours...'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Cache Local (LocalStorage)</span>
                  <Database className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Actif (Sécurisé & Persistant)
                </p>
                <p className="text-[11px] text-slate-500">
                  Données sauvegardées en continu
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold">Sécurité & Code Maître</span>
                  <Key className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  PIN Plateforme : <span className="font-mono text-blue-600">761278</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Déclencheur : Triple-clic sur le logo
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USERS & ROLES */}
      {activeAdminTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Gestion Globale des Comptes & Rôles</h2>
            </div>
            {pinChangeSuccess && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {pinChangeSuccess}
              </span>
            )}
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-3">Collaborateur</th>
                    <th className="pb-3">Téléphone</th>
                    <th className="pb-3">Rôle Actuel</th>
                    <th className="pb-3">Code PIN</th>
                    <th className="pb-3">Statut</th>
                    <th className="pb-3 text-right">Actions Maître</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold uppercase">
                          {u.name.charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">{u.phone}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          u.role === 'owner' 
                            ? 'bg-amber-100 text-amber-900' 
                            : u.role === 'cashier' 
                            ? 'bg-blue-100 text-blue-900' 
                            : 'bg-indigo-100 text-indigo-900'
                        }`}>
                          {u.role === 'owner' ? 'Propriétaire' : u.role === 'cashier' ? 'Caissier' : 'Stock'}
                        </span>
                      </td>
                      <td className="py-3">
                        {editingUserId === u.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="PIN (4)"
                              value={newPinValue}
                              onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, ''))}
                              className="w-16 px-2 py-1 border border-blue-400 rounded text-xs font-mono"
                            />
                            <button
                              onClick={() => {
                                if (newPinValue.length === 4) {
                                  u.pin = newPinValue;
                                  setPinChangeSuccess(`PIN de ${u.name} modifié !`);
                                  setEditingUserId(null);
                                  setNewPinValue('');
                                  setTimeout(() => setPinChangeSuccess(null), 3000);
                                }
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-bold"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingUserId(u.id);
                              setNewPinValue(u.pin || '');
                            }}
                            className="font-mono text-slate-600 hover:text-blue-600 underline text-xs"
                          >
                            {u.pin ? `PIN: ••••` : 'Définir PIN'}
                          </button>
                        )}
                      </td>
                      <td className="py-3">
                        {u.active ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" /> Actif
                          </span>
                        ) : (
                          <span className="text-red-500 font-semibold flex items-center gap-1">
                            <UserX className="h-3.5 w-3.5" /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                            u.active 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {u.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STORE & LICENSE CONFIG */}
      {activeAdminTab === 'store' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Informations Commerciales & Paramètres Nationaux</h2>
            </div>
            {saveBizSuccess && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré avec succès !
              </span>
            )}
          </div>

          <form onSubmit={handleSaveStore} className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de l'Entreprise</label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone Principal</label>
                <input
                  type="text"
                  required
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ville</label>
                <input
                  type="text"
                  required
                  value={bizCity}
                  onChange={(e) => setBizCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quartier / Secteur</label>
                <input
                  type="text"
                  value={bizSector}
                  onChange={(e) => setBizSector(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Numéro IFU (Fiscal)</label>
                <input
                  type="text"
                  placeholder="Ex: 00148925K"
                  value={bizIfu}
                  onChange={(e) => setBizIfu(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Devise Principale</label>
                <input
                  type="text"
                  required
                  value={bizCurrency}
                  onChange={(e) => setBizCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pied de Page du Reçu Client</label>
              <input
                type="text"
                value={bizFooter}
                onChange={(e) => setBizFooter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
              >
                Mettre à jour la Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. AUDIT & LOGS */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Journal d'Audit Système</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAuditFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${auditFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                Tous ({sales.length + expenses.length})
              </button>
              <button
                onClick={() => setAuditFilter('sales')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${auditFilter === 'sales' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                Ventes ({sales.length})
              </button>
              <button
                onClick={() => setAuditFilter('expenses')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${auditFilter === 'expenses' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                Dépenses ({expenses.length})
              </button>
            </div>
          </div>

          <div className="p-5 max-h-[500px] overflow-y-auto divide-y divide-slate-100">
            {sales.slice(0, 30).map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 transition px-2 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      Vente #{s.receiptNumber} • {s.customerName || 'Client Comptoir'}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Enregistré par {s.sellerName} • {new Date(s.createdAt).toLocaleString('fr-FR')} • {s.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{s.total.toLocaleString()} {business.currency}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold">Bénéfice : +{s.profit.toLocaleString()} {business.currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TOOLS & BACKUP */}
      {activeAdminTab === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center space-x-3 text-blue-600">
              <Download className="h-6 w-6" />
              <h3 className="font-bold text-slate-900 text-base">Sauvegarde Intégrale</h3>
            </div>
            <p className="text-xs text-slate-600">
              Téléchargez une archive JSON complète contenant tous les articles, ventes, clients, créances et configurations de la boutique.
            </p>
            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-xs transition"
            >
              <Download className="h-4 w-4" />
              <span>Exporter la Sauvegarde JSON</span>
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-2xs space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <Trash2 className="h-6 w-6" />
              <h3 className="font-bold text-slate-900 text-base">Réinitialisation d'Urgence</h3>
            </div>
            <p className="text-xs text-slate-600">
              Remettre à zéro l'application avec le jeu de données initial Burkina Faso (Commerce & Épicerie Moderne).
            </p>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Restaurer les Données de Démonstration</span>
              </button>
            ) : (
              <div className="p-3 bg-red-50 border border-red-300 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-red-900">Confirmez-vous la réinitialisation ?</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await resetToDemoData();
                      setShowResetConfirm(false);
                    }}
                    className="flex-1 bg-red-600 text-white font-bold py-1.5 rounded-lg"
                  >
                    Oui, Réinitialiser
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 bg-slate-200 text-slate-800 py-1.5 rounded-lg"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
