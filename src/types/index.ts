export type UserRole = 'owner' | 'cashier' | 'stock_manager' | 'admin';

export type NavigationTab = 'pos' | 'products' | 'stock' | 'customers' | 'expenses' | 'dashboard' | 'settings' | 'admin';

export type PaymentMethod = 'cash' | 'orange_money' | 'moov_money' | 'wave_coris' | 'credit' | 'split';

export type StockMovementType = 'in_purchase' | 'out_manual' | 'sale' | 'return_customer' | 'damaged_loss' | 'inventory_adjustment';

export type ExpenseCategory = 
  | 'transport'
  | 'rent'
  | 'salaries'
  | 'electricity_sonabel'
  | 'water_onea'
  | 'communication'
  | 'goods_purchase'
  | 'repairs'
  | 'taxes'
  | 'other';

export interface Business {
  id: string;
  name: string;
  ownerId: string;
  phone: string;
  city: string;
  sector: string;
  ifu?: string;
  currency: string; // e.g. "FCFA"
  receiptFooter?: string;
  address?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  role: UserRole;
  pin?: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  unit: string; // e.g. "Pièce", "Carton", "Paquet", "Kg", "Litre", "Bouteille"
  purchasePrice: number;
  salePrice: number;
  currentStock: number;
  alertThreshold: number;
  supplier?: string;
  archived: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number; // in FCFA or calculated
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  subtotal: number;
  totalCost: number;
}

export interface Sale {
  id: string;
  businessId: string;
  receiptNumber: string;
  sellerId: string;
  sellerName: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
  profit: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: {
    cash?: number;
    orangeMoney?: number;
    moovMoney?: number;
    waveCoris?: number;
    credit?: number;
  };
  notes?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  address?: string;
  totalDebt: number;
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  recordedBy: string;
  recordedByName: string;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  customCategory?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  beneficiary: string;
  recordedBy: string;
  recordedByName: string;
  notes?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'danger';
  timestamp: string;
  read: boolean;
  linkTab?: NavigationTab;
}

export interface BusinessSummary {
  todaySales: number;
  todaySalesCount: number;
  todayProfit: number;
  todayExpenses: number;
  weekSales: number;
  monthSales: number;
  monthProfit: number;
  monthExpenses: number;
  totalPendingDebts: number;
  lowStockCount: number;
  outOfStockCount: number;
}
