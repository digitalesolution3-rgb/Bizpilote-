import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Business, 
  AppUser, 
  Product, 
  Sale, 
  Customer, 
  CustomerPayment, 
  Expense, 
  StockMovement, 
  NotificationItem, 
  CartItem, 
  PaymentMethod, 
  UserRole,
  BusinessSummary,
  StockMovementType,
  ExpenseCategory,
  NavigationTab
} from '../types';
import { 
  initialBusiness, 
  initialUsers, 
  initialProducts, 
  initialCustomers, 
  initialExpenses, 
  initialSales, 
  initialStockMovements 
} from '../data/initialDemoData';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';

interface AppContextType {
  business: Business;
  currentUser: AppUser;
  allUsers: AppUser[];
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  expenses: Expense[];
  stockMovements: StockMovement[];
  notifications: NotificationItem[];
  cart: CartItem[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  activeTab: NavigationTab;
  
  // Tab & User Switchers
  setActiveTab: (tab: NavigationTab) => void;
  switchUser: (userId: string) => void;
  updateBusinessProfile: (updates: Partial<Business>) => Promise<void>;

  // Platform Admin (Triple Click & Master PIN 761278)
  isPlatformAdminUnlocked: boolean;
  showAdminPinModal: boolean;
  setShowAdminPinModal: (show: boolean) => void;
  unlockPlatformAdmin: (pin: string) => boolean;
  lockPlatformAdmin: () => void;
  handleLogoClick: () => void;

  // Cart operations
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemDiscount: (productId: string, discount: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  
  // Transaction operations
  completeSale: (
    paymentMethod: PaymentMethod,
    customerId?: string,
    customerName?: string,
    overallDiscount?: number,
    splitDetails?: { cash?: number; orangeMoney?: number; moovMoney?: number; waveCoris?: number; credit?: number; },
    notes?: string
  ) => Promise<Sale>;

  // Product & Stock operations
  addProduct: (productData: Omit<Product, 'id' | 'businessId' | 'createdAt'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
  recordStockMovement: (
    productId: string,
    type: StockMovementType,
    quantity: number,
    reason: string
  ) => Promise<void>;

  // Customer & Credit operations
  addCustomer: (customerData: Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'totalDebt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => Promise<void>;

  // Expense operations
  addExpense: (expenseData: {
    category: ExpenseCategory;
    customCategory?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    beneficiary: string;
    notes?: string;
  }) => Promise<Expense>;

  // User management
  addUser: (userData: Omit<AppUser, 'id' | 'businessId' | 'createdAt' | 'active'>) => Promise<AppUser>;
  toggleUserStatus: (id: string) => Promise<void>;

  // Metrics & Notifications
  summary: BusinessSummary;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  resetToDemoData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'bizpilot_burkina_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved state or fallback
  const getInitialStorage = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
    return null;
  };

  const initialCached = getInitialStorage();

  const [business, setBusiness] = useState<Business>(initialCached?.business || initialBusiness);
  const [allUsers, setAllUsers] = useState<AppUser[]>(initialCached?.allUsers || initialUsers);
  const [currentUser, setCurrentUser] = useState<AppUser>(
    initialCached?.currentUser || initialUsers.find(u => u.role === 'owner') || initialUsers[0]
  );
  const [products, setProducts] = useState<Product[]>(initialCached?.products || initialProducts);
  const [sales, setSales] = useState<Sale[]>(initialCached?.sales || initialSales);
  const [customers, setCustomers] = useState<Customer[]>(initialCached?.customers || initialCustomers);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(initialCached?.customerPayments || []);
  const [expenses, setExpenses] = useState<Expense[]>(initialCached?.expenses || initialExpenses);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(initialCached?.stockMovements || initialStockMovements);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  
  // Platform Admin state
  const [isPlatformAdminUnlocked, setIsPlatformAdminUnlocked] = useState<boolean>(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const logoClicksRef = React.useRef<{ count: number; timer: NodeJS.Timeout | null }>({ count: 0, timer: null });

  const PLATFORM_ADMIN_PIN = '761278';

  const unlockPlatformAdmin = useCallback((pin: string): boolean => {
    if (pin.trim() === PLATFORM_ADMIN_PIN) {
      setIsPlatformAdminUnlocked(true);
      setShowAdminPinModal(false);
      setActiveTab('admin');
      return true;
    }
    return false;
  }, []);

  const lockPlatformAdmin = useCallback(() => {
    setIsPlatformAdminUnlocked(false);
    setActiveTab(prev => (prev === 'admin' ? 'pos' : prev));
  }, []);

  const handleLogoClick = useCallback(() => {
    if (logoClicksRef.current.timer) {
      clearTimeout(logoClicksRef.current.timer);
    }
    
    logoClicksRef.current.count += 1;
    
    if (logoClicksRef.current.count >= 3) {
      logoClicksRef.current.count = 0;
      if (isPlatformAdminUnlocked) {
        setActiveTab('admin');
      } else {
        setShowAdminPinModal(true);
      }
    } else {
      logoClicksRef.current.timer = setTimeout(() => {
        logoClicksRef.current.count = 0;
      }, 700);
    }
  }, [isPlatformAdminUnlocked]);

  // Save to localStorage whenever core state updates
  useEffect(() => {
    const dataToSave = {
      business,
      allUsers,
      currentUser,
      products,
      sales,
      customers,
      customerPayments,
      expenses,
      stockMovements,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (err) {
      console.warn('LocalStorage limit reached or disabled:', err);
    }
  }, [business, allUsers, currentUser, products, sales, customers, customerPayments, expenses, stockMovements]);

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!isOnline) return;

    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeSales: (() => void) | undefined;
    let unsubscribeCustomers: (() => void) | undefined;
    let unsubscribeExpenses: (() => void) | undefined;

    const setupFirestoreSync = async () => {
      try {
        setIsSyncing(true);
        // Products listener
        const prodCol = collection(db, 'products');
        unsubscribeProducts = onSnapshot(prodCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Product[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Product);
            });
            setProducts(list);
          }
        }, (err) => console.log('Firestore snapshot fallback:', err.message));

        // Sales listener
        const salesCol = collection(db, 'sales');
        unsubscribeSales = onSnapshot(salesCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Sale[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Sale);
            });
            setSales(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => console.log('Firestore snapshot fallback:', err.message));

        // Customers listener
        const custCol = collection(db, 'customers');
        unsubscribeCustomers = onSnapshot(custCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Customer[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
            });
            setCustomers(list);
          }
        }, (err) => console.log('Firestore snapshot fallback:', err.message));

        // Expenses listener
        const expCol = collection(db, 'expenses');
        unsubscribeExpenses = onSnapshot(expCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Expense[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Expense);
            });
            setExpenses(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => console.log('Firestore snapshot fallback:', err.message));

        setLastSyncedAt(new Date());
        setIsSyncing(false);
      } catch (e) {
        console.warn('Initial Firestore sync error:', e);
        setIsSyncing(false);
      }
    };

    setupFirestoreSync();

    return () => {
      unsubscribeProducts?.();
      unsubscribeSales?.();
      unsubscribeCustomers?.();
      unsubscribeExpenses?.();
    };
  }, [isOnline]);

  // Generate automated alerts for stock and overdue debts
  useEffect(() => {
    const alerts: NotificationItem[] = [];

    // Stock alerts
    products.forEach(p => {
      if (!p.archived) {
        if (p.currentStock <= 0) {
          alerts.push({
            id: `notif_stock_zero_${p.id}`,
            title: `Rupture de Stock : ${p.name}`,
            message: `Le stock est épuisé (0 ${p.unit}). Prévoyez un réapprovisionnement d'urgence.`,
            type: 'danger',
            timestamp: new Date().toISOString(),
            read: false,
            linkTab: 'stock',
          });
        } else if (p.currentStock <= p.alertThreshold) {
          alerts.push({
            id: `notif_stock_low_${p.id}`,
            title: `Stock Faible : ${p.name}`,
            message: `Il ne reste que ${p.currentStock} ${p.unit} (Seuil d'alerte: ${p.alertThreshold}).`,
            type: 'warning',
            timestamp: new Date().toISOString(),
            read: false,
            linkTab: 'stock',
          });
        }
      }
    });

    // Overdue credit alerts
    const todayStr = new Date().toISOString().split('T')[0];
    customers.forEach(c => {
      if (c.totalDebt > 0 && c.dueDate && c.dueDate < todayStr) {
        alerts.push({
          id: `notif_debt_overdue_${c.id}`,
          title: `Échéance de crédit dépassée`,
          message: `${c.name} doit ${c.totalDebt.toLocaleString()} ${business.currency} (Échéance: ${c.dueDate}). Envoyer un rappel WhatsApp.`,
          type: 'danger',
          timestamp: new Date().toISOString(),
          read: false,
          linkTab: 'customers',
        });
      }
    });

    setNotifications(alerts);
  }, [products, customers, business.currency]);

  // Switch active user
  const switchUser = (userId: string) => {
    const found = allUsers.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  };

  // Update business profile
  const updateBusinessProfile = async (updates: Partial<Business>) => {
    const updated = { ...business, ...updates };
    setBusiness(updated);
    if (isOnline) {
      try {
        await setDoc(doc(db, 'businesses', business.id), updated, { merge: true });
      } catch (err) {
        console.warn('Could not sync business profile to cloud:', err);
      }
    }
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prev, { product, quantity, unitPrice: product.salePrice, discount: 0 }];
      }
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const updateCartItemDiscount = (productId: string, discount: number) => {
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, discount: Math.max(0, discount) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Complete a sale
  const completeSale = async (
    paymentMethod: PaymentMethod,
    customerId?: string,
    customerName?: string,
    overallDiscount = 0,
    splitDetails?: { cash?: number; orangeMoney?: number; moovMoney?: number; waveCoris?: number; credit?: number; },
    notes?: string
  ): Promise<Sale> => {
    if (cart.length === 0) {
      throw new Error('Le panier est vide');
    }

    const saleItems = cart.map(item => {
      const itemSubtotal = (item.unitPrice * item.quantity) - (item.discount || 0);
      const itemCost = item.product.purchasePrice * item.quantity;
      return {
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        purchasePrice: item.product.purchasePrice,
        subtotal: itemSubtotal,
        totalCost: itemCost,
      };
    });

    const subtotal = saleItems.reduce((acc, curr) => acc + curr.subtotal, 0);
    const total = Math.max(0, subtotal - overallDiscount);
    const totalCost = saleItems.reduce((acc, curr) => acc + curr.totalCost, 0);
    const profit = total - totalCost;

    const receiptNumber = `BZ-${new Date().getFullYear()}-${String(sales.length + 1).padStart(3, '0')}`;
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const nowIso = new Date().toISOString();

    const newSale: Sale = {
      id: saleId,
      businessId: business.id,
      receiptNumber,
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      customerId,
      customerName: customerName || (customerId ? customers.find(c => c.id === customerId)?.name : 'Client Comptoir'),
      items: saleItems,
      subtotal,
      discount: overallDiscount,
      total,
      totalCost,
      profit,
      paymentMethod,
      paymentBreakdown: splitDetails,
      notes,
      createdAt: nowIso,
    };

    // Update local sales
    setSales(prev => [newSale, ...prev]);

    // 1. Decrement products stock & record stock movements
    const updatedProducts = [...products];
    const newMovements: StockMovement[] = [];

    saleItems.forEach(item => {
      const prodIndex = updatedProducts.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const p = updatedProducts[prodIndex];
        const prevStock = p.currentStock;
        const nextStock = prevStock - item.quantity;
        updatedProducts[prodIndex] = { ...p, currentStock: nextStock };

        newMovements.push({
          id: `mov_${Date.now()}_${item.productId}`,
          businessId: business.id,
          productId: item.productId,
          productName: item.productName,
          type: 'sale',
          quantity: -item.quantity,
          previousStock: prevStock,
          newStock: nextStock,
          reason: `Vente Ticket #${receiptNumber}`,
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: nowIso,
        });
      }
    });

    setProducts(updatedProducts);
    setStockMovements(prev => [...newMovements, ...prev]);

    // 2. If credit sale, increase customer's totalDebt
    if ((paymentMethod === 'credit' || (splitDetails && (splitDetails.credit || 0) > 0)) && customerId) {
      const creditAmount = paymentMethod === 'credit' ? total : (splitDetails?.credit || 0);
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId ? { ...c, totalDebt: c.totalDebt + creditAmount } : c
        )
      );
    }

    // 3. Clear cart
    clearCart();

    // 4. Async Firestore Sync
    if (isOnline) {
      try {
        await setDoc(doc(db, 'sales', saleId), newSale);
        
        // Update product stocks in firestore
        for (const p of updatedProducts) {
          const itemInSale = saleItems.find(si => si.productId === p.id);
          if (itemInSale) {
            await updateDoc(doc(db, 'products', p.id), {
              currentStock: p.currentStock,
            });
          }
        }
      } catch (err) {
        console.warn('Firestore offline fallback for sale:', err);
      }
    }

    return newSale;
  };

  // Add Product
  const addProduct = async (productData: Omit<Product, 'id' | 'businessId' | 'createdAt'>): Promise<Product> => {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const nowIso = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id,
      businessId: business.id,
      createdAt: nowIso,
    };

    setProducts(prev => [newProduct, ...prev]);

    // Initial stock movement
    if (newProduct.currentStock > 0) {
      const initMov: StockMovement = {
        id: `mov_${Date.now()}_init`,
        businessId: business.id,
        productId: id,
        productName: newProduct.name,
        type: 'in_purchase',
        quantity: newProduct.currentStock,
        previousStock: 0,
        newStock: newProduct.currentStock,
        reason: 'Stock initial à la création du produit',
        userId: currentUser.id,
        userName: currentUser.name,
        createdAt: nowIso,
      };
      setStockMovements(prev => [initMov, ...prev]);
    }

    if (isOnline) {
      try {
        await setDoc(doc(db, 'products', id), newProduct);
      } catch (err) {
        console.warn('Firestore offline fallback for add product:', err);
      }
    }

    return newProduct;
  };

  // Update Product
  const updateProduct = async (id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );

    if (isOnline) {
      try {
        await updateDoc(doc(db, 'products', id), updates);
      } catch (err) {
        console.warn('Firestore error updating product:', err);
      }
    }
  };

  // Archive Product (Safe delete preventing broken sales history)
  const archiveProduct = async (id: string) => {
    await updateProduct(id, { archived: true });
  };

  // Record manual stock movement (In, Out, Damage, Adjustment)
  const recordStockMovement = async (
    productId: string,
    type: StockMovementType,
    quantity: number,
    reason: string
  ) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    const prevStock = targetProduct.currentStock;
    const nextStock = prevStock + quantity;
    const nowIso = new Date().toISOString();

    const newMovement: StockMovement = {
      id: `mov_${Date.now()}`,
      businessId: business.id,
      productId,
      productName: targetProduct.name,
      type,
      quantity,
      previousStock: prevStock,
      newStock: nextStock,
      reason,
      userId: currentUser.id,
      userName: currentUser.name,
      createdAt: nowIso,
    };

    setStockMovements(prev => [newMovement, ...prev]);
    await updateProduct(productId, { currentStock: nextStock });

    if (isOnline) {
      try {
        await setDoc(doc(db, 'stock_movements', newMovement.id), newMovement);
      } catch (e) {
        console.warn('Firestore stock movement error:', e);
      }
    }
  };

  // Add Customer
  const addCustomer = async (customerData: Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'totalDebt'>): Promise<Customer> => {
    const id = `cust_${Date.now()}`;
    const newCust: Customer = {
      ...customerData,
      id,
      businessId: business.id,
      totalDebt: 0,
      createdAt: new Date().toISOString(),
    };

    setCustomers(prev => [...prev, newCust]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'customers', id), newCust);
      } catch (e) {
        console.warn('Firestore add customer error:', e);
      }
    }

    return newCust;
  };

  // Update Customer
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );

    if (isOnline) {
      try {
        await updateDoc(doc(db, 'customers', id), updates);
      } catch (e) {
        console.warn('Firestore update customer error:', e);
      }
    }
  };

  // Record customer repayment
  const recordCustomerPayment = async (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;

    const paymentId = `pay_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newPayment: CustomerPayment = {
      id: paymentId,
      businessId: business.id,
      customerId,
      customerName: cust.name,
      amount,
      paymentMethod,
      recordedBy: currentUser.id,
      recordedByName: currentUser.name,
      notes,
      createdAt: nowIso,
    };

    const newDebt = Math.max(0, cust.totalDebt - amount);

    setCustomerPayments(prev => [newPayment, ...prev]);
    await updateCustomer(customerId, { totalDebt: newDebt });

    if (isOnline) {
      try {
        await setDoc(doc(db, 'customer_payments', paymentId), newPayment);
      } catch (e) {
        console.warn('Firestore record payment error:', e);
      }
    }
  };

  // Add Expense
  const addExpense = async (expenseData: {
    category: ExpenseCategory;
    customCategory?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    beneficiary: string;
    notes?: string;
  }): Promise<Expense> => {
    const id = `exp_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newExp: Expense = {
      ...expenseData,
      id,
      businessId: business.id,
      recordedBy: currentUser.id,
      recordedByName: currentUser.name,
      createdAt: nowIso,
    };

    setExpenses(prev => [newExp, ...prev]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'expenses', id), newExp);
      } catch (e) {
        console.warn('Firestore add expense error:', e);
      }
    }

    return newExp;
  };

  // Add User
  const addUser = async (userData: Omit<AppUser, 'id' | 'businessId' | 'createdAt' | 'active'>): Promise<AppUser> => {
    const id = `usr_${Date.now()}`;
    const newUser: AppUser = {
      ...userData,
      id,
      businessId: business.id,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setAllUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const toggleUserStatus = async (id: string) => {
    setAllUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, active: !u.active } : u))
    );
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Reset to sample Burkina demo dataset
  const resetToDemoData = async () => {
    setBusiness(initialBusiness);
    setAllUsers(initialUsers);
    setCurrentUser(initialUsers[0]);
    setProducts(initialProducts);
    setSales(initialSales);
    setCustomers(initialCustomers);
    setExpenses(initialExpenses);
    setStockMovements(initialStockMovements);
    setCustomerPayments([]);
    setCart([]);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  // Compute live Business Summary
  const summary: BusinessSummary = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let todaySales = 0;
    let todaySalesCount = 0;
    let todayProfit = 0;
    let weekSales = 0;
    let monthSales = 0;
    let monthProfit = 0;

    sales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      const saleDateStr = sale.createdAt.split('T')[0];

      if (saleDateStr === todayStr) {
        todaySales += sale.total;
        todaySalesCount += 1;
        todayProfit += sale.profit;
      }
      if (saleDate >= sevenDaysAgo) {
        weekSales += sale.total;
      }
      if (saleDate >= thirtyDaysAgo) {
        monthSales += sale.total;
        monthProfit += sale.profit;
      }
    });

    let todayExpenses = 0;
    let monthExpenses = 0;
    expenses.forEach(exp => {
      const expDate = new Date(exp.createdAt);
      const expDateStr = exp.createdAt.split('T')[0];
      if (expDateStr === todayStr) {
        todayExpenses += exp.amount;
      }
      if (expDate >= thirtyDaysAgo) {
        monthExpenses += exp.amount;
      }
    });

    const totalPendingDebts = customers.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
    const lowStockCount = products.filter(p => !p.archived && p.currentStock > 0 && p.currentStock <= p.alertThreshold).length;
    const outOfStockCount = products.filter(p => !p.archived && p.currentStock <= 0).length;

    return {
      todaySales,
      todaySalesCount,
      todayProfit: todayProfit - todayExpenses,
      todayExpenses,
      weekSales,
      monthSales,
      monthProfit: monthProfit - monthExpenses,
      monthExpenses,
      totalPendingDebts,
      lowStockCount,
      outOfStockCount,
    };
  }, [sales, expenses, customers, products]);

  return (
    <AppContext.Provider
      value={{
        business,
        currentUser,
        allUsers,
        products,
        sales,
        customers,
        customerPayments,
        expenses,
        stockMovements,
        notifications,
        cart,
        isOnline,
        isSyncing,
        lastSyncedAt,
        activeTab,
        setActiveTab,
        switchUser,
        updateBusinessProfile,
        isPlatformAdminUnlocked,
        showAdminPinModal,
        setShowAdminPinModal,
        unlockPlatformAdmin,
        lockPlatformAdmin,
        handleLogoClick,
        addToCart,
        updateCartQuantity,
        updateCartItemDiscount,
        removeFromCart,
        clearCart,
        completeSale,
        addProduct,
        updateProduct,
        archiveProduct,
        recordStockMovement,
        addCustomer,
        updateCustomer,
        recordCustomerPayment,
        addExpense,
        addUser,
        toggleUserStatus,
        summary,
        markNotificationAsRead,
        clearAllNotifications,
        resetToDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
