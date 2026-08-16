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
import { db, sanitizeForFirestore, ensureFirebaseAuth } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Sync Notice:', JSON.stringify(errInfo));
  return errInfo;
}

interface AppContextType {
  // Business Multi-Tenant State
  allBusinesses: Business[];
  business: Business;
  isBusinessAuthenticated: boolean;
  authenticateBusiness: (accessCode: string) => Promise<{ success: boolean; message?: string; business?: Business }>;
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
  forceSyncCloudData: () => Promise<void>;
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

  // 1. Authenticate Business by Access Code (checks memory cache first, then directly queries Firestore)
  const authenticateBusiness = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    let found = allBusinesses.find(b => 
      (b.accessCode && b.accessCode.toUpperCase() === code) ||
      b.id.toUpperCase() === code
    );

    // If not found in local memory state, query Firestore directly for real-time multi-device access
    if (!found) {
      try {
        await ensureFirebaseAuth();
        const snap = await getDocs(collection(db, 'businesses'));
        if (!snap.empty) {
          const list: Business[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as Business));
          setAllBusinesses(list);
          found = list.find(b => 
            (b.accessCode && b.accessCode.toUpperCase() === code) ||
            b.id.toUpperCase() === code
          );
        }
      } catch (err) {
        console.warn('Direct Firestore business lookup notice:', err);
      }
    }

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
    let storeUsers = allUsers.filter(u => u.businessId === found.id);
    if (storeUsers.length === 0) {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        if (!uSnap.empty) {
          const uList: AppUser[] = [];
          uSnap.forEach(d => uList.push({ id: d.id, ...d.data() } as AppUser));
          setAllUsers(uList);
          storeUsers = uList.filter(u => u.businessId === found.id);
        }
      } catch (err) {
        console.warn('Direct users fetch notice:', err);
      }
    }

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
      try {
        await setDoc(doc(db, 'users', newOwner.id), sanitizeForFirestore(newOwner));
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `users/${newOwner.id}`);
      }
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

    try {
      await setDoc(doc(db, 'businesses', id), sanitizeForFirestore(newBusiness));
      await setDoc(doc(db, 'users', ownerUserId), sanitizeForFirestore(newOwner));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'businesses');
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

    try {
      await updateDoc(doc(db, 'businesses', id), sanitizeForFirestore(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `businesses/${id}`);
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

    try {
      await deleteDoc(doc(db, 'businesses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `businesses/${id}`);
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

    try {
      await setDoc(doc(db, 'users', id), sanitizeForFirestore(newUser));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'users');
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

    try {
      await updateDoc(doc(db, 'users', userId), sanitizeForFirestore(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
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

    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
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

  // Save to localStorage whenever core state updates (fast offline recovery cache)
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

  // Multi-Device Real-Time Cloud Synchronization Engine with Firestore
  useEffect(() => {
    if (!isOnline) return;

    let unsubscribeBusinesses: (() => void) | undefined;
    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeSales: (() => void) | undefined;
    let unsubscribeCustomers: (() => void) | undefined;
    let unsubscribeExpenses: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeStockMovements: (() => void) | undefined;
    let unsubscribeCustomerPayments: (() => void) | undefined;

    const setupFirestoreSync = async () => {
      try {
        setIsSyncing(true);

        // 0. Verify connection and test document
        try {
          await getDocFromServer(doc(db, 'system', 'connection_test')).catch(() => null);
        } catch {
          // Non-blocking connection test
        }

        // 1. Initial Cloud Seeding Check: If Firestore is fresh / empty across all devices, seed standard master dataset
        try {
          const bizSnapshot = await getDocs(collection(db, 'businesses'));
          if (bizSnapshot.empty) {
            console.log('Seeding initial master data to Cloud Firestore for multi-device collaboration...');
            const batch = writeBatch(db);
            
            initialBusinesses.forEach(b => {
              batch.set(doc(db, 'businesses', b.id), sanitizeForFirestore(b));
            });
            initialUsers.forEach(u => {
              batch.set(doc(db, 'users', u.id), sanitizeForFirestore(u));
            });
            initialProducts.forEach(p => {
              batch.set(doc(db, 'products', p.id), sanitizeForFirestore(p));
            });
            initialCustomers.forEach(c => {
              batch.set(doc(db, 'customers', c.id), sanitizeForFirestore(c));
            });
            initialExpenses.forEach(e => {
              batch.set(doc(db, 'expenses', e.id), sanitizeForFirestore(e));
            });
            initialSales.forEach(s => {
              batch.set(doc(db, 'sales', s.id), sanitizeForFirestore(s));
            });
            initialStockMovements.forEach(sm => {
              batch.set(doc(db, 'stock_movements', sm.id), sanitizeForFirestore(sm));
            });

            await batch.commit();
          }
        } catch (seedErr) {
          console.warn('Notice on initial seeding to Firestore:', seedErr);
        }

        // 2. Real-Time Businesses Listener (Multi-Tenant & Codes)
        const bizCol = collection(db, 'businesses');
        unsubscribeBusinesses = onSnapshot(bizCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Business[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Business);
            });
            if (list.length > 0) {
              setAllBusinesses(list);
              setBusiness(prev => {
                const updated = list.find(b => b.id === prev.id);
                return updated || prev;
              });
            }
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'businesses'));

        // 3. Real-Time Products Listener (When Gérant adds/edits an article, Caissière receives it instantly!)
        const prodCol = collection(db, 'products');
        unsubscribeProducts = onSnapshot(prodCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Product[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Product);
            });
            setProducts(list);
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

        // 4. Real-Time Sales Listener (When Caissière sells on Device B, Owner sees it on Device A in real time!)
        const salesCol = collection(db, 'sales');
        unsubscribeSales = onSnapshot(salesCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Sale[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Sale);
            });
            setSales(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

        // 5. Real-Time Customers & Debts Listener
        const custCol = collection(db, 'customers');
        unsubscribeCustomers = onSnapshot(custCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Customer[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
            });
            setCustomers(list);
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

        // 6. Real-Time Customer Reimbursements Listener
        const custPayCol = collection(db, 'customer_payments');
        unsubscribeCustomerPayments = onSnapshot(custPayCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: CustomerPayment[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as CustomerPayment);
            });
            setCustomerPayments(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'customer_payments'));

        // 7. Real-Time Stock Movements Listener
        const movCol = collection(db, 'stock_movements');
        unsubscribeStockMovements = onSnapshot(movCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: StockMovement[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as StockMovement);
            });
            setStockMovements(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'stock_movements'));

        // 8. Real-Time Expenses Listener
        const expCol = collection(db, 'expenses');
        unsubscribeExpenses = onSnapshot(expCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: Expense[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Expense);
            });
            setExpenses(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

        // 9. Real-Time Users & PINs Listener
        const usersCol = collection(db, 'users');
        unsubscribeUsers = onSnapshot(usersCol, (snapshot) => {
          if (!snapshot.empty) {
            const list: AppUser[] = [];
            snapshot.forEach(docSnap => {
              list.push({ id: docSnap.id, ...docSnap.data() } as AppUser);
            });
            setAllUsers(list);
            setCurrentUser(prev => {
              const updated = list.find(u => u.id === prev.id);
              return updated || prev;
            });
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

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
      unsubscribeStockMovements?.();
      unsubscribeCustomerPayments?.();
    };
  }, [isOnline]);

  // Manual / On-demand force sync helper
  const forceSyncCloudData = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      await ensureFirebaseAuth();
      const [
        bizSnap,
        prodSnap,
        salesSnap,
        custSnap,
        custPaySnap,
        movSnap,
        expSnap,
        usersSnap
      ] = await Promise.all([
        getDocs(collection(db, 'businesses')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'customer_payments')),
        getDocs(collection(db, 'stock_movements')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'users')),
      ]);

      if (!bizSnap.empty) {
        const bList: Business[] = [];
        bizSnap.forEach(d => bList.push({ id: d.id, ...d.data() } as Business));
        setAllBusinesses(bList);
        setBusiness(prev => bList.find(b => b.id === prev.id) || prev);
      }

      if (!prodSnap.empty) {
        const pList: Product[] = [];
        prodSnap.forEach(d => pList.push({ id: d.id, ...d.data() } as Product));
        setProducts(pList);
      }

      if (!salesSnap.empty) {
        const sList: Sale[] = [];
        salesSnap.forEach(d => sList.push({ id: d.id, ...d.data() } as Sale));
        setSales(sList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      if (!custSnap.empty) {
        const cList: Customer[] = [];
        custSnap.forEach(d => cList.push({ id: d.id, ...d.data() } as Customer));
        setCustomers(cList);
      }

      if (!custPaySnap.empty) {
        const cpList: CustomerPayment[] = [];
        custPaySnap.forEach(d => cpList.push({ id: d.id, ...d.data() } as CustomerPayment));
        setCustomerPayments(cpList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      if (!movSnap.empty) {
        const smList: StockMovement[] = [];
        movSnap.forEach(d => smList.push({ id: d.id, ...d.data() } as StockMovement));
        setStockMovements(smList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      if (!expSnap.empty) {
        const eList: Expense[] = [];
        expSnap.forEach(d => eList.push({ id: d.id, ...d.data() } as Expense));
        setExpenses(eList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

      if (!usersSnap.empty) {
        const uList: AppUser[] = [];
        usersSnap.forEach(d => uList.push({ id: d.id, ...d.data() } as AppUser));
        setAllUsers(uList);
        setCurrentUser(prev => uList.find(u => u.id === prev.id) || prev);
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn('Manual cloud sync notice:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

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

  // Complete a sale (multi-device synced)
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

    // Update local sales optimistically
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
    let customerCreditIncrement = 0;
    if ((paymentMethod === 'credit' || (splitDetails && (splitDetails.credit || 0) > 0)) && customerId) {
      customerCreditIncrement = paymentMethod === 'credit' ? total : (splitDetails?.credit || 0);
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId ? { ...c, totalDebt: c.totalDebt + customerCreditIncrement } : c
        )
      );
    }

    // 3. Clear cart
    clearCart();

    // 4. Multi-Device Real-Time Cloud Firestore Sync
    try {
      await setDoc(doc(db, 'sales', saleId), sanitizeForFirestore(newSale));
      
      for (const p of updatedProducts) {
        const itemInSale = saleItems.find(si => si.productId === p.id);
        if (itemInSale) {
          await updateDoc(doc(db, 'products', p.id), sanitizeForFirestore({
            currentStock: p.currentStock,
          }));
        }
      }

      for (const mov of newMovements) {
        await setDoc(doc(db, 'stock_movements', mov.id), sanitizeForFirestore(mov));
      }

      if (customerId && customerCreditIncrement > 0) {
        const currentCust = customers.find(c => c.id === customerId);
        if (currentCust) {
          await updateDoc(doc(db, 'customers', customerId), sanitizeForFirestore({
            totalDebt: currentCust.totalDebt + customerCreditIncrement,
          }));
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sales');
    }

    return newSale;
  };

  // Add Product (Real-time synced across all devices)
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

    let initMov: StockMovement | null = null;
    if (newProduct.currentStock > 0) {
      initMov = {
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
      setStockMovements(prev => [initMov!, ...prev]);
    }

    try {
      await setDoc(doc(db, 'products', id), sanitizeForFirestore(newProduct));
      if (initMov) {
        await setDoc(doc(db, 'stock_movements', initMov.id), sanitizeForFirestore(initMov));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${id}`);
    }

    return newProduct;
  };

  // Update Product (Real-time synced)
  const updateProduct = async (id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );

    try {
      await updateDoc(doc(db, 'products', id), sanitizeForFirestore(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
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
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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

    try {
      await setDoc(doc(db, 'stock_movements', newMovement.id), sanitizeForFirestore(newMovement));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `stock_movements/${newMovement.id}`);
    }
  };

  // Add Customer
  const addCustomer = async (customerData: Omit<Customer, 'id' | 'businessId' | 'createdAt' | 'totalDebt'>): Promise<Customer> => {
    const id = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCust: Customer = {
      ...customerData,
      id,
      businessId: business.id,
      totalDebt: 0,
      createdAt: new Date().toISOString(),
    };

    setCustomers(prev => [...prev, newCust]);

    try {
      await setDoc(doc(db, 'customers', id), sanitizeForFirestore(newCust));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `customers/${id}`);
    }

    return newCust;
  };

  // Update Customer
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );

    try {
      await updateDoc(doc(db, 'customers', id), sanitizeForFirestore(updates));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `customers/${id}`);
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

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
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

    try {
      await setDoc(doc(db, 'customer_payments', paymentId), sanitizeForFirestore(newPayment));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `customer_payments/${paymentId}`);
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
    const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
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

    try {
      await setDoc(doc(db, 'expenses', id), sanitizeForFirestore(newExp));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `expenses/${id}`);
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

    try {
      const batch = writeBatch(db);
      initialBusinesses.forEach(b => batch.set(doc(db, 'businesses', b.id), sanitizeForFirestore(b)));
      initialUsers.forEach(u => batch.set(doc(db, 'users', u.id), sanitizeForFirestore(u)));
      initialProducts.forEach(p => batch.set(doc(db, 'products', p.id), sanitizeForFirestore(p)));
      initialCustomers.forEach(c => batch.set(doc(db, 'customers', c.id), sanitizeForFirestore(c)));
      initialExpenses.forEach(e => batch.set(doc(db, 'expenses', e.id), sanitizeForFirestore(e)));
      initialSales.forEach(s => batch.set(doc(db, 'sales', s.id), sanitizeForFirestore(s)));
      initialStockMovements.forEach(sm => batch.set(doc(db, 'stock_movements', sm.id), sanitizeForFirestore(sm)));
      await batch.commit();
    } catch (e) {
      console.warn('Reset demo batch error:', e);
    }
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
        forceSyncCloudData,
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
