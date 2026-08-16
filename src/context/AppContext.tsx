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
  NavigationTab,
  UserPermissions
} from '../types';
import { 
  initialBusinesses,
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
  deleteDoc,
  onSnapshot, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';

interface AppContextType {
  // Business Multi-Tenant State
  allBusinesses: Business[];
  business: Business;
  isBusinessAuthenticated: boolean;
  authenticateBusiness: (accessCode: string) => { success: boolean; message?: string; business?: Business };
  logoutBusiness: () => void;
  createBusiness: (businessData: Omit<Business, 'id' | 'createdAt'>, ownerPin?: string) => Promise<Business>;
  updateBusiness: (id: string, updates: Partial<Business>) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  regenerateAccessCode: (businessId: string) => Promise<string>;
  switchBusiness: (businessId: string) => void;
  updateBusinessProfile: (updates: Partial<Business>) => Promise<void>;

  // User & Staff Management (Owner -> Cashier/Manager)
  currentUser: AppUser;
  allUsers: AppUser[];
  switchUser: (userId: string) => void;
  userToSwitchWithPin: AppUser | null;
  setUserToSwitchWithPin: (user: AppUser | null) => void;
  requestUserSwitch: (userId: string) => void;
  addUser: (userData: Omit<AppUser, 'id' | 'businessId' | 'createdAt' | 'active'>) => Promise<AppUser>;
  updateUser: (userId: string, updates: Partial<AppUser>) => Promise<void>;
  updateUserPin: (userId: string, newPin: string) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  verifyUserPin: (userId: string, pin: string) => boolean;

  // Products & Inventory
  products: Product[];
  addProduct: (productData: Omit<Product, 'id' | 'businessId' | 'createdAt'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
  recordStockMovement: (
    productId: string,
    type: StockMovementType,
    quantity: number,
    reason: string
  ) => Promise<void>;
  stockMovements: StockMovement[];

  // Sales & Cart
  sales: Sale[];
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemDiscount: (productId: string, discount: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  completeSale: (
    paymentMethod: PaymentMethod,
    customerId?: string,
    customerName?: string,
    overallDiscount?: number,
    splitDetails?: { cash?: number; orangeMoney?: number; moovMoney?: number; waveCoris?: number; credit?: number; },
    notes?: string
  ) => Promise<Sale>;

  // Customers & Debts
  customers: Customer[];
  customerPayments: CustomerPayment[];
  addCustomer: (customerData: Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'totalDebt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  recordCustomerPayment: (
    customerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => Promise<void>;

  // Expenses
  expenses: Expense[];
  addExpense: (expenseData: {
    category: ExpenseCategory;
    customCategory?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    beneficiary: string;
    notes?: string;
  }) => Promise<Expense>;

  // Navigation & Platform Admin
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  isPlatformAdminUnlocked: boolean;
  showAdminPinModal: boolean;
  setShowAdminPinModal: (show: boolean) => void;
  unlockPlatformAdmin: (pin: string) => boolean;
  lockPlatformAdmin: () => void;
  handleLogoClick: () => void;

  // System, Sync & Telemetry
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  notifications: NotificationItem[];
  summary: BusinessSummary;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  resetToDemoData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'bizpilot_burkina_v2';
const PLATFORM_ADMIN_PIN = '761278';

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

  // Multi-Business States
  const [allBusinesses, setAllBusinesses] = useState<Business[]>(
    initialCached?.allBusinesses || initialBusinesses
  );
  
  const [business, setBusiness] = useState<Business>(
    initialCached?.business || initialBusinesses[0]
  );

  const [isBusinessAuthenticated, setIsBusinessAuthenticated] = useState<boolean>(
    initialCached?.isBusinessAuthenticated ?? true
  );

  // Global Multi-tenant Dataset
  const [allUsers, setAllUsers] = useState<AppUser[]>(
    initialCached?.allUsers || initialUsers
  );

  const [currentUser, setCurrentUser] = useState<AppUser>(
    initialCached?.currentUser || initialUsers[0]
  );

  const [products, setProducts] = useState<Product[]>(
    initialCached?.products || initialProducts
  );
  const [sales, setSales] = useState<Sale[]>(
    initialCached?.sales || initialSales
  );
  const [customers, setCustomers] = useState<Customer[]>(
    initialCached?.customers || initialCustomers
  );
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(
    initialCached?.customerPayments || []
  );
  const [expenses, setExpenses] = useState<Expense[]>(
    initialCached?.expenses || initialExpenses
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(
    initialCached?.stockMovements || initialStockMovements
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  
  // Staff PIN verification modal
  const [userToSwitchWithPin, setUserToSwitchWithPin] = useState<AppUser | null>(null);

  // Platform Admin state
  const [isPlatformAdminUnlocked, setIsPlatformAdminUnlocked] = useState<boolean>(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const logoClicksRef = React.useRef<{ count: number; timer: NodeJS.Timeout | null }>({ count: 0, timer: null });

  // 1. Authenticate Business by Access Code
  const authenticateBusiness = useCallback((rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    const found = allBusinesses.find(b => 
      (b.accessCode && b.accessCode.toUpperCase() === code) ||
      b.id.toUpperCase() === code
    );

    if (!found) {
      return { 
        success: false, 
        message: `Code d'accès "${code}" non trouvé. Veuillez vérifier auprès de l'administrateur.` 
      };
    }

    if (found.status === 'suspended') {
      return { 
        success: false, 
        message: `L'entreprise "${found.name}" a été suspendue par l'administrateur de la plateforme.` 
      };
    }

    // Set active store
    setBusiness(found);
    setIsBusinessAuthenticated(true);

    // Switch to first owner/manager of this business
    const storeUsers = allUsers.filter(u => u.businessId === found.id);
    if (storeUsers.length > 0) {
      const defaultOwner = storeUsers.find(u => u.role === 'owner') || storeUsers[0];
      setCurrentUser(defaultOwner);
    } else {
      // Create default owner for this business
      const newOwner: AppUser = {
        id: `usr_${Date.now()}`,
        businessId: found.id,
        name: found.ownerName || 'Propriétaire',
        phone: found.phone,
        role: 'owner',
        pin: '1234',
        active: true,
        permissions: {
          canAccessPos: true,
          canAccessStock: true,
          canAccessCustomers: true,
          canAccessExpenses: true,
          canAccessReports: true,
          canGiveDiscount: true,
          canManageUsers: true,
        },
        createdAt: new Date().toISOString(),
      };
      setAllUsers(prev => [...prev, newOwner]);
      setCurrentUser(newOwner);
    }

    setActiveTab('pos');
    return { success: true, business: found };
  }, [allBusinesses, allUsers]);

  // Logout from current business
  const logoutBusiness = useCallback(() => {
    setIsBusinessAuthenticated(false);
    setCart([]);
  }, []);

  // Switch business directly (Super Admin helper)
  const switchBusiness = useCallback((businessId: string) => {
    const found = allBusinesses.find(b => b.id === businessId);
    if (found) {
      setBusiness(found);
      setIsBusinessAuthenticated(true);
      const storeUsers = allUsers.filter(u => u.businessId === found.id);
      if (storeUsers.length > 0) {
        setCurrentUser(storeUsers.find(u => u.role === 'owner') || storeUsers[0]);
      }
    }
  }, [allBusinesses, allUsers]);

  // Create New Business in Admin Console
  const createBusiness = async (
    businessData: Omit<Business, 'id' | 'createdAt'>,
    ownerPin = '1234'
  ): Promise<Business> => {
    const id = `biz_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    const nowIso = new Date().toISOString();

    const finalAccessCode = (businessData.accessCode || `BF-${businessData.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();

    const newBusiness: Business = {
      ...businessData,
      id,
      accessCode: finalAccessCode,
      createdAt: nowIso,
    };

    // Create Initial Owner for this business
    const ownerUserId = `usr_${Date.now().toString(36)}`;
    const newOwner: AppUser = {
      id: ownerUserId,
      businessId: id,
      name: businessData.ownerName || 'Propriétaire',
      phone: businessData.phone,
      role: 'owner',
      pin: ownerPin,
      active: true,
      permissions: {
        canAccessPos: true,
        canAccessStock: true,
        canAccessCustomers: true,
        canAccessExpenses: true,
        canAccessReports: true,
        canGiveDiscount: true,
        canManageUsers: true,
      },
      createdAt: nowIso,
    };

    setAllBusinesses(prev => [newBusiness, ...prev]);
    setAllUsers(prev => [...prev, newOwner]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'businesses', id), newBusiness);
        await setDoc(doc(db, 'users', ownerUserId), newOwner);
      } catch (err) {
        console.warn('Firestore offline fallback for create business:', err);
      }
    }

    return newBusiness;
  };

  // Update Business
  const updateBusiness = async (id: string, updates: Partial<Business>) => {
    setAllBusinesses(prev =>
      prev.map(b => (b.id === id ? { ...b, ...updates } : b))
    );

    if (business.id === id) {
      setBusiness(prev => ({ ...prev, ...updates }));
    }

    if (isOnline) {
      try {
        await updateDoc(doc(db, 'businesses', id), updates);
      } catch (err) {
        console.warn('Firestore update business error:', err);
      }
    }
  };

  // Delete Business
  const deleteBusiness = async (id: string) => {
    setAllBusinesses(prev => prev.filter(b => b.id !== id));
    if (business.id === id) {
      const remaining = allBusinesses.filter(b => b.id !== id);
      if (remaining.length > 0) {
        setBusiness(remaining[0]);
      } else {
        setIsBusinessAuthenticated(false);
      }
    }

    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'businesses', id));
      } catch (err) {
        console.warn('Firestore delete business error:', err);
      }
    }
  };

  // Regenerate Access Code for a store
  const regenerateAccessCode = async (businessId: string): Promise<string> => {
    const target = allBusinesses.find(b => b.id === businessId);
    const prefix = target ? target.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : 'FASO';
    const newCode = `BF-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    await updateBusiness(businessId, { accessCode: newCode });
    return newCode;
  };

  // Switch active user
  const switchUser = (userId: string) => {
    const found = allUsers.find(u => u.id === userId);
    if (found) {
      if (!found.active) {
        alert("Ce compte est suspendu par le propriétaire.");
        return;
      }
      setCurrentUser(found);
    }
  };

  // Request user switch with PIN prompt
  const requestUserSwitch = (userId: string) => {
    const found = allUsers.find(u => u.id === userId);
    if (found) {
      setUserToSwitchWithPin(found);
    }
  };

  // Verify User PIN
  const verifyUserPin = (userId: string, pin: string): boolean => {
    const found = allUsers.find(u => u.id === userId);
    return found ? (found.pin === pin || (!found.pin && pin === '0000')) : false;
  };

  // User Management by Owner
  const addUser = async (userData: Omit<AppUser, 'id' | 'businessId' | 'createdAt' | 'active'>): Promise<AppUser> => {
    const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 3)}`;
    const newUser: AppUser = {
      ...userData,
      id,
      businessId: business.id,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setAllUsers(prev => [...prev, newUser]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'users', id), newUser);
      } catch (err) {
        console.warn('Firestore add user error:', err);
      }
    }

    return newUser;
  };

  const updateUser = async (userId: string, updates: Partial<AppUser>) => {
    setAllUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, ...updates } : u))
    );

    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }

    if (isOnline) {
      try {
        await updateDoc(doc(db, 'users', userId), updates);
      } catch (err) {
        console.warn('Firestore update user error:', err);
      }
    }
  };

  const updateUserPin = async (userId: string, newPin: string) => {
    await updateUser(userId, { pin: newPin });
  };

  const toggleUserStatus = async (id: string) => {
    const target = allUsers.find(u => u.id === id);
    if (!target) return;
    const newStatus = !target.active;
    await updateUser(id, { active: newStatus });
  };

  const deleteUser = async (id: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== id));
    if (currentUser.id === id) {
      const remaining = allUsers.filter(u => u.id !== id && u.businessId === business.id);
      if (remaining.length > 0) {
        setCurrentUser(remaining[0]);
      }
    }

    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (err) {
        console.warn('Firestore delete user error:', err);
      }
    }
  };

  // Update business profile
  const updateBusinessProfile = async (updates: Partial<Business>) => {
    await updateBusiness(business.id, updates);
  };

  // Platform Admin PIN Unlock
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
      allBusinesses,
      business,
      isBusinessAuthenticated,
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
  }, [
    allBusinesses, 
    business, 
    isBusinessAuthenticated, 
    allUsers, 
    currentUser, 
    products, 
    sales, 
    customers, 
    customerPayments, 
    expenses, 
    stockMovements
  ]);

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

    let unsubscribeBusinesses: (() => void) | undefined;
    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeSales: (() => void) | undefined;
    let unsubscribeCustomers: (() => void) | undefined;
    let unsubscribeExpenses: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;

    const setupFirestoreSync = async () => {
      try {
        setIsSyncing(true);

        // 1. Businesses listener
        const bizCol = collection(db, 'businesses');
        unsubscribeBusinesses = onSnapshot(bizCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Business[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Business);
            });
            if (list.length > 0) {
              setAllBusinesses(list);
              const currentUpdated = list.find(b => b.id === business.id);
              if (currentUpdated) setBusiness(currentUpdated);
            }
          }
        }, (err) => console.log('Businesses snapshot fallback:', err.message));

        // 2. Products listener
        const prodCol = collection(db, 'products');
        unsubscribeProducts = onSnapshot(prodCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Product[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Product);
            });
            setProducts(list);
          }
        }, (err) => console.log('Products snapshot fallback:', err.message));

        // 3. Sales listener
        const salesCol = collection(db, 'sales');
        unsubscribeSales = onSnapshot(salesCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Sale[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Sale);
            });
            setSales(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => console.log('Sales snapshot fallback:', err.message));

        // 4. Customers listener
        const custCol = collection(db, 'customers');
        unsubscribeCustomers = onSnapshot(custCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Customer[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
            });
            setCustomers(list);
          }
        }, (err) => console.log('Customers snapshot fallback:', err.message));

        // 5. Expenses listener
        const expCol = collection(db, 'expenses');
        unsubscribeExpenses = onSnapshot(expCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Expense[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Expense);
            });
            setExpenses(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => console.log('Expenses snapshot fallback:', err.message));

        // 6. Users listener
        const usersCol = collection(db, 'users');
        unsubscribeUsers = onSnapshot(usersCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: AppUser[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as AppUser);
            });
            setAllUsers(list);
          }
        }, (err) => console.log('Users snapshot fallback:', err.message));

        setLastSyncedAt(new Date());
        setIsSyncing(false);
      } catch (e) {
        console.warn('Initial Firestore sync error:', e);
        setIsSyncing(false);
      }
    };

    setupFirestoreSync();

    return () => {
      unsubscribeBusinesses?.();
      unsubscribeProducts?.();
      unsubscribeSales?.();
      unsubscribeCustomers?.();
      unsubscribeExpenses?.();
      unsubscribeUsers?.();
    };
  }, [isOnline, business.id]);

  // Current Business scoped entities
  const scopedProducts = useMemo(() => 
    products.filter(p => p.businessId === business.id),
    [products, business.id]
  );

  const scopedSales = useMemo(() => 
    sales.filter(s => s.businessId === business.id),
    [sales, business.id]
  );

  const scopedCustomers = useMemo(() => 
    customers.filter(c => c.businessId === business.id),
    [customers, business.id]
  );

  const scopedCustomerPayments = useMemo(() => 
    customerPayments.filter(cp => cp.businessId === business.id),
    [customerPayments, business.id]
  );

  const scopedExpenses = useMemo(() => 
    expenses.filter(e => e.businessId === business.id),
    [expenses, business.id]
  );

  const scopedStockMovements = useMemo(() => 
    stockMovements.filter(sm => sm.businessId === business.id),
    [stockMovements, business.id]
  );

  const scopedUsers = useMemo(() => 
    allUsers.filter(u => u.businessId === business.id),
    [allUsers, business.id]
  );

  // Generate automated alerts for stock and overdue debts
  useEffect(() => {
    const alerts: NotificationItem[] = [];

    // Stock alerts
    scopedProducts.forEach(p => {
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
    scopedCustomers.forEach(c => {
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
  }, [scopedProducts, scopedCustomers, business.currency]);

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

    const receiptNumber = `BZ-${new Date().getFullYear()}-${String(scopedSales.length + 1).padStart(3, '0')}`;
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

  // Archive Product
  const archiveProduct = async (id: string) => {
    await updateProduct(id, { archived: true });
  };

  // Record Stock Movement
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
    setAllBusinesses(initialBusinesses);
    setBusiness(initialBusinesses[0]);
    setIsBusinessAuthenticated(true);
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

  // Compute live Business Summary for current scoped business
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

    scopedSales.forEach(sale => {
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
    scopedExpenses.forEach(exp => {
      const expDate = new Date(exp.createdAt);
      const expDateStr = exp.createdAt.split('T')[0];
      if (expDateStr === todayStr) {
        todayExpenses += exp.amount;
      }
      if (expDate >= thirtyDaysAgo) {
        monthExpenses += exp.amount;
      }
    });

    const totalPendingDebts = scopedCustomers.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
    const lowStockCount = scopedProducts.filter(p => !p.archived && p.currentStock > 0 && p.currentStock <= p.alertThreshold).length;
    const outOfStockCount = scopedProducts.filter(p => !p.archived && p.currentStock <= 0).length;

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
  }, [scopedSales, scopedExpenses, scopedCustomers, scopedProducts]);

  return (
    <AppContext.Provider
      value={{
        allBusinesses,
        business,
        isBusinessAuthenticated,
        authenticateBusiness,
        logoutBusiness,
        createBusiness,
        updateBusiness,
        deleteBusiness,
        regenerateAccessCode,
        switchBusiness,
        updateBusinessProfile,
        currentUser,
        allUsers: scopedUsers,
        switchUser,
        userToSwitchWithPin,
        setUserToSwitchWithPin,
        requestUserSwitch,
        addUser,
        updateUser,
        updateUserPin,
        toggleUserStatus,
        deleteUser,
        verifyUserPin,
        products: scopedProducts,
        sales: scopedSales,
        customers: scopedCustomers,
        customerPayments: scopedCustomerPayments,
        expenses: scopedExpenses,
        stockMovements: scopedStockMovements,
        notifications,
        cart,
        isOnline,
        isSyncing,
        lastSyncedAt,
        activeTab,
        setActiveTab,
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
