import React from 'react';
import { Sale, Business } from '../../types';
import { 
  X, 
  Printer, 
  Share2, 
  CheckCircle, 
  MessageCircle, 
  Download,
  Calendar,
  User,
  CreditCard,
  Phone
} from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  business: Business;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, business, onClose }) => {
  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèces (Cash)';
      case 'orange_money': return 'Orange Money (OM)';
      case 'moov_money': return 'Moov Money';
      case 'wave_coris': return 'Wave / Coris Money';
      case 'credit': return 'Vente à Crédit';
      case 'split': return 'Paiement Mixte';
      default: return method;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate WhatsApp preformatted receipt message
  const handleShareWhatsApp = () => {
    const dateFormatted = new Date(sale.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let itemsText = sale.items
      .map(item => `• ${item.quantity}x ${item.productName} = ${item.subtotal.toLocaleString()} ${business.currency}`)
      .join('\n');

    let text = `🧾 *REÇU DE VENTE - ${business.name.toUpperCase()}*\n`;
    text += `N° Ticket : *${sale.receiptNumber}*\n`;
    text += `Date : ${dateFormatted}\n`;
    text += `Caissier : ${sale.sellerName}\n`;
    if (sale.customerName && sale.customerName !== 'Client Comptoir') {
      text += `Client : ${sale.customerName}\n`;
    }
    text += `--------------------------------\n`;
    text += `*DÉTAILS DES ACHATS :*\n${itemsText}\n`;
    text += `--------------------------------\n`;
    if (sale.discount > 0) {
      text += `Sous-total : ${sale.subtotal.toLocaleString()} ${business.currency}\n`;
      text += `Remise accordée : -${sale.discount.toLocaleString()} ${business.currency}\n`;
    }
    text += `*TOTAL PAYÉ : ${sale.total.toLocaleString()} ${business.currency}*\n`;
    text += `Mode de règlement : ${getPaymentLabel(sale.paymentMethod)}\n`;
    text += `--------------------------------\n`;
    text += `${business.receiptFooter || 'Merci pour votre confiance !'}\n`;
    text += `📞 Contact : ${business.phone}\n`;
    if (business.ifu) text += `N° IFU : ${business.ifu}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-6 w-6 text-emerald-400" />
            <div>
              <h3 className="font-bold text-base">Vente Validée avec Succès</h3>
              <p className="text-xs text-slate-300">Ticket N° {sale.receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Box */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 max-h-[60vh] overflow-y-auto print:max-h-none">
          <div 
            id="thermal-receipt" 
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs font-mono text-xs text-slate-800 space-y-3"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
              <p className="font-extrabold text-sm tracking-wide text-slate-900">{business.name.toUpperCase()}</p>
              <p className="text-[11px] text-slate-600">{business.city}</p>
              <p className="text-[11px] text-slate-600">Tél : {business.phone}</p>
              {business.ifu && <p className="text-[10px] text-slate-500">N° IFU : {business.ifu}</p>}
            </div>

            {/* Meta Info */}
            <div className="space-y-1 text-[11px] text-slate-600 pb-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>N° Ticket :</span>
                <span className="font-bold text-slate-900">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date :</span>
                <span>{new Date(sale.createdAt).toLocaleDateString('fr-FR')} {new Date(sale.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>Caissier :</span>
                <span>{sale.sellerName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span className="font-semibold text-slate-900">{sale.customerName}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
              <div className="flex justify-between font-bold text-[11px] text-slate-900 pb-1">
                <span>Article</span>
                <span>Total</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <div className="pr-2">
                    <p className="font-medium text-slate-900">{item.productName}</p>
                    <p className="text-[10px] text-slate-500">
                      {item.quantity} x {item.unitPrice.toLocaleString()} {business.currency}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900 whitespace-nowrap">
                    {item.subtotal.toLocaleString()} {business.currency}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
              {sale.discount > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Sous-total :</span>
                    <span>{sale.subtotal.toLocaleString()} {business.currency}</span>
                  </div>
                  <div className="flex justify-between text-blue-700 font-semibold">
                    <span>Remise accordée :</span>
                    <span>-{sale.discount.toLocaleString()} {business.currency}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-950 pt-1">
                <span>TOTAL :</span>
                <span>{sale.total.toLocaleString()} {business.currency}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                <span>Règlement :</span>
                <span className="font-semibold text-slate-900">{getPaymentLabel(sale.paymentMethod)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-1 text-[10px] text-slate-500 leading-tight">
              <p>{business.receiptFooter || 'Merci pour votre achat et à très bientôt !'}</p>
              <p className="mt-1 font-bold text-slate-600">BizPilot Burkina • Gestion de Caisse</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-share-whatsapp"
              onClick={handleShareWhatsApp}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 px-3 rounded-xl font-semibold text-xs shadow-xs transition"
            >
              <MessageCircle className="h-4 w-4 text-emerald-100" />
              <span>WhatsApp</span>
            </button>

            <button
              id="btn-print-receipt"
              onClick={handlePrint}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 active:bg-black text-white py-2.5 px-3 rounded-xl font-semibold text-xs shadow-xs transition"
            >
              <Printer className="h-4 w-4 text-slate-200" />
              <span>Imprimer</span>
            </button>
          </div>

          <button
            id="btn-close-receipt"
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-semibold text-xs transition"
          >
            Nouvelle Vente
          </button>
        </div>

      </div>
    </div>
  );
};
