import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { 
  Settings, 
  Store, 
  Users, 
  Database, 
  ShieldCheck, 
  Save, 
  Plus, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Lock,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    business, 
    updateBusinessProfile, 
    allUsers, 
    addUser, 
    toggleUserStatus, 
    resetToDemoData,
    products,
    sales,
    customers,
    expenses,
    stockMovements
  } = useApp();

  // Business Profile Form State
  const [bizName, setBizName] = useState(business.name);
  const [bizPhone, setBizPhone] = useState(business.phone);
  const [bizCity, setBizCity] = useState(business.city);
  const [bizSector, setBizSector] = useState(business.sector);
  const [bizIfu, setBizIfu] = useState(business.ifu || '');
  const [bizReceiptFooter, setBizReceiptFooter] = useState(business.receiptFooter || '');
  const [bizSaved, setBizSaved] = useState(false);

  // New User Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('+226 ');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPin, setNewUserPin] = useState('0000');

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusinessProfile({
      name: bizName.trim(),
      phone: bizPhone.trim(),
      city: bizCity.trim(),
      sector: bizSector.trim(),
      ifu: bizIfu.trim() || undefined,
      receiptFooter: bizReceiptFooter.trim() || undefined,
    });
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 3000);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPhone.trim()) return;

    await addUser({
      name: newUserName.trim(),
      phone: newUserPhone.trim(),
      role: newUserRole,
      pin: newUserPin.trim(),
    });

    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserPhone('+226 ');
    setNewUserPin('0000');
  };

  const handleExportData = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      business,
      products,
      sales,
      customers,
      expenses,
      stockMovements,
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `bizpilot_backup_${business.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleResetData = async () => {
    if (window.confirm('Voulez-vous réinitialiser les données avec le jeu de démonstration complet pour le commerce burkinabè ?')) {
      await resetToDemoData();
      alert('Données de démonstration restaurées avec succès.');
      window.location.reload();
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8 pb-16">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Paramètres de l'Entreprise & Équipe
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configuration des coordonnées commerciales, gestion des employés et sauvegarde des données.
        </p>
      </div>

      {/* 1. Profil Entreprise & Reçu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Store className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Informations Commerciales & Reçus</h2>
          </div>
          {bizSaved && (
            <span className="text-xs text-blue-700 font-bold flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded-md animate-in fade-in">
              <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré !
            </span>
          )}
        </div>

        <form onSubmit={handleSaveBusiness} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom Commercial de la Boutique *</label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone Principal (Contact Reçu) *</label>
              <input
                type="text"
                required
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ville & Quartier *</label>
              <input
                type="text"
                required
                value={bizCity}
                onChange={(e) => setBizCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Secteur d'Activité</label>
              <input
                type="text"
                value={bizSector}
                onChange={(e) => setBizSector(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Numéro IFU (Identifiant Fiscal Unique)</label>
              <input
                type="text"
                placeholder="Ex: 00148925K"
                value={bizIfu}
                onChange={(e) => setBizIfu(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Devise Principale</label>
              <input
                type="text"
                disabled
                value="FCFA (Franc CFA de l'Afrique de l'Ouest - XOF)"
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Message personnalisé imprimé en bas des reçus</label>
            <input
              type="text"
              value={bizReceiptFooter}
              onChange={(e) => setBizReceiptFooter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition"
            >
              <Save className="h-4 w-4" />
              <span>Enregistrer les Modifications</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Gestion des Employés & Rôles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Collaborateurs & Permissions</h2>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Inviter un Employé</span>
          </button>
        </div>

        <div className="p-5 divide-y divide-slate-100">
          {allUsers.map(u => (
            <div key={u.id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                  u.role === 'owner' ? 'bg-amber-600' : u.role === 'cashier' ? 'bg-blue-600' : 'bg-slate-700'
                }`}>
                  {u.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{u.name}</p>
                  <p className="text-[11px] text-slate-500">{u.phone}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  u.role === 'owner' 
                    ? 'bg-amber-100 text-amber-900' 
                    : u.role === 'cashier' 
                    ? 'bg-blue-100 text-blue-900' 
                    : 'bg-indigo-100 text-indigo-900'
                }`}>
                  {u.role === 'owner' ? 'Propriétaire (Gérant)' : u.role === 'cashier' ? 'Vendeur / Caissier' : 'Gestionnaire Stock'}
                </span>

                {u.role !== 'owner' && (
                  <button
                    onClick={() => toggleUserStatus(u.id)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded ${
                      u.active ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {u.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Sauvegarde & Maintenance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Sauvegarde & Restauration</h2>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <p className="font-bold text-slate-900">Exporter les données de la boutique</p>
              <p className="text-slate-500 text-[11px]">Téléchargez une copie JSON complète (produits, ventes, clients, dépenses).</p>
            </div>
            <button
              onClick={handleExportData}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-black text-white px-3.5 py-2 rounded-xl font-semibold text-xs transition shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Exporter Sauvegarde</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <div>
              <p className="font-bold text-amber-950">Données de Démonstration (Ouagadougou)</p>
              <p className="text-amber-800 text-[11px]">Recharger le catalogue type, l'historique de ventes et les créances burkinabè.</p>
            </div>
            <button
              onClick={handleResetData}
              className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs transition shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Recharger Démo</span>
            </button>
          </div>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base">Ajouter un Collaborateur</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom Complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aminata Kaboré"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de Téléphone *</label>
                <input
                  type="tel"
                  required
                  placeholder="+226 70..."
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rôle et Permissions *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cashier">Vendeur / Caissier (Caisse, Reçus, sans accès aux bénéfices)</option>
                  <option value="stock_manager">Gestionnaire de Stock (Entrées/Sorties, Inventaire)</option>
                  <option value="owner">Propriétaire / Gérant (Accès complet)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code PIN de Caisse (4 chiffres)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs"
                >
                  Ajouter l'Employé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
