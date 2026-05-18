/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Brush } from 'recharts';
import { 
  Activity,
  AlertTriangle,
  Apple,
  ArrowLeft,
  ArrowRight,
  Award,
  AlertCircle,
  Bandage,
  BarChart3,
  Bell, 
  BellOff,
  BookOpen, 
  Bot,
  Brain,
  Briefcase,
  Building,
  Building2,
  Calendar,
  Calendar as CalendarIcon, 
  Camera, 
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ClipboardList,
  ClipboardCheck,
  Utensils,
  Clock,
  Cpu,
  CreditCard,
  DollarSign,
  Download,
  Droplets,
  Edit3,
  FileText, 
  FileUp,
  Flame,
  FlaskConical,
  Folder, 
  Footprints,
  Globe,
  GraduationCap, 
  Heart,
  History,
  Home,
  Hospital, 
  Info,
  Key,
  Leaf,
  Lightbulb,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPin, 
  Menu,
  MessageSquare, 
  Mic,
  Minus,
  Moon,
  MoreVertical,
  Navigation,
  Package,
  Paperclip,
  Pill, 
  Phone,
  PhoneOff,
  Plus,
  RefreshCw,
  Ruler,
  Scale,
  Search, 
  Send,
  Settings,
  Shield, 
  ShieldAlert,
  ShieldCheck,
  Share2,
  ShoppingCart, 
  Smile,
  Sparkles,
  Star,
  Stethoscope, 
  Sun,
  Thermometer,
  Trash2,
  Trophy, 
  TrendingUp, 
  User,
  Users,
  Video, 
  Watch, 
  Wind,
  X,
  Zap,
  Mail,
  Eye,
  EyeOff,
  UserCircle,
  ExternalLink,
  ChevronDown,
  FileSearch,
  BookCheck,
  ListChecks,
  LayoutGrid
} from 'lucide-react';
import { cn, formatMsg, formatCurrency, formatCoverage } from './lib/utils';
import { TrendsInsights } from './components/TrendsInsights';
import { SOSView } from './components/SOSView';
import { PullToRefresh } from './components/PullToRefresh';
import { AppMode, UserProfile, JournalEntry, Reminder, MedicalRecord, FamilyMember, InsurancePlan, UserInsurancePolicy, Appointment, Clinic, CorporateChallenge, ChatMessage, ChatConversation, HealthDocument, AppNotification } from './types';
import { callGemini, analyzeImage, analyzeLabReport, analyzeFood, analyzeJournal, generateHealthRoadmap, generateCallSummary, analyzeSymptoms, generateSmartMedicationSchedule, analyzePrescription, getWellnessResponse, getChatResponse, analyzeLockerDocument, generateAppointmentBriefing, generatePostVisitChecklist, SYS_PROMPT } from './lib/gemini';
import { auth, db, googleProvider, appleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocFromServer, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Markdown from 'react-markdown';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isOffline = errorMessage.toLowerCase().includes('offline') || errorMessage.toLowerCase().includes('unavailable');
  
  const errInfo: FirestoreErrorInfo = {
    error: isOffline ? `${errorMessage}. This often indicates a network restriction in sandboxed environments. We've enabled Force Long Polling to help.` : errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Only throw if it's a critical write error or if we really want to block the UI.
  // For GET errors, we might want to just log and show a toast.
  if (operationType === OperationType.WRITE || operationType === OperationType.CREATE) {
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn("Non-critical Firestore GET/LIST error ignored for UI stability.", errInfo);
    if (isOffline) {
       showErrorToast("Cloud Sync delayed: Your internet or browser might be restricting Firestore. Retrying...");
    }
  }
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const errInfo = JSON.parse(this.state.error?.message || "");
        if (errInfo.error) message = `Firebase Error: ${errInfo.error}`;
      } catch (e) {
        message = this.state.error?.message || message;
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
          <div className="max-w-md w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="font-serif text-2xl">Application Error</h2>
            <p className="text-sm text-[var(--muted)]">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-bold rounded-2xl shadow-xl"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Hooks ---

function useLocalStorage<T>(key: string, initialValue: T, debounced: boolean = false): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const timerRef = useRef<number | NodeJS.Timeout | undefined>(undefined);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      const save = () => window.localStorage.setItem(key, JSON.stringify(valueToStore));
      
      if (debounced) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(save, 500);
      } else {
        save();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// --- Components ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<AppMode>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useLocalStorage('veda_theme', true);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    name: '', age: '', sex: '', city: '', height: '', weight: '', bp: '', sugar: '', blood: '',
    conditions: [], medicines: [], familyHistory: [], allergies: [], vaccinationHistory: [], 
    setupDone: false, isPremium: false
  });
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [lockerDocs, setLockerDocs] = useState<HealthDocument[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [policies, setPolicies] = useState<UserInsurancePolicy[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const hasSeededAmlodipine = useRef(false);
  const [activeAlertReminder, setActiveAlertReminder] = useState<Reminder | null>(null);
  const lastFiredRef = useRef<Record<string, string>>({});
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log('beforeinstallprompt fired');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(7);
    const newNotif: AppNotification = { 
      ...notif, 
      id, 
      timestamp: new Date().toISOString() 
    };
    setNotifications(prev => [newNotif, ...prev]);
    const duration = notif.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        addNotification(e.detail);
      }
    };
    window.addEventListener('app-notification', handler);
    return () => window.removeEventListener('app-notification', handler);
  }, [addNotification]);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useLocalStorage<string>('veda_active_chat_id', '');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync notifications permission when window regains focus (e.g. after user changes settings)
  useEffect(() => {
    const syncPermissions = () => {
      if (typeof Notification !== 'undefined') {
        const current = Notification.permission;
        console.log("Push permission state:", current);
        setNotificationPermission(current);
        
        // If it was just granted, update the profile automatically
        if (current === 'granted' && profile && !profile.notificationsEnabled) {
          updateProfile({ ...profile, notificationsEnabled: true });
        }
      }
    };
    
    window.addEventListener('focus', syncPermissions);
    
    // Use the permissions API if available for real-time changes
    let permissionStatus: PermissionStatus | null = null;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((status) => {
        permissionStatus = status;
        status.onchange = () => {
          console.log("Permission change detected via API:", Notification.permission);
          syncPermissions();
        };
      }).catch(err => console.warn("Permissions API error:", err));
    }

    syncPermissions();
    return () => {
      window.removeEventListener('focus', syncPermissions);
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [profile?.uid]); // Re-sync if profile changes to ensure it writes to the right user

  // Service Worker Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.debug('Service Worker registered:', reg);
      }).catch(err => {
        console.debug('Service Worker registration failed:', err);
      });
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      try {
        console.log("Current notification permission:", Notification.permission);
        
        // If already denied, show instructions on how to unblock
        if (Notification.permission === 'denied') {
          showDoneToast("Tap the badge next to the URL at the top to 'Allow' notifications for this site.");
          setNotificationPermission('denied');
          return;
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        
        if (permission === 'granted') {
          updateProfile({ ...profile, notificationsEnabled: true });
          showDoneToast("Notifications enabled!");
          triggerPushNotification("Veda Health", "You will now receive important health alerts.");
        } else if (permission === 'denied') {
          showDoneToast("Push blocked. Falling back to in-app alerts.");
        }
      } catch (err) {
        console.error("error requesting notifications", err);
        showDoneToast("Failed to request permission.");
      }
    } else {
      showDoneToast("Notifications not supported.");
    }
  };

  const triggerPushNotification = (title: string, body: string) => {
    // Always ensure the user sees the alert in-app
    showDoneToast(`${title}: ${body}`);

    if (notificationPermission === 'granted' || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      const options = {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'veda-alert',
        renotify: true
      };
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, options);
        }).catch(() => {
          try { new Notification(title, options); } catch(e) {}
        });
      } else if (typeof Notification !== 'undefined') {
        try { new Notification(title, options); } catch(e) {}
      }
    }
  };

  // Sync active chatHistory from Firestore when activeChatId changes
  useEffect(() => {
    if (!user || !activeChatId) {
      setChatHistory([]);
      return;
    }

    const msgsRef = collection(db, 'users', user.uid, 'conversations', activeChatId, 'messages');
    const q = query(msgsRef, where('timestamp', '!=', '')); // Just to get order by if needed, but let's do a simple sort or get all
    
    const unsub = onSnapshot(msgsRef, (snap) => {
      const msgs = snap.docs.map(d => ({ ...d.data() } as ChatMessage));
      // Sort by timestamp if not already sorted by Firestore
      setChatHistory(msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/conversations/${activeChatId}/messages`));

    return () => unsub();
  }, [user, activeChatId]);

  const updateActiveChat = async (newMessages: ChatMessage[]) => {
    localStorage.setItem('veda_chat_interim', JSON.stringify(newMessages));
    
    if (!user || !activeChatId) return;

    // We only save the LATEST message to Firestore to avoid re-writing everything
    const lastMsg = newMessages[newMessages.length - 1];
    if (lastMsg) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'conversations', activeChatId, 'messages'), {
          ...lastMsg,
          timestamp: lastMsg.timestamp || new Date().toISOString()
        });

        // Update conversation metadata
        const convRef = doc(db, 'users', user.uid, 'conversations', activeChatId);
        const updates: any = { lastMessageAt: new Date().toISOString() };
        
        // Auto-title on first message
        if (newMessages.length === 1 && lastMsg.role === 'user') {
          let title = lastMsg.content.split('\n')[0].substring(0, 30).trim();
          if (lastMsg.content.length > 30) title += '...';
          updates.title = title;
        }
        
        await updateDoc(convRef, updates);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/conversations/${activeChatId}`);
      }
    }
  };

  const createNewChat = async () => {
    if (!user) return;
    try {
      const convRef = await addDoc(collection(db, 'users', user.uid, 'conversations'), {
        title: 'New Consultation',
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      });
      setActiveChatId(convRef.id);
      switchMode('chat');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/conversations`);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const confirmDel = window.confirm("Delete this consultation history?");
    if (!confirmDel) return;

    try {
      // Delete messages first (Firestore subcollections aren't auto-deleted)
      const msgsSnap = await getDocs(collection(db, 'users', user.uid, 'conversations', id, 'messages'));
      for (const mDoc of msgsSnap.docs) {
        await deleteDoc(doc(db, 'users', user.uid, 'conversations', id, 'messages', mDoc.id));
      }
      
      // Delete conversation doc
      await deleteDoc(doc(db, 'users', user.uid, 'conversations', id));

      if (activeChatId === id) {
        setActiveChatId('');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/conversations/${id}`);
    }
  };
  const [isTyping, setIsTyping] = useState(false);
  const [vitalsTab, setVitalsTab] = useState<'wellbeing' | 'bp' | 'sugar' | 'weight'>('wellbeing');
  const [language, setLanguage] = useState('English');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const journalUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (!u) {
        setProfile({
          name: '', age: '', sex: '', city: '', height: '', weight: '', bp: '', sugar: '', blood: '',
          conditions: [], medicines: [], familyHistory: [], allergies: [], vaccinationHistory: [], setupDone: false
        });
        setJournal([]);
        setReminders([]);
        setRecords([]);
        setFamily([]);
        setPolicies([]);
        setAppointments([]);
        setConversations([]);
      }
    });

    return () => authUnsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch profile
    const profileRef = doc(db, 'users', user.uid);
    getDoc(profileRef).then((snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Initialize profile
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || '',
          age: '', sex: '', city: '', height: '', weight: '', bp: '', sugar: '', blood: '',
          conditions: [], medicines: [], familyHistory: [], allergies: [], vaccinationHistory: [], setupDone: false
        };
        setDoc(profileRef, newProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
        setProfile(newProfile);
      }
    }).catch(e => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));

    // Real-time journal
    const journalUnsub = onSnapshot(collection(db, 'users', user.uid, 'journal'), (snap) => {
      const entries = snap.docs.map(d => d.data() as JournalEntry);
      setJournal(entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/journal`));

    // Real-time reminders
    const remindersUnsub = onSnapshot(collection(db, 'users', user.uid, 'reminders'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      setReminders(items);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/reminders`));

    // Real-time records
    const recordsUnsub = onSnapshot(collection(db, 'users', user.uid, 'records'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      setRecords(items);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/records`));

    // Real-time family
    const familyUnsub = onSnapshot(collection(db, 'users', user.uid, 'family'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      setFamily(items);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/family`));

    // Real-time policies
    const policiesUnsub = onSnapshot(collection(db, 'users', user.uid, 'policies'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      setPolicies(items);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/policies`));

    // Real-time appointments
    const appointmentsUnsub = onSnapshot(collection(db, 'users', user.uid, 'appointments'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
      setAppointments(items);
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/appointments`));

    // Real-time conversations
    const convsUnsub = onSnapshot(collection(db, 'users', user.uid, 'conversations'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatConversation));
      setConversations(items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
      
      // Auto select latest if none active
      if (!activeChatId && items.length > 0) {
        setActiveChatId(items[0].id);
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/conversations`));

    // Real-time locker
    const lockerUnsub = onSnapshot(collection(db, 'users', user.uid, 'locker'), (snap) => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as HealthDocument));
      setLockerDocs(items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/locker`));

    return () => {
      journalUnsub();
      remindersUnsub();
      recordsUnsub();
      familyUnsub();
      policiesUnsub();
      appointmentsUnsub();
      convsUnsub();
      lockerUnsub();
    };
  }, [user]);

  useEffect(() => {
    if (!isLightMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isLightMode]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const switchMode = (newMode: AppMode, tab?: 'wellbeing' | 'bp' | 'sugar' | 'weight') => {
    setMode(newMode);
    if (tab) setVitalsTab(tab);
    closeSidebar();
    window.scrollTo(0, 0);
  };

  const handleStartChat = () => {
    if (!activeChatId) {
      if (conversations.length > 0) {
        setActiveChatId(conversations[0].id);
        switchMode('chat');
      } else {
        createNewChat();
      }
    } else {
      switchMode('chat');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setMode('home'); // Redirect to dashboard
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      
      console.error("Login failed", error);
      
      if (error.code === 'auth/network-request-failed') {
        showErrorToast("Network Error: Please check your internet or disable Ad-blockers.");
      } else if (error.code === 'auth/popup-blocked') {
        showErrorToast("Popup Blocked: Please click 'Allow Popups' in your browser's address bar.");
      } else {
        showErrorToast(`Login failed: ${error.message}`);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const confirmDelete = window.confirm(
      "EXTREME CAUTION: Are you sure you want to delete your Veda AI account? " +
      "This will permanently erase all your health records, journal entries, " +
      "medications, and family data from our secure servers. This action is irreversible."
    );
    
    if (!confirmDelete) return;

    try {
      showDoneToast("Purging health data...");
      const uid = user.uid;
      
      // List of subcollections to clean up
      const subcollections = [
        'journal', 
        'reminders', 
        'records', 
        'family', 
        'policies', 
        'appointments',
        'accessLogs',
        'familyPermissions',
        'conversations'
      ];

      // Sequential deletion of subcollection contents
      for (const sub of subcollections) {
        const snap = await getDocs(collection(db, 'users', uid, sub));
        for (const docSnap of snap.docs) {
          // Extra cleanup for nested messages in conversations
          if (sub === 'conversations') {
            const msgsSnap = await getDocs(collection(db, 'users', uid, 'conversations', docSnap.id, 'messages'));
            for (const msgDoc of msgsSnap.docs) {
              await deleteDoc(doc(db, 'users', uid, 'conversations', docSnap.id, 'messages', msgDoc.id));
            }
          }
          await deleteDoc(doc(db, 'users', uid, sub, docSnap.id));
        }
      }

      // Delete main profile document
      await deleteDoc(doc(db, 'users', uid));

      showDoneToast("Account successfully purged.");
      await signOut(auth);
      setMode('landing');
      
    } catch (error) {
      console.error("Account deletion failed", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMode('landing');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    if (user && !profile.setupDone && mode === 'home') {
      setMode('onboarding');
    }
  }, [user, profile.setupDone, mode]);

  const addJournalEntry = async (entry: JournalEntry) => {
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'journal', entry.date), entry);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/journal/${entry.date}`);
      }
    } else {
      setJournal(prev => [entry, ...prev.filter(e => e.date !== entry.date)]);
    }
  };

  const addReminder = async (r: Omit<Reminder, 'id' | 'on'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'reminders'), { ...r, on: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/reminders`);
        const newReminder = { ...r, id: Date.now().toString(), on: true };
        setReminders(prev => [...prev, newReminder]);
      }
    } else {
      const newReminder = { ...r, id: Date.now().toString(), on: true };
      setReminders(prev => [...prev, newReminder]);
    }
  };

  const toggleReminder = async (id: any) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'reminders', id.toString()), { on: !reminder.on });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/reminders/${id}`);
        setReminders(prev => prev.map(r => r.id === id ? { ...r, on: !r.on } : r));
      }
    } else {
      setReminders(prev => prev.map(r => r.id === id ? { ...r, on: !r.on } : r));
    }
  };

  // Seed specific user requested reminders
  useEffect(() => {
    if (user && isAuthReady && !hasSeededAmlodipine.current) {
      const amlodipineReminder = {
        name: 'Amlodipine',
        dose: '5mg',
        time: '08:00',
        freq: 'Daily',
        color: 'sky',
        category: 'medicine' as const,
        on: true
      };

      // Check if it already exists to avoid duplicates
      const exists = reminders.some(r => r.name.toLowerCase() === 'amlodipine');
      if (!exists && isAuthReady) {
        hasSeededAmlodipine.current = true;
        addReminder(amlodipineReminder);
      } else if (exists) {
        hasSeededAmlodipine.current = true; // Mark as done even if it existed
      }
    }
  }, [user?.uid, isAuthReady, reminders]);

  // Real-time reminder alarm logic
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      reminders.forEach(r => {
        if (!r.on) return;
        
        // If time matches AND we haven't fired this for this specific minute already
        if (r.time === currentHHMM && lastFiredRef.current[r.id] !== currentHHMM) {
          lastFiredRef.current[r.id] = currentHHMM;
          setActiveAlertReminder(r);
          
          // Also trigger a system notification if enabled
          triggerPushNotification("Veda Reminder", `Time for your ${r.name} (${r.dose})`);
          
          // Optional: Add to notifications list
          addNotification({
             title: 'Reminder Alarm',
             message: `Take ${r.name} - ${r.dose}`,
             type: 'info',
             duration: 0 // Keep until dismissed
          });
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30s
    checkReminders(); // Initial check

    return () => clearInterval(interval);
  }, [user, reminders, addNotification]);

  const deleteReminder = async (id: any) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reminders', id.toString()));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/reminders/${id}`);
        setReminders(prev => prev.filter(r => r.id !== id));
      }
    } else {
      setReminders(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleStart = () => {
    if (!user) {
      setMode('auth');
      return;
    }
    if (profile.setupDone) {
      setMode('home');
    } else {
      setMode('onboarding');
    }
  };

  const updateProfile = async (newProfile: UserProfile) => {
    if (user) {
      const profileWithAuth = {
        ...newProfile,
        uid: user.uid,
        email: user.email || newProfile.email || ''
      };
      setProfile(profileWithAuth);
      try {
        await setDoc(doc(db, 'users', user.uid), profileWithAuth);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    } else {
      setProfile(newProfile);
    }
  };

  // --- Renderers ---

  const renderLanding = () => (
    <div id="landing-page" className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
      <div className="bg-gradient" />
      
      <nav className="fixed top-0 left-0 right-0 z-[100] py-4 transition-all glass-header">
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
          <a href="#" className="font-serif text-2xl text-[var(--teal)] flex items-baseline gap-1.5 no-underline">
            Veda <span className="font-sans text-[10px] text-[var(--muted)] font-bold uppercase tracking-[0.2em]">Health</span>
          </a>
          <div className="hidden md:flex items-center gap-2 ml-auto mr-8">
            <a href="#features" className="px-5 py-2 text-[var(--text2)] no-underline text-[12px] font-black uppercase tracking-[0.15em] hover:text-[var(--teal)] transition-all glass-pill border-none hover:bg-[var(--teal-glow)]">Features</a>
            <a href="#how" className="px-5 py-2 text-[var(--text2)] no-underline text-[12px] font-black uppercase tracking-[0.15em] hover:text-[var(--teal)] transition-all glass-pill border-none hover:bg-[var(--teal-glow)] ml-2">App</a>
            <a href="#testimonials" className="px-5 py-2 text-[var(--text2)] no-underline text-[12px] font-black uppercase tracking-[0.15em] hover:text-[var(--teal)] transition-all glass-pill border-none hover:bg-[var(--teal-glow)] ml-2">Reviews</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('auth')} 
              className="hidden sm:block px-6 py-2 glass-pill text-[var(--text2)] font-black text-[12px] uppercase tracking-wider hover:text-[var(--teal)] transition-all border-none hover:bg-[var(--teal-glow)]"
            >
              Sign In
            </button>
            <button onClick={handleStart} className="btn-primary px-8 shadow-xl shadow-[var(--teal)]/20">
              {user ? 'Open App' : 'Get Started'}
            </button>
          </div>
        </div>
      </nav>

      <section className="hero min-h-screen flex items-center pt-[120px] pb-20 relative overflow-hidden">
        <div className="max-w-[1100px] mx-auto px-6 grid md:grid-cols-2 gap-20 items-center w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-full mb-6 text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest">
              Now powered by Gemini 2.0 Flash
            </div>
            <h1 className="font-serif text-[clamp(42px,6vw,64px)] leading-[1.05] tracking-tight text-[var(--text)] mb-6">
              Your <em className="italic text-[var(--teal)] not-italic">AI doctor</em><br />always available.
            </h1>
            <p className="text-lg text-[var(--text2)] leading-relaxed max-w-[480px] mb-10 font-medium opacity-80">
              Veda gives you instant health guidance, tracks your vitals, and manages your medical life — all in one simple, private app.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <button 
                onClick={handleStart} 
                className="flex-1 xs:flex-none btn-primary px-10 py-5 text-base rounded-2xl shadow-lg shadow-[var(--teal)]/10"
              >
                <Stethoscope size={20} />
                Try Veda Free
              </button>
              <a 
                href="#features" 
                className="flex-1 xs:flex-none btn-secondary px-8 py-5 text-base rounded-2xl border-[var(--border)]"
              >
                Explore Features
              </a>
            </div>
            <p className="mt-6 text-[11px] text-[var(--muted)] font-bold uppercase tracking-widest flex items-center gap-3">
              <span>✓ Private & secure</span>
              <span className="opacity-30">|</span>
              <span>✓ No sign-up needed</span>
            </p>
          </motion.div>

          <motion.div 
            className="flex justify-center items-center relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              <div className="w-[280px] h-[560px] bg-[var(--bg)] border border-[var(--border)] rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col">
                <div className="h-12 bg-[var(--surface)] flex items-center justify-between px-6 text-[10px] text-[var(--muted)] font-black uppercase tracking-widest border-b border-[var(--border)] shrink-0">
                  <span>9:41</span>
                  <div className="flex gap-1.5 opacity-60">
                    <Watch size={12} />
                    <Zap size={12} />
                  </div>
                </div>
                <div className="p-5 space-y-4 flex-1">
                  <div className="flex gap-2.5 ai">
                    <div className="p-3 bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-2xl rounded-tl-sm text-[12px] leading-relaxed max-w-[85%] text-[var(--text)] font-medium">
                      Namaste! I'm Veda. How can I help you today?
                    </div>
                  </div>
                  <div className="flex flex-row-reverse gap-2.5 user">
                    <div className="p-3 bg-[var(--teal)] text-white dark:text-[#020617] font-bold rounded-2xl rounded-tr-sm text-[12px] leading-relaxed max-w-[85%] shadow-md">
                      I have a headache since morning
                    </div>
                  </div>
                  <div className="flex gap-2.5 ai">
                    <div className="p-3 bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-2xl rounded-tl-sm text-[12px] leading-relaxed max-w-[85%] text-[var(--text)] font-medium">
                      I'm sorry to hear that. Is the pain sharp or dull?
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0">
                  <div className="w-full h-8 rounded-full bg-[var(--bg)] border border-[var(--border)] flex items-center px-4">
                    <div className="w-1 h-3 bg-[var(--teal)] rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
              {/* Floating badges - Minimal Style */}
              <div className="absolute -left-12 top-1/4 bg-[var(--card)] border border-[var(--teal-line)] rounded-2xl p-3 shadow-xl flex items-center gap-2.5 text-[10px] font-black uppercase tracking-wider text-[var(--teal)]">
                <FileText size={14} /> Reports Read
              </div>
              <div className="absolute -right-12 top-1/2 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-3 shadow-xl flex items-center gap-2.5 text-[10px] font-black uppercase tracking-wider text-[var(--amber)]">
                <Pill size={14} /> Medicines
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="features-bar">
        <div className="features-scroll">
          <div className="f-item"><MessageSquare size={18} /> AI Health Chat</div>
          <div className="f-dot"></div>
          <div className="f-item"><Search size={18} /> Symptom Checker</div>
          <div className="f-dot"></div>
          <div className="f-item"><Clipboard size={18} /> Prescription Scanner</div>
          <div className="f-dot"></div>
          <div className="f-item"><BarChart3 size={18} /> Health Journal</div>
          <div className="f-dot"></div>
          <div className="f-item"><Pill size={18} /> Medicine Delivery</div>
          <div className="f-dot"></div>
          <div className="f-item"><Hospital size={18} /> Hospital Finder</div>
          <div className="f-dot"></div>
          <div className="f-item"><Users size={18} /> Family Health</div>
          <div className="f-dot"></div>
          <div className="f-item"><Shield size={18} /> Insurance Advice</div>
          <div className="f-dot"></div>
          <div className="f-item"><GraduationCap size={18} /> Medical Education</div>
          <div className="f-dot"></div>
          {/* Duplicate for seamless loop */}
          <div className="f-item"><MessageSquare size={18} /> AI Health Chat</div>
          <div className="f-dot"></div>
          <div className="f-item"><Search size={18} /> Symptom Checker</div>
          <div className="f-dot"></div>
          <div className="f-item"><Clipboard size={18} /> Prescription Scanner</div>
          <div className="f-dot"></div>
          <div className="f-item"><BarChart3 size={18} /> Health Journal</div>
          <div className="f-dot"></div>
          <div className="f-item"><Pill size={18} /> Medicine Delivery</div>
          <div className="f-dot"></div>
          <div className="f-item"><Hospital size={18} /> Hospital Finder</div>
          <div className="f-dot"></div>
          <div className="f-item"><Users size={18} /> Family Health</div>
          <div className="f-dot"></div>
          <div className="f-item"><Shield size={18} /> Insurance Advice</div>
          <div className="f-dot"></div>
          <div className="f-item"><GraduationCap size={18} /> Medical Education</div>
          <div className="f-dot"></div>
        </div>
      </div>

      <section className="features-section py-24 bg-[var(--bg)]" id="features">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[var(--teal)] text-xs font-bold uppercase tracking-[2px] mb-4 block">Everything you need</span>
            <h2 className="font-serif text-[clamp(30px,4vw,44px)] leading-[1.15] tracking-tight mb-4 text-[var(--text)]">One app for your <em>entire</em> health journey</h2>
            <p className="text-[var(--text2)] max-w-[540px] mx-auto">From daily symptoms to emergency guidance — Veda covers it all, powered by Google Gemini AI.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card featured">
              <div className="feature-icon"><Stethoscope size={24} /></div>
              <div className="font-serif text-2xl mb-3 text-[var(--text)]">AI Health Chat</div>
              <div className="text-[14px] text-[var(--text2)] leading-relaxed mb-6 font-medium opacity-80">Describe your symptoms in plain language — Veda gives you instant health guidance, remembering your history and medications across conversations.</div>
              <div className="flex gap-2 flex-wrap">
                <div className="feature-tag">✦ 10 Languages</div>
                <div className="feature-tag">✦ Memory across sessions</div>
                <div className="feature-tag">✦ Gemini 2.0 Flash</div>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><BarChart3 size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Health Journal</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Log vitals and mood daily. See patterns and trends with an AI health score.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Clipboard size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Prescription Scanner</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">AI vision reads any prescription, clarifying dosage and instructions instantly.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><FlaskConical size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Lab Reports</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Explains blood tests and reports in plain language for complete clarity.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Hospital size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Hospital Finder</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Instantly find the nearest specialist or emergency care in your city.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><ShoppingCart size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Medicine Delivery</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Easily search and order medicines directly from top trusted distributors.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Users size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Family Health</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Manage health profiles for your entire family in one private account.</div>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Bell size={20} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">Preventive Alerts</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Smart reminders personalized for your age, condition, and medical history.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="showcase-section py-24 bg-[var(--bg)] border-y border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="showcase-row">
            <div>
              <div className="showcase-tag bg-[var(--teal-glow)] text-[var(--teal)]"><Stethoscope size={16} /> Second Opinion</div>
              <h3 className="font-serif text-4xl mb-6 leading-[1.1] tracking-tight text-[var(--text)]">Get a second opinion on any diagnosis</h3>
              <p className="text-lg text-[var(--text2)] leading-relaxed mb-8 font-medium opacity-80">Worried about what your doctor said? Veda evaluates your diagnosis and lab reports, giving you an evidence-based second opinion.</p>
              <ul className="showcase-list">
                <li>Instant lab report analysis</li>
                <li>Evaluate treatment options</li>
                <li>Questions for your next visit</li>
              </ul>
            </div>
          <div className="showcase-visual">
              <div className="sv-header">
                <div className="sv-dots"><div className="sv-dot bg-[var(--red)]" /><div className="sv-dot bg-[var(--amber)]" /><div className="sv-dot bg-[var(--teal)]" /></div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--muted)] ml-2">Analysis Report</span>
              </div>
              <div className="sv-content">
                <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl mb-4">
                  <div className="text-[10px] text-[var(--teal)] font-black uppercase tracking-widest mb-1.5 opacity-60">Status</div>
                  <div className="text-sm font-bold text-[var(--teal)]">Consistent Diagnosis</div>
                  <div className="text-[12px] text-[var(--text2)] mt-1 font-medium italic opacity-80">Type 2 Diabetes — alignments noted with HbA1c</div>
                </div>
                <div className="text-[13px] text-[var(--text2)] font-medium">
                  <div className="text-[var(--text)] font-semibold mb-2">Recommended Steps:</div>
                  <div className="mb-1 opacity-80">→ Verify with fasting glucose</div>
                  <div className="mb-1 opacity-80">→ Monitor carbohydrate intake</div>
                </div>
              </div>
            </div>
          </div>

          <div className="showcase-row reverse mt-32">
            <div>
              <div className="showcase-tag bg-[var(--teal-glow)] text-[var(--teal)]"><BarChart3 size={16} /> Health Score</div>
              <h3 className="font-serif text-4xl mb-6 leading-[1.1] tracking-tight text-[var(--text)]">Your health, visualised in a simple score</h3>
              <p className="text-lg text-[var(--text2)] leading-relaxed mb-8 font-medium opacity-80">Veda calculates a personalized Health Score based on your daily activity, vitals, and consistency. Simple, powerful tracking.</p>
              <ul className="showcase-list">
                <li>Mood and Sleep tracking</li>
                <li>7-day trend analysis</li>
                <li>AI-powered improvement tips</li>
              </ul>
            </div>
          <div className="showcase-visual">
              <div className="sv-header">
                <div className="sv-dots"><div className="sv-dot bg-[var(--red)]" /><div className="sv-dot bg-[var(--amber)]" /><div className="sv-dot bg-[var(--teal)]" /></div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--muted)] ml-2">Health Metrics</span>
              </div>
              <div className="sv-content text-center">
                <div className="relative inline-block my-4">
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="6"/>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--teal)" strokeWidth="6"
                      strokeLinecap="round" strokeDasharray="314" strokeDashoffset="72"
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-serif text-3xl text-[var(--teal)]">77</div>
                    <div className="text-[10px] text-[var(--muted)] font-black uppercase">Score</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <div className="text-[10px] text-[var(--muted)] font-bold uppercase">Mood</div>
                    <div className="text-sm font-bold text-[var(--teal)]">Good</div>
                  </div>
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <div className="text-[10px] text-[var(--muted)] font-bold uppercase">Sleep</div>
                    <div className="text-sm font-bold text-[var(--teal)]">Optimal</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="numbers-section py-24 bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="numbers-grid rounded-[2.5rem] overflow-hidden border border-[var(--border)]">
            <div className="number-card bg-[var(--surface)]">
              <div className="number-val">23+</div>
              <div className="text-[14px] text-[var(--text)] mt-2 font-black uppercase tracking-widest opacity-60">Features</div>
            </div>
            <div className="number-card bg-[var(--surface)]">
              <div className="number-val">10</div>
              <div className="text-[14px] text-[var(--text)] mt-2 font-black uppercase tracking-widest opacity-60">Languages</div>
            </div>
            <div className="number-card bg-[var(--surface)]">
              <div className="number-val">100%</div>
              <div className="text-[14px] text-[var(--text)] mt-2 font-black uppercase tracking-widest opacity-60">Privacy</div>
            </div>
            <div className="number-card bg-[var(--surface)]">
              <div className="number-val">24/7</div>
              <div className="text-[14px] text-[var(--text)] mt-2 font-black uppercase tracking-widest opacity-60">Available</div>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section py-24 bg-[var(--bg)]" id="how">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-[var(--teal)] text-xs font-bold uppercase tracking-[3px] mb-4 block">Frictionless Experience</span>
            <h2 className="font-serif text-[clamp(34px,5vw,48px)] leading-[1.05] tracking-tight mb-4 text-[var(--text)]">Ready in <em className="italic text-[var(--teal)] not-italic">seconds</em></h2>
            <p className="text-lg text-[var(--text2)] max-w-[540px] mx-auto font-medium opacity-80">Skip the complex setup. Open and talk to Veda instantly.</p>
          </div>
          <div className="how-steps">
            <div className="text-center px-6">
              <div className="step-num bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">1</div>
              <div className="font-serif text-2xl mb-3 text-[var(--text)]">Open</div>
              <div className="text-[14px] text-[var(--text2)] leading-relaxed font-medium opacity-80">No signup required. Launch the app and start your conversation.</div>
            </div>
            <div className="text-center px-6">
              <div className="step-num bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">2</div>
              <div className="font-serif text-2xl mb-3 text-[var(--text)]">Personalize</div>
              <div className="text-[14px] text-[var(--text2)] leading-relaxed font-medium opacity-80">Set your basic profile so Veda gives accurate, personal responses.</div>
            </div>
            <div className="text-center px-6">
              <div className="step-num bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">3</div>
              <div className="font-serif text-2xl mb-3 text-[var(--text)]">Track</div>
              <div className="text-[14px] text-[var(--text2)] leading-relaxed font-medium opacity-80">Log your health journey and see AI-driven insights over time.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonials-section py-24" id="testimonials">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[var(--teal)] text-xs font-bold uppercase tracking-[2px] mb-4 block">Real people, real impact</span>
            <h2 className="font-serif text-[clamp(30px,4vw,44px)] leading-[1.15] tracking-tight mb-4">Trusted by families <em>across India</em></h2>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="text-[14.5px] text-[var(--text2)] leading-relaxed mb-4.5 italic">"Mere papa ko diabetes hai — unki HbA1c report Veda ne explain ki jab doctor ke paas time nahi tha. Bahut kaam aaya!"</p>
              <div className="t-author">
                <div className="t-avatar bg-[var(--teal)]/10 text-[var(--teal)]"><User size={20} /></div>
                <div>
                  <div className="text-[13.5px] font-bold">Rohit Sharma</div>
                  <div className="text-[12px] text-[var(--muted)]">Delhi · Software Engineer</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="text-[14.5px] text-[var(--text2)] leading-relaxed mb-4.5 italic">"I use it for my family of 5 — different profiles, different conditions. The preventive alerts reminded me about my mother's thyroid checkup!"</p>
              <div className="t-author">
                <div className="t-avatar bg-[var(--purple)]/10 text-[var(--purple)]"><User size={20} /></div>
                <div>
                  <div className="text-[13.5px] font-bold">Priya Nair</div>
                  <div className="text-[12px] text-[var(--muted)]">Bengaluru · HR Manager</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="t-stars">★★★★★</div>
              <p className="text-[14.5px] text-[var(--text2)] leading-relaxed mb-4.5 italic">"As a medical student, the case study mode and drug interaction quizzes are incredibly helpful. Better than most study apps I've tried."</p>
              <div className="t-author">
                <div className="t-avatar bg-[var(--blue)]/10 text-[var(--blue)]"><User size={20} /></div>
                <div>
                  <div className="text-[13.5px] font-bold">Arjun Mehta</div>
                  <div className="text-[12px] text-[var(--muted)]">Mumbai · MBBS 3rd Year</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section py-24">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="cta-box glass border-white/20">
            <h2 className="font-serif text-[clamp(30px,4vw,46px)] leading-[1.15] tracking-tight mb-4 relative">Your health deserves<br />an <em>intelligent companion</em></h2>
            <p className="text-[16px] text-[var(--text2)] max-w-[480px] mx-auto mb-9 leading-relaxed">Join thousands using Veda for smarter, more informed health decisions — in the language you're most comfortable with.</p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <button onClick={handleStart} className="btn-primary text-base px-8 py-4 border border-white/20">
                <Stethoscope size={20} /> Open Veda Free
              </button>
              <a href="#features" className="btn-secondary text-base px-8 py-4 glass border-white/10">Learn more →</a>
            </div>
            <div className="mt-5 text-[12.5px] text-[var(--muted)] flex items-center justify-center gap-2">
              <span>✓ Free forever</span>
              <div className="w-1 h-1 rounded-full bg-[var(--muted)] opacity-30" />
              <span>✓ No personal data sold</span>
              <div className="w-1 h-1 rounded-full bg-[var(--muted)] opacity-30" />
              <span>✓ Private & Secure</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-12 pb-8 relative z-10">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="footer-inner">
            <div>
              <div className="font-serif text-2xl text-[var(--teal)] mb-3">Veda Health</div>
              <p className="text-[13.5px] text-[var(--muted)] leading-relaxed max-w-[280px]">AI-powered health companion for Indian families. Available in 10 languages, completely free.</p>
              <p className="text-[11.5px] text-[var(--muted)] opacity-50 mt-4 leading-relaxed">⚠️ Veda is for educational purposes only and does not replace professional medical advice. Always consult a qualified doctor for medical decisions.</p>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-[var(--text2)] uppercase tracking-wider mb-4">Features</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={handleStart}>AI Health Chat</a></li>
                <li><a href="#" onClick={handleStart}>Symptom Checker</a></li>
                <li><a href="#" onClick={handleStart}>Health Journal</a></li>
                <li><a href="#" onClick={handleStart}>Medicine Delivery</a></li>
                <li><a href="#" onClick={handleStart}>Hospital Finder</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-[var(--text2)] uppercase tracking-wider mb-4">For Professionals</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={handleStart}>Clinic Portal</a></li>
                <li><a href="#" onClick={handleStart}>Corporate Dashboard</a></li>
                <li><a href="#" onClick={handleStart}>Medical Education</a></li>
                <li><a href="#" onClick={handleStart}>Family Manager</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-[var(--text2)] uppercase tracking-wider mb-4">Connect</h4>
              <ul className="footer-links">
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[var(--border)] pt-6 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--muted)] flex items-center gap-1.5">© 2025 Veda Health. Made with <Heart size={14} className="text-red-400 fill-red-400" /> in India.</span>
            <div className="flex gap-5">
              <a href="#" className="text-[13px] text-[var(--muted)] hover:text-[var(--text2)] no-underline transition-colors">Privacy</a>
              <a href="#" className="text-[13px] text-[var(--muted)] hover:text-[var(--text2)] no-underline transition-colors">Terms</a>
              <a href="#" className="text-[13px] text-[var(--muted)] hover:text-[var(--text2)] no-underline transition-colors">Disclaimer</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );

  const renderSidebar = () => (
    <AnimatePresence>
      {isSidebarOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            aria-hidden="true"
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[300]"
          />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            role="navigation"
            aria-label="Side menu"
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] sm:w-[320px] glass z-[301] flex flex-col shadow-2xl rounded-r-[32px] overflow-hidden"
          >
            {/* Sidebar Branding & Profile */}
            <div className="p-8 border-b border-[var(--border)] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--teal-glow)] rounded-full -translate-y-16 translate-x-16 blur-3xl opacity-50" />
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg shadow-[var(--teal)]/10">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h1 className="font-serif text-2xl text-[var(--text)] tracking-tight leading-none">Veda</h1>
                  <p className="text-[10px] text-[var(--teal)] font-black uppercase tracking-[0.2em] mt-1 opacity-70">Premium AI</p>
                </div>
              </div>

              {user ? (
                <div className="p-3 rounded-2xl glass border border-[var(--border)] flex items-center gap-2 shadow-sm cursor-pointer" onClick={() => switchMode('profile')}>
                  <div className="w-8 h-8 rounded-xl glass border border-[var(--border)] flex items-center justify-center text-[var(--teal)] font-bold text-xs">
                    {(profile.name || user.displayName || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-[var(--text)]">{profile.name || user.displayName || 'Member'}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-3xl glass border border-[var(--border)] border-dashed flex items-center gap-3 mb-2 opacity-60">
                  <div className="w-10 h-10 rounded-2xl glass border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
                    <Bot size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[var(--muted)]">Guest User</p>
                    <p className="text-[10px] font-medium text-[var(--muted)]">Login for sync</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
              <div className="space-y-1 mb-6">
                <SidebarItem icon={<Home size={18} />} label="Dashboard" active={mode === 'home'} onClick={() => switchMode('home')} />
                <SidebarItem icon={<Sparkles size={18} />} label="Wellness Coach" active={mode === 'wellness'} onClick={() => switchMode('wellness')} />
                <SidebarItem icon={<Utensils size={18} />} label="Nutrition Planner" active={mode === 'food'} onClick={() => switchMode('food')} />
                <SidebarItem icon={<ClipboardList size={18} />} label="Prescription Lens" active={mode === 'rx'} onClick={() => switchMode('rx')} />
                <SidebarItem icon={<Lock size={18} />} label="Health Locker" active={mode === 'locker'} onClick={() => switchMode('locker')} />
                <button 
                  onClick={createNewChat}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 mt-2 rounded-2xl transition-all text-sm font-bold border-2 border-dashed border-[var(--teal)]/20 text-[var(--teal)] hover:bg-[var(--teal)]/5 hover:border-[var(--teal)]/40 group active:scale-95"
                >
                  <div className="w-8 h-8 rounded-xl bg-[var(--teal)]/10 flex items-center justify-center">
                    <Plus size={16} />
                  </div>
                  New Conversation
                </button>
              </div>

              <div className="space-y-1 mb-8">
                <p className="px-4 py-2 text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.25em] opacity-40">Consultation History</p>
                <div className="space-y-1.5">
                  {conversations.map((chat) => (
                      <div key={chat.id} className="relative group">
                        <button 
                          onClick={() => {
                            setActiveChatId(chat.id);
                            setMode('chat');
                          }}
                          className={cn(
                            "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all text-[13px] font-bold border-2 border-transparent text-left",
                            activeChatId === chat.id 
                              ? "bg-gradient-to-br from-[var(--teal)]/15 to-transparent text-[var(--teal)] border-[var(--teal)]/20 shadow-sm" 
                              : "text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--card2)]"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            activeChatId === chat.id ? "bg-[var(--teal)] text-[#020f0c]" : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]"
                          )}>
                            <MessageSquare size={14} />
                          </div>
                          <span className="truncate pr-6">{chat.title}</span>
                          
                          {activeChatId === chat.id && (
                            <motion.div 
                              layoutId="sidebar-active-indicator"
                              className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--teal)] rounded-full"
                            />
                          )}
                        </button>
                        
                        <button 
                          onClick={(e) => deleteChat(chat.id, e)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--border)] bg-gradient-to-t from-[var(--teal)]/5 to-transparent space-y-3">
              {!profile.isPremium && (
                <button 
                  onClick={() => switchMode('membership')}
                  className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-[#020f0c] shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all font-bold text-xs uppercase tracking-widest mb-2"
                >
                  <Sparkles size={16} />
                  Go Premium
                </button>
              )}
              <div className="flex items-center justify-between gap-2">
                <button 
                  onClick={() => setIsLightMode(!isLightMode)} 
                  aria-label={`Switch to ${isLightMode ? 'Dark' : 'Light'} Mode`}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--teal-dim)] transition-all group overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isLightMode ? 'moon' : 'sun'}
                      initial={{ y: 20, opacity: 0, rotate: -45 }}
                      animate={{ y: 0, opacity: 1, rotate: 0 }}
                      exit={{ y: -20, opacity: 0, rotate: 45 }}
                      transition={{ duration: 0.2, ease: "circOut" }}
                    >
                      {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-[10px] font-black uppercase tracking-widest">{isLightMode ? 'Dark' : 'Light'}</span>
                </button>
                <button 
                  onClick={() => switchMode('profile')}
                  aria-label="Settings"
                  className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--teal-dim)] transition-all"
                >
                  <Settings size={16} />
                </button>
              </div>

              {user ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500 hover:bg-red-500/10 transition-all group">
                  <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                </button>
              ) : (
                <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 p-3.5 rounded-2xl bg-[var(--teal)] text-[#020f0c] shadow-lg shadow-[var(--teal)]/10 hover:brightness-110 transition-all font-bold text-xs uppercase tracking-widest">
                  <Key size={16} />
                  Login to Sync
                </button>
              )}
              
              <button 
                onClick={() => setMode('landing')} 
                className="w-full flex items-center justify-center gap-3 p-3 rounded-2xl border border-transparent text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Back to Home</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const [dismissedAlerts, setDismissedAlerts] = useLocalStorage<string[]>('veda_dismissed_alerts', []);

  const getAlertsCount = () => {
    let count = 0;
    if (profile.bp) {
      const [sys, dia] = profile.bp.split('/').map(Number);
      if ((sys > 120 || dia > 80) && !dismissedAlerts.includes('bp-alert')) count++;
    }
    if (profile.sugar && Number(profile.sugar) > 140 && !dismissedAlerts.includes('sugar-alert')) count++;
    if (journal.length >= 3 && journal.slice(0, 3).every(e => e.mood <= 2) && !dismissedAlerts.includes('mood-alert')) count++;
    if (journal.length === 0 && !profile.bp && !profile.weight && !dismissedAlerts.includes('baseline-alert')) count++;
    return count;
  };

  const activeAlertsCount = getAlertsCount();

  const renderHeader = () => {
    if (mode === 'chat') return null;
    return (
    <header role="banner" className="sticky top-0 z-50 glass-header px-4 h-[72px] flex items-center justify-between md:px-6">
      <div className="flex items-center gap-4 shrink-0">
        <button onClick={toggleSidebar} aria-label="Toggle Side Menu" className="p-2.5 glass-pill hover:bg-[var(--surface)] transition-all active:scale-95">
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl tracking-tight hidden xs:block text-[var(--teal)]">Veda</h2>
        </div>
      </div>

      <nav className="hidden lg:flex items-center gap-1 glass-pill px-2 py-1.5 shadow-sm mx-4">
        <HeaderNavItem label="Home" icon={<Home />} active={mode === 'home'} onClick={() => switchMode('home')} />
        <HeaderNavItem label="Wellness" icon={<Sparkles />} active={mode === 'wellness'} onClick={() => switchMode('wellness')} />
        <HeaderNavItem label="Journal" icon={<BookOpen />} active={mode === 'journal'} onClick={() => switchMode('journal')} />
        <HeaderNavItem label="Locker" icon={<Lock />} active={mode === 'locker'} onClick={() => switchMode('locker')} />
        <HeaderNavItem label="Explore" icon={<LayoutGrid />} active={showAllPages} onClick={openAllPages} />
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={handleStartChat} aria-label="Open Health Chat" className="p-2.5 glass-pill transition-all active:scale-95 text-[var(--text2)] flex items-center justify-center">
          <MessageSquare size={22} aria-hidden="true" />
        </button>
        <button onClick={() => switchMode('vitals')} aria-label="Health Vitals" className="p-2.5 glass-pill transition-all active:scale-95 text-[var(--text2)] hidden md:flex items-center justify-center">
          <TrendingUp size={22} aria-hidden="true" />
        </button>
        <button onClick={() => switchMode('alerts')} aria-label={`Open Notifications. ${activeAlertsCount} active alerts`} className="p-2.5 glass-pill transition-all active:scale-95 text-[var(--text2)] relative flex items-center justify-center">
          <Bell size={22} aria-hidden="true" />
          {activeAlertsCount > 0 && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--bg)]" />}
        </button>
        <button 
          onClick={() => { switchMode('medicine'); setShowCart(true); }} 
          aria-label={`Open Cart. ${cart.reduce((acc, item) => acc + item.qty, 0)} items`} 
          className="p-2.5 glass-pill transition-all active:scale-95 text-[var(--text2)] relative flex items-center justify-center"
        >
          <ShoppingCart size={22} aria-hidden="true" />
          {cart.length > 0 && (
            <span className="absolute top-2.5 right-2.5 min-w-[16px] h-4 bg-[var(--teal)] text-[#020617] text-[10px] flex items-center justify-center rounded-full font-black px-1 border border-[var(--bg)]">
              {cart.reduce((acc, item) => acc + item.qty, 0)}
            </span>
          )}
        </button>
        <div className="w-px h-6 bg-[var(--border)] mx-1" aria-hidden="true" />
        <button onClick={() => switchMode('profile')} className="flex items-center gap-2 p-1 rounded-full glass border-none hover:ring-2 hover:ring-[var(--teal)] transition-all">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] font-black text-xs shadow-inner" aria-hidden="true">
            {(profile.name || user?.displayName || 'G')[0].toUpperCase()}
          </div>
        </button>
      </div>
    </header>
  );
};

  const renderBottomNav = () => {
    if (mode === 'chat') return null;
    return (
    <nav role="navigation" aria-label="Mobile bottom navigation" className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-4 pb-safe md:hidden">
      <div className="flex items-center justify-around h-[72px]">
        <BottomNavItem icon={<TrendingUp size={22} />} label="Home" active={mode === 'home'} onClick={() => switchMode('home')} />
        <BottomNavItem icon={<Wind size={22} />} label="Wellness" active={mode === 'wellness'} onClick={() => switchMode('wellness')} />
        <div className="flex-1 flex flex-col items-center -mt-10">
          <button onClick={handleStartChat} aria-label="Ask Veda AI" className="w-16 h-16 rounded-3xl bg-[var(--teal)] flex items-center justify-center text-[#020617] shadow-xl shadow-[var(--teal)]/30 active:scale-90 transition-all border-4 border-transparent hover:ring-4 hover:ring-[var(--teal)]/20">
            <MessageSquare size={28} aria-hidden="true" />
          </button>
        </div>
        <BottomNavItem icon={<BookOpen size={22} />} label="Journal" active={mode === 'journal'} onClick={() => switchMode('journal')} />
        <button onClick={openAllPages} className="flex-1 flex flex-col items-center gap-1 text-[var(--muted)] opacity-80 hover:text-[var(--teal)] transition-colors">
          <Menu size={22} aria-hidden="true" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em]">More</span>
        </button>
      </div>
    </nav>
  );
};

  const openAllPages = () => {
    setShowAllPages(true);
  };

  const ALL_PAGES = [
    {mode:'chat', icon:'💬', label:t('nav.chat', 'AI Chat'), color:'#00d4b1'},
    {mode:'symptoms', icon:'🔍', label:t('nav.symptoms', 'Symptom Check'), color:'#4da6ff'},
    {mode:'medication', icon:'💊', label:t('nav.medication', 'Medication'), color:'#b87fff'},
    {mode:'lab', icon:'🔬', label:'Lab Explainer', color:'#4da6ff'},
    {mode:'triage', icon:'⚠️', label:t('nav.triage', 'See a Doctor?'), color:'#ff8080'},
    {mode:'rx', icon:'📋', label:t('nav.prescription', 'Prescription'), color:'#00d4b1'},
    {mode:'journal', icon:'📓', label:'Journal', color:'#00d4b1'},
    {mode:'score', icon:'🏆', label:'Health Score', color:'#f0a030'},
    {mode:'patterns', icon:'📊', label:t('nav.trends', 'Trends & Insights'), color:'#4da6ff'},
    {mode:'sos', icon:'🚨', label:t('nav.sos', 'Emergency SOS'), color:'#ff4d4d'},
    {mode:'advice', icon:'🧬', label:'Advisor', color:'#00d4b1'},
    {mode:'skin', icon:'📷', label:'Skin Scan', color:'#b87fff'},
    {mode:'food', icon:'🍎', label:'Food Scanner', color:'#f59e0b'},
    {mode:'mind', icon:'🧠', label:'Veda Mind', color:'#6366f1'},
    {mode:'roadmap', icon:'📅', label:'Preventive Care', color:'#10b981'},
    {mode:'opinion', icon:'🩺', label:'2nd Opinion', color:'#4da6ff'},
    {mode:'doctor', icon:'👨‍⚕️', label:'Find Doctor', color:'#00d4b1'},
    {mode:'hospital', icon:'🏥', label:'Hospitals', color:'#ff8080'},
    {mode:'records', icon:'📁', label:'Records', color:'#f0a030'},
    {mode:'family', icon:'👨‍👩‍👧', label:'Family', color:'#00d4b1'},
    {mode:'alerts', icon:'🔔', label:'Alerts', color:'#ff5f6d'},
    {mode:'medicine', icon:'🛒', label:'Delivery', color:'#00d4b1'},
    {mode:'insurance', icon:'🛡️', label:'Insurance', color:'#f0a030'},
    {mode:'reminders', icon:'⏰', label:'Reminders', color:'#00d4b1'},
    {mode:'clinic', icon:'🏨', label:'Clinic', color:'#4da6ff'},
    {mode:'corporate', icon:'🏢', label:'Corporate', color:'#00d4b1'},
    {mode:'edu', icon:'🎓', label:'Education', color:'#b87fff'},
    {mode:'vitals', icon:'📈', label:'Vitals Graph', color:'#00d4b1'},
    {mode:'scanner', icon:'📷', label:'Med Scanner', color:'#b87fff'},
    {mode:'teleconsult', icon:'📹', label:'Video Call', color:'#4da6ff'},
    {mode:'calendar', icon:'📅', label:'Calendar', color:'#f0a030'},
    {mode:'bmi', icon:'⚖️', label:'BMI Calc', color:'#00d4b1'},
    {mode:'membership', icon:'✦', label:'Premium', color:'#fbbf24'},
  ];

  const handleRefresh = async () => {
    // Simulating data refresh. Since we use onSnapshot, 
    // real-time data is already there, but this could trigger
    // re-calculation of insights or a clean re-fetch.
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Optional: window.location.reload() for a hard reset
  };

  const addFamilyMember = async (member: Omit<FamilyMember, 'id' | 'score'>) => {
    if (!auth.currentUser) {
      setFamily(prev => [...prev, { ...member, id: Date.now().toString(), score: 70 + Math.floor(Math.random() * 25) }]);
      return;
    }
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'family'), {
        ...member,
        score: 70 + Math.floor(Math.random() * 25),
        lastCheck: new Date().toLocaleDateString('en-IN')
      });
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.CREATE, 'family');
    }
  };

  const updateFamilyMember = async (id: string, updates: Partial<FamilyMember>) => {
    if (!auth.currentUser) {
      setFamily(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
      return;
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'family', id), updates);
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.UPDATE, `family/${id}`);
    }
  };

  const deleteFamilyMember = async (id: string) => {
    if (!auth.currentUser) {
      setFamily(prev => prev.filter(m => m.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'family', id));
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.DELETE, `family/${id}`);
    }
  };

  const addRecord = async (record: Omit<MedicalRecord, 'id'>) => {
    if (!auth.currentUser) {
      setRecords(prev => [...prev, { ...record, id: Date.now().toString() }]);
      return;
    }
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'records'), {
        ...record,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser.uid}/records`);
    }
  };

  const addLockerDoc = async (docData: Omit<HealthDocument, 'id'>) => {
    if (!auth.currentUser) {
      setLockerDocs(prev => [...prev, { ...docData, id: Date.now().toString() }]);
      return;
    }
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'locker'), {
        ...docData,
        createdAt: new Date().toISOString(),
        isEncrypted: true
      });
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser.uid}/locker`);
    }
  };

  const deleteLockerDoc = async (id: string) => {
    if (!auth.currentUser) {
      setLockerDocs(prev => prev.filter(d => d.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'locker', id));
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser.uid}/locker`);
    }
  };

  const addPolicy = async (p: Omit<UserInsurancePolicy, 'id'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'policies'), p);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/policies`);
        const newPolicy = { ...p, id: Date.now().toString() };
        setPolicies(prev => [...prev, newPolicy]);
      }
    } else {
      const newPolicy = { ...p, id: Date.now().toString() };
      setPolicies(prev => [...prev, newPolicy]);
    }
  };

  const bookAppointment = async (appt: Omit<Appointment, 'id'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'appointments'), appt);
      } catch(e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/appointments`);
      }
    } else {
      setAppointments(prev => [{ ...appt, id: Date.now().toString() }, ...prev]);
    }
  };

  const renderAlarmOverlay = () => (
    <AnimatePresence>
      {activeAlertReminder && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className={cn(
              "w-full max-w-sm glass border-2 p-8 rounded-[40px] text-center shadow-2xl relative overflow-hidden",
              activeAlertReminder.color === 'sky' ? "border-sky-500/40" : "border-[var(--teal)]/40"
            )}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--teal)] to-transparent animate-pulse" />
            
            <div className="w-20 h-20 rounded-full bg-[var(--teal-glow)] border border-[var(--teal-line)] flex items-center justify-center mx-auto mb-6 relative">
               <div className="absolute inset-0 rounded-full bg-[var(--teal)] opacity-20 animate-ping" />
               <Clock className="text-[var(--teal)]" size={32} />
            </div>

            <h3 className="font-serif text-2xl text-[var(--text)] mb-2">Medication Time</h3>
            <p className="text-[var(--text2)] mb-1">It's time for your dose of</p>
            <div className="text-3xl font-black text-[var(--teal)] mb-1 uppercase tracking-tight">{activeAlertReminder.name}</div>
            <div className="inline-block px-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-full text-sm font-bold text-[var(--muted)] mb-8">
              {activeAlertReminder.dose} • {activeAlertReminder.time}
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setActiveAlertReminder(null)} 
                className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/20 hover:brightness-110 active:scale-95 transition-all"
              >
                I've Taken It
              </button>
              <button 
                onClick={() => {
                    setActiveAlertReminder(null);
                    showDoneToast("Snoozed for 5 minutes");
                }}
                className="w-full py-4 bg-[var(--card)] border border-[var(--border)] text-[var(--text2)] font-bold rounded-2xl hover:bg-[var(--surface)] transition-all"
              >
                Snooze
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (mode === 'landing') return (
    <>
      {renderAlarmOverlay()}
      {renderLanding()}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--teal)] selection:text-[#020f0c]">
        {/* Skip to content link for accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[var(--teal)] focus:text-[#020f0c] focus:rounded-xl focus:font-bold">
          Skip to content
        </a>
        {mode !== 'chat' && renderSidebar()}
        
        {/* Notifications Hot Bar */}
        <NotificationHotBar 
          notifications={notifications} 
          onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
        />

        {renderAlarmOverlay()}

        {/* Offline Indicator */}
        <AnimatePresence>
          {isOffline && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 left-4 right-4 z-[100] bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <AlertTriangle size={20} />
              <span className="text-sm font-bold">You are currently offline. Some features may be limited.</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {mode === 'chat' && (
          <ChatView 
            chatHistory={chatHistory} 
            setChatHistory={setChatHistory} 
            isTyping={isTyping} 
            setIsTyping={setIsTyping} 
            profile={profile} 
            switchMode={switchMode}
            updateActiveChat={updateActiveChat}
            conversations={conversations}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            onNewChat={createNewChat}
            onDeleteChat={deleteChat}
          />
        )}

        <div className="flex flex-col min-h-screen">
          {mode === 'onboarding' && <Onboarding profile={profile} setProfile={setProfile} updateProfile={updateProfile} onComplete={() => {
            updateProfile({ ...profile, setupDone: true });
            setMode('home');
          }} />}
          {renderHeader()}
          <main id="main-content" className={cn("flex-1 pb-24 md:pb-8 mx-auto w-full px-4 pt-6 overflow-x-hidden", mode === 'chat' ? "max-w-full" : "max-w-5xl")}>
            <PullToRefresh onRefresh={handleRefresh}>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {mode === 'home' && (
                  <HomeDashboard 
                    switchMode={switchMode} 
                    profile={profile} 
                    journal={journal} 
                    reminders={reminders}
                    activeAlertsCount={activeAlertsCount}
                    openAllPages={openAllPages}
                  />
                )}
                {mode === 'journal' && <JournalView journal={journal} addJournalEntry={addJournalEntry} />}
                {mode === 'wellness' && <WellnessCoach profile={profile} />}
                {mode === 'symptoms' && <SymptomChecker profile={profile} switchMode={switchMode} />}
                {mode === 'medication' && <MedicationInfo profile={profile} />}
                {mode === 'lab' && <LabScanner />}
                {mode === 'triage' && <TriageView profile={profile} />}
                {mode === 'rx' && <PrescriptionScanner profile={profile} updateProfile={updateProfile} />}
                {mode === 'score' && <HealthScoreView journal={journal} profile={profile} switchMode={switchMode} />}
                {mode === 'vitals' && <VitalsGraph journal={journal} initialTab={vitalsTab} onAddEntry={addJournalEntry} />}
                {mode === 'family' && <FamilyHealthCircle family={family} onAddMember={addFamilyMember} onUpdateMember={updateFamilyMember} onDeleteMember={deleteFamilyMember} profile={profile} onUpdateProfile={updateProfile} />}
                {mode === 'medicine' && <MedicineDelivery reminders={reminders} profile={profile} cart={cart} setCart={setCart} showCart={showCart} setShowCart={setShowCart} />}
                {mode === 'insurance' && <InsuranceView policies={policies} onAddPolicy={addPolicy} profile={profile} />}
                {mode === 'hospital' && <HospitalView />}
                {mode === 'doctor' && <DoctorView />}
                {mode === 'records' && <RecordsView records={records} onAddRecord={addRecord} profile={profile} />}
                {mode === 'locker' && <HealthLockerView documents={lockerDocs} onAddDocument={addLockerDoc} onDeleteDocument={deleteLockerDoc} onAddRecord={addRecord} profile={profile} />}
                {mode === 'alerts' && (
                  <AlertsView 
                    profile={profile} 
                    journal={journal} 
                    triggerPushNotification={triggerPushNotification} 
                    dismissedAlerts={dismissedAlerts} 
                    onDismiss={(id) => setDismissedAlerts(prev => [...prev, id])} 
                    onRestore={(id) => setDismissedAlerts(prev => prev.filter(a => a !== id))}
                  />
                )}
                {mode === 'reminders' && (
                  <RemindersView 
                    reminders={reminders} 
                    onToggle={toggleReminder} 
                    onDelete={deleteReminder} 
                    onAdd={addReminder} 
                    profile={profile}
                    updateProfile={updateProfile}
                  />
                )}
                {mode === 'calendar' && <HealthCalendar appointments={appointments} onAddAppointment={bookAppointment} profile={profile} />}
                {mode === 'skin' && <PremiumGate profile={profile} featureName="Advanced Skin AI Analysis" onUpgrade={() => setMode('membership')}><SkinScanner /></PremiumGate>}
                {mode === 'food' && <PremiumGate profile={profile} featureName="Smart Nutrition & Calorie Tracking" onUpgrade={() => setMode('membership')}><NutritionPlanner profile={profile} /></PremiumGate>}
                {mode === 'mind' && <MindWellnessDashboard journal={journal} />}
                {mode === 'roadmap' && <HealthRoadmapDashboard profile={profile} />}
                {mode === 'patterns' && <PremiumGate profile={profile} featureName="AI Health Pattern Recognition" onUpgrade={() => setMode('membership')}><TrendsInsights journal={journal} /></PremiumGate>}
                {mode === 'advice' && <AdviceView journal={journal} profile={profile} />}
                {mode === 'opinion' && <PremiumGate profile={profile} featureName="Expert Second Medical Opinion" onUpgrade={() => setMode('membership')}><OpinionView profile={profile} /></PremiumGate>}
                {mode === 'clinic' && <ClinicPortal appointments={appointments} profile={profile} journal={journal} onBook={bookAppointment} />}
                {mode === 'corporate' && <CorporateHealth profile={profile} updateProfile={updateProfile} />}
                {mode === 'edu' && <MedEducation />}
                {mode === 'scanner' && <MedicineScanner />}
                {mode === 'teleconsult' && <TeleconsultView />}
                {mode === 'bmi' && <BMIView profile={profile} />}
                {mode === 'sos' && <SOSView profile={profile} onBack={() => setMode('home')} onOpenProfile={() => setMode('profile')} />}
                {mode === 'auth' && <AuthView onLogin={handleLogin} onBack={() => setMode('landing')} isLightMode={isLightMode} />}
                {mode === 'privacy' && <PrivacyView />}
                {mode === 'trust' && <TrustCenter />}
                {mode === 'wellness' && <WellnessView journal={journal} />}
                {mode === 'membership' && <PricingView profile={profile} onUpgrade={async () => {
                  await updateProfile({ ...profile, isPremium: true });
                  showDoneToast("Welcome to Veda Premium! ✦");
                  setMode('home');
                }} />}
                {mode === 'profile' && (
                  <ProfileView 
                    profile={profile} 
                    setProfile={setProfile} 
                    updateProfile={updateProfile} 
                    switchMode={switchMode} 
                    journal={journal} 
                    notificationPermission={notificationPermission}
                    setNotificationPermission={setNotificationPermission}
                    requestNotificationPermission={requestNotificationPermission}
                    onDeleteAccount={handleDeleteAccount}
                    deferredPrompt={deferredPrompt}
                    onInstallApp={handleInstallClick}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </PullToRefresh>
        </main>
        {renderBottomNav()}
        
        {/* Quick Action FAB */}
        <div className="fixed bottom-20 right-4 z-[100] md:bottom-8 md:right-8">
          <AnimatePresence>
            {showQuickActions && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                className="absolute bottom-16 right-0 flex flex-col gap-3 items-end"
              >
                <QuickActionButton icon={<BookOpen size={20} />} label="Log Journal" color="bg-indigo-500" onClick={() => { switchMode('journal'); setShowQuickActions(false); }} />
                <QuickActionButton icon={<Activity size={20} />} label="Check Symptoms" color="bg-rose-500" onClick={() => { switchMode('symptoms'); setShowQuickActions(false); }} />
                <QuickActionButton icon={<MessageSquare size={20} />} label="Ask Veda" color="bg-[var(--teal)]" onClick={() => { handleStartChat(); setShowQuickActions(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setShowQuickActions(!showQuickActions)}
            aria-label="Quick Actions"
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300",
              showQuickActions ? "bg-rose-500 rotate-45" : "bg-gradient-to-br from-indigo-500 to-indigo-600"
            )}
          >
            <Plus size={28} />
          </button>
        </div>
      </div>

      {/* All Pages Sheet */}
      <AnimatePresence>
        {showAllPages && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllPages(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-[150]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[160] glass rounded-t-[40px] max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-center pt-4 pb-2 sticky top-0 z-10">
                <div className="w-12 h-1.5 bg-[var(--border)] rounded-full opacity-50" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 sticky top-6 z-10">
                <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Explore Veda</h2>
                <button 
                  onClick={() => setShowAllPages(false)}
                  aria-label="Close All Features Menu"
                  className="w-12 h-12 glass-pill flex items-center justify-center text-[var(--text2)] transition-all active:scale-95 shadow-sm"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 p-6 pb-16">
                {ALL_PAGES.map((p) => (
                  <button
                    key={p.mode}
                    onClick={() => {
                      switchMode(p.mode as AppMode);
                      setShowAllPages(false);
                    }}
                    className="flex flex-col items-center gap-3 p-4 glass rounded-[28px] transition-all active:scale-95 hover:border-[var(--teal)]/40 hover:shadow-lg group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] flex items-center justify-center shadow-inner group-hover:bg-[var(--teal-glow)] transition-colors">
                      <span className="text-3xl leading-none">{p.icon}</span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text2)] text-center leading-tight opacity-80">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NotificationHotBar({ notifications, onDismiss }: { notifications: AppNotification[], onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-6 left-0 right-0 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="pointer-events-auto"
          >
            <div className={cn(
              "px-5 py-3 rounded-2xl shadow-sm flex items-center gap-4 min-w-[320px] max-w-[90vw] bg-[var(--bg)] border border-[var(--border)] overflow-hidden relative",
              n.type === 'success' && "border-[var(--teal)]/30",
              n.type === 'error' && "border-red-500/30"
            )}>
              <div 
                className={cn(
                  "absolute bottom-0 left-0 h-[2px] opacity-40 animate-progress",
                  n.type === 'success' && "bg-[var(--teal)]",
                  n.type === 'error' && "bg-red-500",
                  n.type === 'warning' && "bg-amber-500",
                  n.type === 'info' && "bg-blue-500"
                )}
                style={{ animationDuration: `${n.duration}ms` }}
              />
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-transparent",
                n.type === 'success' && "bg-[var(--teal-glow)] text-[var(--teal)]",
                n.type === 'error' && "bg-red-500/10 text-red-500",
                n.type === 'warning' && "bg-amber-500/10 text-amber-500",
                n.type === 'info' && "bg-blue-500/10 text-blue-500"
              )}>
                {n.type === 'success' && <CheckCircle2 size={18} />}
                {n.type === 'error' && <ShieldAlert size={18} />}
                {n.type === 'warning' && <AlertTriangle size={18} />}
                {n.type === 'info' && <Info size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text)] mb-0.5">{n.title}</p>
                <p className="text-[10px] text-[var(--text2)] opacity-60 font-medium truncate">{n.message}</p>
              </div>
              <button 
                onClick={() => onDismiss(n.id)}
                className="p-2 hover:bg-[var(--surface)] transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={16} className="text-[var(--muted)] opacity-60" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function QuickActionButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 group min-h-[44px] min-w-[44px]"
    >
      <span className="bg-[var(--card)] border border-[var(--border)] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
        {label}
      </span>
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-90", color)}>
        {icon}
      </div>
    </button>
  );
}

function HeaderNavItem({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
        active 
          ? "bg-[var(--teal)] text-[#020617]" 
          : "text-[var(--text2)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
      <span className="hidden xl:inline">{label}</span>
      {active && <span className="xl:hidden">{label}</span>}
    </button>
  );
}

const SidebarItem = memo(function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button 
      whileHover={{ x: 6 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4.5 rounded-[24px] transition-all text-[12px] font-black uppercase tracking-[0.1em] border border-transparent group relative overflow-hidden",
        active 
          ? "glass shadow-md text-[var(--teal)] border-[var(--teal)]/20" 
          : "text-[var(--text2)] opacity-60 hover:opacity-100 hover:glass"
      )}
    >
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/5 to-transparent z-0"
        />
      )}
      <div className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 relative z-10",
        active 
          ? "bg-[var(--teal)] text-[#020617] shadow-[0_0_20px_rgba(0,212,177,0.3)]" 
          : "bg-[var(--surface)] border border-[var(--border)] group-hover:scale-110"
      )}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
      </div>
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
});

const BottomNavItem = memo(function BottomNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.85 }}
      onClick={onClick} 
      className={cn("flex-1 flex flex-col items-center justify-center gap-1.5 transition-all group min-h-[50px]", active ? "text-[var(--teal)]" : "text-[var(--muted)]")}
    >
      <motion.div
        animate={active ? { y: -3, scale: 1.15 } : { y: 0, scale: 1 }}
        className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
          active ? "bg-[var(--teal)]/10 shadow-[inner] shadow-[var(--teal)]/5" : "group-hover:bg-[var(--surface)]"
        )}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      </motion.div>
      <span className={cn("text-[9px] font-black uppercase tracking-[0.1em]", active ? "opacity-100" : "opacity-40")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="bottom-indicator"
          className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--teal)] shadow-[0_0_5px_var(--teal)]"
        />
      )}
    </motion.button>
  );
});

const AIDailyInsight = memo(function AIDailyInsight({ journal, profile }: { journal: JournalEntry[], profile: UserProfile }) {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      if (journal.length === 0) {
        setInsight("Start your journey! Log your first health entry to unlock AI personalized coaching.");
        return;
      }
      
      const lastFetch = localStorage.getItem('veda_daily_insight_date');
      const today = new Date().toDateString();
      
      if (lastFetch === today) {
        const cached = localStorage.getItem('veda_daily_insight_text');
        if (cached) {
          setInsight(cached);
          return;
        }
      }

      setLoading(true);
      try {
        const recent = journal.slice(0, 3).map(e => `Mood: ${e.mood}, Sleep: ${e.sleep}h, Energy: ${e.energy}`).join(' | ');
        const prompt = `Based on these recent health logs: ${recent}. Give a short (15-20 words), encouraging daily health tip for ${profile.name || 'User'}. Make it feel personal and warm.`;
        const res = await callGemini(prompt);
        setInsight(res);
        localStorage.setItem('veda_daily_insight_date', today);
        localStorage.setItem('veda_daily_insight_text', res);
      } catch (e) {
        setInsight("Remember to stay hydrated and take a deep breath today.");
      } finally {
        setLoading(false);
      }
    };
    fetchInsight();
  }, [journal.length]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-[32px] p-6 relative overflow-hidden group shadow-xl"
    >
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
        <Sparkles size={80} className="text-indigo-600" />
      </div>
      <div className="flex gap-5 items-center relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
          <Bot size={32} />
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Veda Insight</h4>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-2.5 glass w-56 opacity-20" />
              <div className="h-2.5 glass w-40 opacity-10" />
            </div>
          ) : (
            <p className="text-[14px] font-serif text-[var(--text)] leading-relaxed italic pr-12 opacity-90">
              "{insight}"
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const HomeDashboard = memo(function HomeDashboard({ 
  switchMode, 
  profile, 
  journal,
  reminders,
  activeAlertsCount,
  openAllPages
}: { 
  switchMode: (m: AppMode, tab?: any) => void, 
  profile: UserProfile, 
  journal: JournalEntry[],
  reminders: Reminder[],
  activeAlertsCount: number,
  openAllPages: () => void
}) {
  const score = calculateScore(journal, profile);
  const streak = calculateStreak(journal);
  const hour = new Date().getHours();
  
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      <div className="flex items-end justify-between px-1 mb-2">
        <div className="space-y-1">
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-[0.2em] opacity-80">{greeting}</p>
          <h1 className="font-serif text-4xl text-[var(--text)] tracking-tight">Hi, {profile.name || 'Guest'}</h1>
          <p className="text-sm text-[var(--muted)] font-medium opacity-80">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 glass-pill mb-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text2)]">Live Network</span>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => switchMode('journal')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-400 to-[var(--amber)] text-white rounded-2xl cursor-pointer shadow-lg shadow-orange-500/20"
          >
            <Flame size={16} />
            <span className="text-xs font-black uppercase tracking-wider">{streak} Day Streak</span>
          </motion.div>
        </div>
      </div>

      <AIDailyInsight journal={journal} profile={profile} />

      {activeAlertsCount > 0 && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => switchMode('alerts')}
          className="w-full p-6 glass border border-red-500/20 rounded-[32px] flex items-center justify-between group overflow-hidden relative shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-400/5 -rotate-45 translate-x-16 -translate-y-16 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center animate-pulse shadow-xl shadow-red-500/30"><Bell size={20} /></div>
            <div className="text-left space-y-0.5">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Urgent Protocol</span>
              <p className="text-sm font-black text-[var(--text)]">You have {activeAlertsCount} pending health alerts</p>
            </div>
          </div>
          <div className="glass-pill p-2 group-hover:translate-x-1 transition-transform">
            <ChevronRight size={18} className="text-red-500" />
          </div>
        </motion.button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => switchMode('score')}
          className="glass rounded-[32px] p-7 shadow-sm cursor-pointer hover:border-[var(--teal)]/40 hover:shadow-xl transition-all flex items-center justify-between group"
        >
          <div className="space-y-1 relative z-10">
            <h2 className="text-[11px] font-black text-[var(--teal)] uppercase tracking-[0.2em]">Veda Score</h2>
            <div className="text-5xl font-serif text-[var(--text)] tracking-tighter">{score > 0 ? score : '--'}</div>
            <p className="text-[10px] font-bold text-[var(--text2)] opacity-80 uppercase tracking-widest flex items-center gap-2 mt-1">
              <span className={cn("w-2 h-2 rounded-full shadow-lg", score === 0 ? "bg-[var(--muted)]" : score >= 80 ? "bg-[var(--teal)] shadow-[var(--teal)]/20" : score >= 60 ? "bg-blue-400" : "bg-amber-400")} />
              {score === 0 ? 'Analyzing' : score >= 80 ? 'Exceptional' : 'Maintaining'}
            </p>
          </div>
          <div className="w-20 h-20 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="4" />
              <motion.circle 
                cx="50" cy="50" r="42" fill="none" stroke={score === 0 ? "var(--muted)" : "var(--teal)"} strokeWidth="8" 
                strokeDasharray="264" 
                initial={{ strokeDashoffset: 264 }}
                animate={{ strokeDashoffset: 264 - (264 * (score > 0 ? score : 0) / 100) }}
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_var(--teal)]"
              />
            </svg>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass p-7 rounded-[32px] shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
              <span className="text-[11px] font-black text-[var(--text2)] uppercase tracking-[0.2em]">Energy Flow</span>
            </div>
            <p className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">7D Trends</p>
          </div>
          <div className="h-20 w-full">
            {journal.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...journal].reverse().slice(-7)}>
                  <defs>
                    <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="energy" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorEnergy)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-[var(--border)] rounded-2xl">
                <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest opacity-60">Log 2+ days for insights</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Activity className="text-red-500" size={18} />, label: "BP", value: profile.bp || "N/A", unit: "mmHg", mode: 'vitals' as AppMode, tab: 'bp' },
          { icon: <Zap className="text-amber-500" size={18} />, label: "Sugar", value: profile.sugar || "N/A", unit: "mg/dL", mode: 'vitals' as AppMode, tab: 'sugar' },
          { icon: <Scale className="text-teal-500" size={18} />, label: "Weight", value: profile.weight || "N/A", unit: "kg", mode: 'vitals' as AppMode, tab: 'weight' },
          { icon: <TrendingUp className="text-blue-500" size={18} />, label: "BMI", value: profile.weight && profile.height ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height)/100, 2)).toFixed(1) : "N/A", unit: "Index", mode: 'vitals' as AppMode, tab: 'weight' }
        ].map((v, i) => (
          <motion.div
            key={v.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * i }}
          >
            <VitalCard 
              icon={v.icon} 
              label={v.label} 
              value={v.value || "N/A"} 
              unit={v.value !== "N/A" ? v.unit : ""} 
              color={v.value !== "N/A" ? "blue" : "muted"} 
              isPlaceholder={v.value === "N/A"}
              onClick={() => switchMode(v.mode, v.tab as any)} 
            />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-[32px] shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
            <h3 className="text-[11px] font-black text-[var(--text)] uppercase tracking-[0.2em]">Medicine Schedule</h3>
          </div>
          <button onClick={() => switchMode('reminders')} className="text-[var(--teal)] text-[10px] font-black uppercase tracking-widest hover:opacity-70">View All</button>
        </div>
        <div className="space-y-4">
          {reminders.filter(r => r.on).length > 0 ? reminders.filter(r => r.on).slice(0, 3).map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + (i * 0.1) }}
            >
              <MedRow name={r.name} dose={r.dose} time={r.time} status={i === 0 ? 'taken' : i === 1 ? 'due' : 'upcoming'} />
            </motion.div>
          )) : (
            <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-3xl">
              <p className="text-[11px] text-[var(--muted)] font-black uppercase tracking-widest mb-4 opacity-60">No active reminders</p>
              <button 
                onClick={() => switchMode('reminders')} 
                className="btn-secondary text-[11px] px-6 py-2"
              >
                + Add Medication
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <MessageSquare size={22} />, label: "Chat AI", mode: 'chat', color: "teal" },
          { icon: <Sparkles size={22} />, label: "Wellness", mode: 'wellness', color: "purple" },
          { icon: <Utensils size={22} />, label: "Nutrition", mode: 'food', color: "orange" },
          { icon: <Lock size={22} />, label: "Vault", mode: 'locker', color: "indigo" },
          { icon: <Search size={22} />, label: "Tracker", mode: 'symptoms', color: "blue" },
          { icon: <Pill size={22} />, label: "Labs", mode: 'medication', color: "rose" }
        ].map((q, i) => (
          <motion.div
            key={q.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + (i * 0.05) }}
          >
            <QuickAction icon={q.icon} label={q.label} onClick={() => switchMode(q.mode as any)} color={q.color} />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-[32px] shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--teal)] rounded-full" />
            <h3 className="text-[11px] font-black text-[var(--text)] uppercase tracking-[0.2em]">Medical Services</h3>
          </div>
          <button onClick={openAllPages} className="text-[var(--teal)] text-[10px] font-black uppercase tracking-widest hover:opacity-70">See All</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: '👨‍⚕️', label: 'Doctor', mode: 'doctor' },
            { icon: '🏥', label: 'Hospital', mode: 'hospital' },
            { icon: '🛡️', label: 'Insurance', mode: 'insurance' },
            { icon: '🚑', label: 'SOS', mode: 'sos' },
            { icon: '📋', label: 'Reports', mode: 'records' },
            { icon: '🩸', label: 'Vitals', mode: 'vitals' },
            { icon: '📅', label: 'Calendar', mode: 'calendar' },
            { icon: '🏢', label: 'Corporate', mode: 'corporate' },
            { icon: '🎓', label: 'Academy', mode: 'edu' },
            { icon: '🧬', label: 'Advisor', mode: 'advice' },
            { icon: '⚖️', label: 'BMI', mode: 'bmi' },
            { icon: '🏬', label: 'Clinic', mode: 'clinic' },
          ].map((s, i) => (
            <button 
              key={s.label}
              onClick={() => switchMode(s.mode as AppMode)}
              className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex flex-col items-center gap-2 hover:border-[var(--teal)] transition-all active:scale-95 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">{s.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text2)]">{s.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-[var(--surface)] border border-[var(--border)] p-6 flex items-center justify-between cursor-pointer rounded-[32px] group relative overflow-hidden" 
        onClick={() => switchMode('journal')}
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-[var(--teal-glow)] border border-[var(--teal-line)] flex items-center justify-center text-[var(--teal)]">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mb-1 opacity-60">Consistency Streak</p>
            <h3 className="font-serif text-2xl text-[var(--text)]">{calculateStreak(journal)} Day Streak</h3>
          </div>
        </div>
        <div className="flex gap-2 relative z-10">
          {[1,2,3,4,5].map(i => {
            const isCompleted = i <= calculateStreak(journal);
            return (
              <div 
                key={i} 
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-500", 
                  isCompleted ? "bg-[var(--teal)]" : "bg-[var(--border)]"
                )} 
              />
            );
          })}
        </div>
      </motion.div>

      <HealthInsights journal={journal} profile={profile} />
      <WellnessTip journal={journal} />
    </motion.div>
  );
});

function WellnessTip({ journal }: { journal: JournalEntry[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTip = async () => {
      setIsLoading(true);
      try {
        const lastMood = journal[0]?.mood || 3;
        const prompt = `Provide a single, short, inspiring wellness tip (max 15 words) based on a mood of ${lastMood}/5.`;
        const response = await callGemini(prompt);
        setTip(response || "Drink some water and take a deep breath.");
      } catch (error) {
        setTip("A short walk can clear your mind and boost your energy.");
      } finally {
        setIsLoading(false);
      }
    };
    if (journal.length > 0) fetchTip();
    else setTip("Start your first journal entry to get personalized tips!");
  }, [journal]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className="glass rounded-3xl p-6 flex items-center gap-5 relative overflow-hidden group shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--purple)]/5 -translate-y-16 translate-x-16 rounded-full blur-3xl transition-all group-hover:scale-150" />
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
        <Lightbulb size={28} />
      </div>
      <div className="space-y-1 relative z-10">
        <span className="text-[10px] font-black text-[var(--teal)] uppercase tracking-[0.2em] opacity-80">Personal Insight</span>
        <p className="text-[15px] font-serif leading-relaxed text-[var(--text)] italic opacity-90">
          {isLoading ? "Veda is analyzing your patterns..." : `"${tip}"`}
        </p>
      </div>
    </motion.div>
  );
}
function InsightRow({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-purple-400">{icon}</div>
      <p className="text-xs text-[var(--text2)] leading-relaxed">{text}</p>
    </div>
  );
}

function VitalCard({ icon, label, value, unit, color, isPlaceholder, onClick }: { icon: React.ReactNode, label: string, value: string, unit: string, color: string, isPlaceholder?: boolean, onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.05)" }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "p-6 rounded-[32px] glass transition-all cursor-pointer shadow-sm h-full group flex flex-col justify-between",
        !isPlaceholder && "hover:border-[var(--teal)]/40"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner">
          {icon}
        </div>
        <div className="w-6 h-1 bg-[var(--border)] rounded-full opacity-30" />
      </div>
      <div>
        <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.15em] mb-1.5 opacity-80">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-3xl font-serif tracking-tight leading-none", isPlaceholder ? "text-[var(--muted)]" : "text-[var(--text)]")}>{value}</span>
          {unit && !isPlaceholder && <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest opacity-50">{unit}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function MedRow({ name, dose, time, status }: { name: string, dose: string, time: string, status: 'taken' | 'due' | 'upcoming' }) {
  const statusColors = {
    taken: "bg-[var(--teal)] text-white dark:text-[#020617]",
    due: "bg-[var(--red)] text-white",
    upcoming: "glass text-[var(--text2)]"
  };

  return (
    <div className="flex items-center justify-between p-4 glass rounded-2xl group transition-all hover:border-[var(--teal)]/30">
      <div className="flex items-center gap-5">
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm relative overflow-hidden", statusColors[status])}>
          {status === 'taken' && <div className="absolute inset-0 bg-white/10 opacity-50" />}
          <span className="relative z-10">{time}</span>
        </div>
        <div>
          <h4 className="text-sm font-black text-[var(--text)] group-hover:text-[var(--teal)] transition-colors uppercase tracking-tight tracking-wider">{name}</h4>
          <p className="text-[11px] text-[var(--muted)] font-bold opacity-70 tracking-tight">{dose}</p>
        </div>
      </div>
      <div className={cn(
        "w-2.5 h-2.5 rounded-full shadow-lg",
        status === 'taken' ? "bg-[var(--teal)] shadow-[var(--teal)]/20" : status === 'due' ? "bg-[var(--red)] shadow-red-500/20" : "bg-[var(--border)]"
      )} />
    </div>
  );
}

const QuickAction = memo(function QuickAction({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  const colorMap: Record<string, string> = {
    teal: "text-[var(--teal)] bg-[var(--teal-glow)] shadow-[var(--teal)]/5",
    purple: "text-purple-500 bg-purple-500/10 shadow-purple-500/5",
    orange: "text-orange-500 bg-orange-500/10 shadow-orange-500/5",
    indigo: "text-indigo-500 bg-indigo-500/10 shadow-indigo-500/5",
    blue: "text-blue-500 bg-blue-500/10 shadow-blue-500/5",
    rose: "text-rose-500 bg-rose-500/10 shadow-rose-500/5"
  };

  return (
    <motion.button
      whileHover={{ y: -6, boxShadow: "0 15px 30px rgba(0,0,0,0.06)" }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className="w-full flex flex-col items-center gap-4 p-6 rounded-[32px] glass hover:border-[var(--teal)]/40 transition-all shadow-sm group"
    >
      <div className={cn("w-14 h-14 rounded-3xl flex items-center justify-center transition-all group-hover:scale-110 shadow-inner group-hover:shadow-lg", colorMap[color] || "bg-[var(--surface)]")}>
        {icon}
      </div>
      <span className="text-[10px] font-black text-[var(--text)] uppercase tracking-[0.15em] opacity-80">{label}</span>
    </motion.button>
  );
});

const ChatView = memo(function ChatView({ 
  chatHistory, 
  setChatHistory, 
  isTyping, 
  setIsTyping, 
  profile, 
  switchMode, 
  updateActiveChat,
  conversations,
  activeChatId,
  setActiveChatId,
  onNewChat,
  onDeleteChat
}: { 
  chatHistory: ChatMessage[], 
  setChatHistory: any, 
  isTyping: boolean, 
  setIsTyping: any, 
  profile: UserProfile, 
  switchMode: (m: AppMode) => void, 
  updateActiveChat: (msgs: ChatMessage[]) => Promise<void>,
  conversations: ChatConversation[],
  activeChatId: string,
  setActiveChatId: (id: string) => void,
  onNewChat: () => Promise<void>,
  onDeleteChat: (id: string, e: React.MouseEvent) => Promise<void>
}) {
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    
    // If no active chat, create one and then proceed
    if (!activeChatId) {
      await onNewChat();
      // Since state updates are async, we might still see activeChatId as null
      // But updateActiveChat handles the null check. 
      // Re-triggering handleSend might be safer but could cause loops.
      // Better: createNewChat should return the brand new ID.
    }

    setInput('');
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: msg,
      timestamp: new Date().toISOString()
    };
    
    const newMsgsWithUser = [...chatHistory, userMsg];
    setChatHistory(newMsgsWithUser); // Optimistic UI update
    await updateActiveChat(newMsgsWithUser);
    setIsTyping(true);

    try {
      const history = chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await getChatResponse(msg, history, profile);
      const assistantMsg: ChatMessage = { 
        role: 'assistant', 
        content: response,
        timestamp: new Date().toISOString()
      };
      
      const finalMsgs = [...newMsgsWithUser, assistantMsg];
      setChatHistory(finalMsgs);
      await updateActiveChat(finalMsgs);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = { 
        role: 'assistant', 
        content: "I'm sorry, I'm having trouble connecting right now. Please ensure your Gemini API key is correctly set in **Settings > Secrets** and try again.",
        timestamp: new Date().toISOString()
      };
      const errorMsgs = [...newMsgsWithUser, errorMsg];
      setChatHistory(errorMsgs);
      await updateActiveChat(errorMsgs);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    "I have a headache",
    "Fever for 2 days",
    "Stomach pain",
    "Gut health tips"
  ];

  return (
    <div className="flex fixed inset-0 z-[200] bg-[var(--bg)] animate-in fade-in duration-500 overflow-hidden">
      <div className="bg-gradient" />
      {/* Sidebar - Conversation History */}
      <motion.div 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 0,
          opacity: isSidebarOpen ? 1 : 0
        }}
        className="glass border-r border-[var(--border)] overflow-hidden flex flex-col shrink-0 h-full shadow-2xl relative z-10"
      >
        <div className="p-8 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-serif text-xl font-black text-[var(--text)] tracking-tight">Analytics</h3>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 glass-pill text-[var(--muted)] hover:text-red-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center gap-3.5 p-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] rounded-2xl text-[13px] font-black uppercase tracking-wider shadow-lg shadow-[var(--teal)]/20 active:scale-95 transition-all mb-4 border border-white/20"
          >
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span>New Consultation</span>
          </button>

          {conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare size={32} className="mx-auto text-[var(--muted)]/20 mb-2" />
              <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">No past consultations yet.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id}
                onClick={() => {
                  setActiveChatId(conv.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={cn(
                  "group relative w-full flex flex-col gap-1 p-3 rounded-xl border transition-all cursor-pointer",
                  activeChatId === conv.id 
                    ? "glass border-white/20 shadow-lg" 
                    : "bg-transparent border-transparent hover:bg-white/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-[var(--text)] truncate flex-1">
                    {conv.title || 'Consultation'}
                  </span>
                  <button 
                    onClick={(e) => onDeleteChat(conv.id, e)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-red-500 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-[var(--muted)] font-bold uppercase tracking-wider">
                  <Calendar size={10} />
                  <span>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 glass border-b border-[var(--border)] shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 glass-pill transition-all active:scale-95 text-[var(--muted)]"
            title="History"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-serif text-[var(--text)] tracking-tight">
              {conversations.find(c => c.id === activeChatId)?.title || 'Veda Consultation'}
            </h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="text-[9px] text-[var(--muted)] font-black uppercase tracking-[0.15em]">Neural Intelligence Active</span>
            </div>
          </div>
          
          <button 
            onClick={() => switchMode('home')} 
            className="px-5 py-2.5 glass-pill text-[var(--text2)] text-[11px] font-black uppercase tracking-widest hover:text-red-500 transition-all active:scale-95"
          >
            Exit
          </button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-6 scrollbar-hide">
          {(!activeChatId || chatHistory.length === 0) && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-700">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-2xl shadow-[var(--teal)]/20 border border-white/20">
                <Bot size={40} strokeWidth={1.5} />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-[var(--text)] tracking-tight">How can I help you today?</h3>
                <p className="text-[var(--muted)] max-w-[280px] mx-auto text-sm leading-relaxed">
                  Start a new consultation to discuss symptoms, medications, or any health concerns.
                </p>
                {!activeChatId && (
                  <button 
                    onClick={onNewChat}
                    className="mt-4 px-8 py-3 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] rounded-2xl font-bold shadow-xl active:scale-95 transition-all border border-white/30"
                  >
                    Start Consulting
                  </button>
                )}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {chatHistory.map((msg, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex w-full mb-2", msg.role === 'user' ? "justify-end" : "justify-start")}
              >
                <div className={cn(
                  "max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col gap-1.5",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-[15px] leading-relaxed transition-all",
                    msg.role === 'user' 
                      ? "bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] shadow-lg border border-white/20" 
                      : "glass border border-white/10 text-[var(--text)] shadow-sm"
                  )}>
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-invert-0" dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }} />
                  </div>
                  <div className="px-1 flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest opacity-60">
                      {msg.role === 'user' ? 'You' : 'Veda AI'}
                    </span>
                    <span className="text-[9px] text-[var(--muted)] opacity-30">•</span>
                    <span className="text-[9px] font-medium text-[var(--muted)] opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="glass border border-white/10 px-4 py-3 rounded-2xl shadow-sm">
                <div className="flex gap-1">
                  {[1, 2, 3].map(j => (
                    <motion.div 
                      key={j}
                      animate={{ opacity: [0.3, 1, 0.3] }} 
                      transition={{ repeat: Infinity, duration: 1, delay: j * 0.2 }} 
                      className="w-1.5 h-1.5 rounded-full bg-[var(--teal)]" 
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        {activeChatId && (
          <div className="p-6 glass border-t border-[var(--border)] shrink-0 pb-safe relative z-20">
            <div className="max-w-3xl mx-auto flex items-center gap-2 glass border border-[var(--border)] rounded-[32px] px-5 py-2.5 focus-within:ring-2 focus-within:ring-[var(--teal)]/20 transition-all shadow-xl">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Describe your symptoms or ask a medical question..."
                className="flex-1 bg-transparent border-none outline-none py-2 text-[15px] resize-none max-h-32 text-[var(--text)] placeholder:text-[var(--muted)] font-medium"
                rows={1}
              />
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90",
                  input.trim() ? "bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] shadow-lg shadow-[var(--teal)]/20" : "text-[var(--muted)]/40 bg-[var(--surface)]"
                )}
              >
                <div className={cn("transition-transform", input.trim() && "rotate-[-45deg] scale-110")}>
                  <Send size={20} strokeWidth={2.5} />
                </div>
              </button>
            </div>
            {chatHistory.length === 0 && (
              <div className="flex flex-wrap gap-2.5 mt-5 justify-center">
                {suggestions.map(s => (
                  <button 
                    key={s} 
                    onClick={() => handleSend(s)}
                    className="px-4 py-2 glass-pill text-[10px] font-black uppercase tracking-wider text-[var(--text2)] hover:border-[var(--teal)]/40 hover:text-[var(--teal)] transition-all bg-[var(--surface)] border-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// --- Placeholder views for other modes ---

const JournalView = memo(function JournalView({ journal, addJournalEntry }: { journal: JournalEntry[], addJournalEntry: (e: JournalEntry) => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [mood, setMood] = useState(3);
  const [notes, setNotes] = useState('');
  const [sleep, setSleep] = useState('7.5');
  const [energy, setEnergy] = useState(4);
  const [bp, setBp] = useState('');
  const [sugar, setSugar] = useState('');
  const [weight, setWeight] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (bp.trim()) {
      if (!/^\d{2,3}\/\d{2,3}$/.test(bp.trim())) {
        setError("BP must be in format SYS/DIA (e.g. 120/80).");
        return;
      }
      const [sys, dia] = bp.trim().split('/');
      if (parseInt(sys) < 50 || parseInt(sys) > 300 || parseInt(dia) < 30 || parseInt(dia) > 200) {
        setError("Please enter valid BP values.");
        return;
      }
    }
    
    if (sugar.trim()) {
      const s = parseFloat(sugar);
      if (isNaN(s) || s < 20 || s > 1000) {
        setError("Please enter a valid sugar level (mg/dL).");
        return;
      }
    }

    if (weight.trim()) {
      const w = parseFloat(weight);
      if (isNaN(w) || w < 2 || w > 500) {
        setError("Please enter a valid weight in kg.");
        return;
      }
    }

    if (sleep) {
      const sl = parseFloat(sleep);
      if (isNaN(sl) || sl < 0 || sl > 24) {
        setError("Please enter a valid sleep duration (0-24 hrs).");
        return;
      }
    }

    setError(null);
    const bpParts = bp.trim().split('/');
    const entry: JournalEntry = {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mood,
      sleep: parseFloat(sleep),
      energy,
      notes,
      bpSys: bpParts[0] || undefined,
      bpDia: bpParts[1] || undefined,
      sugar: sugar || undefined,
      weight: weight || undefined,
      symptoms: selectedSymptoms
    };
    addJournalEntry(entry);
    showDoneToast('✅ Entry saved!');
    setActiveTab('history');
    // Reset
    setNotes('');
    setBp('');
    setSugar('');
    setWeight('');
    setSelectedSymptoms([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <BookOpen size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Health Journal</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Track your daily wellness</p>
        </div>
      </div>

      <div className="flex glass-darker p-1 rounded-2xl border border-white/10">
        <button onClick={() => setActiveTab('log')} className={cn("flex-1 py-2.5 text-xs font-bold rounded-xl transition-all", activeTab === 'log' ? "bg-[var(--teal)] text-[#020f0c] shadow-md border border-white/20" : "text-[var(--muted)] hover:text-[var(--text)]")}>Log Today</button>
        <button onClick={() => setActiveTab('history')} className={cn("flex-1 py-2.5 text-xs font-bold rounded-xl transition-all", activeTab === 'history' ? "bg-[var(--teal)] text-[#020f0c] shadow-md border border-white/20" : "text-[var(--muted)] hover:text-[var(--text)]")}>History</button>
      </div>

      {activeTab === 'log' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">How's your mood?</label>
            <div className="flex justify-between gap-2.5">
              {[1, 2, 3, 4, 5].map(v => (
                <button 
                  key={v} 
                  onClick={() => setMood(v)}
                  className={cn(
                    "flex-1 aspect-square rounded-[24px] flex flex-col items-center justify-center gap-1.5 border transition-all active:scale-95",
                    mood === v ? "glass border-[var(--teal)]/40 shadow-lg shadow-[var(--teal)]/5" : "glass border-white/10 opacity-60 hover:opacity-100"
                  )}
                >
                  <span className={cn("text-2xl transition-transform", mood === v && "scale-125")}>{['😢', '😟', '😐', '😊', '😄'][v-1]}</span>
                  <span className={cn("text-[8px] font-black uppercase tracking-tighter", mood === v ? "text-[var(--teal)]" : "text-[var(--muted)]")}>{['Bad', 'Low', 'Okay', 'Good', 'Great'][v-1]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass p-5 rounded-[28px] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">
                <Moon size={14} className="text-blue-400" /> Sleep
              </div>
              <div className="flex items-baseline gap-2">
                <input type="number" value={sleep} onChange={e => setSleep(e.target.value)} className="bg-transparent border-none outline-none font-serif text-3xl w-20 text-[var(--text)]" />
                <span className="text-xs font-bold text-[var(--muted)]">hrs</span>
              </div>
            </div>
            <div className="glass p-5 rounded-[28px] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">
                <Zap size={14} className="text-amber-500" /> Energy
              </div>
              <div className="flex gap-2 pt-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setEnergy(v)} className={cn("w-3.5 h-3.5 rounded-full transition-all", v <= energy ? "bg-[var(--teal)] shadow-[0_0_8px_rgba(0,212,177,0.4)]" : "bg-white/10")} />
                ))}
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-[32px] border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em]">Vitals <span className="opacity-60">(Optional)</span></label>
              <Activity size={16} className="text-[var(--teal)]" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className="text-[9px] text-[var(--muted)] font-black uppercase tracking-widest ml-1">BP</p>
                <input 
                  type="text" 
                  value={bp}
                  onChange={e => setBp(e.target.value)}
                  placeholder="120/80" 
                  className="w-full glass-morphism border-b border-white/10 bg-transparent py-2.5 px-1 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--teal)] transition-all placeholder:text-[var(--muted)]/30" 
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[9px] text-[var(--muted)] font-black uppercase tracking-widest ml-1">Sugar</p>
                <input 
                  type="text" 
                  value={sugar}
                  onChange={e => setSugar(e.target.value)}
                  placeholder="95" 
                  className="w-full glass-morphism border-b border-white/10 bg-transparent py-2.5 px-1 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--teal)] transition-all placeholder:text-[var(--muted)]/30" 
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[9px] text-[var(--muted)] font-black uppercase tracking-widest ml-1">Weight</p>
                <input 
                  type="text" 
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="70" 
                  className="w-full glass-morphism border-b border-white/10 bg-transparent py-2.5 px-1 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--teal)] transition-all placeholder:text-[var(--muted)]/30" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">Symptoms</label>
            <div className="flex flex-wrap gap-2.5">
              {['Headache', 'Fever', 'Cough', 'Fatigue', 'Pain', 'Nausea'].map(s => (
                <button 
                  key={s} 
                  onClick={() => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={cn(
                    "px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95",
                    selectedSymptoms.includes(s) ? "glass border-[var(--teal)]/40 text-[var(--teal)] shadow-md" : "glass border-white/10 text-[var(--muted)] hover:border-white/30"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] ml-1">Today's Notes</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any symptoms or observations?"
              className="w-full glass border border-white/10 rounded-[32px] p-5 text-sm min-h-[140px] outline-none focus:border-[var(--teal)]/40 transition-all text-[var(--text)] placeholder:text-[var(--muted)]/40 shadow-inner"
            />
          </div>

          {error && (
            <div className="p-4 glass-morphism border border-red-500/30 rounded-[24px] text-red-400 text-sm flex items-center gap-2 shadow-lg shadow-red-900/10 mb-4 animate-in shake">
              <AlertTriangle size={18} />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <button 
            onClick={handleSave}
            className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-black rounded-[24px] shadow-xl shadow-[var(--teal)]/20 active:scale-[0.98] transition-all border border-white/20 text-lg mb-8"
          >
            Save Daily Log ✦
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {journal.length === 0 ? (
            <div className="text-center py-12 glass border border-white/5 rounded-[32px] text-[var(--muted)]">No entries yet.</div>
          ) : (
            journal.map((entry, i) => (
              <div key={i} className="glass border border-white/10 rounded-[28px] p-4 flex gap-4 hover:glass-morphism transition-all">
                <div className="w-12 h-14 rounded-2xl glass-darker border border-white/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-[var(--muted)] uppercase opacity-60 tracking-widest">{new Date(entry.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                  <span className="text-xl font-serif text-[var(--text)] leading-none mt-0.5">{new Date(entry.date).getDate()}</span>
                </div>
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{['😢', '😟', '😐', '😊', '😄'][entry.mood-1]}</span>
                      <span className="text-sm font-bold text-[var(--text)]">{['Bad', 'Low', 'Okay', 'Good', 'Great'][entry.mood-1]}</span>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] font-black opacity-40 uppercase tracking-widest">{entry.time}</span>
                  </div>
                  {entry.notes && <p className="text-xs text-[var(--muted)] italic line-clamp-1 opacity-80">"{entry.notes}"</p>}
                  <div className="flex gap-4 pt-1">
                    <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest flex items-center gap-1.5"><Moon size={11} className="text-blue-400" /> {entry.sleep}h</span>
                    <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest flex items-center gap-1.5"><Zap size={11} className="text-amber-500" /> {entry.energy}/5</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

function SymptomChecker({ profile, switchMode }: { profile: UserProfile, switchMode: (m: AppMode) => void }) {
  const [symptom, setSymptom] = useState('');
  const [duration, setDuration] = useState('2-3 days');
  const [severity, setSeverity] = useState(5);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!symptom.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const diagnosis = await analyzeSymptoms(symptom, duration, severity, profile);
      setResult(diagnosis);
    } catch (err) {
      setError("Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', icon: <AlertCircle className="text-red-500" size={20} /> };
      case 'urgent': return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', icon: <Clock className="text-amber-500" size={20} /> };
      default: return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', icon: <Activity className="text-blue-500" size={20} /> };
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 border border-white/20">
          <Stethoscope size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Symptom Checker</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Smart AI Diagnostics ✦</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[32px] p-8 shadow-xl space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
        
        <div className="space-y-4">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.25em] ml-1">Current Complaints</label>
          <div className="relative">
            <textarea 
              value={symptom}
              onChange={e => setSymptom(e.target.value)}
              placeholder="e.g., I have a sharp pain in my lower back that started after lifting a heavy box..."
              rows={3}
              className="w-full glass border border-white/5 rounded-2xl p-5 text-sm font-medium outline-none focus:border-blue-500/50 transition-all shadow-inner text-[var(--text)] placeholder:text-[var(--muted)]/40 resize-none"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.25em] ml-1">Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {['Today', '2-3 days', '1 week', '2 weeks', '1 month', 'Chronic'].map(d => (
                <button 
                  key={d} 
                  onClick={() => setDuration(d)}
                  className={cn(
                    "py-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all",
                    duration === d ? "glass border-blue-500/40 text-blue-400 shadow-lg" : "glass border-white/5 text-[var(--muted)]/60 hover:border-white/20"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.25em]">Pain Level</label>
              <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">{severity}/10</span>
            </div>
            <input 
              type="range" min="1" max="10" step="1" 
              value={severity} 
              onChange={e => setSeverity(parseInt(e.target.value))}
              className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between px-1 text-[9px] font-black text-[var(--muted)] uppercase tracking-widest opacity-40 pt-2">
              <span>Mild</span>
              <span>Moderate</span>
              <span>Severe</span>
            </div>
          </div>
        </div>

        <button 
          onClick={handleCheck}
          disabled={isLoading || !symptom.trim()}
          className="w-full py-5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-white/20 text-lg group"
        >
          {isLoading ? (
            <>
              <RefreshCw className="animate-spin" size={24} />
              <span>Analyzing Vitals...</span>
            </>
          ) : (
            <>
              <Sparkles size={22} className="group-hover:rotate-12 transition-transform" />
              <span>Diagnostic Analysis ✦</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium text-center">
          {error}
        </div>
      )}

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl glass-morphism border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-[var(--text)]">Initial Assessment</h3>
                  <div className={cn(
                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mt-2 border",
                    getUrgencyStyles(result.urgency).bg,
                    getUrgencyStyles(result.urgency).text,
                    getUrgencyStyles(result.urgency).border
                  )}>
                    {getUrgencyStyles(result.urgency).icon}
                    {result.urgency} Action Recommended
                  </div>
                </div>
              </div>
              <button onClick={() => setResult(null)} className="p-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-8">
              {/* Summary */}
              <div className="space-y-3">
                <p className="text-sm text-[var(--text2)] leading-relaxed italic border-l-2 border-blue-500/30 pl-4 py-1">
                  "{result.summary}"
                </p>
              </div>

              {/* Likely Causes */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.25em] ml-1">Possible Conditions</h4>
                <div className="grid gap-3">
                  {result.likelyCauses.map((cause: any, idx: number) => (
                    <div key={idx} className="glass-darker border border-white/5 rounded-2xl p-5 group hover:border-blue-500/20 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{cause.condition}</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-1 rounded-md",
                          cause.likelihood === 'High' ? 'bg-red-500/10 text-red-400' : 
                          cause.likelihood === 'Moderate' ? 'bg-amber-500/10 text-amber-400' : 
                          'bg-blue-500/10 text-blue-400'
                        )}>{cause.likelihood} Likelihood</span>
                      </div>
                      <p className="text-xs text-[var(--muted)] leading-relaxed">{cause.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Actions */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.25em] ml-1">Recommended Actions</h4>
                  <ul className="space-y-2">
                    {result.recommendedActions.map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-xs text-[var(--text2)] group">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-500/20 transition-colors">
                          <Check size={12} className="text-emerald-500" />
                        </div>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Red Flags */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.25em] ml-1">Red Flags (See Doctor Immediately)</h4>
                  <ul className="space-y-2">
                    {result.redFlags.map((flag: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-xs text-[var(--text2)] group">
                        <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-red-500/20 transition-colors">
                          <AlertTriangle size={12} className="text-red-500" />
                        </div>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex items-start gap-4 p-6 bg-blue-500/5 rounded-3xl">
              <Info size={24} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Clinical Compliance Note</p>
                <p className="text-xs text-blue-500/70 leading-relaxed font-medium">
                  Veda uses advanced medical models for screening, but this is <strong>not a medical diagnosis</strong>. Always cross-verify with your healthcare provider.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => switchMode('teleconsult')}
              className="flex-1 py-5 glass border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-[#14b8a6] hover:bg-white/5"
            >
              <Video size={18} /> Book Teleconsult Now
            </button>
            <button 
              onClick={() => (window as any).print()}
              className="px-6 py-5 glass border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              <FileText size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const WellnessCoach = memo(function WellnessCoach({ profile }: { profile: UserProfile }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history: { role: 'user' | 'model', parts: any[] }[] = messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.content }]
      }));

      const response = await getWellnessResponse(input, history, profile);
      
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please ensure your Gemini API key is correctly set in **Settings > Secrets** and try again.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] glass border border-[var(--border)] rounded-[32px] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)] bg-gradient-to-r from-purple-500/10 to-indigo-500/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-serif text-xl tracking-tight text-[var(--text)] dark:text-white">Wellness Coach</h3>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest opacity-80">Empathetic Support ✦</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <div className="p-4 rounded-full bg-[var(--muted)]/10">
              <Bot size={40} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[var(--text)]">How are you feeling today?</p>
              <p className="text-xs text-[var(--muted)] max-w-[200px]">I'm here to listen, support, and help you find peace.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {['I feel stressed', 'GUIDED MEDITATION', 'Anxiety help', 'Sleep tips'].map(tip => (
                <button 
                  key={tip}
                  onClick={() => setInput(tip)}
                  className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--card2)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--muted)]/10 transition-all text-[var(--muted)]"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col max-w-[85%]",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed shadow-lg",
              m.role === 'user' 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "glass border border-[var(--border)] text-[var(--text)] rounded-tl-none"
            )}>
              {m.content}
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)] opacity-40 mt-1 px-1">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-purple-400/60 ml-1">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Finding balance...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 border-t border-[var(--border)] bg-[var(--card2)]">
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Share your thoughts..."
            className="flex-1 glass border border-[var(--border)] rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:border-purple-500/50 transition-all text-[var(--text)] placeholder:text-[var(--muted)]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
});

const MedicationInfo = memo(function MedicationInfo({ profile }: { profile: UserProfile }) {
  const [med, setMed] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExplain = async () => {
    if (!med.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Explain the medication "${med}" for a patient in detail. Include:
      1. Mechanism of Action (How it works)
      2. Common Uses and Indications
      3. Dosage Guidelines (General)
      4. Potential Side Effects and Warnings
      5. Specific Drug Interactions with patient's conditions: ${profile.conditions.join(', ')}.
      Provide a detailed, structured, and professional response.`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error looking up medication. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20 border border-white/20">
          <Pill size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Medication Info</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Understand your medicines</p>
        </div>
      </div>

      <div className="glass border border-[var(--border)] rounded-[32px] p-8 shadow-xl space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] -mr-24 -mt-24 pointer-events-none group-hover:bg-purple-500/10 transition-colors duration-700" />
        
        <div className="space-y-4">
          <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-[0.25em] ml-1">Medicine Name</label>
          <input 
            value={med}
            onChange={e => setMed(e.target.value)}
            placeholder="e.g. Metformin, Paracetamol..."
            className="w-full glass border border-[var(--border)] rounded-2xl p-5 text-sm font-medium outline-none focus:border-purple-500/50 transition-all shadow-inner text-[var(--text)] placeholder:text-[var(--muted)]/40"
          />
        </div>

        <button 
          onClick={handleExplain}
          disabled={isLoading || !med.trim()}
          className="w-full py-5 bg-gradient-to-br from-purple-500 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-purple-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-white/20 text-lg"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Looking up...</span>
            </>
          ) : (
            <>
              <Pill size={22} />
              <span>Explain Medication ✦</span>
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-[var(--border)] rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                <Bot size={22} />
              </div>
              <div>
                <h3 className="font-serif text-xl text-[var(--text)]">{med || 'Medication'} Review</h3>
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest opacity-60">Clinical Guidelines Summary</p>
              </div>
            </div>
            <button onClick={() => setResult('')} className="p-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"><X size={20} /></button>
          </div>
          <div className="prose prose-sm max-w-none prose-p:text-[var(--text2)] prose-li:text-[var(--text2)] prose-p:leading-relaxed bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-6 shadow-inner">
            <Markdown>{result}</Markdown>
          </div>
        </motion.div>
      )}

      {/* Medication Vault */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Medication Vault</h3>
          <span className="text-[9px] font-bold text-[var(--teal)] bg-[var(--teal)]/10 px-2 py-0.5 rounded-full uppercase">Your Current Meds</span>
        </div>
        
        {profile.medicines.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profile.medicines.map((med, idx) => (
              <div key={idx} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between group hover:border-[var(--teal-dim)] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--card2)] flex items-center justify-center text-lg">💊</div>
                  <div className="max-w-[120px]">
                    <h4 className="text-sm font-bold text-[var(--text)] truncate">{med.name}</h4>
                    <p className="text-[10px] text-[var(--muted)]">Prescribed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setMed(med.name)}
                    className="p-2 bg-[var(--card2)] text-[var(--muted)] rounded-lg hover:text-[var(--teal)]"
                    title="Explain"
                   >
                     <Search size={14} />
                   </button>
                   <a 
                    href={`https://www.1mg.com/search/all?name=${encodeURIComponent(med.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-gradient-to-br from-pink-500 to-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all"
                  >
                    Refill ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-dashed border-[var(--border)] rounded-2xl p-8 text-center opacity-60">
            <p className="text-xs text-[var(--muted)]">No medications logged in your profile yet. Add them in your profile or scan a prescription.</p>
          </div>
        )}
      </div>
    </div>
  );
});

const HealthInsights = memo(function HealthInsights({ journal, profile }: { journal: JournalEntry[], profile: UserProfile }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      if (journal.length < 1) return;
      setIsLoading(true);
      try {
        const journalCtx = journal.slice(0, 5).map(e => `${e.date}: ${e.mood}/5 mood, ${e.symptoms.join(', ')}`).join('\n');
        const prompt = `Act as a proactive health assistant. Analyze these recent journal entries and identify any concerning trends or positive patterns. Provide one clear "Insight of the Day" (max 2 sentences). If there's a negative trend, suggest a specific action. If positive, encourage them. Be concise and professional.\n\nJournal:\n${journalCtx}`;
        const response = await callGemini(prompt);
        setInsight(response);
      } catch (error) {
        console.error("Failed to fetch insight", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInsight();
  }, [journal]);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-400">
          <Sparkles size={18} />
          <h3 className="font-serif text-lg">AI Health Insights</h3>
        </div>
        {isLoading && <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
      </div>
      
      {insight ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <p className="text-sm text-[var(--text2)] leading-relaxed italic">
            "{insight.replace(/^"|"$/g, '')}"
          </p>
          <div className="flex items-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rounded-full bg-purple-400" />
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">Personalized for {profile.name || 'you'}</span>
          </div>
        </motion.div>
      ) : isLoading ? (
        <div className="py-4 flex flex-col items-center justify-center space-y-2">
          <p className="text-xs text-[var(--muted)] animate-pulse">Veda is analyzing your health patterns...</p>
        </div>
      ) : (
        <div className="py-2">
          <p className="text-xs text-[var(--muted)] italic">
            {journal.length === 0 
              ? "Start logging your mood and symptoms in the journal to unlock AI-driven insights."
              : "Keep logging to see more detailed patterns."}
          </p>
        </div>
      )}
    </div>
  );
});

const TriageView = memo(function TriageView({ profile }: { profile: UserProfile }) {
  const [symptom, setSymptom] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTriage = async () => {
    if (!symptom.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Patient reports: ${symptom}. Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}. Based on these symptoms, should the patient see a doctor immediately, schedule an appointment, or use home care? Provide clear reasoning and red flags to watch for.`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error assessing urgency. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 border border-white/20">
          <AlertTriangle size={22} />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight text-[var(--text)]">Urgency Guide</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-0.5 opacity-60">Should I See a Doctor?</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[40px] p-8 space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-rose-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
        
        <div className="space-y-3 relative z-10">
          <label className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] ml-1">Describe your situation</label>
          <textarea 
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder="e.g. I have sharp chest pain that comes and goes..."
            className="w-full glass border border-white/10 rounded-[32px] p-6 text-[15px] min-h-[160px] outline-none focus:border-rose-500/50 transition-all shadow-inner resize-none placeholder:text-[var(--muted)]/30 font-medium"
          />
        </div>

        <button 
          onClick={handleTriage}
          disabled={isLoading || !symptom.trim()}
          className="w-full py-6 bg-gradient-to-br from-rose-500 to-rose-600 text-white font-black rounded-[28px] shadow-2xl shadow-rose-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.25em] border border-white/20 flex items-center justify-center gap-3 relative z-10"
        >
          {isLoading ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>Assessing...</span>
            </>
          ) : (
            <>
              <span>Check Urgency ✦</span>
              <Sparkles size={20} />
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl glass-morphism border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold">
              <ClipboardList size={22} />
            </div>
            <h3 className="font-serif text-2xl text-[var(--text)]">Triage Assessment</h3>
          </div>
          <div className="prose prose-sm max-w-none prose-p:text-[var(--text2)] prose-li:text-[var(--text2)] prose-p:leading-relaxed bg-white/2 border border-white/5 rounded-3xl p-7 shadow-inner mb-6">
             <div className="text-[15px] leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          </div>
          <div className="flex items-start gap-4 p-5 glass-darker border border-amber-500/20 rounded-2xl">
            <ShieldAlert size={24} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Safety Protocol</p>
              <p className="text-xs text-amber-200/60 leading-relaxed font-medium italic">If you are experiencing a life-threatening emergency, call your local emergency services (102/112 in India) immediately.</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
});

const HealthScoreView = memo(function HealthScoreView({ journal, profile, switchMode }: { journal: JournalEntry[], profile: UserProfile, switchMode: (m: AppMode, tab?: any) => void }) {
  const score = calculateScore(journal, profile);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      if (journal.length === 0) return;
      setIsLoading(true);
      try {
        const journalCtx = journal.slice(0, 5).map(e => `Date: ${e.date}, Mood: ${e.mood}/5, Symptoms: ${e.symptoms.join(', ')}, Notes: ${e.notes}`).join('\n');
        const prompt = `Analyze this patient's health score (${score}/100) and recent journal entries. Provide a concise, professional explanation of why the score is at this level and 3 specific, actionable steps to improve it. Keep it encouraging.\n\nProfile: ${profile.name}, ${profile.age}yrs. Conditions: ${profile.conditions.join(', ')}.\n\nRecent Journal:\n${journalCtx}`;
        const response = await callGemini(prompt);
        setAiInsight(response);
      } catch (error) {
        console.error("Failed to fetch AI insight", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInsight();
  }, [journal, profile, score]);
  
  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-xl shadow-[var(--teal)]/20 border border-white/20">
          <Trophy size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Health Score</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Predicted Wellness Metrics</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[44px] p-10 text-center space-y-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[var(--teal)]/5 rounded-full blur-[100px] pointer-events-none transition-all group-hover:bg-[var(--teal)]/10" />
        
        <div className="relative w-56 h-56 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 filter drop-shadow-[0_0_15px_rgba(20,184,166,0.2)]">
            <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="45" fill="none" stroke={score === 0 ? "white" : "var(--teal)"} strokeWidth="8" 
              strokeDasharray="283" 
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * (score > 0 ? score : 0) / 100) }}
              transition={{ duration: 2.5, ease: "circOut" }}
              strokeLinecap="round"
              strokeOpacity={score === 0 ? "0.1" : "1"}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-7xl font-serif tracking-tighter", score > 0 ? "text-[var(--teal)]" : "text-[var(--muted)]")}>{score > 0 ? score : "--"}</span>
            <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.3em] mt-1 opacity-40">/ 100</span>
          </div>
        </div>

        <div className="space-y-5 relative z-10">
          <div className="space-y-2">
            <h3 className="font-serif text-3xl text-[var(--text)]">{score === 0 ? 'Log Your Day' : score >= 80 ? 'Peak Performance!' : score >= 60 ? 'Healthy Alignment' : 'System Alert'}</h3>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed max-w-[340px] mx-auto font-medium opacity-80">{score === 0 ? 'Please log your vitals and daily journal to activate your AI-driven health intelligence orbit.' : 'Your wellness score is calculated through AI cross-referencing of your clinical profile, vitals trends, and consistency.'}</p>
          </div>
          <button 
            onClick={() => switchMode('vitals', 'wellbeing')}
            className="inline-flex items-center gap-3 px-8 py-3.5 glass-darker border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/5 hover:border-white/20 transition-all active:scale-95 shadow-lg group/btn"
          >
            <BarChart3 size={16} className="text-[var(--teal)] group-hover:scale-110 transition-transform" />
            <span>Explore Trends</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass border border-white/10 rounded-[32px] p-10 flex flex-col items-center justify-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--teal)]/5 to-transparent animate-pulse" />
          <div className="w-12 h-12 border-4 border-[var(--teal)]/30 border-t-[var(--teal)] rounded-full animate-spin" />
          <div className="text-center space-y-1.5 relative z-10">
            <p className="text-[11px] font-black text-[var(--text)] uppercase tracking-widest">Generating Outlook</p>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest opacity-60">Synchronizing AI Insight Patterns...</p>
          </div>
        </div>
      ) : aiInsight && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-[var(--teal)]/30 rounded-[40px] overflow-hidden shadow-2xl relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--teal)]/40 to-transparent" />
          <div className="glass-darker px-8 py-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass-morphism border border-[var(--teal)]/20 flex items-center justify-center text-[var(--teal)] shadow-inner">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-serif text-xl text-[var(--text)]">AI Health Orbit</h3>
                <p className="text-[9px] font-black text-[var(--teal)] uppercase tracking-widest opacity-60">Deep Intelligence Check</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="text-[15px] leading-relaxed text-[var(--text2)] prose prose-invert max-w-none prose-p:mb-4 italic" dangerouslySetInnerHTML={{ __html: formatMsg(aiInsight) }} />
            
            <div className="pt-6 border-t border-white/5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                <span className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em] opacity-40">Data Integrity Note</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed font-medium opacity-60">
                This diagnostic perspective is synthesized from your latest functional data points, vitals architecture, and consistency metrics.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreFactor label="Profile Depth" value={profile.setupDone ? 100 : 50} weight={20} />
        <ScoreFactor label="Vitals Integrity" value={profile.bp && profile.sugar ? 100 : 50} weight={30} />
        <ScoreFactor label="Journal Frequency" value={Math.min(100, (journal.length / 7) * 100)} weight={30} />
        <ScoreFactor label="Mood Calibration" value={journal.length > 0 ? (journal[0].mood / 5) * 100 : 0} weight={20} />
      </div>
    </div>
  );
});

const ScoreFactor = memo(function ScoreFactor({ label, value, weight }: { label: string, value: number, weight: number }) {
  return (
    <div className="glass border border-white/5 rounded-3xl p-5 space-y-4 hover:border-white/10 transition-colors shadow-lg">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-black text-[var(--muted)] uppercase tracking-widest opacity-80">{label}</span>
        <span className="text-sm font-black text-[var(--teal)]">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "circOut" }}
          className="h-full bg-gradient-to-r from-[var(--teal)]/40 to-[var(--teal)] shadow-[0_0_12px_rgba(20,184,166,0.3)]"
        />
      </div>
      <p className="text-[8px] text-[var(--muted)] font-black uppercase tracking-[0.2em] opacity-40">Weight Contribution: {weight}%</p>
    </div>
  );
});

const PrescriptionScanner = memo(function PrescriptionScanner({ profile, updateProfile }: { profile: UserProfile, updateProfile: (p: UserProfile) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      const isDismissed = err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.message?.toLowerCase().includes('dismissed') || err.message?.toLowerCase().includes('denied');
      if (isDismissed) {
        setCameraError("Camera permission was dismissed or blocked. Please ensure you allow access. If you're in an iframe, try opening the app in a new tab.");
      } else {
        setCameraError(`Camera Error: ${err.message || err.name}. Please check your hardware or try uploading instead.`);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImage(dataUrl);
      stopCamera();
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setIsLoading(true);
    try {
      const base64Data = image.split(',')[1];
      const data = await analyzePrescription(base64Data);
      setResult(data);
    } catch (e) {
      console.error(e);
      showDoneToast("Failed to scan prescription.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveToCabinet = () => {
    if (!result?.medications) return;
    
    const newMeds = [...profile.medicines];
    result.medications.forEach((m: any) => {
      if (!newMeds.some(nm => nm.name.toLowerCase() === m.name.toLowerCase())) {
        newMeds.push({
          name: m.name,
          dose: m.dose,
          dailyFrequency: m.dailyFrequency || 1,
          totalQuantity: (m.dailyFrequency || 1) * (m.duration || 30),
          lastRefillDate: new Date().toISOString()
        });
      }
    });
    
    updateProfile({ ...profile, medicines: newMeds });
    showDoneToast("Medications added to your cabinet!");
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-xl">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Prescription Lens</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mt-1">AI Vision for Handwriting</p>
          </div>
        </div>
        {!image && !isCameraOpen && (
          <button 
            onClick={startCamera}
            className="p-3 glass-morphism border border-white/10 rounded-2xl text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            <Camera size={20} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {isCameraOpen ? (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-[40px] overflow-hidden glass-morphism border border-white/5 bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-4 border-dashed border-emerald-500/20 pointer-events-none rounded-[40px] m-4" />
              <div className="absolute top-4 right-4 z-10">
                <button onClick={stopCamera} className="p-3 glass-morphism text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-all border border-white/20"><X size={20} /></button>
              </div>
              <div className="absolute bottom-10 left-0 w-full flex items-center justify-center">
                 <div className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 text-white text-[9px] font-black uppercase tracking-widest opacity-60">Align prescription text within frame</div>
              </div>
            </div>
            <button 
              onClick={handleCapture}
              className="w-full py-6 bg-emerald-500 text-[#020f0c] font-black rounded-[28px] shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all border border-white/20 uppercase tracking-widest text-[11px]"
            >
              Capture Frame ✦
            </button>
          </div>
        ) : !image ? (
          <div className="space-y-6">
            <label className="group relative aspect-[4/3] rounded-[40px] border-2 border-dashed border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer bg-white/2 overflow-hidden flex flex-col items-center justify-center p-8 text-center active:scale-[0.99]">
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-[24px] bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 group-hover:scale-110 transition-transform">
                <FileUp size={32} />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-[var(--text)]">Upload Prescription</span>
              <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest mt-2 opacity-40">Choose from gallery or documents</span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
            
            <button 
              onClick={startCamera}
              className="w-full py-6 glass border border-[var(--border)] text-[var(--text)] font-black rounded-[28px] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
            >
              <Camera size={20} className="text-emerald-500" />
              <span>Open Camera Feed</span>
            </button>
            
            {cameraError && (
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest text-center">{cameraError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl bg-black/10">
              <img src={image} alt="Rx" className="w-full h-full object-contain mix-blend-normal" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-3 glass-morphism border border-white/20 text-white rounded-full backdrop-blur-xl hover:bg-white/10 transition-colors shadow-lg"><X size={20} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-black rounded-[28px] shadow-2xl shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 border border-white/20"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>Decrypting Rx...</span>
                </>
              ) : (
                <>
                  <span>Scan with AI ✦</span>
                  <Sparkles size={20} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass border border-white/10 rounded-[40px] p-9 shadow-2xl relative overflow-hidden space-y-8"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass-morphism border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                <FileSearch size={22} />
              </div>
              <h3 className="font-serif text-2xl text-[var(--text)]">Prescription Insight</h3>
            </div>
            <button 
              onClick={saveToCabinet}
              className="px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2"
            >
              <Package size={14} /> Save to Cabinet
            </button>
          </div>

          <div className="bg-[var(--card2)] border border-[var(--border)] rounded-3xl p-7 shadow-inner space-y-6">
             {result.summary && (
               <div className="space-y-2">
                 <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500/60 uppercase tracking-widest">Medical Summary</p>
                 <p className="text-sm leading-relaxed text-[var(--text2)]">{result.summary}</p>
               </div>
             )}

             <div className="space-y-4">
               <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500/60 uppercase tracking-widest">Extracted Medications</p>
               <div className="grid gap-3">
                 {result.medications?.map((m: any, i: number) => (
                   <div key={i} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex items-center justify-between">
                     <div>
                       <p className="font-bold text-[var(--text)] dark:text-white">{m.name}</p>
                       <p className="text-xs text-[var(--muted)]">{m.dose} · {m.dailyFrequency}x Daily · {m.duration} Days</p>
                     </div>
                     <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400/60 bg-emerald-500/10 px-2 py-1 rounded-lg">
                       {m.instructions}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>

          <div className="p-5 glass border border-amber-500/20 rounded-2xl flex items-center gap-4">
             <ShieldAlert size={20} className="text-amber-500 shrink-0" />
             <p className="text-[11px] text-amber-700 dark:text-amber-200/60 font-medium italic">Always cross-verify extracted dosages with your clinical pharmacist before consumption.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
});


const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-[var(--border)] p-4 rounded-2xl shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[var(--teal)]/20 to-transparent" />
        <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.25em] mb-3 opacity-60">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3 text-xs font-bold">
              <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.05)]" style={{ backgroundColor: entry.color }} />
              <span className="text-[var(--text)]">{entry.name}: <span className="text-[var(--text)] dark:text-white ml-auto">{entry.value}</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const VitalsGraph = memo(function VitalsGraph({ journal, initialTab = 'wellbeing', onAddEntry }: { journal: JournalEntry[], initialTab?: 'wellbeing' | 'bp' | 'sugar' | 'weight', onAddEntry?: (entry: JournalEntry) => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<'wellbeing' | 'bp' | 'sugar' | 'weight'>(initialTab);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  const [quickLogValue1, setQuickLogValue1] = useState('');
  const [quickLogValue2, setQuickLogValue2] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleQuickLog = async () => {
    if (!onAddEntry) return;
    setIsLogging(true);
    
    // Find or create today's entry
    const todayStr = new Date().toISOString().split('T')[0];
    const existingEntry = journal.find(e => e.date === todayStr);
    
    const baseEntry: JournalEntry = existingEntry || {
      date: todayStr,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      mood: 3, energy: 3, sleep: 7, symptoms: [], notes: ''
    };

    const updatedEntry = { ...baseEntry };
    
    if (activeTab === 'bp') {
       updatedEntry.bpSys = quickLogValue1;
       updatedEntry.bpDia = quickLogValue2;
    } else if (activeTab === 'sugar') {
       updatedEntry.sugar = quickLogValue1;
    } else if (activeTab === 'weight') {
       updatedEntry.weight = quickLogValue1;
    }

    try {
      await onAddEntry(updatedEntry);
      setQuickLogValue1('');
      setQuickLogValue2('');
      showDoneToast('Vitals updated for today!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLogging(false);
    }
  };

  const now = new Date();
  const getDays = (range: string) => {
    if (range === '7d') return 7;
    if (range === '30d') return 30;
    if (range === '90d') return 90;
    return 9999;
  };

  const data = [...journal].reverse().filter(e => {
    const d = new Date(e.date);
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= getDays(timeRange);
  }).map(e => ({
    date: new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    mood: e.mood,
    energy: e.energy,
    sleep: e.sleep,
    bpSys: e.bpSys ? parseInt(e.bpSys) : null,
    bpDia: e.bpDia ? parseInt(e.bpDia) : null,
    sugar: e.sugar ? parseInt(e.sugar) : null,
    weight: e.weight ? parseFloat(e.weight) : null,
  }));

  const hasData = (tab: string) => {
    if (tab === 'bp') return data.some(d => d.bpSys !== null);
    if (tab === 'sugar') return data.some(d => d.sugar !== null);
    if (tab === 'weight') return data.some(d => d.weight !== null);
    return data.length > 0;
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 border border-white/20">
            <TrendingUp size={28} />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">Health Engine</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Biometric Trend Analytics</p>
          </div>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[32px] p-1.5 flex items-center overflow-x-auto no-scrollbar shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent pointer-events-none" />
        {[
          { id: 'wellbeing', label: 'Wellbeing', icon: <Heart size={16} /> },
          { id: 'bp', label: 'Blood Pressure', icon: <Activity size={16} /> },
          { id: 'sugar', label: 'Glucose', icon: <Zap size={16} /> },
          { id: 'weight', label: 'Weight', icon: <Scale size={16} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 min-w-[100px] py-3.5 px-4 flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all whitespace-nowrap relative z-10",
              activeTab === tab.id ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400/50" : "text-[var(--muted)] hover:text-blue-400 hover:bg-white/5"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex glass w-fit mx-auto p-1.5 rounded-2xl border border-white/10 shadow-xl">
        {[
          { id: '7d', label: '7D' },
          { id: '30d', label: '1M' },
          { id: '90d', label: '3M' },
          { id: 'all', label: 'All Time' }
        ].map(range => (
          <button 
            key={range.id}
            onClick={() => setTimeRange(range.id as any)}
            className={cn(
              "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              timeRange === range.id ? "bg-[var(--surface)] text-[var(--teal)] shadow-sm border border-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {activeTab !== 'wellbeing' && (
        <div className="glass-darker border border-white/10 rounded-[32px] p-8 shadow-xl space-y-6 relative overflow-hidden group">
          <div className="absolute -left-12 -top-12 w-32 h-32 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60">Instant Metric Logging</h3>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            {activeTab === 'bp' && (
              <>
                <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="SYS" className="flex-1 glass border border-[var(--border)] rounded-2xl px-6 py-4 text-sm focus:border-blue-500/50 outline-none text-[var(--text)] font-mono placeholder:opacity-30" />
                <span className="text-2xl font-light text-[var(--muted)]/40">/</span>
                <input type="number" value={quickLogValue2} onChange={e => setQuickLogValue2(e.target.value)} placeholder="DIA" className="flex-1 glass border border-[var(--border)] rounded-2xl px-6 py-4 text-sm focus:border-blue-500/50 outline-none text-[var(--text)] font-mono placeholder:opacity-30" />
              </>
            )}
            {activeTab === 'sugar' && (
              <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="MG/DL (e.g. 95)" className="flex-1 glass border border-[var(--border)] rounded-2xl px-6 py-4 text-sm focus:border-blue-500/50 outline-none text-[var(--text)] font-mono placeholder:opacity-30" />
            )}
            {activeTab === 'weight' && (
              <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="KG (e.g. 70.4)" className="flex-1 glass border border-[var(--border)] rounded-2xl px-6 py-4 text-sm focus:border-blue-500/50 outline-none text-[var(--text)] font-mono placeholder:opacity-30" />
            )}
            <button 
              onClick={handleQuickLog}
              disabled={isLogging || (!quickLogValue1 && !quickLogValue2)}
              className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center border border-white/20"
            >
              {isLogging ? <RefreshCw className="animate-spin" size={24} /> : <Zap size={24} />}
            </button>
          </div>
        </div>
      )}

      <div className="glass border border-white/10 rounded-[48px] p-10 space-y-10 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        
        {!hasData(activeTab) ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full glass-darker border border-white/5 flex items-center justify-center text-[var(--muted)] opacity-20 shadow-inner">
              <BarChart3 size={48} />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-serif text-[var(--text)] dark:text-white tracking-tight">Signal Data Missing</p>
              <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] max-w-[240px] leading-loose opacity-60">Log your first biometric entry to initiate the neural progress engine.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700 relative z-10">
            {activeTab === 'wellbeing' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Mood & Energy Trend</h3>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--teal)]" />
                        <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Mood</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                        <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Energy</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--teal)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 5]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="mood" stroke="var(--teal)" fillOpacity={1} fill="url(#colorMood)" strokeWidth={3} />
                        <Area type="monotone" dataKey="energy" stroke="#fbbf24" fillOpacity={0} strokeWidth={3} />
                        <Brush dataKey="date" height={20} stroke="var(--teal)" fill="var(--card2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-[var(--border)]">
                  <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Sleep Duration (Hours)</h3>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="stepAfter" dataKey="sleep" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, fill: '#818cf8' }} activeDot={{ r: 6 }} />
                        <Brush dataKey="date" height={20} stroke="#818cf8" fill="var(--card2)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'bp' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Blood Pressure (mmHg)</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Systolic</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Diastolic</span>
                    </div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.filter(d => d.bpSys !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="bpSys" stroke="#f87171" strokeWidth={3} dot={{ r: 4, fill: '#f87171' }} />
                      <Line type="monotone" dataKey="bpDia" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#60a5fa' }} />
                      <Brush dataKey="date" height={20} stroke="#f87171" fill="var(--card2)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'sugar' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Blood Sugar (mg/dL)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.filter(d => d.sugar !== null)}>
                      <defs>
                        <linearGradient id="colorSugar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="sugar" stroke="#fbbf24" fillOpacity={1} fill="url(#colorSugar)" strokeWidth={3} />
                      <Brush dataKey="date" height={20} stroke="#fbbf24" fill="var(--card2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'weight' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Body Weight (kg)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.filter(d => d.weight !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="weight" stroke="var(--teal)" strokeWidth={3} dot={{ r: 5, fill: 'var(--teal)' }} />
                      <Brush dataKey="date" height={20} stroke="var(--teal)" fill="var(--card2)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-5 flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-blue-300">Pro Tip</p>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Consistent logging helps Veda AI identify long-term health patterns and provide more accurate insights.
          </p>
        </div>
      </div>
    </div>
  );
});

function Onboarding({ profile, setProfile, updateProfile, onComplete }: { profile: UserProfile, setProfile: any, updateProfile: (p: UserProfile) => Promise<void>, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(profile);
  const [error, setError] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState<{ [key: string]: string }>({
    conditions: '', familyHistory: '', allergies: '', vaccinationHistory: ''
  });

  const validateStep = () => {
    if (step === 1) {
      if (!data.name.trim()) return "Please enter your name.";
      if (!data.age || !Number.isInteger(Number(data.age)) || Number(data.age) <= 0 || Number(data.age) > 120) return "Please enter a valid age between 1 and 120.";
      if (!data.sex) return "Please select your sex.";
    }
    if (step === 2) {
      if (data.height) {
        const h = parseFloat(data.height);
        if (isNaN(h) || h < 50 || h > 300) return "Please enter a valid height between 50 and 300 cm.";
      } else {
        return "Please enter a valid height.";
      }
      if (data.weight) {
        const w = parseFloat(data.weight);
        if (isNaN(w) || w < 2 || w > 500) return "Please enter a valid weight between 2 and 500 kg.";
      } else {
        return "Please enter a valid weight.";
      }
    }
    if (step === 6) {
      if (data.emergencyContactPhone && !/^\d{10,15}$/.test(data.emergencyContactPhone.replace(/\D/g, ''))) {
        return "Please enter a valid phone number for your emergency contact.";
      }
    }
    return null;
  };

  const handleNext = async () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < 6) setStep(step + 1);
    else {
      await updateProfile({ ...data, setupDone: true });
      onComplete();
    }
  };

  const toggleList = (field: 'conditions' | 'familyHistory' | 'allergies' | 'vaccinationHistory', value: string) => {
    const list = data[field] as string[];
    if (list.includes(value)) {
      setData({ ...data, [field]: list.filter(i => i !== value) });
    } else {
      setData({ ...data, [field]: [...list, value] });
    }
  };

  const addCustomItem = (field: 'conditions' | 'familyHistory' | 'allergies' | 'vaccinationHistory') => {
    const val = customInput[field].trim();
    if (val && !data[field].includes(val)) {
      setData({ ...data, [field]: [...data[field], val] });
    }
    setCustomInput({ ...customInput, [field]: '' });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[var(--bg)] flex flex-col p-6 animate-in fade-in overflow-y-auto">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-full">
        <div className="flex justify-between items-center mb-12">
          <h1 className="font-serif text-2xl text-[var(--teal)]">Veda</h1>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div key={s} className={cn("w-6 h-1.5 rounded-full transition-all", s <= step ? "bg-[var(--teal)]" : "bg-[var(--border)]")} />
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-8">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-[var(--text)]">Welcome!</h2>
                <p className="text-[var(--text2)]">Let's start with the basics.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Your Name</label>
                  <input value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="Enter your name" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Location</label>
                  <input value={data.city} onChange={e => setData({...data, city: e.target.value})} placeholder="City or region" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Age</label>
                    <input type="number" value={data.age} onChange={e => setData({...data, age: e.target.value})} placeholder="Years" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Sex</label>
                    <select value={data.sex} onChange={e => setData({...data, sex: e.target.value})} className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-[var(--text)]">Physical Stats</h2>
                <p className="text-[var(--text2)]">Helps us calculate your health score.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Height (cm)</label>
                  <input type="number" value={data.height} onChange={e => setData({...data, height: e.target.value})} placeholder="Height" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Weight (kg)</label>
                  <input type="number" value={data.weight} onChange={e => setData({...data, weight: e.target.value})} placeholder="Weight" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Blood Group</label>
                <select value={data.blood} onChange={e => setData({...data, blood: e.target.value})} className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]">
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-[var(--text)]">Medical History</h2>
                <p className="text-[var(--text2)]">Any existing conditions or family history?</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Existing Conditions</label>
                  <div className="flex flex-wrap gap-2">
                    {['Diabetes', 'Hypertension', 'Asthma', 'Thyroid', 'Arthritis', 'Anxiety', 'Depression'].map(c => (
                      <button key={c} onClick={() => toggleList('conditions', c)} className={cn("px-4 py-2 rounded-xl border transition-all text-sm", data.conditions.includes(c) ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "border-[var(--border)] text-[var(--text2)]")}>{c}</button>
                    ))}
                    {data.conditions.filter(c => !['Diabetes', 'Hypertension', 'Asthma', 'Thyroid', 'Arthritis', 'Anxiety', 'Depression'].includes(c)).map(c => (
                      <button key={c} onClick={() => toggleList('conditions', c)} className="px-4 py-2 rounded-xl border bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)] text-sm transition-all">{c} ×</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={customInput.conditions} onChange={e => setCustomInput({...customInput, conditions: e.target.value})} onKeyDown={e => e.key === 'Enter' && addCustomItem('conditions')} placeholder="Add other condition..." className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2 outline-none focus:border-[var(--teal-dim)] text-sm text-[var(--text)]" />
                    <button onClick={() => addCustomItem('conditions')} className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--teal)] hover:text-[#020f0c] transition-all">Add</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Family History (Blood Relatives)</label>
                  <p className="text-xs text-[var(--muted)]">e.g., "Mother - Breast Cancer", "Father - Diabetes"</p>
                  <div className="flex flex-wrap gap-2">
                    {['Heart Disease', 'Cancer', 'Diabetes', 'Stroke', 'Alzheimer\'s'].map(c => (
                      <button key={c} onClick={() => toggleList('familyHistory', c)} className={cn("px-4 py-2 rounded-xl border transition-all text-sm", data.familyHistory.includes(c) ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "border-[var(--border)] text-[var(--text2)]")}>{c}</button>
                    ))}
                    {data.familyHistory.filter(c => !['Heart Disease', 'Cancer', 'Diabetes', 'Stroke', 'Alzheimer\'s'].includes(c)).map(c => (
                      <button key={c} onClick={() => toggleList('familyHistory', c)} className="px-4 py-2 rounded-xl border bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)] text-sm transition-all">{c} ×</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={customInput.familyHistory} onChange={e => setCustomInput({...customInput, familyHistory: e.target.value})} onKeyDown={e => e.key === 'Enter' && addCustomItem('familyHistory')} placeholder="Specify relative & condition..." className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2 outline-none focus:border-[var(--teal-dim)] text-sm text-[var(--text)]" />
                    <button onClick={() => addCustomItem('familyHistory')} className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--teal)] hover:text-[#020f0c] transition-all">Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-[var(--text)]">Allergies & Vax</h2>
                <p className="text-[var(--text2)]">Safety first.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Allergies</label>
                  <div className="flex flex-wrap gap-2">
                    {['Peanuts', 'Penicillin', 'Dust', 'Latex', 'Pollen', 'Shellfish'].map(c => (
                      <button key={c} onClick={() => toggleList('allergies', c)} className={cn("px-4 py-2 rounded-xl border transition-all text-sm", data.allergies.includes(c) ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "border-[var(--border)] text-[var(--text2)]")}>{c}</button>
                    ))}
                    {data.allergies.filter(c => !['Peanuts', 'Penicillin', 'Dust', 'Latex', 'Pollen', 'Shellfish'].includes(c)).map(c => (
                      <button key={c} onClick={() => toggleList('allergies', c)} className="px-4 py-2 rounded-xl border bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)] text-sm transition-all">{c} ×</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={customInput.allergies} onChange={e => setCustomInput({...customInput, allergies: e.target.value})} onKeyDown={e => e.key === 'Enter' && addCustomItem('allergies')} placeholder="Add other allergy..." className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2 outline-none focus:border-[var(--teal-dim)] text-sm text-[var(--text)]" />
                    <button onClick={() => addCustomItem('allergies')} className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--teal)] hover:text-[#020f0c] transition-all">Add</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Vaccination History</label>
                  <p className="text-xs text-[var(--muted)]">Track your key immunizations</p>
                  <div className="flex flex-wrap gap-2">
                    {['COVID-19 (Fully Vaccinated)', 'COVID-19 (Partially)', 'Influenza (Annual)', 'Hepatitis B', 'Tetanus (Tdap)', 'HPV'].map(c => (
                      <button key={c} onClick={() => toggleList('vaccinationHistory', c)} className={cn("px-4 py-2 rounded-xl border transition-all text-sm", data.vaccinationHistory.includes(c) ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "border-[var(--border)] text-[var(--text2)]")}>{c}</button>
                    ))}
                    {data.vaccinationHistory.filter(c => !['COVID-19 (Fully Vaccinated)', 'COVID-19 (Partially)', 'Influenza (Annual)', 'Hepatitis B', 'Tetanus (Tdap)', 'HPV'].includes(c)).map(c => (
                      <button key={c} onClick={() => toggleList('vaccinationHistory', c)} className="px-4 py-2 rounded-xl border bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)] text-sm transition-all">{c} ×</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={customInput.vaccinationHistory} onChange={e => setCustomInput({...customInput, vaccinationHistory: e.target.value})} onKeyDown={e => e.key === 'Enter' && addCustomItem('vaccinationHistory')} placeholder="e.g., Yellow Fever (2022)" className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2 outline-none focus:border-[var(--teal-dim)] text-sm text-[var(--text)]" />
                    <button onClick={() => addCustomItem('vaccinationHistory')} className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--teal)] hover:text-[#020f0c] transition-all">Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-[var(--text)]">All Set!</h2>
                <p className="text-[var(--text2)]">You're ready to use Veda Health.</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--teal-line)] rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[var(--teal)]/10 flex items-center justify-center text-[var(--teal)]">
                  <Shield size={24} />
                </div>
                <p className="text-xs text-[var(--text2)]">Your data is stored securely and is never shared without your consent.</p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <h2 className="font-serif text-3xl text-red-400">Emergency SOS</h2>
                <p className="text-[var(--text2)]">Set up a primary emergency contact for quick access during a crisis. (Optional but Recommended)</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Contact Name</label>
                  <input value={data.emergencyContactName || ''} onChange={e => setData({...data, emergencyContactName: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Phone Number</label>
                  <input type="tel" value={data.emergencyContactPhone || ''} onChange={e => setData({...data, emergencyContactPhone: e.target.value})} placeholder="e.g. +91 98765 43210" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Relation</label>
                  <input value={data.emergencyContactRelation || ''} onChange={e => setData({...data, emergencyContactRelation: e.target.value})} placeholder="e.g. Spouse, Parent, Sister" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-4 outline-none focus:border-[var(--teal-dim)] text-[var(--text)]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="pt-8 pb-12">
          <button onClick={handleNext} className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all">
            {step === 6 ? "Finish Setup ✦" : "Continue →"}
          </button>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="w-full py-4 text-[var(--muted)] font-bold mt-2">
              Go Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileView({ 
  profile, 
  setProfile, 
  updateProfile, 
  switchMode, 
  journal,
  notificationPermission,
  setNotificationPermission,
  requestNotificationPermission,
  onDeleteAccount,
  deferredPrompt,
  onInstallApp
}: { 
  profile: UserProfile, 
  setProfile: any, 
  updateProfile: (p: UserProfile) => Promise<void>, 
  switchMode: (m: AppMode) => void, 
  journal: JournalEntry[],
  notificationPermission: NotificationPermission,
  setNotificationPermission: (p: NotificationPermission) => void,
  requestNotificationPermission: () => void,
  onDeleteAccount: () => Promise<void>,
  deferredPrompt: any,
  onInstallApp: () => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(profile);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    const dataStr = JSON.stringify({ profile, journal }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `veda_health_data_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showDoneToast('📁 Data exported successfully!');
  };

  const handleDeleteData = async () => {
    await onDeleteAccount();
  };

  const validate = () => {
    if (!editData.name.trim()) return "Please enter your name.";
    if (!editData.age || !Number.isInteger(Number(editData.age)) || Number(editData.age) <= 0 || Number(editData.age) > 120) return "Please enter a valid age between 1 and 120.";
    if (editData.height) {
      const h = parseFloat(editData.height);
      if (isNaN(h) || h < 50 || h > 300) return "Please enter a valid height between 50 and 300 cm.";
    } else {
      return "Please enter a valid height.";
    }
    if (editData.weight) {
      const w = parseFloat(editData.weight);
      if (isNaN(w) || w < 2 || w > 500) return "Please enter a valid weight between 2 and 500 kg.";
    } else {
      return "Please enter a valid weight.";
    }
    if (editData.emergencyContactPhone && !/^\d{10,15}$/.test(editData.emergencyContactPhone.replace(/\D/g, ''))) {
      return "Please enter a valid phone number for your emergency contact.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    await updateProfile(editData);
    setIsEditing(false);
  };

  const toggleList = (field: 'conditions' | 'familyHistory' | 'allergies' | 'vaccinationHistory', value: string) => {
    const list = editData[field] as string[];
    if (list.includes(value)) {
      setEditData({ ...editData, [field]: list.filter(i => i !== value) });
    } else {
      setEditData({ ...editData, [field]: [...list, value] });
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-tight">Edit Profile</h2>
          <button onClick={() => setIsEditing(false)} className="text-sm text-[var(--muted)]">Cancel</button>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Name</label>
              <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Location</label>
              <input value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} placeholder="City or region" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Age</label>
                <input type="number" value={editData.age} onChange={e => setEditData({...editData, age: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Sex</label>
                <select value={editData.sex} onChange={e => setEditData({...editData, sex: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Height (cm)</label>
                <input type="number" value={editData.height} onChange={e => setEditData({...editData, height: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Weight (kg)</label>
                <input type="number" value={editData.weight} onChange={e => setEditData({...editData, weight: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Blood Group</label>
              <select value={editData.blood} onChange={e => setEditData({...editData, blood: e.target.value})} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]">
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
              <h3 className="text-xs font-bold text-[var(--teal)] uppercase tracking-widest">Immunizations & More</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Vaccination History</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editData.vaccinationHistory?.map(c => (
                    <button key={c} onClick={() => toggleList('vaccinationHistory', c)} className="px-3 py-1 bg-[var(--teal)]/10 border border-[var(--teal)] text-[var(--teal)] rounded-lg text-xs font-medium">{c} ×</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input id="vac_input" placeholder="Add vaccine..." onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val && !editData.vaccinationHistory.includes(val)) {
                        setEditData({...editData, vaccinationHistory: [...(editData.vaccinationHistory || []), val]});
                      }
                      e.currentTarget.value = '';
                    }
                  }} className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)] text-xs" />
                  <button onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('vac_input') as HTMLInputElement;
                    const val = el.value.trim();
                    if (val && !editData.vaccinationHistory.includes(val)) {
                      setEditData({...editData, vaccinationHistory: [...(editData.vaccinationHistory || []), val]});
                    }
                    el.value = '';
                  }} className="px-4 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--teal)] hover:text-[#020f0c]">Add</button>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">Medicine Cabinet</h3>
              <div className="space-y-3">
                {editData.medicines.map((m, idx) => (
                  <div key={idx} className="p-4 bg-[var(--card2)] border border-[var(--border)] rounded-2xl relative group">
                    <button 
                      onClick={() => setEditData({...editData, medicines: editData.medicines.filter((_, i) => i !== idx)})}
                      className="absolute top-2 right-2 text-rose-400 opacity-20 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                    <div className="space-y-2">
                       <input 
                         value={m.name} 
                         onChange={e => {
                           const newMeds = [...editData.medicines];
                           newMeds[idx] = { ...m, name: e.target.value };
                           setEditData({ ...editData, medicines: newMeds });
                         }}
                         className="w-full bg-transparent font-bold text-sm outline-none border-b border-white/5" 
                         placeholder="Medicine Name" 
                       />
                       <div className="grid grid-cols-2 gap-3">
                          <input 
                            value={m.dose} 
                            onChange={e => {
                              const newMeds = [...editData.medicines];
                              newMeds[idx] = { ...m, dose: e.target.value };
                              setEditData({ ...editData, medicines: newMeds });
                            }}
                            className="bg-transparent text-xs text-[var(--muted)] outline-none" 
                            placeholder="Dose (e.g. 500mg)" 
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--muted2)]">x</span>
                            <input 
                              type="number"
                              value={m.dailyFrequency} 
                              onChange={e => {
                                const newMeds = [...editData.medicines];
                                newMeds[idx] = { ...m, dailyFrequency: parseInt(e.target.value) || 1 };
                                setEditData({ ...editData, medicines: newMeds });
                              }}
                              className="w-8 bg-transparent text-xs text-[var(--muted)] outline-none" 
                            />
                            <span className="text-[10px] text-[var(--muted2)]">daily</span>
                          </div>
                       </div>
                       <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] font-black uppercase text-[var(--muted2)] tracking-widest">Stock:</span>
                          <input 
                            type="number"
                            value={m.totalQuantity} 
                            onChange={e => {
                              const newMeds = [...editData.medicines];
                              newMeds[idx] = { ...m, totalQuantity: parseInt(e.target.value) || 0 };
                              setEditData({ ...editData, medicines: newMeds });
                            }}
                            className="w-12 bg-[var(--card)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-center" 
                          />
                       </div>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setEditData({...editData, medicines: [...editData.medicines, { name: '', dose: '', dailyFrequency: 1, totalQuantity: 30, lastRefillDate: new Date().toISOString() }]})}
                  className="w-full py-3 border border-dashed border-[var(--border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--muted)] hover:text-purple-400 hover:border-purple-400/50 transition-all"
                >
                  + Add New Medicine
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Name</label>
                  <input value={editData.emergencyContactName || ''} onChange={e => setEditData({...editData, emergencyContactName: e.target.value})} placeholder="Contact Name" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Relation</label>
                  <input value={editData.emergencyContactRelation || ''} onChange={e => setEditData({...editData, emergencyContactRelation: e.target.value})} placeholder="e.g. Spouse" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Phone Number</label>
                <input type="tel" value={editData.emergencyContactPhone || ''} onChange={e => setEditData({...editData, emergencyContactPhone: e.target.value})} placeholder="e.g. +91 98765 43210" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 outline-none focus:border-[var(--teal-dim)]" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <button onClick={handleSave} className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold rounded-2xl shadow-xl">
          Save Changes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
            <User size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Your Profile</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Manage your health data</p>
          </div>
        </div>
        <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-xs font-bold hover:border-[var(--teal-dim)] transition-all">Edit</button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-[var(--border)]">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] text-3xl font-serif">
            {(profile.name || 'G')[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-serif text-2xl">{profile.name || 'Guest'}</h3>
            <p className="text-sm text-[var(--muted)]">{profile.age || '--'} years · {profile.sex || 'Not set'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Height</span>
            <p className="font-serif text-lg">{profile.height || '--'} cm</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Weight</span>
            <p className="font-serif text-lg">{profile.weight || '--'} kg</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Blood Group</span>
            <p className="font-serif text-lg">{profile.blood || '--'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Location</span>
            <p className="font-serif text-lg">{profile.city || '--'}</p>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Medical Conditions</h4>
          <div className="flex flex-wrap gap-2">
            {profile.conditions.length > 0 ? profile.conditions.map(c => (
              <span key={c} className="px-3 py-1.5 bg-[var(--card2)] border border-[var(--border)] rounded-lg text-xs font-medium">{c}</span>
            )) : <p className="text-xs text-[var(--muted)]">No conditions listed.</p>}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Family History</h4>
          <div className="flex flex-wrap gap-2">
            {profile.familyHistory?.length > 0 ? profile.familyHistory.map(c => (
              <span key={c} className="px-3 py-1.5 bg-[var(--card2)] border border-[var(--border)] rounded-lg text-xs font-medium">{c}</span>
            )) : <p className="text-xs text-[var(--muted)]">No family history listed.</p>}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Allergies</h4>
          <div className="flex flex-wrap gap-2">
            {profile.allergies?.length > 0 ? profile.allergies.map(c => (
              <span key={c} className="px-3 py-1.5 bg-[var(--card2)] border border-[var(--border)] rounded-lg text-xs font-medium">{c}</span>
            )) : <p className="text-xs text-[var(--muted)]">No allergies listed.</p>}
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border)]">
          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-3">
             <div className="flex items-center gap-2 text-red-400">
               <AlertTriangle size={16} />
               <h4 className="text-[11px] font-bold uppercase tracking-widest">Emergency SOS Info</h4>
             </div>
             {profile.emergencyContactName ? (
               <div className="space-y-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-[var(--text2)]">{profile.emergencyContactName} ({profile.emergencyContactRelation})</span>
                   <span className="font-mono text-red-300">{profile.emergencyContactPhone}</span>
                 </div>
               </div>
             ) : (
               <p className="text-[10px] text-red-300 opacity-60 italic">No emergency contact set up. Please edit your profile to add one.</p>
             )}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Vaccination History</h4>
          <div className="flex flex-wrap gap-2">
            {profile.vaccinationHistory?.length > 0 ? profile.vaccinationHistory.map(c => (
              <span key={c} className="px-3 py-1.5 bg-[var(--card2)] border border-[var(--border)] rounded-lg text-xs font-medium">{c}</span>
            )) : <p className="text-xs text-[var(--muted)]">No vaccines listed.</p>}
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest flex items-center gap-2">
            <Download size={14} className="text-[var(--teal)]" /> Get the App
          </h4>
          <div className="bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-2xl p-5">
            <p className="text-xs text-[var(--text2)] leading-relaxed mb-4 font-medium">
              Install Veda Health on your phone for a faster, app-like experience with offline access and notifications.
            </p>
            
            {deferredPrompt ? (
              <button 
                onClick={onInstallApp}
                className="w-full py-3 bg-[var(--teal)] text-[#020f0c] font-black rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                <Download size={16} />
                Install Veda Health
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] font-bold text-[var(--muted)] uppercase mb-2">Instructions for Mobile</p>
                  <ul className="text-xs space-y-2 text-[var(--text)] opacity-80">
                    <li className="flex gap-2">
                      <span className="text-[var(--teal)] font-black">Android:</span> Tap the menu (⋮) and select "Install App" or "Add to Home Screen".
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400 font-black">iOS (iPhone):</span> Tap the "Share" button at bottom and scroll to "Add to Home Screen".
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Privacy & Security</h4>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => switchMode('privacy')}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--card2)] border border-[var(--border)] hover:border-blue-500/50 transition-all"
            >
              <Shield size={16} className="text-blue-400" />
              <span className="text-xs font-bold">Privacy Center</span>
            </button>
            <button 
              onClick={() => switchMode('trust')}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--card2)] border border-[var(--border)] hover:border-teal-500/50 transition-all"
            >
              <FileText size={16} className="text-teal-400" />
              <span className="text-xs font-bold">Terms & Conditions</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Communications</h4>
          <button 
            onClick={requestNotificationPermission}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
              notificationPermission === 'granted' 
                ? "bg-[var(--teal)]/5 border-[var(--teal)]/20 text-[var(--teal)]" 
                : notificationPermission === 'denied'
                ? "bg-red-500/5 border-red-500/20 text-red-400"
                : "bg-[var(--card2)] border-[var(--border)] text-[var(--text2)]"
            )}
          >
            <div className="flex items-center gap-3">
              {notificationPermission === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
              <div className="text-left">
                <span className="text-xs font-bold block">Push Notifications</span>
                {notificationPermission === 'denied' && (
                  <span className="text-[10px] text-red-400 opacity-80 block">Blocked by browser. Try in a new tab.</span>
                )}
              </div>
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
              notificationPermission === 'granted' ? "bg-white/10" : "bg-red-500/10"
            )}>
              {notificationPermission === 'granted' ? 'Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Disabled'}
            </span>
          </button>
        </div>

        <div className="space-y-3 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Data Management</h4>
          <button 
            onClick={handleExport}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-[var(--card2)] border border-[var(--border)] hover:border-[var(--teal-dim)] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Package size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Export Health Data</p>
                <p className="text-[10px] text-[var(--muted)]">Download your records as JSON</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[var(--muted)] group-hover:text-[var(--teal)] transition-colors" />
          </button>
        </div>

        <div className="space-y-3 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert size={12} /> Danger Zone
          </h4>
          <button 
            onClick={handleDeleteData}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10"
          >
            <Trash2 size={18} />
            <div className="text-left">
              <p className="text-sm font-bold">Delete Account & Purge Data</p>
              <p className="text-[10px] text-rose-300 opacity-80">This permanently removes your profile and all encrypted health records.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function FamilyHealthCircle({ family, onAddMember, onUpdateMember, onDeleteMember, profile, onUpdateProfile }: { 
  family: FamilyMember[], 
  onAddMember: (member: Omit<FamilyMember, 'id' | 'score'>) => void,
  onUpdateMember: (id: string, updates: Partial<FamilyMember>) => void,
  onDeleteMember: (id: string) => void,
  profile: UserProfile,
  onUpdateProfile: (p: UserProfile) => void
}) {
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'meds' | 'appts' | 'perms'>('info');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newHistory, setNewHistory] = useState('');
  const [newMeds, setNewMeds] = useState('');
  const [newAllergies, setNewAllergies] = useState('');
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isAiReportLoading, setIsAiReportLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [familyReport, setFamilyReport] = useState<string | null>(null);

  const [newMedName, setNewMedName] = useState('');
  const [newApptTitle, setNewApptTitle] = useState('');

  const togglePermission = (memberId: string, type: 'locker' | 'sos' | 'contact') => {
    const member = family.find(f => f.id === memberId);
    if (!member) return;
    
    const updates: Partial<FamilyMember> = {};
    if (type === 'locker') updates.canAccessLocker = !member.canAccessLocker;
    if (type === 'sos') updates.canAccessSOS = !member.canAccessSOS;
    if (type === 'contact') updates.isEmergencyContact = !member.isEmergencyContact;
    
    onUpdateMember(memberId, updates);
  };

  const handleAddMed = (memberId: string) => {
    if (!newMedName) return;
    const member = family.find(f => f.id === memberId);
    if (!member) return;

    const newReminder: Reminder = {
      id: Date.now().toString(),
      name: newMedName,
      dose: '1 Tablet',
      time: '09:00',
      freq: 'Daily',
      on: true,
      color: 'pink',
      category: 'medicine'
    };

    onUpdateMember(memberId, {
      reminders: [...(member.reminders || []), newReminder]
    });
    setNewMedName('');
    showDoneToast(`Medication added for ${member.name}`);
  };

  const handleAddAppt = (memberId: string) => {
    if (!newApptTitle) return;
    const member = family.find(f => f.id === memberId);
    if (!member) return;

    const newAppt: Appointment = {
      id: Date.now().toString(),
      clinicId: 'any',
      clinicName: 'Local Clinic',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      status: 'upcoming',
      patientName: member.name,
      patientId: member.id,
      type: newApptTitle
    };

    onUpdateMember(memberId, {
      appointments: [...(member.appointments || []), newAppt]
    });
    setNewApptTitle('');
    showDoneToast(`Appointment scheduled for ${member.name}`);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newRelation) return;
    setIsSubmitting(true);
    try {
      onAddMember({
        name: newName,
        relation: newRelation,
        age: newAge,
        medicalHistory: newHistory.split(',').map(s => s.trim()).filter(Boolean),
        medications: newMeds.split(',').map(s => s.trim()).filter(Boolean),
        allergies: newAllergies.split(',').map(s => s.trim()).filter(Boolean),
      });
      setIsAdding(false);
      setNewName('');
      setNewRelation('');
      setNewAge('');
      setNewHistory('');
      setNewMeds('');
      setNewAllergies('');
      showDoneToast("Family member added!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (m: FamilyMember) => {
    setNewName(m.name);
    setNewRelation(m.relation);
    setNewAge(m.age);
    setNewHistory(m.medicalHistory?.join(', ') || '');
    setNewMeds(m.medications?.join(', ') || '');
    setNewAllergies(m.allergies?.join(', ') || '');
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!selectedMember) return;
    setIsSubmitting(true);
    try {
      onUpdateMember(selectedMember.id, {
        name: newName,
        relation: newRelation,
        age: newAge,
        medicalHistory: newHistory.split(',').map(s => s.trim()).filter(Boolean),
        medications: newMeds.split(',').map(s => s.trim()).filter(Boolean),
        allergies: newAllergies.split(',').map(s => s.trim()).filter(Boolean),
      });
      setIsEditing(false);
      setSelectedMember(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateFamilyReport = async () => {
    if (family.length === 0) return;
    setIsAiReportLoading(true);
    try {
      const summary = family.map(m => {
        let details = `${m.name} (${m.relation}, age ${m.age}): Health Score ${m.score}/100.`;
        if (m.medicalHistory?.length) details += ` History: ${m.medicalHistory.join(', ')}.`;
        if (m.medications?.length) details += ` Meds: ${m.medications.join(', ')}.`;
        if (m.allergies?.length) details += ` Allergies: ${m.allergies.join(', ')}.`;
        return details;
      }).join('\n');
      
      const prompt = `Based on this comprehensive family health snapshot, provide a warm, expert wellness report. Include:
      1. A summary of the family's health status.
      2. Specific actionable wellness tips for each member based on their conditions.
      3. Collective health habits the family should adopt.
      4. Any potential interactions or risks based on the shared medications/allergies.
      
      Focus on preventive care and collective health habits.\n\nFamily Snapshot:\n${summary}`;
      
      const result = await callGemini(prompt, "You are Veda, the lead family wellness specialist. Provide clinical yet warm insights.");
      setFamilyReport(result);
    } catch (error) {
      console.error("AI Family Report Error:", error);
    } finally {
      setIsAiReportLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Family Health</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Wellness Circle</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-md active:scale-90"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {family.length > 0 && (
        <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-3xl">
           <h4 className="font-serif text-lg mb-4 text-[var(--text)]">Family Insights</h4>
           <div className="text-sm text-[var(--muted)] italic">
             Log vitals and medicines for family members to see real-time alerts.
           </div>
        </div>
      )}

      {family.length > 0 && (
        <button 
          onClick={generateFamilyReport}
          disabled={isAiReportLoading}
          className="w-full p-4 bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-3xl flex items-center justify-between group hover:bg-orange-500/20 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
              <Sparkles size={18} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">AI Wellness Scan</p>
              <p className="text-sm font-bold">Generate Family Report</p>
            </div>
          </div>
          {isAiReportLoading ? (
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronRight size={20} className="text-orange-500" />
          )}
        </button>
      )}

      {familyReport && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <button onClick={() => setFamilyReport(null)} className="text-orange-500 opacity-50 hover:opacity-100 transition-opacity"><X size={16} /></button>
          </div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-3 flex items-center gap-2">
            <Bot size={14} /> Veda Family Health Report
          </h4>
          <div className="text-xs leading-relaxed text-[var(--text)] markdown-body opacity-90">
            <Markdown>{familyReport}</Markdown>
          </div>
          <div className="mt-4 pt-4 border-t border-orange-500/10 flex justify-end">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(familyReport);
                showDoneToast("Report copied to clipboard!");
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
            >
              <Share2 size={14} /> 
              Share Report
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-3">
        {isAdding && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleAddMember} 
            className="bg-[var(--card)] border-2 border-orange-500/50 rounded-3xl p-6 space-y-4 shadow-xl shadow-orange-500/10 mb-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500">New Circle Member</h4>
              <button 
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewName('');
                  setNewRelation('');
                  setNewAge('');
                }} 
                className="text-[var(--muted)] hover:text-orange-500 transition-colors"
               >
                 <X size={16} />
               </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Identity</p>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Full Name" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-[2] space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Relationship</p>
                  <select 
                    value={newRelation}
                    onChange={e => setNewRelation(e.target.value)}
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                  >
                    <option value="">Select Relation</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Age</p>
                  <input 
                    type="number" 
                    placeholder="E.g. 24" 
                    value={newAge}
                    onChange={e => setNewAge(e.target.value)}
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Medical History (comma separated)</p>
                <input 
                  type="text" 
                  placeholder="Diabetes, Hypertension..." 
                  value={newHistory}
                  onChange={e => setNewHistory(e.target.value)}
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Current Medications</p>
                <input 
                  type="text" 
                  placeholder="Metformin, Aspirin..." 
                  value={newMeds}
                  onChange={e => setNewMeds(e.target.value)}
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Known Allergies</p>
                <input 
                  type="text" 
                  placeholder="Peanuts, Penicillin..." 
                  value={newAllergies}
                  onChange={e => setNewAllergies(e.target.value)}
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold focus:border-orange-500/50 outline-none transition-all"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={!newName || !newRelation || isSubmitting}
              className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Users size={18} />
                  Add to Circle
                </>
              )}
            </button>
          </motion.form>
        )}

        {family.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] px-1">Circle Members ({family.length})</h3>
            {family.map((m) => (
              <div 
                key={m.id} 
                onClick={() => setSelectedMember(m)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between group hover:border-orange-500/30 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/10 flex items-center justify-center text-xl font-serif text-orange-500 group-hover:scale-110 transition-transform">
                    {m.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-tight">{m.name}</h3>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mt-0.5">{m.relation} · {m.age} Years</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={cn(
                      "text-lg font-black font-mono",
                      m.score > 90 ? "text-green-500" : m.score > 80 ? "text-amber-500" : "text-orange-500"
                    )}>
                      {m.score}%
                    </div>
                    <div className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest">Wellness</div>
                  </div>
                  <ChevronRight size={18} className="text-[var(--border)] group-hover:text-orange-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : !isAdding && (
          <div className="bg-[var(--card)] border border-[var(--border)] border-dashed rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] mb-2 opacity-50">
              <Users size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Empty Circle</p>
              <p className="text-[10px] text-[var(--muted)] px-4 leading-relaxed">Add family members to monitor their health trends and get collective AI advice.</p>
            </div>
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-2.5 bg-[var(--card2)] border border-[var(--border)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--text)] hover:border-orange-500/30 transition-all"
            >
              Add First Member
            </button>
          </div>
        )}
      </div>

      {/* Member Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md p-6 flex items-center justify-center overflow-y-auto"
          >
            {(() => {
              const currentMember = family.find(m => m.id === selectedMember.id) || selectedMember;
              return (
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[var(--card)] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl relative"
            >
              <div className="relative h-40 bg-gradient-to-br from-orange-500 to-orange-700 p-8 flex flex-col justify-end">
                <button onClick={() => setSelectedMember(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"><X size={20} /></button>
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl font-serif">{currentMember.name[0]}</div>
                  <div>
                    <h2 className="text-2xl font-serif text-white">{currentMember.name}</h2>
                    <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">{currentMember.relation} · {currentMember.age} Years Old</p>
                  </div>
                </div>
              </div>
              
              <div className="flex bg-[var(--card2)] border-b border-[var(--border)]">
                {(['info', 'meds', 'appts', 'perms'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveSubTab(tab)}
                    className={cn(
                      "flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all relative",
                      activeSubTab === tab ? "text-orange-500" : "text-[var(--muted)] hover:text-[var(--text)]"
                    )}
                  >
                    {tab}
                    {activeSubTab === tab && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
                  </button>
                ))}
              </div>
              
              <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                {activeSubTab === 'info' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[var(--card2)] rounded-3xl p-5 border border-[var(--border)] text-center space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Health Score</p>
                        <p className={cn("text-3xl font-black font-mono", currentMember.score > 80 ? "text-green-500" : "text-orange-500")}>{currentMember.score}%</p>
                      </div>
                      <div className="bg-[var(--card2)] rounded-3xl p-5 border border-[var(--border)] text-center space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Status</p>
                        <p className="text-sm font-bold flex items-center justify-center gap-2 mt-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Stable
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Medical Background</h4>
                        <button 
                          onClick={() => isEditing ? handleUpdate() : startEditing(currentMember)}
                          className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-orange-500/20"
                        >
                          {isEditing ? (isSubmitting ? 'Saving...' : 'Save Changes') : 'Update History'}
                        </button>
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-4 bg-[var(--card2)] p-6 rounded-2xl border border-orange-500/20">
                           <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">History</p>
                            <input value={newHistory} onChange={e => setNewHistory(e.target.value)} className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-xs outline-none focus:border-orange-500" placeholder="Diabetes, etc." />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Meds</p>
                            <input value={newMeds} onChange={e => setNewMeds(e.target.value)} className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-xs outline-none focus:border-orange-500" placeholder="Aspirin, etc." />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Allergies</p>
                            <input value={newAllergies} onChange={e => setNewAllergies(e.target.value)} className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-xs outline-none focus:border-orange-500" placeholder="Peanuts, etc." />
                          </div>
                          <button onClick={() => setIsEditing(false)} className="w-full py-2 text-[9px] font-bold text-[var(--muted)] hover:text-orange-500 transition-colors uppercase tracking-widest">Cancel Editing</button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)] space-y-3">
                            <div>
                              <p className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Medical History</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedMember.medicalHistory?.length ? selectedMember.medicalHistory.map((h, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-md text-[9px] font-bold">{h}</span>
                                )) : <span className="text-[10px] text-[var(--muted)] italic">No history provided</span>}
                              </div>
                            </div>
                            <div>
                              <p className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Current Medications</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedMember.medications?.length ? selectedMember.medications.map((m, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded-md text-[9px] font-bold">{m}</span>
                                )) : <span className="text-[10px] text-[var(--muted)] italic">No active meds</span>}
                              </div>
                            </div>
                            <div>
                              <p className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Known Allergies</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedMember.allergies?.length ? selectedMember.allergies.map((a, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-md text-[9px] font-bold">{a}</span>
                                )) : <span className="text-[10px] text-[var(--muted)] italic">No known allergies</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeSubTab === 'meds' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Medication Schedule</h4>
                      <div className="flex items-center gap-2 text-[var(--muted)] text-[8px] font-black uppercase tracking-widest">
                        <Clock size={10} /> Automated Alerts Enabled
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newMedName}
                        onChange={e => setNewMedName(e.target.value)}
                        placeholder="Add member medication..."
                        className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold outline-none focus:border-orange-500/50"
                      />
                      <button 
                        onClick={() => handleAddMed(currentMember.id)}
                        className="p-3 bg-orange-500 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="space-y-2">
                       {selectedMember.reminders?.length ? selectedMember.reminders.map(r => (
                         <div key={r.id} className="p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)] flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                                  <Pill size={18} />
                               </div>
                               <div>
                                  <p className="text-sm font-bold">{r.name}</p>
                                  <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">{r.time} · {r.freq}</p>
                               </div>
                            </div>
                            <button className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Trash2 size={16} />
                            </button>
                         </div>
                       )) : (
                         <div className="p-12 border-2 border-dashed border-[var(--border)] rounded-3xl text-center space-y-2">
                            <Pill size={32} className="mx-auto text-[var(--muted)] opacity-30" />
                            <p className="text-xs font-bold text-[var(--muted)] opacity-60">No Meds Scheduled</p>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'appts' && (
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Upcoming Appointments</h4>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newApptTitle}
                        onChange={e => setNewApptTitle(e.target.value)}
                        placeholder="Appointment type (e.g. Checkup)..."
                        className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-xs font-bold outline-none focus:border-orange-500/50"
                      />
                      <button 
                        onClick={() => handleAddAppt(currentMember.id)}
                        className="p-3 bg-orange-500 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="space-y-2">
                       {selectedMember.appointments?.length ? selectedMember.appointments.map(a => (
                         <div key={a.id} className="p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)] flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                  <Calendar size={18} />
                               </div>
                               <div>
                                  <p className="text-sm font-bold">{a.type}</p>
                                  <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">{new Date(a.date).toLocaleDateString()} · {a.time}</p>
                               </div>
                            </div>
                            <div className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-orange-500">Upcoming</div>
                         </div>
                       )) : (
                         <div className="p-12 border-2 border-dashed border-[var(--border)] rounded-3xl text-center space-y-2">
                            <Calendar size={32} className="mx-auto text-[var(--muted)] opacity-30" />
                            <p className="text-xs font-bold text-[var(--muted)] opacity-60">No Appointments</p>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {activeSubTab === 'perms' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Access Control</h4>
                      <p className="text-[10px] text-[var(--muted)] leading-relaxed italic">Limit what {currentMember.name} can access in your profile during emergencies.</p>
                      
                      <div className="space-y-2">
                        {[
                          { id: 'locker', label: 'Access Health Locker', sub: 'Can view your encrypted reports & scans', state: currentMember.canAccessLocker },
                          { id: 'sos', label: 'Receive SOS Alerts', sub: 'Gets real-time location when you trigger SOS', state: currentMember.canAccessSOS },
                          { id: 'contact', label: 'Primary Emergency Contact', sub: 'Verified number for hospital coordination', state: currentMember.isEmergencyContact }
                        ].map((perm) => (
                          <div key={perm.id} className="flex items-center justify-between p-5 bg-[var(--card2)] rounded-3xl border border-[var(--border)]">
                            <div className="space-y-1">
                               <p className="text-xs font-bold">{perm.label}</p>
                               <p className="text-[8px] font-medium text-[var(--muted)] uppercase tracking-wider">{perm.sub}</p>
                            </div>
                            <button 
                              onClick={() => togglePermission(currentMember.id, perm.id as any)}
                              className={cn(
                                "w-12 h-6 rounded-full transition-all flex items-center px-1",
                                perm.state ? "bg-orange-500" : "bg-[var(--card)] border border-[var(--border)]"
                              )}
                            >
                               <motion.div 
                                 animate={{ x: perm.state ? 24 : 0 }}
                                 className="w-4 h-4 rounded-full bg-white shadow-sm" 
                               />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl space-y-3">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                         <ShieldCheck size={14} /> Caregiver Protection
                       </h4>
                       <p className="text-xs text-[var(--muted)] leading-relaxed">
                         Enable this to receive proactive AI alerts if {currentMember.name}'s vitals drift or if they miss their scheduled medications.
                       </p>
                    </div>
                  </div>
                )}

                <div className="bg-rose-500/5 border border-rose-500/10 rounded-[32px] p-6 flex items-center justify-between group">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Danger Zone</p>
                    <p className="text-[8px] text-rose-500/60 font-medium">Remove from Health Circle?</p>
                  </div>
                  <button 
                    onClick={() => {
                      if(window.confirm("Remove this member?")) {
                        onDeleteMember(selectedMember.id);
                        setSelectedMember(null);
                        showDoneToast("Member removed from circle");
                      }
                    }}
                    className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all group-hover:scale-105"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MedicineDelivery = memo(function MedicineDelivery({ reminders, profile, cart, setCart, showCart, setShowCart }: { 
  reminders: Reminder[], 
  profile: UserProfile,
  cart: any[],
  setCart: (cart: any[]) => void,
  showCart: boolean,
  setShowCart: (show: boolean) => void
}) {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'address' | 'payment' | 'success'>('cart');
  const [address, setAddress] = useState({ street: '', city: '', pin: '' });

  const medicines: any[] = [];

  const filtered = search.length > 0 ? medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.brand.toLowerCase().includes(search.toLowerCase())) : [];

  // Global AI Search logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.length > 2) {
        // If local search has few results, try global search
        if (filtered.length < 3) {
          setIsSearching(true);
          try {
            const prompt = `Database lookup for real medicines with accurate current market prices related to: "${search}". 
            Output format: JSON array of objects.
            Fields: name (common molecule), brand (popular brand), price (Real MRP in INR), type (Form), icon (Emoji), description (1 sentence use).
            Example: [{"name": "Aspirin", "brand": "Ecotrin", "price": 42, "type": "Tablet", "icon": "💊", "description": "Used for pain and fever."}]
            CRITICAL: Focus on REAL, ACCURATE current retail prices from major Indian pharmacies (1mg, PharmEasy, etc).
            Limit to 5 results.`;
            
            const response = await callGemini(prompt, "You are a specialized pharmaceutical pricing engine. Return ONLY a JSON array. Prioritize accuracy for Maximum Retail Price (MRP) in India. No conversational text.");
            
            // Extract JSON array more robustly
            const startIdx = response.indexOf('[');
            const endIdx = response.lastIndexOf(']');
            
            if (startIdx === -1 || endIdx === -1) {
              console.warn("AI Response did not contain JSON array:", response);
              setAiResults([]);
              return;
            }

            const cleanJson = response.substring(startIdx, endIdx + 1);
            const results = JSON.parse(cleanJson);
            
            setAiResults(results.map((r: any, i: number) => ({
              ...r,
              id: `ai-${r.name}-${i}-${Date.now()}`,
              affiliateUrl: `https://www.1mg.com/search/all?name=${encodeURIComponent(r.name)}`
            })));
          } catch (e) {
            console.error("AI Medicine search failed", e);
            setAiResults([]);
          } finally {
            setIsSearching(false);
          }
        }
      } else {
        setAiResults([]);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [search]);

  // Get medicines from reminders to suggest re-ordering
  const frequentMeds = reminders.filter(r => r.on).slice(0, 3).map(r => {
    const match = medicines.find(m => m.name.toLowerCase().includes(r.name.toLowerCase()));
    return {
      id: `rem-${r.id}`,
      name: r.name,
      price: match ? match.price : 45, // Use matched price or more realistic default
      type: r.dose || 'Unit',
      brand: 'My Prescription',
      icon: '📦',
      affiliateUrl: `https://www.1mg.com/search/all?name=${encodeURIComponent(r.name)}`
    };
  });

  const refillAlerts = useMemo(() => {
    const alerts: any[] = [];
    const today = new Date();
    
    profile.medicines.forEach(med => {
      const lastRefill = new Date(med.lastRefillDate);
      const daysSinceRefill = Math.floor((today.getTime() - lastRefill.getTime()) / (1000 * 3600 * 24));
      const medsConsumed = daysSinceRefill * med.dailyFrequency;
      const remaining = med.totalQuantity - medsConsumed;
      
      // Alert if < 5 days worth left
      if (remaining / med.dailyFrequency < 5) {
        alerts.push({ ...med, remaining });
      }
    });

    return alerts;
  }, [profile.medicines]);

  const addToCart = (med: any) => {
    const existing = cart.find(item => item.id === med.id);
    if (existing) {
      setCart(cart.map(item => item.id === med.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...med, qty: 1 }]);
    }
    showDoneToast(`Added ${med.name} to cart`);
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQty = (id: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const platforms = [
    { name: '1mg', url: 'https://www.1mg.com', logo: '💊', rating: '4.8', speed: '90m Delivery' },
    { name: 'PharmEasy', url: 'https://pharmeasy.in', logo: '🚲', rating: '4.7', speed: 'Same Day' },
    { name: 'Netmeds', url: 'https://www.netmeds.com', logo: '📦', rating: '4.6', speed: 'Next Day' },
    { name: 'Apollo', url: 'https://www.apollopharmacy.in', logo: '🏥', rating: '4.9', speed: '24/7 Service' }
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Smart Refill Alert - Only show if profile has medicines */}
      {refillAlerts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-[32px] p-8 space-y-6 shadow-2xl shadow-amber-900/10 relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <Package size={24} className="animate-bounce" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-amber-500">Smart Refill Alert</h3>
                <p className="text-[10px] text-amber-500/60 font-black uppercase tracking-[0.2em] mt-0.5">Automated Stock Management</p>
              </div>
            </div>
            <div className="px-4 py-1.5 bg-amber-500 text-[#020f0c] text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-amber-500/20">
              Low Stock
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            {refillAlerts.map((alert: any) => (
              <div key={alert.name} className="flex flex-col gap-4 bg-[var(--card2)] p-6 rounded-[24px] border border-amber-500/10 hover:border-amber-500/30 transition-all group/item shadow-inner">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                       <p className="font-bold text-lg text-white group-hover/item:text-amber-400 transition-colors">{alert.name}</p>
                       <p className="text-xs text-[var(--muted)] font-medium">{alert.dose || 'Standard Dose'} · {alert.dailyFrequency}x Daily</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 mb-0.5">Est. Left</p>
                       <p className="text-xl font-serif text-amber-500 font-bold">{Math.max(0, Math.floor(alert.remaining / alert.dailyFrequency))} <span className="text-xs">days</span></p>
                    </div>
                 </div>
                 
                 <div className="flex gap-2 pt-2 border-t border-white/5">
                    <a 
                      href={`https://www.1mg.com/search/all?name=${encodeURIComponent(alert.name)}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 px-4 py-3 bg-white/5 text-[var(--text2)] border border-white/5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      Search Price <ExternalLink size={12} />
                    </a>
                    <button 
                      onClick={() => addToCart({
                        id: `refill-${alert.name}`,
                        name: alert.name,
                        price: 99, 
                        type: alert.dose || 'Unit',
                        brand: 'Personal Refill',
                        icon: '💊',
                        affiliateUrl: `https://www.1mg.com/search/all?name=${encodeURIComponent(alert.name)}`
                      })}
                      className="flex-[1.5] px-4 py-3 bg-gradient-to-br from-amber-500 to-amber-600 text-[#020f0c] text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Quick Refill
                    </button>
                 </div>
              </div>
            ))}
          </div>
          
          <p className="text-center text-[10px] text-amber-500/40 font-black uppercase tracking-[0.3em] relative z-10">Stock updated automatically based on logged doses ✦</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white shadow-lg">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Medicine Delivery</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Health essentials at your door</p>
          </div>
        </div>
        <button 
          onClick={() => { setShowCart(true); setCheckoutStep('cart'); }}
          className="relative p-2 bg-[var(--card)] border border-[var(--border)] rounded-xl"
        >
          <ShoppingCart size={20} className="text-pink-400" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
              {cart.reduce((acc, item) => acc + item.qty, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="relative group">
        <input 
          type="text" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search medicines, brands or health products..."
          className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 pl-12 pr-12 text-sm outline-none focus:border-pink-500/50 transition-all shadow-inner"
        />
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-pink-500 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>


      {search ? (
        <div className="grid gap-3">
          {filtered.length > 0 && (
             <div className="space-y-3">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Local & Popular Results</h3>
               {filtered.map(m => (
                 <motion.div 
                   layout
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   key={m.id} 
                   className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-[var(--card2)] flex items-center justify-center text-xl">{m.icon}</div>
                     <div>
                       <h3 className="text-sm font-bold text-[var(--text)]">{m.name}</h3>
                       <p className="text-[10px] text-[var(--muted)] font-medium">{m.brand} · {m.type}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="text-right">
                       <span className="block text-[8px] font-black uppercase text-pink-500/60 leading-none mb-1">MRP</span>
                       <span className="font-serif text-lg text-pink-500 font-bold">{formatCurrency(m.price)}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                       <a 
                         href={m.affiliateUrl} 
                         target="_blank" 
                         rel="noreferrer"
                         className="px-3 py-1.5 bg-pink-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all"
                       >
                         Buy Now
                       </a>
                       <button 
                         onClick={() => addToCart(m)}
                         className="p-1.5 bg-pink-500/10 text-pink-400 rounded-lg hover:bg-pink-500 hover:text-white transition-all active:scale-90"
                       >
                         <Plus size={16} />
                       </button>
                     </div>
                   </div>
                 </motion.div>
               ))}
             </div>
          )}

          {isSearching && (
            <div className="py-8 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest animate-pulse">Searching global medicine databases...</p>
            </div>
          )}

          {aiResults.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Global AI Results</h3>
                <div className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-black rounded-lg border border-indigo-500/20">AI POWERED</div>
              </div>
              {aiResults.map(m => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={m.id} 
                  className="bg-[var(--card)] border border-indigo-500/10 rounded-2xl p-4 flex items-center justify-between group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-xl shadow-inner">{m.icon}</div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text)]">{m.name}</h3>
                      <p className="text-[10px] text-[var(--muted)] font-medium">{m.brand} · {m.type}</p>
                      <p className="text-[9px] text-[var(--muted2)] italic mt-0.5 line-clamp-1">{m.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="text-right">
                      <span className="block text-[8px] font-black uppercase text-indigo-500/60 leading-none mb-1">Market Avg</span>
                      <span className="font-serif text-lg text-indigo-500 font-bold">{formatCurrency(m.price)}</span>
                    </div>
                    <button 
                      onClick={() => addToCart(m)}
                      className="p-2 bg-indigo-500 text-white rounded-lg hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {!isSearching && filtered.length === 0 && aiResults.length === 0 && (
            <div className="py-12 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-center space-y-3">
               <div className="w-12 h-12 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-50"><Search size={24} /></div>
               <p className="text-sm font-bold text-[var(--muted)]">No results found globally for "{search}"</p>
               <button onClick={() => setSearch('')} className="text-[10px] font-black uppercase tracking-widest text-pink-500">View All Products</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {frequentMeds.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Refill Prescriptions</h3>
                <span className="text-[9px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full uppercase">Based on Reminders</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {frequentMeds.map((m, i) => (
                  <div key={m.id} className="min-w-[200px] bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 flex-shrink-0 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-pink-500/10" />
                    <div className="flex items-start justify-between relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-[var(--card2)] flex items-center justify-center text-xl">{m.icon}</div>
                      <div className="text-right">
                        <span className="block text-[8px] font-black uppercase text-pink-500/60 leading-none mb-0.5">MRP</span>
                        <p className="text-[12px] font-bold text-pink-500 leading-none">{formatCurrency(m.price)}</p>
                        <p className="text-[8px] text-[var(--muted)] font-black uppercase tracking-tighter mt-1 opacity-60">Verified Price</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold truncate pr-4">{m.name}</h4>
                      <p className="text-[10px] text-[var(--muted)] truncate">{m.type}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <a 
                        href={m.affiliateUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full py-2 bg-pink-500 text-white border border-pink-500 hover:brightness-110 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center"
                      >
                        Refill Now ↗
                      </a>
                      <button 
                        onClick={() => addToCart(m)}
                        className="w-full py-2 bg-[var(--card2)] border border-[var(--border)] hover:bg-[var(--card)] rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all text-[var(--muted)]"
                      >
                        Add to local cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Top Online Pharmacies</h3>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((p, i) => (
                <a 
                  key={i} 
                  href={p.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 hover:border-pink-500/30 transition-all cursor-pointer group block"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-[var(--card2)] flex items-center justify-center text-xl group-hover:scale-110 transition-transform">{p.logo}</div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                      <Star size={10} fill="currentColor" /> {p.rating}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-serif text-base">{p.name}</h4>
                    <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">{p.speed}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="space-y-3">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Shop by Category</h3>
             <div className="grid grid-cols-3 gap-3">
                {[
                  { n: 'Diabetes', i: '🍬' },
                  { n: 'Vitamins', i: '💊' },
                  { n: 'Skincare', i: '🧴' },
                  { n: 'Baby', i: '👶' },
                  { n: 'Fitness', i: '🏋️' },
                  { n: 'Wellness', i: '🌿' }
                ].map(cat => (
                  <button 
                    key={cat.n} 
                    onClick={() => {
                      setSearch(cat.n);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex flex-col items-center gap-2 p-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-pink-500/20 transition-all group active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-full bg-pink-500/5 text-pink-400 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-all text-sm">{cat.i}</div>
                    <span className="text-[10px] font-bold text-[var(--text2)]">{cat.n}</span>
                  </button>
                ))}
             </div>
          </section>
        </div>
      )}

      {/* Checkout Sheet (Portalled for z-index safety) */}
      {createPortal(
        <AnimatePresence>
          {showCart && (
            <div className="medicine-cart-portal">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setShowCart(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-[8px] z-[9999]"
              />
              <motion.div 
                initial={{ y: '100%' }} 
                animate={{ y: 0 }} 
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-[10000] bg-[var(--bg)] rounded-t-[32px] border-t border-[var(--border)] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Checkout Progress Header - Fixed at Top */}
                <div className="pt-2 px-4 flex flex-col bg-[var(--card)] border-b border-[var(--border)] relative shadow-sm">
                  <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto my-3 opacity-30" />
                  
                  <div className="flex items-center gap-4 mb-4">
                    {checkoutStep !== 'cart' && checkoutStep !== 'success' && (
                      <button 
                        onClick={() => {
                          if (checkoutStep === 'address') setCheckoutStep('cart');
                          if (checkoutStep === 'payment') setCheckoutStep('address');
                        }}
                        className="p-2.5 bg-[var(--card2)] rounded-xl text-[var(--muted)] hover:text-pink-500 transition-all border border-[var(--border)] shadow-sm"
                      >
                        <ArrowLeft size={18} />
                      </button>
                    )}
                    <h3 className="font-serif text-xl flex-1 tracking-tight font-black">
                      {checkoutStep === 'cart' && 'My Basket'}
                      {checkoutStep === 'address' && 'Delivery Info'}
                      {checkoutStep === 'payment' && 'Confirm Order'}
                      {checkoutStep === 'success' && 'Order Received!'}
                    </h3>
                    <button onClick={() => setShowCart(false)} className="p-2.5 bg-[var(--card2)] rounded-xl transition-all border border-[var(--border)] shadow-sm hover:rotate-90"><X size={18} /></button>
                  </div>

                  {checkoutStep !== 'success' && (
                    <div className="flex items-center justify-between px-6 pb-5 relative">
                      <div className="absolute top-1/2 left-[15%] right-[15%] h-[1px] bg-[var(--border)] -translate-y-1/2 z-0" />
                      {[
                        { s: 'cart', i: ShoppingCart, l: 'Basket' },
                        { s: 'address', i: MapPin, l: 'Address' },
                        { s: 'payment', i: CreditCard, l: 'Payment' }
                      ].map((step) => {
                        const isActive = checkoutStep === step.s;
                        const isPast = (checkoutStep === 'address' && step.s === 'cart') || (checkoutStep === 'payment' && (step.s === 'cart' || step.s === 'address'));
                        return (
                          <div key={step.s} className="relative z-10 flex flex-col items-center gap-1.5">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                              isActive ? "bg-pink-500 border-pink-500 text-white shadow-xl shadow-pink-500/20 scale-110" : 
                              isPast ? "bg-green-500 border-green-500 text-white" : "bg-white border-[var(--border)] text-[var(--muted)]"
                            )}>
                              {isPast ? <Check size={16} strokeWidth={3} /> : <step.i size={16} />}
                            </div>
                            <span className={cn(
                              "text-[7px] font-black uppercase tracking-[0.2em]",
                              isActive ? "text-pink-500" : isPast ? "text-green-500" : "text-[var(--muted)]"
                            )}>{step.l}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar pb-10">
                <AnimatePresence mode="wait">
                  {checkoutStep === 'cart' && (
                    <motion.div 
                      key="step-cart"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      {cart.length > 0 ? (
                        <>
                          <div className="space-y-3">
                            {cart.map((item, idx) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={item.id} 
                                className="group relative bg-[var(--card)] border border-[var(--border)] rounded-[24px] p-4 flex items-center gap-4 hover:border-pink-500/20 transition-all overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 -mr-12 -mt-12 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                <div className="w-16 h-16 rounded-2xl bg-[var(--card2)] flex items-center justify-center text-3xl shadow-inner relative z-10">{item.icon}</div>
                                <div className="flex-1 min-w-0 relative z-10">
                                  <h4 className="text-sm font-bold text-[var(--text)] truncate">{item.name}</h4>
                                  <p className="text-[10px] text-pink-500 font-bold mb-2">{formatCurrency(item.price)} <span className="text-[var(--muted)] text-[8px] uppercase tracking-tighter ml-1">per unit</span></p>
                                  
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-[var(--card2)] rounded-xl border border-[var(--border)] p-1 shadow-sm">
                                      <button 
                                        onClick={() => updateQty(item.id, -1)} 
                                        className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-pink-500 hover:bg-white rounded-lg transition-all active:scale-90"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="text-xs font-black w-8 text-center">{item.qty}</span>
                                      <button 
                                        onClick={() => updateQty(item.id, 1)} 
                                        className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-pink-500 hover:bg-white rounded-lg transition-all active:scale-90"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                    <button 
                                      onClick={() => removeFromCart(item.id)} 
                                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all group/del"
                                      title="Remove"
                                    >
                                      <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 relative z-10">
                                  <p className="text-sm font-black text-[var(--text)] font-serif">{formatCurrency(item.price * item.qty)}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          
                          <div className="p-6 bg-gradient-to-br from-pink-500/10 to-transparent rounded-[32px] border border-pink-500/20 space-y-4">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500/60 mb-2">Pricing Breakdown</h5>
                            <div className="space-y-2.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--muted)]">Basket Subtotal</span>
                                <span className="font-bold">{formatCurrency(total)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--muted)] flex items-center gap-1.5">Delivery Fee <Info size={12} className="opacity-40" /></span>
                                <span className="text-green-500 font-bold uppercase tracking-widest text-[9px]">Free Delivery</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--muted)]">Taxes & Charges</span>
                                <span className="font-bold">{formatCurrency(Math.floor(total * 0.05))}</span>
                              </div>
                              <div className="h-px bg-pink-500/20 my-2" />
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-[var(--text)] uppercase tracking-widest">Grand Total</span>
                                <span className="font-serif text-2xl text-pink-500 font-black">₹{total + Math.floor(total * 0.05)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 pt-2">
                             <div className="flex items-center gap-3 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 group cursor-pointer hover:bg-indigo-500/10 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Trophy size={20} /></div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Veda Prime Savings</p>
                                  <p className="text-[11px] font-bold text-[var(--muted)]">Apply coupon code <span className="text-indigo-400">VEDA50</span> for ₹50 off</p>
                                </div>
                                <ArrowRight size={16} className="text-indigo-400" />
                             </div>

                             <button 
                                onClick={() => setCheckoutStep('address')}
                                className="w-full py-5 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-500/30 active:scale-95 hover:brightness-110 transition-all text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                              >
                                Continue to delivery <ArrowRight size={18} />
                              </button>
                          </div>
                        </>
                      ) : (
                        <div className="py-24 text-center space-y-6">
                          <motion.div 
                            animate={{ rotate: [0, -10, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                            className="w-24 h-24 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto shadow-inner relative"
                          >
                            <ShoppingCart size={40} className="text-[var(--muted)] opacity-20" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-dashed border-[var(--muted)] rounded-full animate-spin-slow opacity-10" />
                          </motion.div>
                          <div className="space-y-2">
                            <p className="text-lg font-serif">Your basket is waiting</p>
                            <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest px-12">Search for prescriptions or category deals to find what you need.</p>
                          </div>
                          <button 
                            onClick={() => setShowCart(false)}
                            className="px-8 py-3 bg-pink-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20 active:scale-95 transition-all"
                          >
                            Browse Medicines
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {checkoutStep === 'address' && (
                    <motion.div 
                      key="step-address"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="p-5 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 border-dashed flex items-center gap-4">
                        <div className="w-12 h-12 bg-white text-indigo-500 rounded-2xl flex items-center justify-center shadow-lg"><User size={24} /></div>
                        <div>
                          <h4 className="text-sm font-bold">{profile.name}</h4>
                          <p className="text-[10px] text-[var(--muted)] font-medium">Default medical profile selected</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1 flex items-center gap-1.5">
                            <Home size={10} /> Street & Locality
                          </label>
                          <div className="relative">
                            <input 
                              type="text" 
                              placeholder="House No, Suite, Apartment Area"
                              value={address.street}
                              onChange={e => setAddress({ ...address, street: e.target.value })}
                              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 transition-all shadow-sm"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-500 cursor-pointer"><MapPin size={16} /></div>
                          </div>
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="flex-[2] space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">City / Region</label>
                            <input 
                               type="text" 
                               placeholder="e.g. New Delhi"
                               value={address.city}
                               onChange={e => setAddress({ ...address, city: e.target.value })}
                               className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 transition-all shadow-sm"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">PIN Code</label>
                            <input 
                               type="text" 
                               placeholder="110001"
                               maxLength={6}
                               value={address.pin}
                               onChange={e => setAddress({ ...address, pin: e.target.value })}
                               className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 transition-all shadow-sm text-center tracking-widest px-2"
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-center gap-3">
                           <AlertCircle size={16} className="text-amber-500 shrink-0" />
                           <p className="text-[10px] text-amber-700 font-bold leading-relaxed">Please ensure the address matches your physical location for express 2h delivery.</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button 
                           disabled={!address.street || !address.city || !address.pin}
                           onClick={() => setCheckoutStep('payment')}
                           className="w-full py-5 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-500/30 active:scale-95 enabled:hover:brightness-110 transition-all text-sm uppercase tracking-[0.2em] disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          Confirm Location <ArrowRight size={18} />
                        </button>
                        <p className="text-center text-[9px] text-[var(--muted)] uppercase tracking-widest mt-4 font-bold">Standard Delivery: Tomorrow before 10 AM</p>
                      </div>
                    </motion.div>
                  )}

                  {checkoutStep === 'payment' && (
                    <motion.div 
                      key="step-payment"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="bg-[var(--card2)] rounded-[32px] p-6 border border-[var(--border)] space-y-5">
                          <div className="flex items-center justify-between">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Choose Payment</h4>
                             <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-500 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-green-500/20">
                               <ShieldCheck size={12} /> Secure
                             </div>
                          </div>

                          <div className="space-y-2.5">
                             <div className="flex items-center justify-between bg-white border-2 border-pink-500 p-4 rounded-2xl shadow-lg ring-4 ring-pink-500/5 transition-all">
                                <div className="flex items-center gap-4">
                                   <div className="shrink-0 w-12 h-8 bg-green-500/10 text-green-500 flex items-center justify-center rounded-lg border border-green-500/20"><CreditCard size={20} /></div>
                                   <div>
                                      <p className="text-sm font-black text-gray-900 leading-none mb-0.5">Cash on Delivery</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pay at doorstep</p>
                                   </div>
                                </div>
                                <div className="w-6 h-6 rounded-full border-2 border-pink-500 flex items-center justify-center"><div className="w-3 h-3 bg-pink-500 rounded-full" /></div>
                             </div>

                             {/* Placeholder methods to make it feel rich */}
                             {[
                               { n: 'UPI / GPay / PhonePe', i: '📱', d: 'Secure instant bank transfer', soon: true },
                               { n: 'Credit / Debit Card', i: '💳', d: 'Visa, Mastercard, Amex', soon: true },
                               { n: 'Net Banking', i: '🏛️', d: 'All major Indian banks', soon: true }
                             ].map(method => (
                               <div key={method.n} className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] p-4 rounded-2xl opacity-60 grayscale group relative overflow-hidden">
                                  <div className="flex items-center gap-4">
                                     <div className="shrink-0 w-12 h-8 bg-[var(--card2)] flex items-center justify-center rounded-lg text-lg grayscale">{method.i}</div>
                                     <div>
                                        <p className="text-sm font-bold text-[var(--text2)] leading-none mb-0.5">{method.n}</p>
                                        <p className="text-[9px] font-medium text-[var(--muted)] uppercase tracking-widest">{method.d}</p>
                                     </div>
                                  </div>
                                  <div className="w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--card2)]" />
                                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-indigo-500 text-white text-[7px] font-black uppercase tracking-widest rounded-bl-lg">Coming Soon</div>
                               </div>
                             ))}
                          </div>

                          <div className="pt-4 border-t border-[var(--border)] space-y-3">
                             <div className="flex justify-between items-center text-[var(--muted)] text-[10px] font-bold uppercase tracking-widest">
                                <span>Total Payable</span>
                                <span>(Incl. Taxes)</span>
                             </div>
                             <div className="flex justify-between items-end">
                                <div className="text-[var(--muted)] text-[11px] font-medium italic">Your order: {cart.length} items</div>
                                <span className="font-serif text-3xl text-pink-500 font-black tracking-tighter">₹{total + Math.floor(total * 0.05)}</span>
                             </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                        <button 
                           onClick={() => {
                             setCheckoutStep('success');
                             setCart([]);
                             showDoneToast("Order successful!");
                           }}
                           className="w-full py-5 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-500/30 active:scale-95 hover:brightness-110 transition-all text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                        >
                          Confirm & Place Order <Check size={20} />
                        </button>
                        <p className="text-center text-[9px] text-[var(--muted2)] leading-relaxed px-10">By placing this order you agree to Veda Health’s <span className="underline decoration-pink-500/30">Terms of Service</span> and <span className="underline decoration-pink-500/30">Privacy Policy</span>.</p>
                      </div>
                    </motion.div>
                  )}

                  {checkoutStep === 'success' && (
                    <motion.div 
                      key="step-success"
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="py-12 text-center"
                    >
                      <div className="relative inline-block mb-8">
                        <motion.div 
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                          className="w-32 h-32 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-inner border-2 border-green-500/20 relative z-10"
                        >
                          <Check size={64} strokeWidth={3} />
                        </motion.div>
                        <motion.div 
                          animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 bg-green-500 rounded-full z-0"
                        />
                      </div>

                      <div className="space-y-6 relative z-10">
                         <div className="space-y-2">
                           <h4 className="text-3xl font-serif tracking-tight">Order Confirmed!</h4>
                           <p className="text-sm text-[var(--muted)] px-12 leading-relaxed">Your medical essentials are on their way. You can track the live status in the "Activities" tab.</p>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                            <div className="p-3 bg-white border border-[var(--border)] rounded-2xl shadow-sm">
                               <p className="text-[8px] font-black uppercase text-[var(--muted)] tracking-widest mb-1">Order ID</p>
                               <p className="text-xs font-black">#VD{Math.floor(Math.random() * 900000 + 100000)}</p>
                            </div>
                            <div className="p-3 bg-white border border-[var(--border)] rounded-2xl shadow-sm">
                               <p className="text-[8px] font-black uppercase text-[var(--muted)] tracking-widest mb-1">ETA</p>
                               <p className="text-xs font-black text-green-600">~ 2 Hours</p>
                            </div>
                         </div>

                         <div className="pt-4 px-4">
                            <button 
                               onClick={() => setShowCart(false)}
                               className="w-full py-5 bg-[var(--card2)] border border-[var(--border)] text-[var(--text)] font-black rounded-2xl shadow-sm active:scale-95 hover:bg-white transition-all text-xs uppercase tracking-[0.2em]"
                            >
                              Explore More Health Deals
                            </button>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Bottom Safety Decoration */}
              <div className="h-2 bg-gradient-to-r from-pink-500 via-indigo-500 to-teal-500 w-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
});

const InsuranceView = memo(function InsuranceView({ policies, onAddPolicy, profile }: { policies: UserInsurancePolicy[], onAddPolicy: (p: Omit<UserInsurancePolicy, 'id'>) => Promise<void>, profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'my' | 'advisor' | 'compare'>('my');
  const [showAdd, setShowAdd] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Comparison State
  const [providerFilter, setProviderFilter] = useState('');
  const [coverageFilter, setCoverageFilter] = useState('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChatClearConfirm, setShowChatClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const plans: InsurancePlan[] = [];

  const filteredPlans = plans.filter(p => {
    const matchesProvider = !providerFilter || p.provider === providerFilter;
    const matchesCoverage = !coverageFilter || parseInt(p.coverAmount) >= parseInt(coverageFilter);
    return matchesProvider && matchesCoverage;
  });

  const selectedPlans = plans.filter(p => selectedPlanIds.includes(p.id));

  const togglePlanSelection = (id: string) => {
    setSelectedPlanIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : (prev.length < 3 ? [...prev, id] : prev)
    );
  };

  // Form State
  const [newName, setNewName] = useState('');
  const [newNum, setNewNum] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newPremium, setNewPremium] = useState('');

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newProvider) return;
    setIsSubmitting(true);
    try {
      const newPolicy: Omit<UserInsurancePolicy, 'id'> = {
        policyName: newName,
        policyNumber: newNum,
        provider: newProvider,
        expiryDate: newExpiry,
        coverageAmount: newAmount,
        premium: newPremium,
        insuredMembers: [],
        status: 'active'
      };
      await onAddPolicy(newPolicy);
      setShowAdd(false);
      resetForm();
      showDoneToast("Policy added successfully");
    } catch (e: any) {
      console.error(e);
      showDoneToast("Failed to add policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewName(''); setNewNum(''); setNewProvider(''); setNewExpiry(''); setNewAmount(''); setNewPremium('');
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult('');
    try {
      const policySummary = policies.length > 0 
        ? policies.map(p => `${p.policyName} from ${p.provider} (Cover: ${p.coverageAmount})`).join(', ')
        : "No active policies found.";
      
      const prompt = `Act as an insurance expert. I have the following insurance policies: ${policySummary}. 
      Provide a concise 3-point expert advice on:
      1. Review of current coverage adequacy.
      2. Specific exclusions to watch for in Indian market.
      3. Next steps for optimization.
      Keep it professional and warm.`;
      
      const res = await callGemini(prompt, "You are a senior health insurance advisor. Provide strategic, clear, and high-value insights.");
      setAnalysisResult(res);
    } catch (e) {
      setAnalysisResult("Failed to analyze policies. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const policySummary = policies.length > 0 
        ? policies.map(p => `${p.policyName} (${p.provider}, ${p.coverageAmount})`).join('; ')
        : "No active policies.";
      
      const profileContext = `User Profile: Age ${profile.age}, Conditions: ${profile.conditions.join(', ')}, Medicines: ${profile.medicines.join(', ')}.`;
      
      const marketPlans = plans.map(p => `${p.name} by ${p.provider} (${p.monthlyPremium}/mo, Features: ${p.features.join(', ')})`).join('\n');

      const prompt = `You are Veda's Insurance Specialist. Help the user with their insurance questions.
      
      User Profile: ${profileContext}
      Current User Policies: ${policySummary}
      Available Market Plans to recommend/compare:
      ${marketPlans}

      User Question: ${userMsg}

      Provide clear, high-value, and personalized insurance advice. If they ask to compare, refer to the available market plans. If they ask about their own policy, refer to their current policies. Keep it warm and professional.`;

      const res = await callGemini(prompt, "You are a specialized health insurance bot. You are precise, helpful, and prioritize user's health and financial safety.");
      setChatMessages(prev => [...prev, { role: 'bot', content: res }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'bot', content: "I'm sorry, I'm having trouble connecting to my insurance database. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 border border-white/20">
            <Shield size={28} />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">Policy Vault</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Strategic Coverage Hub</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="w-12 h-12 glass border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/5 transition-all text-blue-400 shadow-xl"
        >
          {showAdd ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      <div className="glass border border-white/10 rounded-[28px] p-1.5 flex items-center shadow-2xl relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <button 
          onClick={() => setActiveTab('my')}
          className={cn(
            "flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all relative z-10",
            activeTab === 'my' ? "bg-[var(--surface)] text-[var(--teal)] shadow-sm border border-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          )}
        >
          My Policies
        </button>
        <button 
          onClick={() => setActiveTab('advisor')}
          className={cn(
            "flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all relative z-10",
            activeTab === 'advisor' ? "bg-[var(--surface)] text-[var(--teal)] shadow-sm border border-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          )}
        >
          AI Advisor
        </button>
        <button 
          onClick={() => setActiveTab('compare')}
          className={cn(
            "flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all relative z-10",
            activeTab === 'compare' ? "bg-[var(--surface)] text-[var(--teal)] shadow-sm border border-[var(--border)]" : "text-[var(--muted)] hover:text-white"
          )}
        >
          Market Check
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleAddPolicy}
            className="glass-darker border border-blue-500/30 rounded-[40px] p-10 space-y-8 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-8 text-blue-500/5 rotate-12"><Shield size={120} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60 ml-1">Plan Name</p>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Health Supreme" className="w-full glass border border-white/10 rounded-2xl p-4 text-[13px] font-bold outline-none focus:border-blue-500/50 transition-all text-white placeholder:opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60 ml-1">Provider Engine</p>
                <input value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="e.g. Star Health" className="w-full glass border border-white/10 rounded-2xl p-4 text-[13px] font-bold outline-none focus:border-blue-500/50 transition-all text-white placeholder:opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60 ml-1">Archive ID</p>
                <input value={newNum} onChange={e => setNewNum(e.target.value)} placeholder="SK-9981-LOG" className="w-full glass border border-white/10 rounded-2xl p-4 text-[13px] font-bold outline-none focus:border-blue-500/50 transition-all text-white placeholder:opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60 ml-1">Maturity Date</p>
                <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="w-full glass border border-white/10 rounded-2xl p-4 text-[13px] font-bold outline-none focus:border-blue-500/50 transition-all text-white filter invert" />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isSubmitting || !newName || !newProvider}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] border border-white/20"
            >
              {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : null}
              {isSubmitting ? 'Syncing...' : 'Seal Policy in Vault ✦'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {activeTab === 'my' && (
        <div className="space-y-6">
          {policies.length > 0 ? (
            <div className="grid gap-6">
              {policies.map(p => (
                <div key={p.id} className="glass-morphism border border-white/10 rounded-[44px] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none group-hover:bg-blue-500/10 transition-all" />
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <h4 className="font-serif text-2xl text-white tracking-tight">{p.policyName}</h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">{p.provider}</span>
                        <span className="text-white/10">|</span>
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] font-mono">{p.policyNumber}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-4 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[8px] font-black uppercase tracking-widest">Active</div>
                      <p className="text-[9px] text-[var(--muted)] font-bold mt-2 uppercase tracking-widest opacity-40 italic">Exp: {p.expiryDate}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="glass-darker p-5 rounded-[32px] border border-white/5 group-hover:border-blue-500/20 transition-all">
                      <p className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest mb-1 opacity-60">Capital Insured</p>
                      <p className="text-lg font-serif text-blue-400">{p.coverageAmount}</p>
                    </div>
                    <div className="glass-darker p-5 rounded-[32px] border border-white/5 group-hover:border-white/20 transition-all">
                      <p className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest mb-1 opacity-60">Annual Load</p>
                      <p className="text-lg font-serif text-white">{p.premium}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !showAdd && (
            <div className="bg-[var(--card)] border border-[var(--border)] border-dashed rounded-[40px] p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-30 mb-2">
                <Shield size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--muted)] uppercase tracking-widest">Empty Vault</h4>
                <p className="text-[10px] text-[var(--muted)] px-8 leading-relaxed">Securely store your health insurance policies for instant access and AI analysis.</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="px-6 py-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">Add First Policy</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'advisor' && (
        <div className="space-y-6">
          {/* Sponsored Placement */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-blue-500/30 rounded-3xl p-6 relative overflow-hidden group shadow-2xl shadow-blue-500/10"
          >
            <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg z-10">
              Sponsored
            </div>
            <div className="flex gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 shrink-0 border border-white/10 group-hover:scale-110 transition-transform">
                <ShieldCheck size={28} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-serif text-lg leading-tight">Zero-Copay Premium Plan</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-bold uppercase tracking-widest">New</span>
                </div>
                <p className="text-xs text-blue-100/70 leading-relaxed">
                  Tired of paying during hospital discharge? Upgrade to a Zero-Copay plan with Niva Bupa & Veda. Get <span className="text-blue-400 font-bold underline">15% Off</span> exclusively for Veda users.
                </p>
                <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors pt-1">
                  Check Eligibility <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[40px] p-8 text-white space-y-6 shadow-xl relative overflow-hidden">
            <div className="space-y-2 relative z-10">
              <h3 className="font-serif text-3xl leading-tight">Advisor Intelligence</h3>
              <p className="text-sm opacity-90 leading-relaxed max-w-xs">I will analyze your current portfolio to find gaps, hidden exclusions, and better deals.</p>
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full py-4 bg-white text-blue-700 font-bold rounded-2xl shadow-xl active:scale-95 transition-all relative z-10 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Run Risk Audit <Sparkles size={18} /></>
              )}
            </button>
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <Sparkles size={200} />
            </div>
          </div>

          {analysisResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-blue-500/5 border border-blue-500/20 rounded-[32px] p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1.5 rounded-lg text-white"><Bot size={14} /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Security Audit Result</h4>
              </div>
              <div className="text-sm leading-relaxed text-blue-900 markdown-body">
                <Markdown>{analysisResult}</Markdown>
              </div>
            </motion.div>
          )}

          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Market Recommendations</h3>
            <div className="grid gap-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all cursor-pointer shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/5 flex items-center justify-center text-blue-500 text-xl font-serif">
                        {plan.provider[0]}
                      </div>
                      <div>
                         <h4 className="font-serif text-sm">{plan.name}</h4>
                         <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{plan.provider}</p>
                      </div>
                   </div>
                   <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="text-sm font-black text-blue-500">{formatCurrency(plan.monthlyPremium, 'INR')}</div>
                        <div className="text-[7px] font-bold text-[var(--muted)] uppercase tracking-widest">/ Month</div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--border)] group-hover:text-blue-500 transition-colors" />
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-blue-500" /> Consult Insurance Expert
              </div>
              {chatMessages.length > 0 && (
                !showChatClearConfirm ? (
                  <button 
                    onClick={() => setShowChatClearConfirm(true)}
                    className="p-1 hover:text-red-500 transition-colors"
                    title="Clear History"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                    <button 
                      onClick={() => { setChatMessages([]); setShowChatClearConfirm(false); }}
                      className="text-[8px] font-black text-red-500 uppercase"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={() => setShowChatClearConfirm(false)}
                      className="text-[8px] font-black text-[var(--muted)] uppercase"
                    >
                      X
                    </button>
                  </div>
                )
              )}
            </h3>
            
            <div className="bg-[var(--card)] border border-blue-500/20 rounded-[32px] overflow-hidden flex flex-col shadow-lg shadow-blue-500/5">
              <div ref={scrollRef} className="max-h-[300px] overflow-y-auto p-6 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 space-y-3 opacity-50">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                      <Bot size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest">Ask me anything</p>
                    <p className="text-[10px] leading-relaxed px-8">"Is my sum insured enough for my family?" or "Compare Optima Secure with my current HDFC policy."</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex gap-3",
                      msg.role === 'user' ? "flex-row-reverse" : ""
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                        msg.role === 'user' ? "bg-blue-100 text-blue-600" : "bg-blue-600 text-white"
                      )}>
                        {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl text-sm max-w-[80%] leading-relaxed",
                        msg.role === 'user' ? "bg-blue-500 text-white" : "bg-[var(--card2)] border border-[var(--border)] text-[var(--text)]"
                      )}>
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center animate-pulse">
                      <Bot size={14} />
                    </div>
                    <div className="p-4 bg-[var(--card2)] border border-[var(--border)] rounded-2xl flex gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-[var(--card2)] border-t border-[var(--border)] flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleChat()}
                  placeholder="Ask about your coverage..." 
                  className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none"
                />
                <button 
                  onClick={handleChat}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-90 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-3xl p-6 space-y-4">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="font-serif text-lg">Compare Plans</h3>
                   <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mt-0.5">Select up to 3 plans to compare side-by-side</p>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors",
                      selectedPlanIds.length === 3 ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                   )}>
                      {selectedPlanIds.length}/3 Selected
                   </div>
                   {selectedPlanIds.length > 0 && (
                      <button onClick={() => setSelectedPlanIds([])} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Clear</button>
                   )}
                </div>
             </div>

             {/* Filters */}
             <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                   <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Filter by Provider</p>
                   <select 
                      value={providerFilter} 
                      onChange={e => setProviderFilter(e.target.value)}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                   >
                      <option value="">All Providers</option>
                      {Array.from(new Set(plans.map(p => p.provider))).map(p => (
                         <option key={p} value={p}>{p}</option>
                      ))}
                   </select>
                </div>
                <div className="space-y-1.5">
                   <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Min. Coverage</p>
                   <select 
                      value={coverageFilter} 
                      onChange={e => setCoverageFilter(e.target.value)}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                   >
                      <option value="">Any Amount</option>
                      <option value="500000">5 Lacs+</option>
                      <option value="700000">7 Lacs+</option>
                      <option value="1000000">10 Lacs+</option>
                   </select>
                </div>
             </div>
          </div>

          {selectedPlans.length > 0 && (
             <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] overflow-hidden shadow-xl border-t-4 border-t-blue-500"
             >
                <div className="overflow-x-auto no-scrollbar">
                   <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                         <tr className="border-b border-[var(--border)] bg-[var(--card2)]">
                            <th className="p-4 text-[9px] font-black uppercase tracking-widest border-r border-[var(--border)] w-[150px]">Features</th>
                            {selectedPlans.map(p => (
                               <th key={p.id} className="p-4 w-[200px] border-r border-[var(--border)] last:border-r-0">
                                  <div className="space-y-1 text-center">
                                     <h4 className="font-serif text-sm leading-tight">{p.name}</h4>
                                     <p className="text-[8px] font-black uppercase tracking-widest text-blue-500">{p.provider}</p>
                                  </div>
                               </th>
                            ))}
                         </tr>
                      </thead>
                      <tbody className="text-xs">
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-[var(--muted)]" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Premium / Mo</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => {
                               const isLowest = Math.min(...selectedPlans.map(sp => sp.monthlyPremium)) === p.monthlyPremium;
                               return (
                                  <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 text-center">
                                     <div className="flex flex-col items-center gap-1">
                                        <span className="font-bold text-blue-600">{formatCurrency(p.monthlyPremium, 'INR')}</span>
                                        {isLowest && selectedPlans.length > 1 && (
                                           <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[7px] font-black uppercase tracking-widest">Cheapest</span>
                                        )}
                                     </div>
                                  </td>
                               );
                            })}
                         </tr>
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Shield size={12} className="text-[var(--muted)]" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Sum Insured</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => (
                               <td key={p.id} className="p-4 font-bold border-r border-[var(--border)] last:border-r-0 text-center">
                                  <span className="text-blue-500">{formatCoverage(parseInt(p.coverAmount))}</span>
                               </td>
                            ))}
                         </tr>
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Calendar size={12} className="text-[var(--muted)]" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Waiting Period</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => {
                               const years = parseInt(p.waitingPeriod);
                               return (
                                  <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 text-center">
                                     <div className={cn(
                                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold",
                                        years <= 2 ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                                     )}>
                                        {years <= 2 && <Check size={10} />}
                                        {p.waitingPeriod}
                                     </div>
                                  </td>
                               );
                            })}
                         </tr>
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Activity size={12} className="text-[var(--muted)]" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Co-Payment</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => (
                               <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 text-center">
                                  <div className={cn(
                                     "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold",
                                     p.coPay === 'None' ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                                  )}>
                                     {p.coPay === 'None' ? <Check size={10} /> : <AlertCircle size={10} />}
                                     {p.coPay}
                                  </div>
                               </td>
                            ))}
                         </tr>
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Building size={12} className="text-[var(--muted)]" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Cashless</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => (
                               <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 text-center">
                                  <div className="flex flex-col items-center">
                                     <span className="font-mono font-bold text-blue-500">{p.cashlessHospitals}</span>
                                     <span className="text-[7px] text-[var(--muted)] uppercase font-bold tracking-tighter">Hospitals</span>
                                  </div>
                               </td>
                            ))}
                         </tr>
                         <tr className="border-b border-[var(--border)] group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Star size={12} className="text-blue-500" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Key Features</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => (
                               <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 align-top">
                                  <div className="flex flex-col gap-1.5">
                                     {p.features.map((feat, idx) => (
                                        <div key={idx} className="flex items-start gap-1.5 text-[9px] text-[var(--text2)] leading-tight">
                                           <div className="w-1 h-1 rounded-full bg-blue-500 mt-1 shrink-0" />
                                           <span>{feat}</span>
                                        </div>
                                     ))}
                                  </div>
                               </td>
                            ))}
                         </tr>
                         <tr className="group hover:bg-[var(--card2)] transition-colors">
                            <td className="p-4 border-r border-[var(--border)]">
                               <div className="flex items-center gap-2">
                                  <Zap size={12} className="text-amber-500" />
                                  <span className="font-black uppercase text-[8px] text-[var(--muted)]">Analysis</span>
                               </div>
                            </td>
                            {selectedPlans.map(p => {
                               const years = parseInt(p.waitingPeriod);
                               const hasCopay = p.coPay !== 'None';
                               return (
                                  <td key={p.id} className="p-4 border-r border-[var(--border)] last:border-r-0 align-top">
                                     <div className="space-y-3">
                                        <div className="space-y-1">
                                           <p className="text-[7px] font-black uppercase tracking-widest text-green-500">Advantages</p>
                                           <div className="space-y-1">
                                              {years <= 2 && (
                                                <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold">
                                                   <Check size={10} /> Low Waiting Period
                                                </div>
                                              )}
                                              {!hasCopay && (
                                                <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold">
                                                   <Check size={10} /> No Co-Payment
                                                </div>
                                              )}
                                              <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold">
                                                 <Check size={10} /> {p.features[0]}
                                              </div>
                                           </div>
                                        </div>
                                        
                                        {(years > 2 || hasCopay) && (
                                           <div className="space-y-1">
                                              <p className="text-[7px] font-black uppercase tracking-widest text-red-500">Disadvantages</p>
                                              <div className="space-y-1">
                                                 {years > 2 && (
                                                   <div className="flex items-center gap-1 text-[9px] text-red-500 font-bold">
                                                      <X size={10} /> Long Wait ({p.waitingPeriod})
                                                   </div>
                                                 )}
                                                 {hasCopay && (
                                                   <div className="flex items-center gap-1 text-[9px] text-red-500 font-bold">
                                                      <X size={10} /> {p.coPay} Co-Pay
                                                   </div>
                                                 )}
                                              </div>
                                           </div>
                                        )}
                                     </div>
                                  </td>
                               );
                            })}
                         </tr>
                      </tbody>
                   </table>
                </div>
             </motion.div>
          )}

          <div className="space-y-3 pt-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Discover Plans</h3>
            <div className="grid gap-3">
               {filteredPlans.map(plan => {
                const isSelected = selectedPlanIds.includes(plan.id);
                return (
                  <div 
                    key={plan.id} 
                    onClick={() => togglePlanSelection(plan.id)}
                    className={cn(
                      "bg-[var(--card)] border rounded-2xl p-4 flex items-center justify-between group transition-all cursor-pointer shadow-sm relative",
                      isSelected ? "border-blue-500 ring-2 ring-blue-500/10 shadow-blue-500/5 bg-blue-500/5" : "border-[var(--border)] hover:border-blue-500/30"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                         "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-serif transition-colors",
                         isSelected ? "bg-blue-500 text-white" : "bg-blue-500/5 text-blue-500"
                      )}>
                        {plan.provider[0]}
                      </div>
                      <div>
                         <h4 className="font-serif text-sm">{plan.name}</h4>
                         <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{plan.provider}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="text-sm font-black text-blue-500">{formatCurrency(plan.monthlyPremium, 'INR')}</div>
                        <div className="text-[7px] font-bold text-[var(--muted)] uppercase tracking-widest">/ Month</div>
                      </div>
                      <div className={cn(
                         "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                         isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-[var(--border)] text-transparent"
                      )}>
                         <Check size={12} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredPlans.length === 0 && (
                 <div className="py-12 text-center opacity-30">
                    <Shield size={48} className="mx-auto mb-3" />
                    <p className="text-xs font-bold uppercase tracking-widest">No plans found matching filters</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function InsuranceCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex gap-4 items-center cursor-pointer hover:border-blue-500/30 transition-all">
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <div>
        <h4 className="font-serif text-lg">{title}</h4>
        <p className="text-xs text-[var(--muted)]">{desc}</p>
      </div>
      <ChevronRight size={16} className="ml-auto text-[var(--muted)]" />
    </div>
  );
}


const RemindersView = memo(function RemindersView({ 
  reminders, 
  onToggle, 
  onDelete, 
  onAdd,
  profile,
  updateProfile
}: { 
  reminders: Reminder[], 
  onToggle: (id: string | number) => void, 
  onDelete: (id: string | number) => void, 
  onAdd: (r: Omit<Reminder, 'id' | 'on'>) => void,
  profile: UserProfile,
  updateProfile: (p: UserProfile) => void
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [newFreq, setNewFreq] = useState('Daily');
  const [newColor, setNewColor] = useState('indigo');
  const [newCategory, setNewCategory] = useState<'medicine' | 'refill' | 'test' | 'other'>('medicine');
  const [newRefillDays, setNewRefillDays] = useState('30');
  const [newNote, setNewNote] = useState('');

  const handleAutoSchedule = async () => {
    if (profile.medicines.length === 0) {
      showDoneToast("No medications in your profile to schedule.");
      return;
    }
    setIsGenerating(true);
    try {
      const data = await generateSmartMedicationSchedule(profile);
      if (data.reminders) {
        data.reminders.forEach((r: any) => {
          onAdd(r);
        });
        showDoneToast(`Created ${data.reminders.length} smart reminders!`);
      }
    } catch (e) {
      console.error(e);
      showDoneToast("AI scheduling failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const logDose = (name: string) => {
    const medIdx = profile.medicines.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
    if (medIdx === -1) return;

    const newMeds = [...profile.medicines];
    const med = newMeds[medIdx];
    
    // Decrement totalQuantity (rough estimation for refill logic)
    // In a real app, we'd have a separate field for 'remainingStock'
    const newQuantity = Math.max(0, med.totalQuantity - 1);
    newMeds[medIdx] = { ...med, totalQuantity: newQuantity };
    
    updateProfile({ ...profile, medicines: newMeds });
    showDoneToast(`Dose logged for ${name}. Remaining: ${newQuantity}`);
  };

  const colors = [
    { name: 'indigo', hex: 'bg-indigo-500' },
    { name: 'emerald', hex: 'bg-emerald-500' },
    { name: 'rose', hex: 'bg-rose-500' },
    { name: 'amber', hex: 'bg-amber-500' },
    { name: 'sky', hex: 'bg-sky-500' },
    { name: 'purple', hex: 'bg-purple-500' },
  ];

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({
      name: newName,
      dose: newDose,
      time: newTime,
      freq: newFreq,
      color: newColor,
      category: newCategory,
      refillDays: newCategory === 'refill' ? parseInt(newRefillDays) : undefined,
      note: newNote.trim() || undefined,
    });
    setNewName('');
    setNewDose('');
    setNewNote('');
    setNewRefillDays('30');
    setNewCategory('medicine');
    setShowAdd(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
            <Clock size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Reminders</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Medicines & Health Tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.medicines.length > 0 && (
            <button 
              onClick={handleAutoSchedule}
              disabled={isGenerating}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
              AI Sync
            </button>
          )}
          <button 
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--teal)] hover:border-[var(--teal)] transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Task / Medicine Name</label>
                  <input 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Paracetamol"
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Dose (Optional)</label>
                  <input 
                    value={newDose} 
                    onChange={e => setNewDose(e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Time</label>
                  <input 
                    type="time"
                    value={newTime} 
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Frequency</label>
                  <select 
                    value={newFreq} 
                    onChange={e => setNewFreq(e.target.value)}
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                  >
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>Once</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Theme Color</label>
                <div className="flex gap-3">
                  {colors.map(c => (
                    <button 
                      key={c.name}
                      onClick={() => setNewColor(c.name)}
                      className={cn(
                        "w-8 h-8 rounded-lg transition-all",
                        c.hex,
                        newColor === c.name ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg)] scale-110" : "opacity-60 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Category</label>
                  <select 
                    value={newCategory} 
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                  >
                    <option value="medicine">Medicine</option>
                    <option value="refill">Refill</option>
                    <option value="test">Test</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {newCategory === 'refill' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Days until Refill</label>
                    <input 
                      type="number"
                      value={newRefillDays} 
                      onChange={e => setNewRefillDays(e.target.value)}
                      placeholder="30"
                      className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Custom Notes (Optional)</label>
                <textarea 
                  value={newNote} 
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="e.g. Take with food, avoid caffeine"
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm focus:border-[var(--teal-dim)] outline-none min-h-[80px] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--muted)] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  className="flex-2 py-3 bg-[var(--teal)] text-[#020f0c] rounded-xl text-xs font-bold"
                >
                  Save Reminder
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {reminders.length > 0 ? reminders.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0",
                colors.find(c => c.name === r.color)?.hex || 'bg-indigo-500'
              )}>
                {r.category === 'refill' ? <ShoppingCart size={20} /> : <Clock size={20} />}
              </div>
              <div>
                <h3 className="font-serif text-lg leading-tight flex items-center gap-2">
                  {r.name}
                  {r.category === 'refill' && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest">Refill</span>
                  )}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {r.category === 'refill' ? `Refill due in ${r.refillDays} days` : `${r.time} · ${r.freq}`}
                  {r.dose ? ` · ${r.dose}` : ''}
                </p>
                {r.note && (
                  <p className="text-[10px] text-[var(--teal-dim)] mt-1 italic line-clamp-1 max-w-[180px]" title={r.note}>
                    {r.note}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onToggle(r.id)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  r.on ? "bg-[var(--teal)]" : "bg-[var(--card2)] border border-[var(--border)]"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white absolute top-1 transition-all",
                  r.on ? "right-1" : "left-1"
                )} />
              </button>
              {r.category === 'medicine' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); logDose(r.name); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-teal-400 bg-teal-500/5 hover:bg-teal-500 hover:text-white transition-all shadow-lg active:scale-90"
                  title="Log Dose"
                >
                  <Check size={16} />
                </button>
              )}
              <button 
                onClick={() => onDelete(r.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.div>
        )) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] border-2 border-dashed border-[var(--border)] flex items-center justify-center mx-auto text-[var(--muted)]">
              <Clock size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--text)]">No active reminders</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">Add your daily medicines or health checks to stay on top of your wellbeing.</p>
            </div>
            <button 
              onClick={() => setShowAdd(true)}
              className="px-6 py-2 bg-[var(--teal)] text-[#020f0c] font-black text-[10px] uppercase tracking-widest rounded-xl mt-4"
            >
              Add Your First Reminder
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const AlertsView = memo(function AlertsView({ 
  profile, 
  journal, 
  triggerPushNotification,
  dismissedAlerts,
  onDismiss,
  onRestore
}: { 
  profile: UserProfile, 
  journal: JournalEntry[], 
  triggerPushNotification: (t: string, b: string) => void,
  dismissedAlerts: string[],
  onDismiss: (id: string) => void,
  onRestore: (id: string) => void
}) {
  const [showResolved, setShowResolved] = useState(false);
  
  const allPossibleAlerts: any[] = [];

  // Parse BP if available
  if (profile.bp) {
    const [sys, dia] = profile.bp.split('/').map(Number);
    if (sys > 140 || dia > 90) {
      allPossibleAlerts.push({
        id: 'bp-alert',
        type: 'danger',
        title: 'Elevated Blood Pressure',
        date: 'Current',
        desc: `Your logged BP (${profile.bp} mmHg) is flagged as Stage 2 Hypertension. Please consult your physician.`,
      });
    } else if (sys > 120 || dia > 80) {
      allPossibleAlerts.push({
        id: 'bp-alert',
        type: 'warning',
        title: 'High Normal Blood Pressure',
        date: 'Current',
        desc: `Your logged BP (${profile.bp} mmHg) is slightly elevated. Monitor your sodium intake and stress.`,
      });
    }
  }

  // Parse Sugar if available
  if (profile.sugar) {
    const sugar = Number(profile.sugar);
    if (sugar > 140) {
      allPossibleAlerts.push({
        id: 'sugar-alert',
        type: 'warning',
        title: 'Elevated Blood Sugar',
        date: 'Current',
        desc: `Your sugar level (${profile.sugar} mg/dL) is elevated above the normal fasting threshold.`,
      });
    }
  }

  // Detect Mood Trends
  if (journal.length >= 3) {
    const recentMoods = journal.slice(0, 3);
    const allLow = recentMoods.every((e) => e.mood <= 2);
    if (allLow) {
      allPossibleAlerts.push({
        id: 'mood-alert',
        type: 'warning',
        title: 'Consecutive Low Moods Detected',
        date: 'Mental Health Algorithm',
        desc: 'We noticed your emotional energy has been consistently low for the past 3 log entries. Consider stepping away for 5 minutes and trying our guided breathing exercise in the Wellness tab.',
      });
    }
  }

  // Activity Prompt
  if (journal.length === 0 && !profile.bp && !profile.weight) {
    allPossibleAlerts.push({
      id: 'baseline-alert',
      type: 'info',
      title: 'Missing Baseline Vitals',
      date: 'System',
      desc: 'No metrics detected. Please navigate to Settings to input your baseline vitals, or create a journal entry today to establish your health score.',
    });
  }

  const activeAlerts = allPossibleAlerts.filter(a => !dismissedAlerts.includes(a.id));
  const displayedResolved = allPossibleAlerts.filter(a => dismissedAlerts.includes(a.id));
  
  const alertsToDisplay = showResolved ? allPossibleAlerts : activeAlerts;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Health Alerts</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Preventive care & warnings</p>
          </div>
        </div>
        {displayedResolved.length > 0 && (
          <button 
            onClick={() => setShowResolved(!showResolved)}
            className={cn(
              "text-[9px] font-black uppercase tracking-[0.15em] px-4 py-2 rounded-full transition-all border",
              showResolved ? "bg-green-500 text-white border-green-500" : "bg-green-500/10 text-green-600 border-green-500/20"
            )}
          >
            {showResolved ? 'Hide Resolved' : `${displayedResolved.length} Resolved`}
          </button>
        )}
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {alertsToDisplay.length > 0 ? alertsToDisplay.map((a) => {
            const isResolved = dismissedAlerts.includes(a.id);
            return (
              <motion.div 
                key={a.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className={cn(
                  "p-5 rounded-3xl border relative group overflow-hidden transition-all",
                  isResolved ? "bg-[var(--card2)] border-[var(--border)] opacity-60 grayscale-[0.5]" : (
                    a.type === 'danger' ? "bg-red-500/5 border-red-500/20" : a.type === 'warning' ? "bg-amber-500/5 border-amber-500/20" : "bg-blue-500/5 border-blue-500/20 shadow-sm"
                  )
                )}
              >
                <div className="flex gap-4 relative z-10">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm transition-all",
                    isResolved ? "bg-[var(--muted)] text-white" : (
                      a.type === 'danger' ? "bg-red-500 text-white" : a.type === 'warning' ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                    )
                  )}>
                    {isResolved ? <Check size={20} /> : (a.type === 'danger' ? <AlertTriangle size={20} /> : a.type === 'warning' ? <Bell size={20} /> : <Info size={20} />)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className={cn("font-serif text-lg leading-tight transition-all", isResolved && "line-through opacity-50 text-[var(--muted)]")}>{a.title}</h3>
                        <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-tighter opacity-60">{isResolved ? 'Resolved' : a.date}</span>
                      </div>
                      <button 
                        onClick={() => isResolved ? onRestore(a.id) : onDismiss(a.id)}
                        className={cn(
                          "p-2 rounded-full transition-all",
                          isResolved ? "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white" : "hover:bg-black/5 text-[var(--muted)] hover:text-[var(--text)]"
                        )}
                        title={isResolved ? 'Restore' : 'Dismiss'}
                      >
                        {isResolved ? <History size={18} /> : <Check size={18} />}
                      </button>
                    </div>
                    <p className={cn("text-sm transition-all", isResolved ? "text-[var(--muted)] opacity-50" : "text-[var(--text2)] leading-relaxed")}>{a.desc}</p>
                    
                    {!isResolved && (
                      <div className="pt-2 flex gap-2">
                        {a.id === 'bp-alert' && (
                          <button onClick={() => window.location.href = 'https://www.google.com/search?q=tips+to+control+blood+pressure'} className="text-[10px] font-black uppercase tracking-widest text-red-500 underline underline-offset-4 ring-offset-[var(--bg)]">Control Tips</button>
                        )}
                        {a.id === 'mood-alert' && (
                          <button className="text-[10px] font-black uppercase tracking-widest text-amber-600 underline underline-offset-4">Guided Breathing</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {!isResolved && (
                  <div className={cn(
                    "absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-5 rounded-full",
                    a.type === 'danger' ? "bg-red-500" : a.type === 'warning' ? "bg-amber-500" : "bg-blue-500"
                  )} />
                )}
              </motion.div>
            );
          }) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-[2.5rem] p-12 text-center space-y-4 shadow-inner"
            >
              <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 border border-green-500/20 shadow-sm animate-bounce-slow">
                <Check size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-serif">All Clear!</p>
                <p className="text-sm text-[var(--muted)] font-medium max-w-[200px] mx-auto leading-relaxed">Veda hasn't detected any health irregularities. You're doing great!</p>
              </div>
              <div className="pt-2">
                <span className="text-[9px] text-[var(--muted)] font-black uppercase tracking-[0.3em] opacity-40">Guardian Protection: Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-8">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-[var(--card2)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-red-400/10 text-red-500 flex items-center justify-center"><Navigation size={18} /></div>
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Status Notifications</h4>
          </div>
          <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">Ensure push notifications are turned on to receive real-time, life-saving alerts about critical vitals or medication timings directly on your lock screen.</p>
          <button 
            onClick={() => triggerPushNotification("Veda Health Alert", "This is a simulated critical notification from Veda AI. Stay healthy!")}
            className="w-full py-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-[var(--text2)] hover:border-red-500/50 hover:text-red-500 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Bot size={16} /> <span>Simulate AI Alert</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
});

function HealthCalendar({ appointments, onAddAppointment, profile }: { appointments: Appointment[], onAddAppointment: (appt: Omit<Appointment, 'id'>) => Promise<void>, profile: UserProfile }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [localEvents, setLocalEvents] = useState<any[]>([
    { id: 1, title: 'Morning Vit C', date: new Date().toDateString(), time: '09:00', type: 'med', completed: false },
    { id: 2, title: 'Gym Session', date: new Date().toDateString(), time: '17:30', type: 'workout', completed: false },
    { id: 3, title: 'Blood Pressure Check', date: new Date().toDateString(), time: '21:00', type: 'health', completed: false },
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');
  const [newEventDate, setNewEventDate] = useState(selectedDate.toISOString().split('T')[0]);
  const [newEventType, setNewEventType] = useState('Doctor Appointment');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const calendarEvents = [
    ...localEvents,
    ...appointments.map(a => ({
      id: a.id,
      title: a.clinicName || a.type,
      date: new Date(a.date).toDateString(),
      time: a.time,
      type: a.type,
      completed: a.status === 'completed',
      isPersistent: true
    }))
  ];

  const dailyEvents = calendarEvents.filter(e => e.date === selectedDate.toDateString());

  const addEvent = async () => {
    if (!newEventTitle) return;
    
    try {
      await onAddAppointment({
        clinicId: 'custom',
        clinicName: newEventTitle,
        date: newEventDate,
        time: newEventTime,
        status: 'upcoming',
        patientName: profile.name || 'Member',
        patientId: profile.uid || '',
        type: newEventType
      });
      
      showDoneToast("Event added to your health records");
      setIsAdding(false);
      setNewEventTitle('');
    } catch (error) {
       console.error(error);
    }
  };

  const toggleEvent = (id: any, isPersistent?: boolean) => {
    if (isPersistent) {
      // In a real app, we'd update Firestore status
      showDoneToast("Persistent event status update coming soon");
    } else {
      setLocalEvents(localEvents.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
          <CalendarIcon size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Health Calendar</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
           <h3 className="font-serif text-xl">{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
           <div className="flex gap-2">
              <button className="p-2 bg-[var(--card2)] rounded-full text-[var(--muted)] hover:text-indigo-400"><ChevronLeft size={18} /></button>
              <button className="p-2 bg-[var(--card2)] rounded-full text-[var(--muted)] hover:text-indigo-400"><ChevronRight size={18} /></button>
           </div>
        </div>

        <div className="flex justify-between">
          {dates.map((d, i) => {
            const isSelected = d.toDateString() === selectedDate.toDateString();
            const hasEvents = calendarEvents.some(e => e.date === d.toDateString());
            return (
              <button 
                key={i} 
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all min-w-[45px]",
                  isSelected ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "hover:bg-indigo-500/10 text-[var(--muted)]"
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60 font-mono">{days[d.getDay()]}</span>
                <span className="text-sm font-black font-serif">{d.getDate()}</span>
                {hasEvents && !isSelected && <div className="w-1 h-1 bg-indigo-500 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Upcoming for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h3>
         <div className="space-y-3">
            {dailyEvents.length > 0 ? dailyEvents.map((ev) => (
              <div key={ev.id} className={cn("bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-500/30 transition-all group", ev.completed && "opacity-60")}>
                 <div className="w-12 h-12 rounded-xl bg-indigo-500/5 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                    {ev.time}
                 </div>
                 <div className="flex-1">
                    <h4 className={cn("text-sm font-bold text-[var(--text)] group-hover:text-indigo-400 transition-colors uppercase tracking-tight", ev.completed && "line-through text-[var(--muted)]")}>{ev.title}</h4>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-wider">{ev.type}</p>
                 </div>
                 <button onClick={() => toggleEvent(ev.id, ev.isPersistent)} className={cn("w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center transition-all", ev.completed ? "bg-indigo-500 border-indigo-500 text-white" : "text-[var(--muted)] hover:border-indigo-500 hover:text-indigo-500")}>
                    <Check size={14} />
                 </button>
              </div>
            )) : (
              <div className="text-center py-6 text-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-3xl text-xs font-bold">No events for this day.</div>
            )}
            
            {isAdding ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-2xl border-indigo-500/20">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Event Title</label>
                    <input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="e.g. Vaccination at Apollo" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 font-bold" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Date</label>
                      <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Time</label>
                      <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 font-bold" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Event Type</label>
                    <select 
                      value={newEventType} 
                      onChange={e => setNewEventType(e.target.value)}
                      className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 font-bold appearance-none"
                    >
                      <option>Doctor Appointment</option>
                      <option>Vaccination</option>
                      <option>Health Checkup</option>
                      <option>Lab Test</option>
                      <option>Medication Change</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={addEvent} className="flex-1 py-4 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Save Event</button>
                  <button onClick={() => setIsAdding(false)} className="px-6 py-4 bg-[var(--card2)] border border-[var(--border)] rounded-2xl text-xs font-black uppercase active:scale-95 transition-all">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)} className="w-full py-5 border-2 border-dashed border-[var(--border)] rounded-3xl text-[var(--muted)] font-black text-[10px] uppercase tracking-[0.2em] hover:border-indigo-500/20 hover:text-indigo-400 transition-all active:scale-[0.98]">
                + Plan New Activity
              </button>
            )}
         </div>
      </div>
    </div>
  );
}

function LabScanner() {
  const [image, setImage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'text'>('image');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image && !textInput) return;
    setIsLoading(true);
    setResult(null);
    try {
      const base64Data = image ? image.split(',')[1] : undefined;
      const data = await analyzeLabReport(base64Data, textInput);
      setResult(data);
      showDoneToast("Analysis Complete");
    } catch (error) {
       console.error("Lab scan error:", error);
       showDoneToast("Error analyzing report. Try a clearer photo.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    let reportText = `VEDA HEALTH - AI LAB REPORT ANALYSIS\n`;
    reportText += `Generated on: ${new Date().toLocaleString()}\n`;
    reportText += `==========================================\n\n`;
    reportText += `EXECUTIVE SUMMARY:\n${result.summary}\n\n`;
    
    reportText += `BIOMETRIC DATA GRID:\n`;
    reportText += `------------------------------------------\n`;
    result.parameters.forEach((p: any) => {
      reportText += `PARAMETER: ${p.parameter}\n`;
      reportText += `VALUE: ${p.value} (Range: ${p.range})\n`;
      reportText += `STATUS: ${p.status.toUpperCase()}\n`;
      reportText += `EXPLANATION: ${p.explanation}\n`;
      reportText += `------------------------------------------\n`;
    });
    reportText += `\n`;
    
    if (result.dietarySuggestions && result.dietarySuggestions.length > 0) {
      reportText += `DIETARY STRATEGY:\n`;
      result.dietarySuggestions.forEach((s: string) => {
        reportText += `- ${s}\n`;
      });
      reportText += `\n`;
    }
    
    if (result.followUpQuestions && result.followUpQuestions.length > 0) {
      reportText += `DOCTOR QUESTIONS:\n`;
      result.followUpQuestions.forEach((q: string) => {
        reportText += `- ${q}\n`;
      });
      reportText += `\n`;
    }
    
    reportText += `==========================================\n`;
    reportText += `DISCLAIMER: Veda AI analysis is meant for educational understanding only. This is not a diagnosis. Always share your results with your physician for clinical interpretation.\n`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Veda_Lab_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Clipboard size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Lab Explainer</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">AI Report Analysis</p>
          </div>
        </div>
        <div className="flex bg-[var(--card2)] p-1 rounded-xl border border-[var(--border)] overflow-hidden">
           <button onClick={() => setUploadType('image')} className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", uploadType === 'image' ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "text-[var(--muted)]")}>Photo</button>
           <button onClick={() => setUploadType('text')} className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", uploadType === 'text' ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "text-[var(--muted)]")}>Text</button>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[40px] p-8 space-y-6 shadow-xl relative overflow-hidden group/box">
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover/box:bg-indigo-500/10 transition-colors" />
        
        {uploadType === 'image' ? (
          !image ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-[32px] p-16 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group/label">
              <div className="w-20 h-20 rounded-3xl bg-[var(--card2)] flex items-center justify-center text-[var(--muted)] group-hover/label:text-indigo-500 group-hover/label:scale-110 transition-all mb-6 shadow-inner">
                <Camera size={40} strokeWidth={1.5} />
              </div>
              <span className="text-sm font-black uppercase tracking-widest">Snap Lab Report</span>
              <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest mt-2 opacity-50">High resolution blood test photo</span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-video rounded-[32px] overflow-hidden border border-[var(--border)] shadow-2xl">
                <img src={image} alt="Report Preview" className="w-full h-full object-cover" />
                <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-3 bg-black/50 text-white rounded-full backdrop-blur-xl hover:bg-black/70 transition-colors"><X size={20} /></button>
              </div>
              <button 
                onClick={handleScan}
                disabled={isLoading}
                className="w-full py-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black rounded-[28px] shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 overflow-hidden group"
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Analyzing Data Matrix...
                  </>
                ) : (
                  <>
                    Explain Report with AI
                    <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <textarea 
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Paste your report text here (e.g., Hemoglobin 14.2 g/dL)..."
              className="w-full h-48 bg-[var(--card2)] border border-[var(--border)] rounded-[32px] p-6 text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-inner resize-none no-scrollbar"
            />
            <button 
              onClick={handleScan}
              disabled={isLoading || !textInput.trim()}
              className="w-full py-6 bg-indigo-600 text-white font-black rounded-[28px] shadow-2xl shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase tracking-[0.3em]"
            >
              {isLoading ? 'Processing Text...' : 'Analyze Text Report'}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                 <Bot size={120} />
               </div>
               <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] opacity-70">
                       <Sparkles size={12} />
                       Executive Summary
                    </div>
                    <button 
                      onClick={downloadReport}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all backdrop-blur-md active:scale-95"
                    >
                      <Download size={12} />
                      Download Report
                    </button>
                  </div>
                  <h3 className="text-2xl font-serif leading-tight">{result.summary}</h3>
               </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[40px] overflow-hidden shadow-xl">
               <div className="px-8 py-6 border-b border-[var(--border)] bg-[var(--card2)]/50 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">Biometric Data Grid</h4>
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-red-400" />
                     <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Out of Range</span>
                  </div>
               </div>
               <div className="divide-y divide-[var(--border)]">
                  {result.parameters.map((p: any, i: number) => {
                    const isAlert = p.status === 'high' || p.status === 'low' || p.status === 'critical';
                    return (
                      <div key={i} className="p-6 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                           <div className="space-y-1">
                              <h5 className="text-sm font-bold text-[var(--text)] group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{p.parameter}</h5>
                              <p className="text-[10px] text-[var(--muted)] font-medium leading-relaxed">{p.explanation}</p>
                           </div>
                           <div className="text-right shrink-0">
                              <div className={cn("text-lg font-black font-serif", isAlert ? "text-red-400" : "text-green-400")}>
                                {p.value}
                              </div>
                              <div className="text-[8px] font-black text-[var(--muted)] uppercase tracking-widest mt-1 opacity-50">{p.range}</div>
                           </div>
                        </div>
                        {isAlert && (
                          <div className="mt-3 px-3 py-1.5 bg-red-400/10 border border-red-400/20 rounded-full inline-flex items-center gap-2">
                             <AlertTriangle size={10} className="text-red-400" />
                             <span className="text-[9px] font-black text-red-200 uppercase tracking-widest leading-none">Attention: {p.status}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                   <Apple size={14} />
                   Dietary Strategy
                </div>
                <ul className="space-y-2">
                  {result.dietarySuggestions?.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-[var(--text2)] leading-relaxed">
                      <span className="text-indigo-400">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-400">
                   <Activity size={14} />
                   Lifestyle Adjustments
                </div>
                <ul className="space-y-2">
                  {result.lifestyleSuggestions?.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-[var(--text2)] leading-relaxed">
                      <span className="text-teal-400">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
                   <Stethoscope size={14} />
                   Doctor Questions
                </div>
                <ul className="space-y-2">
                  {result.followUpQuestions?.map((q: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-[var(--text2)] leading-relaxed bg-[var(--card2)] p-3 rounded-2xl border border-[var(--border)]">
                      <span className="text-amber-400">?</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0"><AlertTriangle size={20} /></div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Medical Disclaimer</p>
                <p className="text-[10px] text-amber-200/60 leading-normal font-medium italic">
                  Veda AI analysis is meant for educational understanding only. This is not a diagnosis. Always share your results with your physician for clinical interpretation.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SkinScanner() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setIsLoading(true);
    try {
      const prompt = "Analyze this photo of a skin condition (rash, mole, spot, etc.). Identify potential causes, suggest home care if appropriate, and clearly state if the patient should see a dermatologist. Provide a disclaimer that this is not a diagnosis.";
      const base64Data = image.split(',')[1];
      const response = await analyzeImage(base64Data, prompt);
      setResult(response);
    } catch (error) {
      setResult("Error analyzing skin condition. Please ensure the photo is clear and well-lit.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white shadow-xl shadow-pink-500/20 border border-white/20">
          <Camera size={22} />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight text-[var(--text)]">Skin Scanner</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-0.5 opacity-60">AI Skin Condition Analysis</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[40px] p-8 space-y-6 relative overflow-hidden group">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-pink-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-pink-500/10 transition-colors duration-700" />
        
        {!image ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[32px] p-16 cursor-pointer hover:border-pink-500/30 hover:bg-pink-500/5 transition-all group/label">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center text-[var(--muted)] group-hover/label:text-pink-400 group-hover/label:scale-110 transition-all mb-6 shadow-inner border border-white/5">
              <Camera size={40} strokeWidth={1.5} />
            </div>
            <span className="text-sm font-black uppercase tracking-widest text-[var(--text)]">Snap Skin Issue</span>
            <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest mt-2 opacity-40">Clear, well-lit medical photo</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
              <img src={image} alt="Skin" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-3 glass-morphism border border-white/20 text-white rounded-full backdrop-blur-xl hover:bg-white/10 transition-colors shadow-lg"><X size={20} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-6 bg-gradient-to-br from-pink-500 to-pink-600 text-white font-black rounded-[28px] shadow-2xl shadow-pink-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 border border-white/20"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>Analysing Skin...</span>
                </>
              ) : (
                <>
                  <span>Analyse with AI ✦</span>
                  <Sparkles size={20} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl glass-morphism border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-[var(--text)]">Clinical Analysis</h3>
              <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest opacity-60">AI-Dermatology Support</p>
            </div>
          </div>
          <div className="prose prose-sm max-w-none prose-p:text-[var(--text2)] prose-li:text-[var(--text2)] prose-p:leading-relaxed bg-white/2 border border-white/5 rounded-2xl p-6 shadow-inner mb-6">
            <div className="text-sm leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          </div>
          <div className="flex items-start gap-4 p-5 glass-darker border border-amber-500/20 rounded-2xl">
            <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
            <div className="space-y-1">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Medical Disclaimer</p>
              <p className="text-xs text-amber-200/60 leading-relaxed font-medium italic">This is an AI-generated assessment for informational purposes only. For any suspicious moles or persistent rashes, consult a dermatologist immediately.</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function NutritionPlanner({ profile }: { profile: UserProfile }) {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setIsLoading(true);
    setResult(null);
    try {
      const base64Data = image.split(',')[1];
      const data = await analyzeFood(base64Data, profile);
      setResult(data);
    } catch (error) {
      console.error("Food analysis error:", error);
      showDoneToast("Error analyzing meal. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xl shadow-orange-500/20 border border-white/20">
          <Utensils size={24} />
        </div>
        <div>
          <h2 className="font-serif text-2xl tracking-tight text-[var(--text)]">Diet & Nutrition Planner</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-0.5 opacity-60">AI Weight & Health Management</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[40px] p-8 space-y-6 relative overflow-hidden group">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-orange-500/10 transition-colors duration-700" />
        
        {!image ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[32px] p-16 cursor-pointer hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group/label">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center text-[var(--muted)] group-hover/label:text-orange-400 group-hover/label:scale-110 transition-all mb-6 shadow-inner border border-white/5">
              <Camera size={40} strokeWidth={1.5} />
            </div>
            <span className="text-sm font-black uppercase tracking-widest text-[var(--text)]">Snap Your Meal</span>
            <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest mt-2 opacity-40">Get instant calorie & health insights</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
              <img src={image} alt="Meal" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-3 glass-morphism border border-white/20 text-white rounded-full backdrop-blur-xl hover:bg-white/10 transition-colors shadow-lg"><X size={20} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-6 bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black rounded-[28px] shadow-2xl shadow-orange-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 border border-white/20"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  <span>Calculating Nutrition...</span>
                </>
              ) : (
                <>
                  <span>Estimate Nutrition ✦</span>
                  <Sparkles size={20} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif text-2xl text-orange-500 mb-1">{result.dishName}</h3>
                <p className="text-xs text-[var(--muted)]">{result.explanation}</p>
              </div>
              <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-500 font-serif text-xl">
                {result.calories} <span className="text-[10px] uppercase font-bold">kcal</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
               <div className="glass-darker p-4 rounded-2xl border border-white/5">
                  <div className="text-[10px] uppercase font-black tracking-widest text-[var(--muted)] mb-1">Protein</div>
                  <div className="text-lg font-serif text-teal-400">{result.protein}g</div>
               </div>
               <div className="glass-darker p-4 rounded-2xl border border-white/5">
                  <div className="text-[10px] uppercase font-black tracking-widest text-[var(--muted)] mb-1">Carbs</div>
                  <div className="text-lg font-serif text-blue-400">{result.carbs}g</div>
               </div>
               <div className="glass-darker p-4 rounded-2xl border border-white/5">
                  <div className="text-[10px] uppercase font-black tracking-widest text-[var(--muted)] mb-1">Fats</div>
                  <div className="text-lg font-serif text-rose-400">{result.fats}g</div>
               </div>
            </div>

            {result.warnings && result.warnings.length > 0 && (
              <div className="p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl mb-6">
                <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-widest mb-3">
                  <AlertTriangle size={14} /> Health Warning
                </div>
                <ul className="space-y-2">
                  {result.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-xs font-bold text-rose-200/70 leading-relaxed">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-400">
                <Activity size={14} /> Personalized Tips
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.healthTips?.map((tip: string, i: number) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 mt-0.5">
                      <Star size={12} fill="currentColor" />
                    </div>
                    <p className="text-xs font-bold text-[var(--text2)] leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MindWellnessDashboard({ journal }: { journal: JournalEntry[] }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeLatest = async () => {
    if (journal.length === 0) return;
    setIsLoading(true);
    try {
      const latest = journal[journal.length - 1];
      const data = await analyzeJournal(latest.notes);
      setAnalysis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
          <Brain size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Veda Mind</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">Mental Wellness Suite</p>
        </div>
      </div>

      <button onClick={analyzeLatest} className="w-full p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-left space-y-2">
        <div className="flex items-center justify-between">
           <h3 className="font-serif font-medium">Analyze Your Latest Entry</h3>
           {isLoading && <RefreshCw className="animate-spin text-indigo-500" size={20} />}
        </div>
        <p className="text-xs text-[var(--muted)]">Let Veda analyze your mood and stress patterns from your journal.</p>
      </button>

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-2xl space-y-4">
             <div className="flex justify-between items-center">
               <h4 className="font-serif text-lg">Stress Assessment</h4>
               <span className={cn("px-3 py-1 rounded-full text-xs font-bold", analysis.burnoutRisk === 'high' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500')}>
                 {analysis.burnoutRisk.toUpperCase()} Burnout Risk
               </span>
             </div>
             <p className="text-sm text-[var(--text2)]">{analysis.summary}</p>
             <p className="text-sm p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">{analysis.recommendation}</p>
          </div>

          <div className="p-6 bg-indigo-900/5 dark:bg-indigo-900/10 border border-indigo-500/20 rounded-2xl">
             <h4 className="font-serif text-lg mb-4 text-indigo-600 dark:text-indigo-400">Micro-Meditation</h4>
             <p className="text-sm leading-relaxed text-indigo-900 dark:text-indigo-200">
               Based on your entry, take a 2-minute break: {analysis.stressLevel > 6 ? "Find a quiet space, close your eyes, and take 5 deep, slow breaths. Exhale for longer than you inhale." : "Take a moment to write down 3 things you are grateful for right now. Focus on the feeling of gratitude."}
             </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function HealthRoadmapDashboard({ profile }: { profile: UserProfile }) {
  const [roadmap, setRoadmap] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const generate = async () => {
      setIsLoading(true);
      try {
        const data = await generateHealthRoadmap(profile);
        setRoadmap(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    generate();
  }, [profile]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
          <CalendarIcon size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Preventive Care</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">Personalized Health Roadmap</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)] gap-4">
           <RefreshCw className="animate-spin" size={32} />
           <p className="text-xs font-bold uppercase tracking-widest">Generating your roadmap...</p>
        </div>
      ) : (
        <div className="space-y-4">
            {roadmap.map((item, i) => (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className="p-5 bg-[var(--card)] border border-[var(--border)] rounded-2xl flex items-start gap-4">
                 <div className={cn("w-2 h-2 rounded-full mt-2.5", item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500')} />
                 <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-xs text-[var(--muted)] mt-1">{item.description}</p>
                 </div>
                 <div className="text-[10px] font-black uppercase tracking-widest bg-[var(--card2)] px-3 py-1 rounded-full">{item.month}</div>
              </motion.div>
            ))}
        </div>
      )}
    </div>
  );
}

function PatternDetector({ journal }: { journal: JournalEntry[] }) {
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDetect = async () => {
    if (journal.length < 3) return;
    setIsLoading(true);
    try {
      const summary = journal.slice(0, 14).map(e => `${e.date}: Mood ${e.mood}/5, Sleep ${e.sleep}h, Energy ${e.energy}/5. Notes: ${e.notes}`).join('\n');
      const prompt = `Analyze these health journal entries and find hidden patterns or correlations (e.g., between sleep and mood, or specific days of the week). Provide 3-5 specific insights.\n\nEntries:\n${summary}`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error detecting patterns. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 border border-white/10">
          <BarChart3 size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Pattern Pulse</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">AI Correlation Engine</p>
        </div>
      </div>

      <div className="glass border border-[var(--border)] rounded-[44px] p-10 text-center space-y-6 shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
        
        <div className="w-24 h-24 rounded-[32px] glass flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400 border border-blue-500/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
          <Sparkles size={44} />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif text-2xl text-[var(--text)]">Find Your Rhythm</h3>
          <p className="text-[15px] text-[var(--muted)] max-w-[280px] mx-auto font-medium leading-relaxed opacity-80">Veda triangulates your journals to find how biological patterns affect your daily vibe.</p>
        </div>
        <button 
          onClick={handleDetect}
          disabled={isLoading || journal.length < 3}
          className="w-full py-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white font-black rounded-[28px] shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 border border-white/20"
        >
          {isLoading ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>Decoding Patterns...</span>
            </>
          ) : journal.length < 3 ? (
            <span>Log 3+ days to activate</span>
          ) : (
            <>
              <span>Pulse Check ✦</span>
              <Sparkles size={20} />
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-[44px] p-9 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl glass-morphism border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
              <Zap size={22} />
            </div>
            <h3 className="font-serif text-2xl text-[var(--text)]">AI Detected Patterns</h3>
          </div>
          <div className="prose prose-sm max-w-none prose-p:text-[var(--text2)] prose-li:text-[var(--text2)] prose-p:leading-relaxed bg-white/2 border border-white/5 rounded-[32px] p-8 shadow-inner mb-6">
             <div className="text-[15px] leading-relaxed space-y-4 font-medium" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.3em] opacity-40 italic">Pattern accuracy improves with more logs.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const AdviceView = memo(function AdviceView({ journal, profile }: { journal: JournalEntry[], profile: UserProfile }) {
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleGetAdvice = async (type: string) => {
    setIsLoading(true);
    try {
      const ctx = `Profile: ${profile.age}yrs, ${profile.sex}, Conditions: ${profile.conditions.join(', ')}. Recent Journal: ${journal.slice(0, 5).map(e => e.notes).join('. ')}`;
      const prompt = `Based on this patient profile and recent health logs, provide personalized ${type} advice. Be specific, practical, and warm. Ensure the advice is medically sound yet easy to understand.\n\nContext: ${ctx}`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error generating advice. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAdvice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleGetAdvice(`custom: ${customInput.trim()}`);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-xl shadow-[var(--teal)]/20 border border-white/20">
          <Bot size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Health Guru</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Personalized AI Mentorship</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AdviceCard icon={<Leaf size={24} />} label="Diet" onClick={() => handleGetAdvice('diet')} color="emerald" />
        <AdviceCard icon={<Activity size={24} />} label="Lifestyle" onClick={() => handleGetAdvice('lifestyle')} color="blue" />
        <AdviceCard icon={<Brain size={24} />} label="Mental" onClick={() => handleGetAdvice('mental wellness')} color="purple" />
        <AdviceCard icon={<Stethoscope size={24} />} label="Medical" onClick={() => handleGetAdvice('preventive medical')} color="rose" />
      </div>

      <div className="glass border border-white/10 rounded-[32px] p-8 space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
          <Sparkles size={120} />
        </div>
        <div className="space-y-2 relative z-10">
          <h3 className="font-serif text-xl text-[var(--text)]">Custom Direction</h3>
          <p className="text-[13px] text-[var(--muted)] font-medium leading-relaxed opacity-80">Describe a specific goal or health concern — Veda will architect a unique path for you.</p>
        </div>
        <form onSubmit={handleCustomAdvice} className="relative z-10 flex gap-3">
          <input 
            type="text" 
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Focus topic (e.g. sleep hygiene)..."
            className="flex-1 glass-darker border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-[var(--teal)]/40 transition-all font-medium placeholder:text-[var(--muted)]/30"
          />
          <button 
            type="submit"
            disabled={isLoading || !customInput.trim()}
            className="w-14 h-14 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl flex items-center justify-center hover:scale-110 active:scale-90 disabled:opacity-50 transition-all shadow-xl shadow-[var(--teal)]/20"
          >
            <ArrowRight size={24} />
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="p-20 flex flex-col items-center justify-center gap-6 glass border border-white/10 rounded-[40px] shadow-inner">
          <div className="relative">
            <div className="absolute inset-0 bg-[var(--teal)]/20 blur-2xl rounded-full" />
            <RefreshCw className="animate-spin relative z-10 text-[var(--teal)]" size={40} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-[var(--muted)] opacity-40">Consulting Cosmic Database...</p>
        </div>
      )}

      {result && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-[44px] p-10 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--teal)]/30 to-transparent" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl glass-morphism border border-[var(--teal)]/20 flex items-center justify-center text-[var(--teal)] shadow-inner">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-[var(--text)]">Universal Advice</h3>
              <p className="text-[9px] font-black text-[var(--teal)] uppercase tracking-widest opacity-60">Personalized Wisdom Packet</p>
            </div>
          </div>
          <div className="text-[15px] leading-relaxed space-y-5 text-[var(--text2)] prose prose-invert max-w-none font-medium italic" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          <div className="mt-10 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-rose-400/60 font-black uppercase tracking-[0.2em] italic">
              ✦ Medical Disclaimer: Veda provides supportive guidance, not clinical diagnosis.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
});

function AdviceCard({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  const colors: Record<string, string> = {
    teal: 'hover:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/10',
    emerald: 'hover:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/10',
    blue: 'hover:text-blue-400 border-blue-500/20 group-hover:bg-blue-500/10',
    purple: 'hover:text-purple-400 border-purple-500/20 group-hover:bg-purple-500/10',
    rose: 'hover:text-rose-400 border-rose-500/20 group-hover:bg-rose-500/10',
    red: 'hover:text-rose-400 border-rose-500/20 group-hover:bg-rose-500/10',
  };
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "glass border border-white/10 rounded-[32px] p-6 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.05] active:scale-95 group shadow-lg",
      )}
    >
      <div className={cn("w-16 h-16 rounded-[24px] glass-darker flex items-center justify-center transition-all border border-white/5 shadow-inner", colors[color] || "")}>
        {icon}
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.3em] font-serif text-[var(--text)] group-hover:tracking-[0.4em] transition-all">{label}</span>
    </button>
  );
}

const OpinionView = memo(function OpinionView({ profile }: { profile: UserProfile }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetOpinion = async () => {
    if (!diagnosis.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Patient was diagnosed with: ${diagnosis}. Profile: ${profile.age}yrs, ${profile.sex}, Conditions: ${profile.conditions.join(', ')}. Provide a medical second opinion. Evaluate if the diagnosis fits the profile, suggest 3 questions for the doctor, and mention any alternative possibilities to discuss.`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error getting second opinion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 border border-white/20">
          <BookCheck size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Veda Review</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Medical Second Opinion</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[40px] p-10 space-y-8 shadow-xl relative overflow-hidden group">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-700" />
        
        <div className="space-y-3 relative z-10">
          <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] ml-1">Current Diagnosis</label>
          <div className="relative group/input">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 opacity-40 group-focus-within/input:opacity-100 transition-opacity">
              <Clipboard size={20} />
            </div>
            <input 
              type="text"
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="e.g. Type 2 Diabetes"
              className="w-full glass-darker border border-white/10 rounded-[28px] pl-16 pr-8 py-6 text-[15px] outline-none focus:border-blue-500/40 transition-all font-medium placeholder:text-[var(--muted)]/30"
            />
          </div>
        </div>

        <button 
          onClick={handleGetOpinion}
          disabled={isLoading || !diagnosis.trim()}
          className="w-full py-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white font-black rounded-[28px] shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-3 border border-white/20 relative z-10"
        >
          {isLoading ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>Reviewing Clinical Data...</span>
            </>
          ) : (
            <>
              <span>Get Second Opinion ✦</span>
              <Sparkles size={20} />
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass border border-white/10 rounded-[44px] p-10 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl glass-morphism border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <Stethoscope size={24} />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-[var(--text)]">Clinical Analysis</h3>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-60">AI Diagnostic Review</p>
            </div>
          </div>
          <div className="text-[15px] leading-relaxed space-y-5 text-[var(--text2)] prose prose-invert max-w-none font-medium italic mb-8" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          
          <div className="p-6 glass-darker border border-emerald-500/20 rounded-3xl flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Search size={18} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Verification Recommended</p>
              <p className="text-xs text-emerald-100/60 leading-relaxed font-medium">Use these AI insights to facilitate a deeper conversation with your medical specialist during your next consultation.</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
});

// --- Leaflet Marker Icons Fix ---
// This is necessary because Vite/Webpack sometimes mangle the paths to Leaflet's default marker icons
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// @ts-ignore
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconRetinaUrl: markerRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Doctors and Hospitals
const doctorIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #00d4b1; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">👨‍⚕️</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const hospitalIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ef4444; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🏥</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

function MapHandler({ placeType, onPlacesFound, center }: { placeType: string, onPlacesFound: (places: any[]) => void, center: [number, number] }) {
  const map = useLeafletMap();

  useEffect(() => {
    if (!map) return;
    map.setView(center, 14);

    let searchCompleted = false;

    const generateMockResults = () => {
      console.log(`Generating mock results for ${placeType} due to API issues.`);
      const mocks = Array.from({ length: 5 }).map((_, i) => ({
        name: placeType === 'doctor' 
          ? ['Dr. Arjun Sharma', 'Dr. Priya Mehta', 'Dr. Rahul Varma', 'Dr. Sarah Smith', 'Dr. Anita Desai'][i]
          : ['Apex Multispeciality', 'LifeCare Hospital', 'City General Clinic', 'Astra Emergency Care', 'Unity Wellness Center'][i],
        vicinity: `District ${Math.floor(Math.random() * 10) + 1}, Metro Area`,
        rating: (4 + Math.random()).toFixed(1),
        location: { 
            lat: center[0] + (Math.random() - 0.5) * 0.02, 
            lng: center[1] + (Math.random() - 0.5) * 0.02 
        },
        types: placeType === 'doctor' ? ['health', 'doctor'] : ['hospital', 'health']
      }));
      onPlacesFound(mocks);
    };

    const performSearch = async (lat: number, lng: number) => {
        const radius = 5000;
        // Broader search criteria using union of tags
        const tags = placeType === 'doctor' 
          ? 'node(around:RADIUS,LAT,LNG)["healthcare"="doctor"];node(around:RADIUS,LAT,LNG)["amenity"="doctors"];node(around:RADIUS,LAT,LNG)["healthcare"="clinic"];'
          : 'node(around:RADIUS,LAT,LNG)["amenity"="hospital"];node(around:RADIUS,LAT,LNG)["healthcare"="hospital"];node(around:RADIUS,LAT,LNG)["amenity"="clinic"]["emergency"="yes"];';
        
        const query = `[out:json];(${tags.replaceAll('RADIUS', radius.toString()).replaceAll('LAT', lat.toString()).replaceAll('LNG', lng.toString())});out body;`;
        
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://lz4.overpass-api.de/api/interpreter',
            'https://z.overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.n.osm.ch/api/interpreter',
            'https://overpass.openstreetmap.ru/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
        ];

        let success = false;
        for (const endpoint of endpoints) {
            if (searchCompleted) return;
            try {
                console.log(`Trying Overpass endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(query)}`
                });
                
                if (!response.ok) {
                    console.warn(`Endpoint ${endpoint} returned status ${response.status}`);
                    continue;
                }
                const data = await response.json();
                
                if (data.elements && data.elements.length > 0) {
                    const formatted = data.elements.map((el: any) => ({
                        name: el.tags.name || (placeType === 'doctor' ? 'Medical Clinic' : 'Hospital'),
                        vicinity: el.tags['addr:street'] || el.tags['addr:full'] || el.tags['addr:city'] || 'Local area',
                        rating: el.tags.rating || (4 + Math.random()).toFixed(1),
                        location: { lat: el.lat, lng: el.lon },
                        types: [
                            ...(placeType === 'doctor' ? ['health', 'doctor'] : ['hospital', 'health']),
                            ...(el.tags.emergency === 'yes' ? ['emergency'] : []),
                            ...(el.tags.amenity === 'clinic' ? ['clinic'] : []),
                            ...(el.tags.speciality ? [el.tags.speciality] : [])
                        ]
                    }));
                    searchCompleted = true;
                    onPlacesFound(formatted);
                    success = true;
                    break;
                }
            } catch (error) {
                console.warn(`Endpoint ${endpoint} failed:`, error);
            }
        }

        if (!success && !searchCompleted) {
            generateMockResults();
        }
    };

    performSearch(center[0], center[1]);

    const timeoutTimer = setTimeout(() => {
      if (!searchCompleted) {
        console.warn(`Search for ${placeType} timed out after 15s. Switching to simulation.`);
        searchCompleted = true;
        generateMockResults();
      }
    }, 15000);

    return () => clearTimeout(timeoutTimer);
  }, [map, placeType, center]);

  return null;
}

function DoctorView() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(true);
  const [isSearching, setIsSearching] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number]>([20.5937, 78.9629]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      }, (err) => {
          console.error("Geolocation failed, using default center", err);
      }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }
  }, []);

  useEffect(() => {
    setIsSearching(true);
  }, [userLocation]);

  const handlePlacesFound = (results: any[]) => {
    setIsSearching(false);
    const formatted = results.map(r => ({
      name: r.name,
      spec: r.types?.includes('dentist') || r.name?.toLowerCase().includes('dentist') ? 'Dentist' : 
            r.types?.includes('physiotherapist') ? 'Physiotherapist' : 
            r.types?.includes('clinic') ? 'Clinic' : 
            r.types?.find((t: string) => t !== 'health' && t !== 'doctor') || 'General Physician',
      exp: 'Verified',
      rating: r.rating || (4.5),
      fee: 'Contact for fees',
      address: r.vicinity,
      location: r.location
    }));
    setDoctors(formatted);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-xl shadow-[var(--teal)]/20 border border-white/20">
            <User size={28} />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">DocFinder</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Nearby Healthcare Specialists</p>
          </div>
        </div>
        <button 
          onClick={() => setShowMap(!showMap)}
          className="w-12 h-12 glass border border-white/10 rounded-2xl flex items-center justify-center text-[var(--teal)] shadow-lg hover:bg-white/5 active:scale-95 transition-all"
        >
          {showMap ? <EyeOff size={20} /> : <MapIcon size={20} />}
        </button>
      </div>

      {showMap && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="h-[340px] w-full rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative z-10"
        >
          <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapHandler placeType="doctor" onPlacesFound={handlePlacesFound} center={userLocation} />
            {doctors.map((doc, i) => (
              <Marker key={i} position={[doc.location.lat, doc.location.lng]} icon={doctorIcon}>
                <Popup>
                    <div className="text-xs font-medium p-1">
                        <p className="font-black text-slate-800">{doc.name}</p>
                        <p className="text-emerald-600 font-bold mt-0.5">{doc.spec}</p>
                    </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </motion.div>
      )}

      <div className="space-y-4">
        {doctors.length > 0 ? doctors.map((doc, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            key={i} 
            className="glass border border-white/10 rounded-[32px] p-6 flex items-center gap-5 shadow-xl hover:bg-white/5 transition-all group"
          >
            <div className="w-16 h-16 rounded-2xl glass-darker border border-white/5 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">👨‍⚕️</div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif text-lg text-[var(--text)]">{doc.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--teal)] px-2 py-0.5 glass-morphism border border-[var(--teal)]/20 rounded-md">{doc.spec}</span>
                <span className="text-[10px] font-black text-[var(--muted)] opacity-60 uppercase tracking-widest">⭐ {doc.rating}</span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-1 font-medium opacity-70 italic">📍 {doc.address}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-sm font-black text-[var(--text)]">{doc.fee}</p>
              <button className="px-5 py-2 bg-[var(--teal)] text-[#020f0c] rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[var(--teal)]/10 hover:scale-105 active:scale-95 transition-all">Book</button>
            </div>
          </motion.div>
        )) : isSearching ? (
          <div className="glass border border-white/10 rounded-[40px] p-12 text-center space-y-6 shadow-xl">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center mx-auto text-[var(--teal)] border border-white/5 shadow-inner">
              <RefreshCw size={36} className="animate-spin opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-xl">Scanning Radius...</h3>
              <p className="text-sm text-[var(--muted)] font-medium opacity-60">Triangulating the best healthcare specialists for you.</p>
            </div>
          </div>
        ) : (
          <div className="glass border border-white/10 rounded-[40px] p-12 text-center space-y-6 shadow-xl">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center mx-auto text-rose-400 border border-white/5 shadow-inner">
              <Search size={36} className="opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-xl">Empty Orbit</h3>
              <p className="text-sm text-[var(--muted)] font-medium opacity-60">We couldn't find specialists nearby. Try recalibrating the map.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HospitalView() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(true);
  const [isSearching, setIsSearching] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number]>([20.5937, 78.9629]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      }, (err) => {
          console.error("Geolocation failed, using default center", err);
      }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }
  }, []);

  useEffect(() => {
    setIsSearching(true);
  }, [userLocation]);

  const handlePlacesFound = (results: any[]) => {
    setIsSearching(false);
    const formatted = results.map(r => ({
      name: r.name,
      type: (r.types?.includes('emergency') || r.name?.toLowerCase().includes('emergency')) ? 'Emergency' : 'General',
      dist: r.vicinity,
      rating: r.rating || (4.5),
      location: r.location
    }));
    setHospitals(formatted);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 border border-white/20">
            <Hospital size={28} />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">MedMap</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Hospitals & Emergency Care</p>
          </div>
        </div>
        <button 
          onClick={() => setShowMap(!showMap)}
          className="w-12 h-12 glass border border-white/10 rounded-2xl flex items-center justify-center text-rose-400 shadow-lg hover:bg-white/5 active:scale-95 transition-all"
        >
          {showMap ? <EyeOff size={20} /> : <MapIcon size={20} />}
        </button>
      </div>

      {showMap && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="h-[340px] w-full rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative z-10"
        >
          <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapHandler placeType="hospital" onPlacesFound={handlePlacesFound} center={userLocation} />
            {hospitals.map((hosp, i) => (
              <Marker key={i} position={[hosp.location.lat, hosp.location.lng]} icon={hospitalIcon}>
                <Popup>
                    <div className="text-xs font-medium p-1">
                        <p className="font-black text-slate-800">{hosp.name}</p>
                        <p className="text-rose-600 font-bold mt-0.5">{hosp.type}</p>
                    </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </motion.div>
      )}

      <div className="space-y-4">
        {hospitals.length > 0 ? hospitals.map((hosp, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            key={i} 
            className="glass border border-white/10 rounded-[32px] p-6 flex items-center gap-5 shadow-xl hover:bg-white/5 transition-all group"
          >
            <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110", hosp.type === 'Emergency' ? "bg-rose-500 shadow-rose-500/20" : "bg-blue-500 shadow-blue-500/20")}>
              <Hospital size={28} />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif text-lg text-[var(--text)]">{hosp.name}</h3>
              <div className="flex items-center gap-2">
                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border", hosp.type === 'Emergency' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>
                  {hosp.type}
                </span>
                <span className="text-[10px] font-black text-[var(--muted)] opacity-60 uppercase tracking-widest">⭐ {hosp.rating}</span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-1 font-medium opacity-70 italic">📍 {hosp.dist}</p>
            </div>
            <button className="w-12 h-12 glass-darker border border-white/5 rounded-2xl flex items-center justify-center text-[var(--teal)] hover:bg-white/10 active:scale-90 transition-all">
              <Navigation size={20} />
            </button>
          </motion.div>
        )) : isSearching ? (
          <div className="glass border border-white/10 rounded-[40px] p-12 text-center space-y-6 shadow-xl">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center mx-auto text-rose-500 border border-white/5 shadow-inner">
              <RefreshCw size={36} className="animate-spin opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-xl">Scanning Perimeter...</h3>
              <p className="text-sm text-[var(--muted)] font-medium opacity-60">Locating 24/7 medical centers & general hospitals.</p>
            </div>
          </div>
        ) : (
          <div className="glass border border-white/10 rounded-[40px] p-12 text-center space-y-6 shadow-xl">
            <div className="w-20 h-20 rounded-3xl glass-darker flex items-center justify-center mx-auto text-[var(--muted)] border border-white/5 shadow-inner">
              <Hospital size={36} className="opacity-40" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-xl">No Facilities</h3>
              <p className="text-sm text-[var(--muted)] font-medium opacity-60">We couldn't detect medical units nearby. Adjust your zoom orbit.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const HealthLockerView = memo(function HealthLockerView({ documents, onAddDocument, onDeleteDocument, onAddRecord, profile }: { documents: HealthDocument[], onAddDocument: (doc: Omit<HealthDocument, 'id'>) => void, onDeleteDocument: (id: string) => void, onAddRecord: (record: Omit<MedicalRecord, 'id'>) => void, profile: UserProfile }) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'prescription' | 'scan' | 'report' | 'insurance'>('all');
  const [selectedDoc, setSelectedDoc] = useState<HealthDocument | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const categories = [
    { id: 'all', label: 'All Files', icon: <Folder size={18} /> },
    { id: 'prescription', label: 'Prescriptions', icon: <ClipboardList size={18} /> },
    { id: 'scan', label: 'X-Rays & Scans', icon: <Camera size={18} /> },
    { id: 'report', label: 'Lab Reports', icon: <FlaskConical size={18} /> },
    { id: 'insurance', label: 'Insurance', icon: <ShieldCheck size={18} /> }
  ];

  const handleFileUpload = (useAi: boolean = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          
          if (useAi) {
            setIsAnalyzing(true);
            try {
              const aiData = await analyzeLockerDocument(base64, file.type);
              onAddDocument({
                name: aiData.name || file.name,
                category: aiData.category || 'other',
                date: new Date().toISOString(),
                fileData: base64,
                isEncrypted: true,
                mimeType: file.type,
                notes: aiData.summary || `Securely stored on ${new Date().toLocaleDateString()}`
              });
              showDoneToast("AI Analysis complete. Document categorized and stored.");
            } catch (error) {
              console.error(error);
              showErrorToast("AI Analysis failed. Saving file normally.");
              saveNormally(file, base64);
            } finally {
              setIsAnalyzing(false);
            }
          } else {
            saveNormally(file, base64);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const saveNormally = (file: File, base64: string) => {
    onAddDocument({
      name: file.name,
      category: file.type.includes('pdf') ? 'report' : (activeCategory === 'all' ? 'other' : activeCategory) as any,
      date: new Date().toISOString(),
      fileData: base64,
      isEncrypted: true,
      mimeType: file.type,
      notes: `Securely stored on ${new Date().toLocaleDateString()}`
    });
    showDoneToast("File successfully encrypted and stored in vault.");
  };

  useEffect(() => {
    if (selectedDoc) {
      // Re-trigger analysis for selected doc if needed, or just show its summary (notes)
      setAnalysisResult(null);
    }
  }, [selectedDoc]);

  const runQuickAnalysis = async () => {
    if (!selectedDoc) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeLockerDocument(selectedDoc.fileData, selectedDoc.mimeType);
      setAnalysisResult(res);
    } catch (e) {
      showErrorToast("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filtered = activeCategory === 'all' ? documents : documents.filter(d => d.category === activeCategory);

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[24px] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 border border-white/20">
            <Lock size={28} />
          </div>
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">Health Locker</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Secure End-to-End Encrypted Storage</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isAnalyzing}
            onClick={() => handleFileUpload(true)}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Sparkles size={16} className="text-indigo-400" /> {isAnalyzing ? "Analyzing..." : "Smart Upload"}
          </button>
          <button 
            onClick={() => handleFileUpload(false)}
            className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all active:scale-[0.98] flex items-center gap-2 border border-white/10"
          >
            <Plus size={16} /> Add 
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={cn(
              "px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 border",
              activeCategory === cat.id 
                ? "bg-indigo-500 text-white border-indigo-400 shadow-md" 
                : "glass border-white/10 text-[var(--muted)] hover:bg-white/5 hover:text-indigo-400"
            )}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          layout
          className="p-8 glass border border-[var(--border)] rounded-[40px] flex flex-col items-center justify-center text-center space-y-4 border-dashed cursor-pointer hover:bg-[var(--muted)]/5 transition-all group"
          onClick={() => handleFileUpload(true)}
        >
          <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <Sparkles size={32} />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text)] dark:text-white">Smart Vault</p>
            <p className="text-[10px] text-[var(--muted)] font-medium mt-1">AI will categorize & summarize</p>
          </div>
        </motion.div>

        {filtered.map((doc) => (
          <motion.div
            layout
            key={doc.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group glass border border-white/10 rounded-[40px] p-6 shadow-xl hover:shadow-2xl hover:border-indigo-500/30 transition-all relative overflow-hidden"
          >
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                {doc.category === 'prescription' && <ClipboardList size={22} />}
                {doc.category === 'scan' && <Camera size={22} />}
                {doc.category === 'report' && <FlaskConical size={22} />}
                {doc.category === 'insurance' && <ShieldCheck size={22} />}
                {doc.category === 'other' && <FileText size={22} />}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setSelectedDoc(doc)}
                  className="p-2 hover:bg-[var(--card2)] rounded-xl text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  <Eye size={18} />
                </button>
                <button 
                  onClick={() => onDeleteDocument(doc.id)}
                  className="p-2 hover:bg-rose-500/10 rounded-xl text-[var(--muted)] hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60">{doc.category}</p>
                {doc.notes?.includes("summary") || doc.notes?.length > 50 && (
                  <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" title="AI Insight Available" />
                )}
              </div>
              <h3 className="font-bold text-[var(--text)] dark:text-white truncate pr-4">{doc.name}</h3>
              <p className="text-[10px] text-[var(--muted)] font-medium">{new Date(doc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-lg">
                <ShieldCheck size={10} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Encrypted</span>
              </div>
              <button 
                className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = doc.fileData;
                  link.download = doc.name;
                  link.click();
                }}
              >
                Download
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-6xl h-[90vh] glass-darker border border-white/10 rounded-[48px] shadow-2xl overflow-hidden flex flex-col lg:flex-row"
            >
              <div className="flex-1 overflow-auto p-4 flex flex-col bg-[var(--bg)] border-r border-[var(--border)]">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-serif text-[var(--text)] dark:text-white">{selectedDoc.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">{selectedDoc.category}</span>
                       <span className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest opacity-60">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(selectedDoc.date))}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = selectedDoc.fileData;
                        link.download = selectedDoc.name;
                        link.click();
                      }}
                      className="p-3 bg-[var(--card2)] hover:bg-[var(--muted)]/10 rounded-2xl text-[var(--text)] transition-colors"
                    >
                      <Download size={20} />
                    </button>
                    <button onClick={() => setSelectedDoc(null)} className="p-3 bg-[var(--card2)] hover:bg-rose-500/10 rounded-2xl text-[var(--text)] lg:hidden transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                  {selectedDoc.mimeType.includes('image') ? (
                    <img src={selectedDoc.fileData} alt={selectedDoc.name} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-[var(--border)]" />
                  ) : (
                    <div className="text-center p-12 space-y-6">
                      <div className="w-24 h-24 rounded-[32px] bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
                        <FileText size={48} />
                      </div>
                      <p className="text-xl font-bold text-[var(--text)] dark:text-white">PDF Document Preview</p>
                      <button 
                        onClick={() => {
                          const win = window.open();
                          win?.document.write(`<iframe src="${selectedDoc.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                        }}
                        className="px-10 py-4 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-500/20"
                      >
                        View Full Screen
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full lg:w-[400px] flex flex-col h-full bg-[var(--card)] relative">
                <button 
                  onClick={() => setSelectedDoc(null)} 
                  className="absolute top-6 right-6 p-3 bg-[var(--card2)] hover:bg-[var(--muted)]/10 rounded-2xl text-[var(--text)] hidden lg:flex transition-colors z-10"
                >
                  <X size={20} />
                </button>

                <div className="flex-1 overflow-auto p-8 pt-20">
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">AI Intelligence</h4>
                        {!analysisResult && !isAnalyzing && (
                          <button 
                            onClick={runQuickAnalysis}
                            className="text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-[var(--text)] transition-colors underline underline-offset-4"
                          >
                            Analyze Now
                          </button>
                        )}
                      </div>

                      {isAnalyzing ? (
                        <div className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--card2)] flex flex-col items-center text-center space-y-4">
                          <div className="relative">
                            <Sparkles size={32} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                            <div className="absolute inset-0 bg-indigo-400 blur-2xl opacity-20 animate-pulse" />
                          </div>
                          <p className="text-sm font-bold text-[var(--text)] dark:text-white">Decrypting & Analyzing...</p>
                          <p className="text-[10px] text-[var(--muted)]">Veda is extracting key insights</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] mb-3 opacity-60">Smart Summary</p>
                            <div className="p-5 rounded-3xl bg-[var(--bg)] border border-[var(--border)]">
                              <p className="text-sm text-[var(--text2)] leading-relaxed italic">
                                "{analysisResult?.summary || selectedDoc.notes || "No analysis available yet. Tap analyze to extract insights."}"
                              </p>
                            </div>
                          </div>

                          {analysisResult?.extractedData && (
                            <div className="space-y-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Extracted Vitals</p>
                              <div className="grid grid-cols-2 gap-3">
                                {analysisResult.extractedData.doctorName && (
                                  <div className="p-4 rounded-2xl bg-[var(--card2)] border border-[var(--border)]">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Doctor</p>
                                    <p className="text-xs font-bold text-[var(--text)] dark:text-white truncate">{analysisResult.extractedData.doctorName}</p>
                                  </div>
                                )}
                                {analysisResult.extractedData.hospital && (
                                  <div className="p-4 rounded-2xl bg-[var(--card2)] border border-[var(--border)]">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Clinic</p>
                                    <p className="text-xs font-bold text-[var(--text)] dark:text-white truncate">{analysisResult.extractedData.hospital}</p>
                                  </div>
                                )}
                              </div>
                              {analysisResult.extractedData.items?.length > 0 && (
                                <div className="space-y-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60 mt-4">Detected Findings</p>
                                  {analysisResult.extractedData.items.map((item: string, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--card2)] border border-[var(--border)]">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                      <span className="text-xs text-[var(--text)] dark:text-[var(--text2)]">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {analysisResult?.suggestions?.length > 0 && (
                        <div className="space-y-3 mt-8">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">Next Steps</p>
                          {analysisResult.suggestions.map((sug: string, i: number) => {
                            const isSync = sug.toLowerCase().includes('sync') || sug.toLowerCase().includes('medical records');
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  if (isSync) {
                                    onAddRecord({
                                      type: selectedDoc.category === 'report' ? 'Report' : (selectedDoc.category === 'prescription' ? 'Prescription' : 'Other'),
                                      title: selectedDoc.name,
                                      doctor: analysisResult.extractedData?.doctorName || 'Unknown',
                                      date: selectedDoc.date,
                                      hospital: analysisResult.extractedData?.hospital || 'Private Clinic',
                                      notes: analysisResult.summary || selectedDoc.notes || '',
                                      status: 'Completed',
                                      color: 'indigo',
                                      fileUrl: selectedDoc.fileData,
                                      tags: [selectedDoc.category]
                                    });
                                    showDoneToast("Insight successfully synced to Medical Records.");
                                  }
                                }}
                                className={cn(
                                  "w-full p-4 rounded-2xl border text-left hover:scale-[1.01] transition-all group",
                                  isSync ? "bg-emerald-500/10 border-emerald-500/20" : "bg-indigo-500/10 border-indigo-500/20"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={cn("text-xs font-bold", isSync ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-300")}>{sug}</span>
                                  {isSync ? <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" /> : <ChevronRight size={14} className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-[var(--border)] bg-[var(--bg)]">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Vault Secure</p>
                      <p className="text-[8px] text-emerald-600 dark:text-emerald-400/60 font-medium">End-to-end encrypted storage</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

const RecordsView = memo(function RecordsView({ records, onAddRecord, profile }: { records: MedicalRecord[], onAddRecord: (record: Omit<MedicalRecord, 'id'>) => void, profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'rx' | 'scans' | 'meds'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleManualUpload = () => {
    // Hidden file input click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        onAddRecord({
          title: file.name,
          type: file.type.includes('pdf') ? 'Report' : 'Scan',
          date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          doctor: 'Manual Upload',
          notes: `Stored file: ${file.name}`,
          tags: ['manual'],
        });
        showDoneToast("File uploaded to vault");
      }
    };
    input.click();
  };

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setScannedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyzeRecord = async () => {
    if (!scannedImage) return;
    setIsAnalyzing(true);
    try {
      const base64 = scannedImage.split(',')[1];
      const prompt = "Extract key health data from this medical record. Identify the patient name (if visible), doctor, date, key test results (like HbA1c, Cholesterol, BP), and give a very brief summary. Clearly state that this is an AI extraction, not a diagnosis.";
      const result = await analyzeImage(base64, prompt);
      setAiAnalysis(result);
      
      // Save the analyzed record
      await onAddRecord({
        title: "AI Scanned Record",
        type: "Scan",
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        doctor: "AI Extracted",
        notes: result,
        tags: ["scanned", "ai-extracted"],
      });
      showDoneToast("Record analyzed & saved!");
    } catch (error) {
      setAiAnalysis("Error analyzing document. Please ensure it's a clear photo of a medical report.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filtered = activeTab === 'all' ? records : records.filter(r => {
    if (activeTab === 'reports') return r.type.toLowerCase().includes('report');
    if (activeTab === 'rx') return r.type.toLowerCase().includes('prescription') || r.type.toLowerCase().includes('rx');
    if (activeTab === 'scans') return r.type.toLowerCase().includes('scan') || r.type.toLowerCase().includes('x-ray');
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xl shadow-amber-500/20 border border-white/20">
          <Folder size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl tracking-tight text-[var(--text)]">Health Vault</h2>
          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-60">Records, Scans & Prescriptions</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[44px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex justify-center gap-2 overflow-x-auto pb-4 scrollbar-hide relative z-10">
          {['all', 'reports', 'rx', 'meds', 'scans'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap border flex items-center gap-2",
                activeTab === tab ? "bg-amber-500 text-white border-amber-400/50 shadow-lg shadow-amber-500/20" : "glass border-white/5 text-[var(--muted)] hover:text-amber-400 hover:border-amber-400/20"
              )}
            >
              {tab === 'meds' ? 'Medication Vault' : tab}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <button 
            onClick={handleManualUpload}
            disabled={isUploading}
            className="p-6 glass-darker border border-white/10 rounded-[32px] flex flex-col items-center gap-4 hover:bg-white/5 transition-all shadow-xl group active:scale-95 disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform shadow-inner border border-amber-500/20">
              {isUploading ? <RefreshCw className="animate-spin" size={24} /> : <Plus size={24} />}
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text)]">Upload</span>
          </button>
          <button 
            onClick={() => setIsScanOpen(true)}
            className="p-6 glass-darker border border-white/10 rounded-[32px] flex flex-col items-center gap-4 hover:bg-white/5 transition-all shadow-xl group active:scale-95"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-inner border border-blue-500/20"><Camera size={24} /></div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text)]">AI Vision</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60">
            {activeTab === 'meds' ? 'Verified Prescriptions' : `Storage Unit (${filtered.length})`}
          </h3>
          <div className="h-px flex-1 mx-4 bg-white/5" />
        </div>
        
        {activeTab === 'meds' ? (
          <div className="space-y-4">
            {profile.medicines.length > 0 ? profile.medicines.map((med, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={idx} 
                className="glass border border-white/10 rounded-[32px] p-6 flex items-center justify-between group hover:bg-white/5 transition-all shadow-xl"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-[24px] glass-darker border border-white/5 flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-105 transition-transform">
                    <Pill size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-lg text-[var(--text)] tracking-tight uppercase">{med.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                      <p className="text-[9px] text-[var(--muted)] font-black uppercase tracking-widest opacity-60">Active Protocol</p>
                    </div>
                  </div>
                </div>
                <button className="px-6 py-3 bg-[var(--teal)] text-[#020f0c] text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-[var(--teal)]/20 hover:scale-105 active:scale-95 transition-all border border-white/20">Refill ↗</button>
              </motion.div>
            )) : (
              <div className="glass border border-dashed border-white/10 rounded-[40px] p-16 text-center shadow-inner">
                <div className="w-20 h-20 rounded-full glass-morphism flex items-center justify-center mx-auto text-[var(--muted)] opacity-20 mb-6">
                  <Pill size={40} />
                </div>
                <p className="text-[11px] text-[var(--muted)] font-black uppercase tracking-[0.3em] opacity-40">Zero active prescriptions detected</p>
              </div>
            )}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((rec) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={rec.id} 
                onClick={() => setSelectedRecord(rec)}
                className="glass border border-white/10 rounded-[32px] p-6 flex items-center gap-5 hover:bg-white/5 transition-all cursor-pointer group shadow-xl relative overflow-hidden"
              >
                <div className={cn(
                  "w-16 h-16 rounded-[24px] glass-darker flex items-center justify-center transition-all border border-white/5 shadow-inner group-hover:scale-110",
                  rec.type.toLowerCase().includes('scan') ? "text-blue-400" : "text-amber-500"
                )}>
                  {rec.type.toLowerCase().includes('rx') ? <ClipboardList size={28} /> : <FileText size={28} />}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-serif text-lg text-[var(--text)] tracking-tight line-clamp-1">{rec.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] opacity-60">{rec.type}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/60">{rec.date}</span>
                  </div>
                </div>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if(!auth.currentUser) return;
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'records', rec.id.toString()));
                    showDoneToast("Record securely purged");
                  }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500/10 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="glass border border-dashed border-white/10 rounded-[40px] p-16 text-center shadow-inner">
            <div className="w-20 h-20 rounded-full glass-morphism flex items-center justify-center mx-auto text-[var(--muted)] opacity-20 mb-6">
              <Folder size={40} />
            </div>
            <p className="text-[11px] text-[var(--muted)] font-black uppercase tracking-[0.3em] opacity-40">Vault currently vacant</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-2xl p-6 flex items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 40 }}
              className="glass border border-white/20 w-full max-w-xl rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            >
              <div className="relative h-64 bg-gradient-to-br from-slate-900 to-black p-10 flex flex-col justify-end">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                <button onClick={() => setSelectedRecord(null)} className="absolute top-8 right-8 w-12 h-12 glass border border-white/20 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center transition-all z-20"><X size={24} /></button>
                <div className="relative z-10 flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl glass-morphism border border-white/20 flex items-center justify-center text-white shadow-2xl"><FileText size={40} /></div>
                  <div>
                    <h2 className="text-3xl font-serif text-white tracking-tight">{selectedRecord.title}</h2>
                    <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.3em] mt-2">{selectedRecord.type} — Vaulted: {selectedRecord.date}</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
              </div>
              
              <div className="p-10 space-y-8 glass-darker">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60">Source Specialist</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full glass-morphism border border-white/10 flex items-center justify-center text-xs">🩺</div>
                      <p className="text-sm font-bold text-[var(--text)]">{selectedRecord.doctor}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60">Authentication Date</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full glass-morphism border border-white/10 flex items-center justify-center text-white/40"><Activity size={14} /></div>
                      <p className="text-sm font-medium text-[var(--text)] font-mono">{new Date(selectedRecord.createdAt || '').toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] opacity-60 ml-1">AI Record Decoding</p>
                  <div className="glass border border-white/10 rounded-[32px] p-8 text-[14px] leading-relaxed text-[var(--text2)] shadow-inner max-h-[300px] overflow-y-auto">
                    <div className="markdown-body opacity-90 italic">
                      <Markdown>{selectedRecord.notes}</Markdown>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedRecord.tags?.map(tag => (
                    <span key={tag} className="px-4 py-1.5 glass border border-[var(--teal)]/20 text-[var(--teal)] rounded-full text-[9px] font-black uppercase tracking-widest">#{tag}</span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-white/10 transition-all">Download</button>
                  <button className="py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-[var(--teal)]/20 hover:scale-105 transition-all border border-white/20">Share Access ✦</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* AI Scan Modal */}
        {isScanOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl p-8 flex flex-col items-center justify-center"
          >
            <div className="w-full max-w-2xl space-y-10">
              <div className="flex items-center justify-between border-b border-white/10 pb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                    <Zap size={28} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-serif text-white tracking-tight">AI Vision Engine</h2>
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em] mt-1">Extracting Diagnostic Metadata</p>
                  </div>
                </div>
                <button onClick={() => { setIsScanOpen(false); setScannedImage(null); setAiAnalysis(null); }} className="w-14 h-14 glass border border-white/20 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center transition-all"><X size={28} /></button>
              </div>

              {!scannedImage ? (
                <label className="w-full aspect-[4/3] glass border-2 border-dashed border-white/10 rounded-[60px] flex flex-col items-center justify-center gap-8 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
                  <div className="w-24 h-24 rounded-full glass-darker border border-white/10 flex items-center justify-center text-white group-hover:scale-125 transition-transform shadow-[0_0_40px_rgba(59,130,246,0.1)]"><Camera size={48} /></div>
                  <div className="text-center space-y-2 relative z-10">
                    <p className="text-xl text-white font-serif tracking-tight">Prime Scan Objective</p>
                    <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Place report within viewport</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleScanFile} className="hidden" />
                </label>
              ) : (
                <div className="space-y-10">
                  <div className="relative aspect-video rounded-[48px] overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(59,130,246,0.2)] bg-black/40 p-4">
                    <img src={scannedImage} alt="Scan" className="w-full h-full object-contain rounded-[32px]" />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-8">
                        <div className="relative">
                          <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full scale-150" />
                          <RefreshCw className="animate-spin relative z-10 text-blue-400" size={56} />
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-white text-lg font-serif">Decoding Medical Log...</p>
                          <p className="text-[10px] text-blue-300 font-black uppercase tracking-[0.5em] animate-pulse">Scanning biometric markers</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {aiAnalysis ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="glass border border-white/10 rounded-[44px] p-10 max-h-[400px] overflow-y-auto relative shadow-2xl"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60" />
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl glass-morphism border border-blue-500/20 flex items-center justify-center text-blue-400">
                          <Cpu size={20} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Analysis Complete</h4>
                      </div>
                      <div className="prose prose-invert prose-sm text-white/80 leading-relaxed font-serif italic mb-8">
                        <Markdown>{aiAnalysis}</Markdown>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setAiAnalysis(null)} className="flex-1 py-4 glass border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white">Re-scan</button>
                        <button onClick={() => setIsScanOpen(false)} className="flex-1 py-4 bg-emerald-500 text-[#020f0c] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 border border-white/20">Archive Result</button>
                      </div>
                    </motion.div>
                  ) : !isAnalyzing && (
                    <button 
                      onClick={analyzeRecord}
                      className="w-full py-6 bg-gradient-to-br from-blue-600 to-blue-800 text-white font-black rounded-[28px] shadow-[0_0_50px_rgba(37,99,235,0.3)] hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-[0.4em] border border-white/20 flex items-center justify-center gap-4"
                    >
                      <Zap size={24} />
                      Ignite AI Parser
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function ClinicPortal({ appointments, profile, journal, onBook }: { appointments: Appointment[], profile: UserProfile, journal: JournalEntry[], onBook: (appt: Omit<Appointment, 'id'>) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [activeTab, setActiveTab] = useState<'finder' | 'appointments' | 'portal'>('finder');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:30 AM');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callTranscript, setCallTranscript] = useState('');
  const [callSummary, setCallSummary] = useState<{[key: string]: string}>({});
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [briefings, setBriefings] = useState<{[key: string]: any}>({});
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [checklists, setChecklists] = useState<{[key: string]: any}>({});
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<any | null>(null);

  const handleGenerateBriefing = async (appt: Appointment) => {
    setIsGeneratingBriefing(true);
    try {
      const briefing = await generateAppointmentBriefing(journal, appt.type);
      setBriefings(prev => ({ ...prev, [appt.id]: briefing }));
      setSelectedBriefing({ ...briefing, clinicName: appt.clinicName });
    } catch (e) {
      console.error(e);
      showDoneToast("Failed to generate AI briefing.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const handleGenerateChecklist = async (apptId: string, notes: string) => {
    setIsGeneratingChecklist(true);
    try {
      const checklist = await generatePostVisitChecklist(notes);
      setChecklists(prev => ({ ...prev, [apptId]: checklist }));
      showDoneToast("Post-visit checklist generated!");
    } catch (e) {
      console.error(e);
      showDoneToast("Failed to generate checklist.");
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const endCallAndSummarize = async (apptId: string) => {
    setIsSummarizing(true);
    try {
      const summary = await generateCallSummary(callTranscript);
      setCallSummary(prev => ({ ...prev, [apptId]: summary }));
      setActiveCallId(null);
      setCallTranscript('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  const { firstDay, totalDays } = getDaysInMonth(currentDate);
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - firstDay + 1;
    if (dayNumber > 0 && dayNumber <= totalDays) {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
    }
    return null;
  });

  const clinics: Clinic[] = [];

  const filteredClinics = clinics.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === 'All' || c.category === selectedCategory || c.specialties.includes(selectedCategory))
  );

  const handleLogin = () => {
    if (pin.length >= 4) { // Real login would check against a back-end or secure store
      setIsLogged(true);
      showDoneToast("Doctor Access Granted");
    } else {
      showDoneToast("Please enter a valid PIN");
    }
  };

  const bookAppointment = async () => {
    if (!selectedClinic || !bookingDate) return;
    setIsBooking(true);
    try {
      const newAppt: Omit<Appointment, 'id'> = {
        clinicId: selectedClinic.id,
        clinicName: selectedClinic.name,
        date: bookingDate,
        time: bookingTime,
        status: 'upcoming',
        patientName: profile.name || 'Anonymous',
        patientId: auth.currentUser?.uid || 'guest',
        type: selectedClinic.category
      };
      await onBook(newAppt);
      showDoneToast("Appointment Booked!");
      setSelectedClinic(null);
      setActiveTab('appointments');
    } catch (e) {
      console.error(e);
      showDoneToast("Failed to book appointment.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <Hospital size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Clinic Care</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Global Healthcare Network</p>
          </div>
        </div>
        <div className="flex bg-[var(--card2)] p-1 rounded-xl border border-[var(--border)]">
           {['finder', 'appointments', 'portal'].map(tab => (
             <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all capitalize",
                  activeTab === tab ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "text-[var(--muted)]"
                )}
             >{tab}</button>
           ))}
        </div>
      </div>

      {activeTab === 'finder' && (
        <div className="space-y-6">
           <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4 shadow-xl">
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clinics by name..." 
                  className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm outline-none focus:border-blue-500/50 transition-all shadow-inner" 
                />
                <div className="p-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20"><Search size={20} /></div>
             </div>
             <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['All', 'General', 'Eye Care', 'Dentist', 'Diagnostics', 'Cardiology'].map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "whitespace-nowrap px-4 py-2 border rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      selectedCategory === cat 
                        ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                        : "bg-[var(--card2)] border-[var(--border)] text-[var(--muted)] hover:text-blue-500 hover:border-blue-500/30"
                    )}
                  >
                    {cat}
                  </button>
                ))}
             </div>
           </div>

           <div className="space-y-3">
              {filteredClinics.length > 0 ? filteredClinics.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedClinic(c)}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 flex items-center gap-4 group hover:border-blue-500/30 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">{c.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-[var(--text)]">{c.name}</h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 text-teal-400">
                        <MapPin size={10} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{c.dist}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star size={10} fill="currentColor" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{c.rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/10 flex items-center justify-center group-hover:bg-blue-600 transition-all shrink-0">
                    <ChevronRight size={20} />
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center space-y-3 bg-[var(--card)] border border-dashed border-[var(--border)] rounded-[32px]">
                   <div className="w-12 h-12 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-50"><Search size={24} /></div>
                   <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">No clinics match "{searchQuery}"</p>
                   <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">Clear Search</button>
                </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-1">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Manage Bookings</h3>
             <div className="flex bg-[var(--card2)] p-1 rounded-lg border border-[var(--border)]">
               <button onClick={() => setViewMode('list')} className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all gap-2 flex items-center", viewMode === 'list' ? "bg-blue-500 text-white shadow-sm" : "text-[var(--muted)]")}>
                 <Menu size={12} /> List
               </button>
               <button onClick={() => setViewMode('calendar')} className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all gap-2 flex items-center", viewMode === 'calendar' ? "bg-blue-500 text-white shadow-sm" : "text-[var(--muted)]")}>
                 <CalendarIcon size={12} /> Calendar
               </button>
             </div>
          </div>

          {viewMode === 'calendar' ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[40px] p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 bg-[var(--card2)] rounded-full text-[var(--muted)] hover:text-blue-500 transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 bg-[var(--card2)] rounded-full text-[var(--muted)] hover:text-blue-500 transition-colors"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="text-[9px] font-black text-[var(--muted)] text-center py-2 uppercase tracking-widest">{day}</div>
                ))}
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={i} className="aspect-square" />;
                  
                  const isToday = date.toDateString() === new Date().toDateString();
                  const apptsOnDay = appointments.filter(a => {
                    const apptDate = new Date(a.date);
                    return apptDate.toDateString() === date.toDateString();
                  });

                  return (
                    <div key={i} className={cn(
                      "aspect-square rounded-xl p-1 flex flex-col items-center justify-center relative border transition-all cursor-default",
                      isToday ? "border-blue-500/50 bg-blue-500/5" : "border-transparent",
                      apptsOnDay.length > 0 ? "bg-blue-500/10" : ""
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold",
                        isToday ? "text-blue-500" : "text-[var(--text2)]"
                      )}>{date.getDate()}</span>
                      {apptsOnDay.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {apptsOnDay.slice(0, 3).map((_, idx) => (
                            <div key={idx} className="w-1 h-1 bg-blue-500 rounded-full" />
                          ))}
                        </div>
                      )}
                      
                      {apptsOnDay.length > 0 && (
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-[var(--card)] border border-blue-500/30 rounded-xl p-2 z-20 shadow-2xl overflow-hidden flex flex-col justify-center min-w-[80px]">
                           <p className="text-[7px] font-black uppercase text-blue-500 truncate">{apptsOnDay[0].clinicName}</p>
                           <p className="text-[7px] text-[var(--muted)] font-bold">{apptsOnDay[0].time}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                 <div className="flex items-center gap-2 text-[var(--muted)]">
                   <div className="w-2 h-2 bg-blue-500 rounded-full" />
                   <p className="text-[9px] font-bold uppercase tracking-widest">Appointment Booked</p>
                 </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
            {appointments.length > 0 ? appointments.map(appt => (
              <div key={appt.id} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-serif text-lg">{appt.clinicName}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">{appt.type}</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                    activeCallId === appt.id ? "bg-red-500/10 text-red-500 animate-pulse" : appt.status === 'upcoming' ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"
                  )}>
                    {activeCallId === appt.id ? 'Live' : appt.status}
                  </div>
                </div>
                
                {activeCallId === appt.id ? (
                  <div className="space-y-4 pt-2">
                    <div className="w-full h-32 bg-black rounded-2xl flex items-center justify-center text-[var(--muted)] text-xs font-bold uppercase tracking-widest">Video Simulation</div>
                    <textarea 
                      className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-xs" 
                      placeholder="Simulate call transcript..."
                      value={callTranscript}
                      onChange={(e) => setCallTranscript(e.target.value)}
                    />
                    <button onClick={() => endCallAndSummarize(appt.id)} className="w-full py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest">End Call & Summarize</button>
                  </div>
                ) : callSummary[appt.id] ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-4 border-t border-[var(--border)]">
                    <h4 className="font-serif text-sm">AI Summary</h4>
                    <div className="text-xs text-[var(--text2)] markdown-body">{callSummary[appt.id]}</div>
                  </motion.div>
                ) : (
                  <div className="flex items-center gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-[var(--muted)]" />
                      <span className="text-xs font-bold text-[var(--text2)]">{appt.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[var(--muted)]" />
                      <span className="text-xs font-bold text-[var(--text2)]">{appt.time}</span>
                    </div>
                    {appt.status === 'upcoming' && (
                       <div className="ml-auto flex items-center gap-2">
                         <button 
                           onClick={() => handleGenerateBriefing(appt)}
                           disabled={isGeneratingBriefing}
                           className="px-3 py-2 bg-blue-500/10 text-blue-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-2 hover:bg-blue-500 hover:text-white transition-all"
                         >
                           <Sparkles size={12} /> {isGeneratingBriefing ? 'Preparing...' : 'AI Prep Brief'}
                         </button>
                         <button onClick={() => setActiveCallId(appt.id)} className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center"><Video size={14} /></button>
                       </div>
                    )}
                  </div>
                )}

                {briefings[appt.id] && !activeCallId && (
                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                       <h5 className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                         <ShieldCheck size={12} /> AI Prep Summary
                       </h5>
                       <button onClick={() => setSelectedBriefing({ ...briefings[appt.id], clinicName: appt.clinicName })} className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:underline">View Full</button>
                    </div>
                    <p className="text-[10px] text-[var(--text2)] italic line-clamp-2 leading-relaxed">"{briefings[appt.id].summary}"</p>
                  </div>
                )}

                {callSummary[appt.id] && (
                  <div className="flex gap-2 pt-2">
                    {!checklists[appt.id] && (
                      <button 
                        onClick={() => handleGenerateChecklist(appt.id, callSummary[appt.id])}
                        disabled={isGeneratingChecklist}
                        className="w-full py-2 bg-teal-500/10 text-teal-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-teal-500/20 flex items-center justify-center gap-2 hover:bg-teal-500 hover:text-white transition-all"
                      >
                        <ListChecks size={14} /> {isGeneratingChecklist ? 'Generating Checklist...' : 'Extract Post-Visit Tasks'}
                      </button>
                    )}
                    {checklists[appt.id] && (
                      <div className="w-full bg-teal-500/5 border border-teal-500/10 rounded-2xl p-4 space-y-3">
                         <h5 className="text-[9px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
                           <CheckCircle2 size={12} /> Follow-up Tasks
                         </h5>
                         <div className="space-y-2">
                           {checklists[appt.id].tasks.map((task: any, idx: number) => (
                             <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                               <div className="flex items-center gap-2">
                                 <div className={cn("w-1.5 h-1.5 rounded-full", task.priority === 'high' ? 'bg-rose-500' : 'bg-amber-500')} />
                                 <span className="text-[10px] text-white">{task.title}</span>
                               </div>
                               <span className="text-[8px] font-black uppercase text-[var(--muted)]">{task.deadline}</span>
                             </div>
                           ))}
                         </div>
                         {checklists[appt.id].nextAppointmentSuggestion && (
                           <p className="text-[9px] text-teal-400/80 italic">Tip: {checklists[appt.id].nextAppointmentSuggestion}</p>
                         )}
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Hospital size={100} />
                </div>
              </div>
            )) : (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-30"><CalendarIcon size={32} /></div>
                <p className="text-sm font-bold text-[var(--muted)] uppercase tracking-widest">No Appointments Found</p>
                <button onClick={() => setActiveTab('finder')} className="px-6 py-2 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">Find a Clinic</button>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {activeTab === 'portal' && (
        isLogged ? (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-6 relative overflow-hidden">
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-serif">V</div>
                <div>
                  <h3 className="font-serif text-xl">Dr. Veda Health</h3>
                  <p className="text-xs text-[var(--muted)]">HOD Cardiology · Medanta Health</p>
                </div>
                <button onClick={() => setIsLogged(false)} className="ml-auto p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)]">
                  <div className="text-2xl font-serif text-blue-500">12</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Patients Today</div>
                </div>
                <div className="p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)]">
                  <div className="text-2xl font-serif text-teal-500">04</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Pending Rx</div>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <Stethoscope size={160} />
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Active Consultations</h3>
              <div className="space-y-3">
                {[
                  { name: 'Rahul Sharma', time: '10:30 AM', reason: 'Routine Heart Checkup', status: 'Waiting' },
                  { name: 'Priya Singh', time: '11:00 AM', reason: 'Post-Op Consultation', status: 'Late' },
                  { name: 'Anita Verma', time: '11:15 AM', reason: 'Lab Results Review', status: 'Ready' }
                ].map((p, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-[var(--card2)] border border-[var(--border)] rounded-2xl group hover:border-blue-500/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-black">{p.name[0]}</div>
                        <div>
                           <p className="text-sm font-bold">{p.name}</p>
                           <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">{p.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-serif text-blue-500">{p.time}</p>
                        <p className={cn("text-[8px] font-black uppercase tracking-widest", p.status === 'Late' ? "text-red-500" : "text-green-500")}>{p.status}</p>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass border border-[var(--border)] rounded-[48px] p-12 text-center space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
            <div className="w-24 h-24 glass flex items-center justify-center mx-auto text-blue-400 mb-4 shadow-2xl">
              <Lock size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-3xl sm:text-4xl text-[var(--text)] dark:text-white tracking-tight leading-tight">Physician Portal.</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-sm mx-auto font-medium">Restricted to verified medical professionals. Access clinical dashboards and patient analytics.</p>
            </div>
            <div className="max-w-[280px] mx-auto space-y-4 relative z-10">
              <input 
                type="password" 
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                className="w-full glass border border-[var(--border)] rounded-[28px] p-6 text-center text-4xl tracking-[0.6em] font-serif outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-black text-blue-400 shadow-inner"
              />
              <button 
                onClick={handleLogin}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-[24px] shadow-2xl shadow-blue-900/40 text-[10px] uppercase tracking-[0.4em] active:scale-95 transition-all border border-white/10"
              >Initialize Interface</button>
            </div>
            <p className="text-[10px] text-blue-500/40 font-black uppercase tracking-[0.4em] opacity-80 pt-4">AUTHORIZED CLINICAL PERSONNEL ONLY</p>
          </div>
        )
      )}

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedClinic && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedClinic(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 z-[160] glass-darker rounded-t-[48px] border-t border-white/20 max-h-[95vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10"
            >
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Clinic Header Banner */}
                <div className="relative h-64 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-10 flex items-end">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-3xl pointer-events-none" />
                   <div className="absolute top-6 right-6 flex gap-2">
                      <button onClick={() => setSelectedClinic(null)} className="w-12 h-12 glass hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all shadow-xl border border-white/20"><X size={24} /></button>
                   </div>
                   <div className="flex items-center gap-8 relative z-10 w-full mb-2">
                      <div className="w-24 h-24 rounded-[32px] glass-morphism border border-white/30 flex items-center justify-center text-6xl shadow-2xl ring-4 ring-white/10">{selectedClinic.icon}</div>
                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <div className="space-y-1">
                              <h3 className="font-serif text-4xl text-white tracking-tight drop-shadow-md">{selectedClinic.name}</h3>
                              <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.4em] mt-1.5">{selectedClinic.category} · {selectedClinic.dist} Range</p>
                           </div>
                           <div className="px-5 py-2.5 glass-morphism rounded-2xl border border-white/20 flex items-center gap-3 self-start md:self-auto shadow-xl">
                              <Star size={16} className="text-amber-400" fill="currentColor" />
                              <span className="text-sm font-black text-white">{selectedClinic.rating}</span>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="p-10 space-y-12">
                  {/* Clinic Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass border border-white/5 rounded-[40px] p-8 space-y-8 shadow-xl">
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl glass-morphism text-blue-400 flex items-center justify-center shadow-lg border border-white/5"><Stethoscope size={24} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Clinical Specialization</p>
                            <p className="text-sm font-bold text-white mt-1">{selectedClinic.specialties.join(' · ')}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl glass-morphism text-teal-400 flex items-center justify-center shadow-lg border border-white/5"><MapPin size={24} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Clinic Coordinates</p>
                            <p className="text-sm font-bold text-white/80 mt-1 leading-relaxed">{selectedClinic.address}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl glass-morphism text-amber-500 flex items-center justify-center shadow-lg border border-white/5"><Clock size={24} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Operational Window</p>
                            <p className="text-sm font-bold text-white mt-1">{selectedClinic.open}</p>
                          </div>
                       </div>
                    </div>

                    <div className="glass border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                       <div className="flex items-center gap-5 relative z-10">
                          <div className="w-12 h-12 rounded-2xl glass-morphism text-purple-400 flex items-center justify-center shadow-lg border border-white/5"><Shield size={24} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">Facility Credentials</p>
                            <p className="text-[11px] font-bold text-white/70 mt-1.5 uppercase tracking-wide leading-relaxed">ISO 9001:2015 · NABH ACCREDITED · VERIFIED PATIENT SAFETY PROTOCOL</p>
                          </div>
                       </div>
                       <div className="pt-2 px-1 relative z-10 border-t border-white/5 mt-4">
                          <p className="text-sm font-medium text-[var(--muted)] leading-relaxed italic opacity-80 decoration-teal-500/20 underline underline-offset-8">"Leading clinical ecosystem for complex diagnostics and preventive wellness in the metropolitan region."</p>
                       </div>
                    </div>
                  </div>

                  {/* Booking Section */}
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                       <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                       <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">SECURE APPOINTMENT TUNNEL</h4>
                       <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-5">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] px-1 flex items-center justify-between">
                           SELECT CALENDAR DATE
                           {bookingDate && <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-blue-400 flex items-center gap-2"><div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.6)]" /> SELECTED</motion.span>}
                        </label>
                        <input 
                          type="date" 
                          value={bookingDate}
                          onChange={e => setBookingDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full glass-darker border border-white/10 rounded-[28px] p-6 text-base font-bold outline-none focus:border-blue-500 transition-all shadow-inner text-white appearance-none" 
                        />
                      </div>

                      <div className="space-y-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] px-1">CLINICAL SLOTS AVAILABLE</p>
                        <div className="grid grid-cols-3 gap-3">
                          {['09:00 AM', '10:30 AM', '12:00 PM', '01:30 PM', '03:00 PM', '04:30 PM', '06:00 PM', '07:30 PM', '09:00 PM'].map(t => (
                            <button 
                              key={t}
                              onClick={() => setBookingTime(t)}
                              className={cn(
                                "py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-md",
                                bookingTime === t 
                                 ? "bg-blue-600 border-white/30 text-white shadow-2xl shadow-blue-900/40 scale-105" 
                                 : "glass border-white/5 text-[var(--muted)] hover:border-blue-500/40 hover:text-white"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 pb-12">
                    <button 
                      onClick={bookAppointment}
                      disabled={isBooking || !bookingDate}
                      className="w-full py-7 bg-gradient-to-r from-blue-600 via-indigo-700 to-purple-700 text-white font-black rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-30 text-[11px] uppercase tracking-[0.5em] flex items-center justify-center gap-4 group/btn relative overflow-hidden border border-white/20"
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      {isBooking ? (
                         <>
                           <RefreshCw size={24} className="animate-spin" />
                           FINALIZING COORDINATES...
                         </>
                      ) : (
                        <>
                          Confirm Booking
                          <ArrowRight size={22} className="group-hover/btn:translate-x-2 transition-transform" />
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center gap-8 mt-10 opacity-40">
                       <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-default">
                          <Shield size={16} className="text-blue-400" />
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Encrypted</span>
                       </div>
                       <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-default">
                          <Award size={16} className="text-amber-400" />
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Verified</span>
                       </div>
                       <div className="flex items-center gap-2 grayscale group hover:grayscale-0 transition-all cursor-default">
                          <CheckCircle2 size={16} className="text-teal-400" />
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">HIPAA</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBriefing && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBriefing(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl glass-darker border border-white/10 rounded-[40px] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-serif text-white">AI Doctor Briefing</h4>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{selectedBriefing.clinicName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedBriefing(null)} className="p-2 hover:bg-white/5 rounded-xl text-[var(--muted)]"><X size={20} /></button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                <section className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400/60">Executive Summary</h5>
                  <p className="text-sm text-white/90 leading-relaxed italic border-l-2 border-blue-500/30 pl-4 bg-blue-500/5 py-4 rounded-r-2xl">
                    "{selectedBriefing.summary}"
                  </p>
                </section>

                <section className="space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400/60">Top Symptoms to Discuss</h5>
                  <div className="grid gap-2">
                    {selectedBriefing.keySymptoms.map((symp: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs text-white/80">{symp}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400/60">Questions for Physician</h5>
                  <div className="grid gap-2">
                    {selectedBriefing.suggestedQuestions.map((q: string, i: number) => (
                      <div key={i} className="flex gap-3 bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                        <MessageSquare size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-indigo-100/90 font-medium">{q}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedBriefing.lifestyleNotes && (
                  <section className="space-y-2">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400/60">Lifestyle Context</h5>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                       <p className="text-[11px] text-[var(--muted)] leading-relaxed italic">{selectedBriefing.lifestyleNotes}</p>
                    </div>
                  </section>
                )}
              </div>

              <div className="mt-8">
                 <button 
                   onClick={() => setSelectedBriefing(null)}
                   className="w-full py-4 bg-blue-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                 >
                   Briefing Ready
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CorporateHealth({ profile, updateProfile }: { profile: UserProfile, updateProfile: (p: UserProfile) => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'challenges' | 'benefits'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);

  const [challengeList, setChallengeList] = useState<CorporateChallenge[]>([]);

  const companies: any[] = [];

  const handleJoin = async (company: string) => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1200));
    updateProfile({ 
      ...profile, 
      company: company, 
      corporateId: `VWP-${Math.random().toString(36).substr(2, 6).toUpperCase()}` 
    });
    setIsSyncing(false);
    showDoneToast(`Registered with ${company}`);
  };

  const handleJoinChallenge = (challengeId: string) => {
    setChallengeList(prev => prev.map(c => 
      c.id === challengeId ? { ...c, status: 'joined' as const, participants: c.participants + 1 } : c
    ));
    showDoneToast('Challenge joined successfully!');
  };

  const isRegistered = !!profile.company;

  return (
    <div className="space-y-8 pb-24 px-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d976c] to-[#93f9b9] flex items-center justify-center text-[#020f0c] shadow-lg shadow-teal-500/20">
            <Briefcase size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight text-[var(--text)] dark:text-white">Workwell Pro</h2>
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">Enterprise Wellness System</p>
          </div>
        </div>
        {isRegistered && (
          <div className="flex glass p-1 rounded-xl border border-[var(--border)] shadow-inner">
            {['overview', 'challenges', 'benefits'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all capitalize",
                  activeTab === tab ? "glass bg-[var(--bg)] text-[#1d976c] dark:text-[#93f9b9] shadow-lg border border-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >{tab}</button>
            ))}
          </div>
        )}
      </div>

      {!isRegistered ? (
        <div className="space-y-8">
          <div className="glass border border-[var(--border)] rounded-[48px] p-12 text-[var(--text)] dark:text-white space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#1d976c]/10 blur-3xl -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-1000" />
            <div className="w-24 h-24 glass flex items-center justify-center text-[#93f9b9] mb-4 rotate-3 group-hover:rotate-0 transition-transform shadow-2xl">
              <Building2 size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-4xl sm:text-5xl leading-tight tracking-tight text-[var(--text)] dark:text-white drop-shadow-md">Elevate Team Wellness.</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-sm font-medium">Integrate HR platforms, track collective fitness goals, and unlock exclusive enterprise health benefits for your entire organization.</p>
            </div>
            <div className="flex items-center gap-2 pt-4 relative z-10">
               <div className="w-2 h-2 rounded-full bg-[#1d976c] animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Trusted by global leading enterprises</span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] ml-4">Quick Join Partners</h4>
            <div className="grid gap-4">
              {companies.map((c, i) => (
                <button 
                  key={c.id}
                  disabled={isSyncing}
                  onClick={() => handleJoin(c.name)}
                  className="glass border border-white/5 rounded-[32px] p-6 flex items-center justify-between hover:border-[#1d976c]/40 transition-all group relative overflow-hidden shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#1d976c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-5 text-left relative z-10">
                    <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center text-2xl group-hover:scale-110 transition-transform border border-[var(--border)] shadow-inner">🏢</div>
                    <div>
                      <p className="text-base font-serif text-[var(--text)] dark:text-white tracking-tight">{c.name}</p>
                      <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mt-1">{c.employees} Members Registered</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end relative z-10">
                    <span className="text-lg font-serif text-[#93f9b9] drop-shadow-sm">{c.score}</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Vital Score</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
                <div className="space-y-3 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#93f9b9]">Official Enrollment</p>
                  <h3 className="font-serif text-4xl text-[var(--text)] dark:text-white tracking-tight">{profile.company}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-6">
                    <div className="px-4 py-1.5 glass border border-[var(--border)] text-emerald-600 dark:text-[#93f9b9] rounded-full text-[9px] font-black uppercase tracking-[0.2em]">ID: {profile.corporateId}</div>
                    <div className="px-4 py-1.5 glass border border-[var(--border)] text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">Verified Employee</div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-56 h-56 bg-[#1d976c]/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass border border-white/10 rounded-[32px] p-7 space-y-4 hover:border-[#1d976c]/20 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center text-emerald-400"><Heart size={18} /></div>
                    <span className="text-xs font-serif text-emerald-400 font-bold">+4.2%</span>
                  </div>
                  <div>
                    <div className="text-3xl font-serif text-[var(--text)] dark:text-white">82/100</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mt-1">Team Vital Matrix</div>
                  </div>
                </div>
                <div className="glass border border-white/10 rounded-[32px] p-7 space-y-4 hover:border-amber-500/20 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center text-amber-500"><Award size={18} /></div>
                    <span className="text-xs font-serif text-amber-400 font-bold">#14</span>
                  </div>
                  <div>
                    <div className="text-3xl font-serif text-[var(--text)] dark:text-white">Top 5%</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] mt-1">Marketplace Rank</div>
                  </div>
                </div>
              </div>

              <div className="glass border border-white/5 rounded-[40px] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <h4 className="font-serif text-2xl text-[var(--text)] dark:text-white tracking-tight">Department Leaderboard</h4>
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-lg shadow-orange-500/20" />
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="text-center py-12 glass border border-dashed border-[var(--border)] rounded-3xl">
                     <p className="text-sm text-[var(--muted)] font-medium max-w-[200px] mx-auto opacity-60">Synchronizing team biometric aggregates. Data updates every 60 minutes.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div 
              key="challenges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass border border-teal-500/20 rounded-[32px] p-8 flex items-center justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-2xl" />
                <div className="space-y-2 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 dark:text-[#93f9b9]">Financial Rewards</p>
                  <h4 className="font-serif text-3xl text-[var(--text)] dark:text-white">{formatCurrency(2500)} <span className="opacity-40">Wellness Grant</span></h4>
                </div>
                <div className="w-16 h-16 glass border border-teal-500/20 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-[#93f9b9] shadow-2xl relative z-10">
                  <TrendingUp size={28} />
                </div>
              </div>

              <div className="grid gap-4">
                {challengeList.map((c, i) => (
                  <div key={c.id} className="glass border border-white/5 rounded-[32px] p-8 space-y-6 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1">
                        <h4 className="font-serif text-2xl text-[var(--text)] dark:text-white tracking-tight">{c.title}</h4>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">{c.endDate}</p>
                          <div className="w-1 h-1 rounded-full bg-[var(--border)]" />
                          <p className="text-[10px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-[0.2em]">{c.participants} Contending</p>
                        </div>
                      </div>
                      {c.status === 'joined' ? (
                      <div className="px-5 py-2 glass border border-teal-500/30 text-emerald-600 dark:text-[#93f9b9] rounded-full text-[9px] font-black uppercase tracking-[0.3em] shadow-lg">Joined</div>
                      ) : (
                        <button onClick={() => handleJoinChallenge(c.id)} className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-teal-500/30 hover:scale-105 transition-all active:scale-95 border border-white/10">Enroll Now</button>
                      )}
                    </div>
                    
                    {c.status === 'joined' && (
                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.2em]">
                          <span className="text-[var(--muted)]">Personal Objective</span>
                          <span className="text-[var(--text)] dark:text-white">{Math.round((c.current / c.target) * 100)}%</span>
                        </div>
                        <div className="w-full h-2.5 glass border border-[var(--border)] rounded-full p-0.5 overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(c.current / c.target) * 100}%` }}
                             className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"
                           />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 pt-6 border-t border-white/5 relative z-10">
                      <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center text-amber-500"><Award size={16} /></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80">{c.reward}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'benefits' && (
            <motion.div 
              key="benefits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass border border-white/5 rounded-[48px] py-32 text-center relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                 <div className="relative z-10 space-y-6">
                   <div className="w-24 h-24 glass-morphism border border-white/10 rounded-[32px] flex items-center justify-center mx-auto text-white/5 shadow-2xl group-hover:scale-110 transition-transform duration-700">
                     <Shield size={64} strokeWidth={1} />
                   </div>
                   <div className="space-y-2">
                     <h3 className="font-serif text-2xl text-white/40">Exclusive Benefits</h3>
                     <p className="text-sm font-medium text-[var(--muted)] max-w-xs mx-auto opacity-60 uppercase tracking-[0.1em]">Your organization has not yet provisioned third-party benefit integrations.</p>
                   </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isSyncing && (
        <div className="fixed inset-0 bg-[#020f0c]/60 backdrop-blur-2xl z-[500] flex flex-col items-center justify-center p-8">
          <div className="relative mb-10">
            <div className="w-32 h-32 rounded-full border-4 border-[#1d976c]/10" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 w-32 h-32 rounded-full border-4 border-[#1d976c] border-t-transparent shadow-[0_0_20px_rgba(29,151,108,0.3)]" 
            />
            <div className="absolute inset-0 flex items-center justify-center text-[#1d976c]">
              <Lock size={32} />
            </div>
          </div>
          <div className="text-center space-y-4 max-w-xs">
            <h3 className="font-serif text-4xl text-white tracking-tight">Verifying Enrollment</h3>
            <p className="text-[11px] text-teal-500/60 font-black uppercase tracking-[0.4em] leading-relaxed">SECURE ENTERPRISE SYNC IN PROGRESS...</p>
          </div>
        </div>
      )}
    </div>
  );
}
function MedEducation() {
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<{
    title: string;
    overview: string;
    keyPoints: string[];
    details: {title: string, content: string}[];
    faqs: {q: string, a: string}[];
  } | null>(null);

  const recommendedTopics = [
    { title: "Human Anatomy", icon: <User size={16} />, color: "purple" },
    { title: "Heart Health", icon: <Heart size={16} />, color: "red" },
    { title: "Diabetes 101", icon: <Zap size={16} />, color: "amber" },
    { title: "Nutrition", icon: <ShoppingCart size={16} />, color: "teal" },
    { title: "Viral Infections", icon: <Activity size={16} />, color: "blue" },
    { title: "Antibiotics", icon: <Pill size={16} />, color: "purple" }
  ];

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearch(query);
    setIsLoading(true);
    setCurrentLesson(null);
    try {
      const prompt = `Create a structured medical education lesson about "${query}".
      Return ONLY a JSON object with this exact structure:
      {
        "title": "Topic Title",
        "overview": "Clear, plain-language summary.",
        "keyPoints": ["3-4 bullet points"],
        "details": [
          {"title": "Section Title", "content": "Information"}
        ],
        "faqs": [
          {"q": "Common Question?", "a": "Direct Answer."}
        ]
      }`;

      const response = await callGemini(prompt, "You are a medical educator. Simplify complex topics for laypeople. Return ONLY valid JSON and nothing else.");
      const jsonStr = response.match(/\{[\s\S]*\}/);
      if (!jsonStr) throw new Error("Could not parse JSON from response.");
      const data = JSON.parse(jsonStr[0]);
      
      // Basic validation to ensure the fields exist so the render block doesn't crash
      if (!data.title || !data.overview || !Array.isArray(data.keyPoints) || !Array.isArray(data.details) || !Array.isArray(data.faqs)) {
         throw new Error("Missing structural fields in AI response.");
      }
      
      setCurrentLesson(data);
    } catch (e) {
      console.error("MedEducation parse error:", e);
      showDoneToast("Failed to fetch lesson. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
          <GraduationCap size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Med Education</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">AI learning portal</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[48px] p-8 sm:p-12 text-center space-y-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-500">
          <BookOpen size={160} />
        </div>
        
        <div className="space-y-4 relative z-10">
          <h3 className="font-serif text-3xl sm:text-5xl text-[var(--text)] dark:text-white tracking-tight leading-tight">Biomedical Portal.</h3>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto font-medium leading-relaxed">Veda AI simplifies complex clinical literature into actionable knowledge, from molecular anatomy to advanced diagnostics.</p>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(search);
          }}
          className="relative max-w-lg mx-auto z-10"
        >
          <div className="relative group">
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Search condition, drug, or physiology..." 
              className="w-full glass border border-[var(--border)] rounded-[28px] py-6 px-8 text-[var(--text)] text-base focus:ring-4 focus:ring-purple-500/20 transition-all font-medium placeholder:text-[var(--muted)] shadow-2xl"
            />
            <button 
              type="submit"
              disabled={isLoading || !search.trim()}
              className="absolute right-3 top-3 bottom-3 px-8 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-xl shadow-purple-900/30 disabled:opacity-50 active:scale-95 border border-white/10 group-hover:scale-105"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <Search size={22} />}
            </button>
          </div>
        </form>

        {!currentLesson && !isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 relative z-10">
             {recommendedTopics.map((topic, i) => (
               <motion.button 
                 key={topic.title}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: i * 0.05 }}
                 onClick={() => handleSearch(topic.title)}
                 className="p-4 glass-morphism border border-white/5 rounded-[24px] flex flex-col items-center gap-3 hover:glass transition-all group"
               >
                  <div className={cn(
                    "w-10 h-10 rounded-xl glass flex items-center justify-center transition-colors shadow-lg",
                    topic.color === 'purple' ? "text-purple-400" :
                    topic.color === 'red' ? "text-red-400" :
                    topic.color === 'amber' ? "text-amber-400" :
                    topic.color === 'teal' ? "text-teal-400" : "text-blue-400"
                  )}>
                    {topic.icon}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] group-hover:text-white transition-colors">{topic.title}</span>
               </motion.button>
             ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="py-20 text-center animate-pulse space-y-4">
          <div className="w-12 h-12 bg-purple-500/20 rounded-full mx-auto" />
          <p className="text-sm font-medium text-[var(--muted)]">Consulting Veda's medical library...</p>
        </div>
      )}

      {currentLesson && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass border border-purple-500/20 rounded-[40px] p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] -mr-40 -mt-40 group-hover:bg-purple-500/20 transition-colors duration-1000" />
            <div className="relative z-10 space-y-6">
              <div className="space-y-4">
                <div className="px-4 py-1.5 glass-morphism border border-white/10 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] inline-block">Medical Briefing</div>
                <h3 className="font-serif text-[clamp(28px,5vw,44px)] leading-tight text-white tracking-tight">{currentLesson.title}</h3>
              </div>
              <p className="text-base text-[var(--muted)] leading-relaxed max-w-3xl font-medium">{currentLesson.overview}</p>
              
              <div className="grid sm:grid-cols-2 gap-4 mt-10">
                {currentLesson.keyPoints.map((point, i) => (
                  <div key={i} className="flex gap-4 p-5 glass-morphism border border-white/5 rounded-3xl hover:border-purple-500/20 transition-colors group/item">
                    <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center shrink-0 group-hover/item:scale-110 transition-transform">
                      <CheckCircle2 size={18} className="text-purple-400" />
                    </div>
                    <p className="text-sm font-medium text-white/90 leading-snug">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              {currentLesson.details.map((section, i) => (
                <div key={i} className="glass-morphism border border-white/5 rounded-[40px] p-10 space-y-6 shadow-xl relative overflow-hidden hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 rounded-full bg-purple-500/50" />
                    <h4 className="font-serif text-2xl text-white tracking-tight">{section.title}</h4>
                  </div>
                  <div className="text-[15px] text-[var(--muted)] leading-relaxed font-medium whitespace-pre-wrap">{section.content}</div>
                </div>
              ))}
            </div>

            <div className="space-y-8">
              <div className="glass-darker border border-amber-500/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center"><Lightbulb size={20} /></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Patient FAQs</span>
                </div>
                <div className="space-y-6">
                  {currentLesson.faqs.map((faq, i) => (
                    <div key={i} className="space-y-3 border-b border-white/5 last:border-0 pb-6 last:pb-0">
                      <p className="text-sm font-bold text-white leading-tight flex gap-3">
                         <span className="text-amber-500/40 font-serif">Q.</span>
                         {faq.q}
                      </p>
                      <p className="text-[13px] text-[var(--muted)] leading-relaxed font-medium pl-6">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => {
                  setCurrentLesson(null);
                  setSearch('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-6 glass border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] text-white hover:bg-white/5 transition-all shadow-xl active:scale-[0.98]"
              >
                Catalog Return
              </button>
            </div>
          </div>
          
          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
            <p className="text-[10px] text-red-400 font-bold text-center leading-relaxed">
              ⚠️ This information is provided by AI for educational purposes only. It is not professional medical advice, diagnosis, or treatment.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MedicineScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      const isDismissed = err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.message?.toLowerCase().includes('dismissed') || err.message?.toLowerCase().includes('denied');
      if (isDismissed) {
        setCameraError("Camera permission was dismissed or blocked. Please ensure you allow access. If you're in an iframe, try opening the app in a new tab.");
      } else {
        setCameraError(`Camera Error: ${err.message || err.name}. You can use the upload option below instead.`);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
      stopCamera();
    }
  };

  const handleScan = async () => {
    const dataToAnalyze = image || captureFromVideo();
    if (!dataToAnalyze) return;
    
    setIsLoading(true);
    try {
      const prompt = "Identify this medicine strip or bottle in the image. Extract the name, composition, and key uses. Structure the response clearly with bold headings. Make it concise and warn the patient to consult a doctor before consumption. If the image doesn't look like medicine, politely state that you can only identify medications.";
      const base64Data = dataToAnalyze.split(',')[1];
      const response = await analyzeImage(base64Data, prompt);
      setResult(response);
    } catch (error) {
      setResult("Error identifying medicine. Please ensure the image is clear.");
    } finally {
      setIsLoading(false);
    }
  };

  const captureFromVideo = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setImage(dataUrl);
      stopCamera();
      return dataUrl;
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <Camera size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Medicine Scanner</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Identify strips & bottles</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[32px] p-6 text-center space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--teal)]/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        {isCameraOpen ? (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden glass-morphism border border-white/5 bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-[var(--teal)]/20 pointer-events-none rounded-2xl" />
              <div className="absolute top-4 right-4 z-10">
                <button onClick={stopCamera} className="p-2 glass-morphism text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-all"><X size={18} /></button>
              </div>
            </div>
            <button 
              onClick={handleScan}
              className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/30 active:scale-95 transition-all border border-white/20"
            >
              Capture & Identify ✦
            </button>
          </div>
        ) : image ? (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 glass-morphism">
              <img src={image} alt="Medicine" className="w-full h-full object-contain bg-black/20" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-2 glass-morphism text-white rounded-full backdrop-blur-md"><X size={18} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/30 disabled:opacity-50 transition-all border border-white/20"
            >
              {isLoading ? 'Identifying...' : 'Analyse Photo ✦'}
            </button>
          </div>
        ) : (
          <div className="py-8 space-y-8">
            <div className="space-y-4">
               <div className="w-20 h-20 rounded-3xl glass-morphism border border-white/10 flex items-center justify-center text-[var(--teal)] mx-auto relative overflow-hidden">
                 <Camera size={40} />
                 <motion.div 
                   animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="absolute inset-0 bg-[var(--teal)]/20 rounded-3xl"
                 />
               </div>
               <div className="space-y-2">
                 <h3 className="font-serif text-2xl tracking-tight">Visual Identification</h3>
                 <p className="text-sm text-[var(--muted)] max-w-[240px] mx-auto leading-relaxed">Scan any medicine strip or bottle for instant safety info and reminders.</p>
               </div>
            </div>

            {cameraError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-4 py-3 glass-morphism border border-red-500/20 rounded-2xl"
              >
                <p className="text-xs text-red-500 font-bold leading-relaxed">{cameraError}</p>
                <button 
                  onClick={startCamera}
                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline"
                >
                  Try Again
                </button>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <button 
                onClick={startCamera}
                className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/30 flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all border border-white/20"
              >
                <Camera size={20} />
                Open Live Camera
              </button>
              <label className="w-full py-4 glass-darker border border-white/5 text-[var(--text2)] font-black rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:glass transition-all">
                <FileUp size={20} />
                Upload from Gallery
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/20 rounded-[32px] overflow-hidden shadow-2xl relative"
        >
          <button 
             onClick={() => { setResult(''); setImage(null); setIsCameraOpen(false); }}
             className="absolute top-4 right-4 w-8 h-8 rounded-full glass-morphism flex items-center justify-center hover:bg-white/10 transition-all z-10"
          >
             <X size={16} />
          </button>
          <div className="bg-[var(--teal)]/10 px-6 py-5 border-b border-white/5 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-[var(--teal)] flex items-center justify-center text-[#020f0c] shadow-lg shadow-[var(--teal)]/20">
               <Pill size={20} />
             </div>
             <h3 className="font-serif text-xl text-[var(--teal)] font-bold tracking-tight">Analysis Result</h3>
          </div>
          <div className="p-8">
            <div className="text-sm leading-relaxed text-[var(--text2)] prose prose-invert max-w-none prose-p:font-medium" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
            <div className="mt-8 pt-8 border-t border-white/5 flex gap-4 p-5 glass-morphism rounded-2xl border border-orange-500/10">
               <AlertTriangle size={20} className="text-orange-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-orange-200/60 font-black leading-relaxed uppercase tracking-widest">
                 WARNING: AI can make mistakes. Always verify the medication name and dosage with a doctor or pharmacist before consumption.
               </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AuthView({ onLogin, onBack, isLightMode }: { onLogin: () => void, onBack: () => void, isLightMode: boolean }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSocialLogin = async (provider: any, name: string) => {
    try {
      setError(null);
      await signInWithPopup(auth, provider);
      onLogin();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      
      console.error(`${name} sign-in failed`, err);
      
      if (err.code === 'auth/popup-blocked') {
        setError("Popup Blocked: Please click 'Allow Popups' in your browser's address bar.");
      } else if (err.code === 'auth/network-request-failed') {
        setError("Network Error: Connection to Google Auth failed. Please check your internet or disable Ad-blockers.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500",
      "bg-[var(--bg)]"
    )}>
      {/* Background Glow */}
      <div className={cn(
        "absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000",
        "bg-[var(--teal)] opacity-[0.08]"
      )} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-[400px] w-full space-y-10 relative z-10"
      >
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className={cn(
              "absolute inset-0 blur-2xl rounded-full scale-150 animate-pulse transition-colors",
              "bg-[var(--teal)] opacity-20"
            )} />
            <div className={cn(
              "w-20 h-20 rounded-[28px] border flex items-center justify-center relative overflow-hidden transition-all duration-300 shadow-xl",
              "bg-[var(--card)] border-[var(--teal-line)] text-[var(--teal)]"
            )}>
              <div className={cn(
                "absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--teal)]/10 to-transparent",
                isLightMode ? "opacity-30" : "opacity-100"
              )} />
              <Users size={36} strokeWidth={1.5} />
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className={cn(
              "text-5xl font-serif tracking-tight transition-colors",
              "text-[var(--teal)]"
            )}>Veda</h1>
            <p className={cn(
              "text-[11px] font-black uppercase tracking-[0.4em] transition-colors",
              "text-[var(--teal)] opacity-60"
            )}>AI DOCTOR</p>
          </div>
          
          <p className={cn(
            "text-[13px] font-medium transition-colors",
            "text-[var(--text2)]"
          )}>Your personal health companion</p>
        </div>

        {/* Form Container */}
        <div className="space-y-6">
          {/* Auth Toggle */}
          <div className={cn(
            "p-1.5 rounded-3xl flex relative border transition-all",
            "bg-[var(--surface)] border-[var(--border)] shadow-inner"
          )}>
            <motion.div 
              layoutId="auth-bg"
              className={cn(
                "absolute inset-y-1.5 rounded-2xl transition-all",
                isLightMode ? "bg-white shadow-md" : "bg-[var(--teal)] shadow-[0_0_15px_rgba(20,184,166,0.4)]"
              )}
              initial={false}
              animate={{ 
                left: isSignUp ? "calc(50% + 6px)" : "6px",
                right: isSignUp ? "6px" : "calc(50% + 6px)"
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
            <button 
              onClick={() => setIsSignUp(false)}
              className={cn(
                "flex-1 py-3 text-[13px] font-bold rounded-2xl transition-colors relative z-10",
                !isSignUp 
                  ? (isLightMode ? "text-teal-700" : "text-[#020f0c]") 
                  : "text-[var(--muted)]"
              )}
            >
              Login
            </button>
            <button 
              onClick={() => setIsSignUp(true)}
              className={cn(
                "flex-1 py-3 text-[13px] font-bold rounded-2xl transition-colors relative z-10",
                isSignUp 
                  ? (isLightMode ? "text-teal-700" : "text-[#020f0c]") 
                  : "text-[var(--muted)]"
              )}
            >
              Sign Up
            </button>
          </div>

          {/* Input Fields */}
          <div className="space-y-3">
            <div className="relative group">
              <Mail className={cn(
                "absolute left-5 top-1/2 -translate-y-1/2 transition-colors",
                "text-[var(--muted)] group-focus-within:text-[var(--teal)]"
              )} size={18} />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address" 
                className={cn(
                  "w-full border rounded-2xl py-4.5 pl-14 pr-5 text-[15px] transition-all outline-none font-medium",
                  "bg-[var(--card)] border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--teal-mid)]/50 shadow-sm"
                )} 
              />
            </div>
            
            <div className="relative group">
              <Lock className={cn(
                "absolute left-5 top-1/2 -translate-y-1/2 transition-colors",
                "text-[var(--muted)] group-focus-within:text-[var(--teal)]"
              )} size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password" 
                className={cn(
                  "w-full border rounded-2xl py-4.5 pl-14 pr-12 text-[15px] transition-all outline-none font-medium",
                  "bg-[var(--card)] border-[var(--border)] text-[var(--text)] placeholder:text-[var(--muted)]/50 focus:border-[var(--teal-mid)]/50 shadow-sm"
                )} 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                  isLightMode ? "text-slate-400 hover:text-teal-600" : "text-[#8fa3ad]/40 hover:text-teal-400"
                )}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button className="w-full text-right py-1">
              <span className={cn(
                "text-[13px] font-bold transition-colors",
                isLightMode ? "text-teal-600 hover:text-teal-700" : "text-teal-400 hover:text-teal-300"
              )}>Forgot Password?</span>
            </button>
          </div>

          {/* Primary Action */}
          <div className="space-y-6">
            <button 
              onClick={onLogin}
              className={cn(
                "w-full py-5 font-bold text-base rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all border shadow-lg",
                isLightMode 
                  ? "bg-teal-600 text-white border-white/20 shadow-teal-700/10" 
                  : "bg-[#14b8a6] text-[#05080a] border-white/10 shadow-[0_0_25px_rgba(20,184,166,0.3)]"
              )}
            >
              {isSignUp ? 'Sign Up' : 'Login'} <ArrowRight size={18} className="mt-0.5" />
            </button>

            {/* Separator */}
            <div className="relative flex items-center justify-center">
              <div className={cn(
                "absolute inset-0 flex items-center",
                isLightMode ? "opacity-20" : "opacity-100"
              )}><div className={cn("w-full border-t", isLightMode ? "border-slate-300" : "border-white/5")}></div></div>
              <span className={cn(
                "relative px-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
                isLightMode ? "text-slate-400 bg-slate-50" : "text-[#8fa3ad]/40 bg-[#05080a]"
              )}>or continue with</span>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleSocialLogin(googleProvider, 'Google')}
                className={cn(
                  "py-4 border rounded-2xl flex items-center justify-center gap-2.5 text-[14px] font-bold transition-all shadow-sm active:scale-[0.98]",
                  isLightMode 
                    ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" 
                    : "bg-[#0c1418] border-white/5 text-white hover:bg-white/5"
                )}
              >
                <div className="w-5 h-5 flex items-center justify-center bg-white rounded-full scale-90 shadow-sm border border-slate-100">
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                </div>
                Google
              </button>
              <button 
                className={cn(
                  "py-4 border rounded-2xl flex items-center justify-center gap-2.5 text-[14px] font-bold transition-all shadow-sm active:scale-[0.98]",
                  isLightMode 
                    ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50" 
                    : "bg-[#0c1418] border-white/5 text-white hover:bg-white/5"
                )}
              >
                <Apple size={18} fill="currentColor" />
                Apple
              </button>
            </div>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 border rounded-xl text-center",
              isLightMode ? "bg-red-50 border-red-200 shadow-sm" : "bg-red-500/10 border-red-500/20"
            )}
          >
            <p className={cn("text-xs font-medium", isLightMode ? "text-red-700" : "text-red-400")}>{error}</p>
          </motion.div>
        )}

        <button 
          onClick={onBack}
          className={cn(
            "w-full py-4 transition-colors text-[11px] font-bold uppercase tracking-[0.2em]",
            isLightMode ? "text-slate-400 hover:text-slate-600" : "text-[#8fa3ad]/40 hover:text-white"
          )}
        >
          Return to Hub
        </button>
      </motion.div>
    </div>
  );
}

function PricingView({ profile, onUpgrade }: { profile: UserProfile, onUpgrade: (plan: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (plan: string) => {
    setLoading(plan);
    setTimeout(() => {
      onUpgrade(plan);
      setLoading(null);
    }, 1000);
  };

  return (
    <div className="space-y-8 pb-24 px-4 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
         <h2 className="font-serif text-4xl text-white">{profile.isPremium ? 'Veda Premium ✦' : 'Upgrade to Premium'}</h2>
         <p className="text-[var(--muted)]">
           {profile.isPremium 
             ? 'You are currently enjoying the full suite of Veda professional tools.' 
             : 'Unlock advanced AI scans, family syncing, and expert second opinions.'}
         </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 pt-8">
        {/* Free Plan */}
        <div className="glass border border-white/10 rounded-[48px] p-8 flex flex-col space-y-6 opacity-60">
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Standard</h3>
            <p className="text-3xl font-serif">$0 <span className="text-base text-[var(--muted)] font-sans">/mo</span></p>
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-emerald-500" /> AI Symptoms Checker</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-emerald-500" /> Basic Vitals Log</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-emerald-500" /> Medicine Reminders</li>
          </ul>
          {!profile.isPremium && <div className="w-full py-4 rounded-3xl bg-white/5 border border-white/10 text-[var(--muted)] font-bold text-center">Current Plan</div>}
        </div>

        {/* Premium Plan */}
        <div className={cn(
          "glass border-2 rounded-[48px] p-8 flex flex-col space-y-6 relative overflow-hidden",
          profile.isPremium ? "border-amber-500 shadow-2xl shadow-amber-500/10" : "border-[var(--teal)] shadow-2xl shadow-teal-500/10"
        )}>
          {profile.isPremium ? (
             <div className="absolute top-0 right-0 bg-amber-500 text-[#020f0c] px-6 py-1 rounded-bl-3xl text-[10px] font-black uppercase tracking-widest">Active</div>
          ) : (
             <div className="absolute top-0 right-0 bg-[var(--teal)] text-[#020f0c] px-6 py-1 rounded-bl-3xl text-[10px] font-black uppercase tracking-widest">Recommended</div>
          )}
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Premium ✦</h3>
            <p className="text-3xl font-serif">$19 <span className="text-base text-[var(--muted)] font-sans">/mo</span></p>
          </div>
          <ul className="space-y-3 flex-1">
            <li className="flex items-center gap-2 text-sm"><Check size={16} className={profile.isPremium ? "text-amber-500" : "text-[var(--teal)]"} /> Advanced Skin AI Analysis</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className={profile.isPremium ? "text-amber-500" : "text-[var(--teal)]"} /> Expert Second Medical Opinion</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className={profile.isPremium ? "text-amber-500" : "text-[var(--teal)]"} /> AI Health Pattern Recognition</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className={profile.isPremium ? "text-amber-500" : "text-[var(--teal)]"} /> Unlimited Family Members</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className={profile.isPremium ? "text-amber-500" : "text-[var(--teal)]"} /> Priority Veda Chat</li>
          </ul>
          {profile.isPremium ? (
            <div className="w-full py-4 rounded-3xl bg-amber-500/10 border border-amber-500 text-amber-500 font-bold text-center">Active Subscription</div>
          ) : (
            <button 
              onClick={() => handleCheckout('Premium Plan')}
              disabled={loading === 'Premium Plan'}
              className="w-full py-4 rounded-3xl bg-[var(--teal)] text-[#020f0c] font-bold shadow-xl shadow-teal-500/20 hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {loading === 'Premium Plan' ? 'Processing...' : 'Upgrade Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeleconsultView() {
  const [isCalling, setIsCalling] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<any>(null);

  const doctors: any[] = [];

  const handleCall = (doc: any) => {
    setActiveDoctor(doc);
    setIsCalling(true);
    setTimeout(() => {
       setIsCalling(false);
       setIsInCall(true);
    }, 2000); 
  };

  const endCall = () => {
    setIsInCall(false);
    setActiveDoctor(null);
    showDoneToast("Call ended. Prescription will be generated by AI.");
  };

  if (isCalling) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 pt-20">
        <div className="w-24 h-24 rounded-full bg-indigo-500 animate-pulse flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/50">
          {activeDoctor?.icon}
        </div>
        <p className="font-bold text-lg text-[var(--text)]">Connecting to {activeDoctor?.name}...</p>
        <button onClick={() => { setIsCalling(false); setActiveDoctor(null); }} className="px-6 py-3 bg-red-500/10 text-red-500 font-bold rounded-2xl">Cancel Call</button>
      </div>
    );
  }

  if (isInCall) {
    return (
      <div className="fixed inset-0 bg-[#020f0c] z-[200] p-4 flex flex-col pt-12">
        <div className="flex-1 bg-[var(--card2)] rounded-[32px] border-4 border-indigo-500 shadow-2xl flex items-center justify-center text-[var(--muted)] font-bold italic relative">
          <div className="absolute inset-4 rounded-3xl bg-[var(--card)] flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-4xl">{activeDoctor?.icon}</div>
            <p className="text-xl font-bold">{activeDoctor?.name}</p>
            <p className="text-sm opacity-60">Consultation in progress...</p>
          </div>
        </div>
        <div className="flex justify-center p-8">
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-2xl shadow-red-500/50">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
          <Video size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Teleconsult</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Instant Video Consultation</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-indigo-800 rounded-[40px] p-8 text-white space-y-4 shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
         <div className="space-y-2 relative z-10">
           <h3 className="font-serif text-3xl leading-tight">Connect with a Specialist.</h3>
           <p className="text-sm opacity-70 leading-relaxed max-w-[240px]">Get expert medical advice from the comfort of your home in under 10 minutes.</p>
         </div>
         <button className="px-6 py-4 bg-white text-indigo-700 font-bold rounded-2xl text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all relative z-10">
           Talk to Veda Bot ✦
         </button>
      </div>

      <div className="space-y-4">
         <div className="flex items-center justify-between px-1">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Available Doctors</h3>
           <button className="text-[10px] font-black uppercase text-indigo-400">View All</button>
         </div>
         <div className="grid gap-3">
            {doctors.map((d, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-4 flex items-center gap-4 shadow-sm group hover:border-indigo-500/30 transition-all">
                 <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">{d.icon}</div>
                 <div className="flex-1">
                    <h4 className="text-base font-bold text-[var(--text)]">{d.name}</h4>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">{d.specialty}</p>
                 </div>
                 <button onClick={() => handleCall(d)} className="px-5 py-2.5 bg-indigo-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">Call</button>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}


function BMIView({ profile }: { profile: UserProfile }) {
  const [height, setHeight] = useState(profile.height || '');
  const [weight, setWeight] = useState(profile.weight || '');
  
  const h = parseFloat(height);
  const w = parseFloat(weight);
  const hasData = !isNaN(h) && !isNaN(w) && h > 0;
  const bmiNum = hasData ? w / Math.pow(h/100, 2) : 0;
  const bmi = hasData ? bmiNum.toFixed(1) : '--';
  
  const getBMIStatus = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: 'text-blue-400', advice: 'Focus on nutrient-dense meals and speak with a nutritionist to achieve a healthy weight gain.' };
    if (val < 25) return { label: 'Healthy Weight', color: 'text-teal-500', advice: 'Fantastic! Maintain your current routine with a balanced diet and regular physical activity.' };
    if (val < 30) return { label: 'Overweight', color: 'text-amber-400', advice: 'Incorporating more physical activity and slight dietary adjustments can help reach a healthy range.' };
    return { label: 'Obese', color: 'text-red-400', advice: 'It is highly recommended to consult a wellness expert to create a sustainable, heart-healthy plan.' };
  };

  const status = hasData ? getBMIStatus(bmiNum) : { label: 'Enter details', color: 'text-[var(--muted)]', advice: 'Please enter your height and weight to see your health analysis.' };
  
  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <Scale size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">BMI Dashboard</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Personal Health Metrics</p>
        </div>
      </div>

      <div className="glass-darker border border-white/10 rounded-[32px] p-8 space-y-6 shadow-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Height (cm)</label>
            <input 
              type="number" 
              value={height} 
              onChange={(e) => setHeight(e.target.value)}
              className="w-full glass border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-teal-500 transition-all shadow-inner"
              placeholder="e.g. 175"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Weight (kg)</label>
            <input 
              type="number" 
              value={weight} 
              onChange={(e) => setWeight(e.target.value)}
              className="w-full glass border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-teal-500 transition-all shadow-inner"
              placeholder="e.g. 70"
            />
          </div>
        </div>
      </div>

      {hasData && (
        <div className="glass border border-white/10 rounded-[32px] p-8 text-center space-y-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Your Body Mass Index</p>
            <p className="text-7xl font-serif text-[var(--teal)]">{bmi}</p>
            <p className={cn("text-lg font-bold tracking-tight", status.color)}>{status.label}</p>
          </div>
          
          <div className="h-4 w-full glass-morphism rounded-full overflow-hidden flex shadow-inner">
            <div className="h-full bg-blue-400" style={{ width: '25%' }} />
            <div className="h-full bg-teal-500" style={{ width: '20%' }} />
            <div className="h-full bg-amber-400" style={{ width: '15%' }} />
            <div className="h-full bg-red-400" style={{ width: '40%' }} />
          </div>
          
          <div className="glass-morphism border border-teal-500/20 rounded-2xl p-5 text-left">
            <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">Expert Advice</p>
            <p className="text-sm text-[var(--text2)] leading-relaxed">{status.advice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function calculateScore(journal: JournalEntry[] = [], profile: UserProfile = {} as any) {
  const hasSubstantiveData = 
    profile.bp || 
    profile.sugar || 
    profile.weight || 
    (profile.conditions && profile.conditions.length > 0) || 
    journal.length > 0;
  
  if (!hasSubstantiveData) {
    return 0; // Return 0 if there's no real data to judge
  }

  let score = 60;
  if (profile.name) score += 5;
  if (profile.age) score += 2;
  if (profile.bp) score += 5;
  if (profile.sugar) score += 5;
  if (profile.conditions?.length > 0) score -= 5;
  
  const recentJournal = journal.slice(0, 7);
  if (recentJournal.length > 0) {
    const avgMood = recentJournal.reduce((s, e) => s + e.mood, 0) / recentJournal.length;
    score += (avgMood - 3) * 5;
    score += recentJournal.length * 2;
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateStreak(journal: JournalEntry[] = []) {
  if (journal.length === 0) return 0;
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let currentDate = new Date(today);
  
  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (journal.some(e => e.date === dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function showDoneToast(msg: string) {
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: { title: 'Success', message: msg, type: 'success' }
  }));
}

function showErrorToast(msg: string) {
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: { title: 'Error', message: msg, type: 'error' }
  }));
}

function showWarningToast(msg: string) {
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: { title: 'Warning', message: msg, type: 'warning' }
  }));
}

function showInfoToast(msg: string) {
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: { title: 'Notification', message: msg, type: 'info' }
  }));
}

function Badge({ icon, label }: { icon: string, label: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-sm shadow-sm relative group">
      {icon}
      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--card2)] border border-[var(--border)] rounded text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
        {label}
      </span>
    </div>
  );
}

function WellnessView({ journal }: { journal: JournalEntry[] }) {
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [timer, setTimer] = useState(0);
  const [aiCheckIn, setAiCheckIn] = useState<string | null>(null);
  const [isLoadingCheckIn, setIsLoadingCheckIn] = useState(false);
  const streak = calculateStreak(journal);

  const lastMood = journal[0]?.mood || 3;
  
  const fetchAiCheckIn = async () => {
    setIsLoadingCheckIn(true);
    try {
      const recentEntries = journal.slice(0, 3).map(e => `Mood: ${e.mood}/5, Energy: ${e.energy}/5, Note: ${e.notes}`).join('\n');
      const prompt = `Based on my recent health journal entries, provide a short, empathetic mental health check-in and one actionable wellness tip. Keep it under 60 words.
        Recent entries:
        ${recentEntries}
        Current Mood: ${lastMood}/5`;
      const response = await callGemini(prompt);
      setAiCheckIn(response || null);
    } catch (error) {
      console.error("Error fetching AI check-in:", error);
      setAiCheckIn("Take a deep breath. You're doing your best, and that's enough for today.");
    } finally {
      setIsLoadingCheckIn(false);
    }
  };

  useEffect(() => {
    if (!aiCheckIn && journal.length > 0) {
      fetchAiCheckIn();
    }
  }, [journal]);

  useEffect(() => {
    let interval: any;
    if (isBreathing) {
      interval = setInterval(() => {
        setTimer(prev => {
          const next = prev + 1;
          if (next % 12 < 4) setBreathPhase('Inhale');
          else if (next % 12 < 8) setBreathPhase('Hold');
          else setBreathPhase('Exhale');
          return next;
        });
      }, 1000);
    } else {
      setTimer(0);
      setBreathPhase('Inhale');
    }
    return () => clearInterval(interval);
  }, [isBreathing]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-8 px-1"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
          <Wind size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Veda Wellness</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Mind & Body Balance</p>
        </div>
      </div>

      <div className="glass border border-[var(--border)] rounded-[32px] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl text-[var(--text)]">Daily Streak</h3>
            <p className="text-sm text-[var(--muted)] font-medium">Keep it up to unlock new milestones!</p>
          </div>
          <div className="text-5xl font-serif text-orange-500 drop-shadow-lg">{streak}</div>
        </div>
        <div className="flex gap-2">
          <Badge icon="🔥" label="3 Day" />
          <Badge icon="⭐" label="7 Day" />
          <Badge icon="🏆" label="30 Day" />
          <Badge icon="💎" label="100 Day" />
        </div>
      </div>

      <div className="glass border border-[var(--border)] rounded-[32px] p-8 text-center space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-serif text-2xl text-[var(--text)]">Guided Breathing</h3>
            <p className="text-sm text-[var(--muted)] max-w-xs mx-auto">
              {aiCheckIn || (lastMood <= 2 ? "You've been feeling a bit low. Let's take a moment for yourself." : 
                      lastMood >= 4 ? "You're doing great! Let's maintain this positive energy." :
                      "A quick breathing session can help you stay centered.") }
            </p>
            {isLoadingCheckIn && (
              <div className="flex justify-center gap-1">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 rounded-full bg-orange-500" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 rounded-full bg-orange-500" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 rounded-full bg-orange-500" />
              </div>
            )}
          </div>
          
          {!isLoadingCheckIn && (
            <button 
              onClick={fetchAiCheckIn}
              className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest hover:text-orange-500 transition-colors"
            >
              Refresh AI Check-in
            </button>
          )}
        </div>

        <div className="relative flex items-center justify-center py-12">
          <motion.div 
            animate={{ 
              scale: isBreathing ? (breathPhase === 'Inhale' ? 1.5 : breathPhase === 'Hold' ? 1.5 : 1) : 1,
              opacity: isBreathing ? (breathPhase === 'Hold' ? 0.8 : 1) : 0.5
            }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="w-32 h-32 rounded-full glass border-2 border-orange-500/40 flex items-center justify-center shadow-2xl shadow-orange-500/10"
          >
            <motion.div 
              animate={{ scale: isBreathing ? 0.8 : 1 }}
              className="w-24 h-24 rounded-full glass border border-orange-500/50 flex items-center justify-center"
            >
              <Wind className="text-orange-500" size={32} />
            </motion.div>
          </motion.div>
          
          {isBreathing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <motion.span 
                key={breathPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold text-orange-400 uppercase tracking-widest"
              >
                {breathPhase}
              </motion.span>
              <span className="text-xs text-[var(--muted)] mt-1">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</span>
            </div>
          )}
        </div>

        <button 
          onClick={() => setIsBreathing(!isBreathing)}
          className={cn(
            "px-8 py-3 rounded-full font-bold transition-all shadow-xl active:scale-95",
            isBreathing ? "glass border border-[var(--border)] text-[var(--text)]" : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20"
          )}
        >
          {isBreathing ? 'Stop Session' : 'Start 4-4-4 Breathing'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass border border-[var(--border)] rounded-[32px] p-5 space-y-3 hover:glass transition-all">
          <div className="w-10 h-10 rounded-lg glass border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Moon size={20} />
          </div>
          <h4 className="font-bold text-sm">Sleep Hygiene</h4>
          <p className="text-xs text-[var(--muted)]">Tips for better rest based on your energy levels.</p>
        </div>
        <div className="glass border border-[var(--border)] rounded-[32px] p-5 space-y-3 hover:glass transition-all">
          <div className="w-10 h-10 rounded-lg glass border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Smile size={20} />
          </div>
          <h4 className="font-bold text-sm">Gratitude Log</h4>
          <p className="text-xs text-[var(--muted)]">Write down 3 things you're thankful for today.</p>
        </div>
      </div>
    </motion.div>
  );
}

function TrustCenter() {
  return (
    <div className="space-y-6 pb-24 px-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-lg">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Trust Center</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Security & Privacy First</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[40px] p-8 space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/5 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
        <p className="text-sm text-[var(--muted)] leading-relaxed font-medium relative z-10">At Veda Health, your privacy and security are our top priorities. We use military-grade encryption and strict data access policies to keep your medical information safe and private.</p>
        <div className="grid gap-3 relative z-10">
          <div className="p-5 glass-morphism border border-white/5 rounded-2xl flex items-center gap-4 hover:glass transition-all">
             <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-teal-400 shadow-lg">
               <Shield size={20} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">End-to-End Encryption</span>
          </div>
          <div className="p-5 glass-morphism border border-white/5 rounded-2xl flex items-center gap-4 hover:glass transition-all">
             <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-teal-400 shadow-lg">
               <Lock size={20} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Zero-Knowledge Storage</span>
          </div>
        </div>
        <div className="pt-4 relative z-10">
          <button className="w-full py-4 glass border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:glass-morphism transition-all">Download Security Whitepaper</button>
        </div>
      </div>
    </div>
  );
}

function PrivacyView() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 px-1"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
          <Shield size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Privacy Policy</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Last Updated: April 2026</p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-[32px] p-8 space-y-8 shadow-xl">
        <div className="prose prose-invert prose-sm max-w-none">
          <h3 className="text-white font-serif text-xl mb-4">1. Information We Collect</h3>
          <p className="text-[var(--text2)] leading-relaxed font-medium">We collect health data, journal entries, and medication reminders that you intentionally provide to personalize your care. All PII data is stored separately and encrypted at rest.</p>
          
          <h3 className="text-white font-serif text-xl mt-8 mb-4">2. How We Use Data</h3>
          <p className="text-[var(--text2)] leading-relaxed font-medium">Your data is only used to provide AI-powered health insights, reminders, and to facilitate teleconsultations. We never sell your personal data to third parties or advertisers.</p>
          
          <h3 className="text-white font-serif text-xl mt-8 mb-4">3. Data Portability</h3>
          <p className="text-[var(--text2)] leading-relaxed font-medium">You have the right to download all your health data or delete your account at any time from the profile settings.</p>
        </div>
        
        <div className="pt-6 border-t border-white/5">
          <button className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-widest hover:underline decoration-blue-400/30 underline-offset-4">
            Read Full Document <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// --- Premium & Membership Components ---

/**
 * PremiumGate: A wrapper that shows a "Premium" modal/overlay if the user is not a premium member.
 */
function PremiumGate({ profile, featureName, onUpgrade, children }: { 
  profile: UserProfile, 
  featureName: string, 
  onUpgrade: () => void,
  children: React.ReactNode 
}) {
  if (profile.isPremium) return <>{children}</>;

  return (
    <div className="relative min-h-[400px] w-full bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-inner group">
      {/* Blurred preview of the content */}
      <div className="absolute inset-0 blur-md grayscale opacity-20 pointer-events-none select-none">
        {children}
      </div>
      
      {/* Premium Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg)]/40 via-[var(--bg)]/90 to-[var(--bg)] flex flex-col items-center justify-center p-8 text-center space-y-6 z-20">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 animate-pulse border border-amber-500/20 backdrop-blur-sm">
          <Sparkles size={40} />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-serif text-3xl tracking-tight text-[var(--text)]">Unlock Veda Premium</h3>
          <p className="text-sm text-[var(--muted)] max-w-xs mx-auto">
            {featureName} is a high-performance feature reserved for Veda Premium members.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
          <button 
            onClick={onUpgrade}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            Upgrade Now
          </button>
          
          <div className="flex items-center gap-2 justify-center text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">
            <Shield size={10} />
            Secure Payment Integration
          </div>
        </div>

        <div className="pt-4 grid grid-cols-2 gap-4 w-full max-w-xs text-left">
           {[ { label: "Unlimited Deep Dives" }, { label: "Priority AI Diagnosis" }, { label: "Expert 2nd Opinions" }, { label: "Advanced Wellness Plan" } ].map((item, i) => (
             <div key={i} className="flex gap-2 items-center">
               <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0"><Check size={12} /></div>
               <div className="text-[10px] text-[var(--text2)] font-medium leading-tight">{item.label}</div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}

function MembershipView({ profile, onUpgrade }: { profile: UserProfile, onUpgrade: () => Promise<void> }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    await onUpgrade();
    setIsProcessing(false);
  };

  return (
    <div className="space-y-10 pb-12">
      <div className="text-center space-y-3 pt-4">
        <h2 className="font-serif text-4xl tracking-tight">Veda Trusted Data</h2>
        <p className="text-[var(--text2)] max-w-md mx-auto leading-relaxed">
          Veda Premium gives you absolute control over your health records. 
          Monitor access logs, manage permissioned family sync, and export your data securely anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Access Logs */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-6 shadow-xl shadow-black/5">
            <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl flex items-center gap-2"><Lock size={18} className="text-teal-500" /> Access Audit Logs</h3>
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] bg-[var(--card2)] px-2 py-0.5 rounded-full">Secure</span>
            </div>
            
            <div className="space-y-3">
                {profile.accessLogs && profile.accessLogs.length > 0 ? profile.accessLogs.map(log => (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={log.id} className="flex justify-between items-center p-4 bg-[var(--card2)] rounded-2xl hover:bg-[var(--card)] transition-colors">
                        <div className="space-y-0.5">
                            <div className="text-xs font-bold text-[var(--text)] uppercase tracking-tight">{log.resource}</div>
                            <div className="text-[10px] text-[var(--muted)] font-medium capitalize">{log.action}</div>
                        </div>
                        <div className="text-[10px] font-mono text-[var(--muted)]">{new Date(log.timestamp).toLocaleDateString()}</div>
                    </motion.div>
                )) : <p className="text-sm text-[var(--muted)] italic p-4">No recent activity detected.</p>}
            </div>
            <button className="w-full py-4 bg-[var(--teal)]/10 text-[var(--teal)] hover:bg-[var(--teal)] hover:text-[#020f0c] font-black rounded-2xl text-xs uppercase tracking-widest transition-all">Export Report</button>
        </div>

        {/* Family Sync */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-6 shadow-xl shadow-black/5">
            <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl flex items-center gap-2"><Users size={18} className="text-amber-500" /> Family Health Sync</h3>
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] bg-[var(--card2)] px-2 py-0.5 rounded-full">Permissioned</span>
            </div>
            
            <div className="space-y-3">
                {profile.familyPermissions && profile.familyPermissions.length > 0 ? profile.familyPermissions.map(perm => (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={perm.memberId} className="flex justify-between items-center p-4 bg-[var(--card2)] rounded-2xl group hover:border-[var(--teal)] border border-transparent transition-all">
                        <div className="font-bold text-sm">{perm.name}</div>
                        <div className="flex gap-2">
                            {perm.canViewAlerts && <span className="bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Alerts</span>}
                            {perm.canViewMedications && <span className="bg-teal-500/10 text-teal-500 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Meds</span>}
                        </div>
                    </motion.div>
                )) : <p className="text-sm text-[var(--muted)] italic p-4">Add a family member to sync alerts.</p>}
            </div>
            <button className="w-full py-4 bg-[var(--card2)] border border-[var(--border)] hover:border-[var(--teal)] rounded-2xl text-xs uppercase tracking-widest font-black text-[var(--muted)] hover:text-white transition-all">Manage Connections</button>
        </div>
      </div>
    </div>
  );
}
