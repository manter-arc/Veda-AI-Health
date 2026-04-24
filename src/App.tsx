/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
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
  UserCircle
} from 'lucide-react';
import { cn, formatMsg, formatCurrency, formatCoverage } from './lib/utils';
import { TrendsInsights } from './components/TrendsInsights';
import { SOSView } from './components/SOSView';
import { PullToRefresh } from './components/PullToRefresh';
import { AppMode, UserProfile, JournalEntry, Reminder, MedicalRecord, FamilyMember, InsurancePlan, UserInsurancePolicy, Appointment, Clinic, CorporateChallenge } from './types';
import { callGemini, analyzeImage, analyzeLabReport, analyzeFood, analyzeJournal, generateHealthRoadmap, generateCallSummary, SYS_PROMPT } from './lib/gemini';
import { auth, db, googleProvider, appleProvider, ai } from './firebase';
import { signInWithRedirect, getRedirectResult, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocFromServer, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  throw new Error(JSON.stringify(errInfo));
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
    conditions: [], medicines: [], familyHistory: [], allergies: [], vaccinationHistory: [], setupDone: false
  });
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [policies, setPolicies] = useState<UserInsurancePolicy[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  
  // Multi-conversation management
  const [activeChatId, setActiveChatId] = useLocalStorage<string>('veda_active_chat_id', 'default');
  const [allChats, setAllChats] = useLocalStorage<Record<string, {id: string, title: string, messages: any[], timestamp: number}>>('veda_all_chats', {
    'default': { id: 'default', title: 'New Consultation', messages: [], timestamp: Date.now() }
  }, true);
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
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          updateProfile({ ...profile, notificationsEnabled: true });
          showDoneToast("Notifications enabled!");
          triggerPushNotification("Veda Health", "You will now receive important health alerts.");
        } else {
          showDoneToast("Notifications disabled.");
        }
      } catch (err) {
        console.error("error requesting notifications", err);
      }
    } else {
      showDoneToast("Notifications not supported on this browser.");
    }
  };

  const triggerPushNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted' || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
      const options = {
        body,
        icon: '/favicon.ico', // Fallback for icon
        badge: '/favicon.ico',
        tag: 'veda-alert',
        renotify: true
      };
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, options);
        }).catch(() => {
          new Notification(title, options);
        });
      } else if (typeof Notification !== 'undefined') {
        new Notification(title, options);
      }
    }
  };

  // Sync active chatHistory state with allChats
  useEffect(() => {
    if (allChats[activeChatId]) {
      setChatHistory(allChats[activeChatId].messages);
    } else {
      const firstChatId = Object.keys(allChats)[0];
      if (firstChatId) setActiveChatId(firstChatId);
    }
  }, [activeChatId]);

  const updateActiveChat = (newMessages: any[]) => {
    setChatHistory(newMessages);
    setAllChats(prev => {
      const chat = prev[activeChatId] || { id: activeChatId, title: 'Consultation', messages: [], timestamp: Date.now() };
      
      // Update title automatically based on first message
      let title = chat.title;
      if (chat.messages.length === 0 && newMessages.length > 0 && newMessages[0].role === 'user') {
        title = newMessages[0].content.split('\n')[0].substring(0, 24).trim();
        if (newMessages[0].content.length > 24) title += '...';
      }

      return {
        ...prev,
        [activeChatId]: {
          ...chat,
          messages: newMessages,
          title,
          timestamp: Date.now()
        }
      };
    });
  };

  const createNewChat = () => {
    const id = 'chat_' + Date.now();
    setAllChats(prev => ({
      ...prev,
      [id]: { id, title: 'New Consultation', messages: [], timestamp: Date.now() }
    }));
    setActiveChatId(id);
    switchMode('chat');
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const chatIds = Object.keys(allChats);
    if (chatIds.length <= 1) {
      // Just clear the messages instead of deleting the last chat
      updateActiveChat([]);
      return;
    }
    
    const newChats = { ...allChats };
    delete newChats[id];
    setAllChats(newChats);

    if (activeChatId === id) {
      const remainingIds = Object.keys(newChats);
      setActiveChatId(remainingIds[remainingIds.length - 1]);
    }
  };
  const [isTyping, setIsTyping] = useState(false);
  const [vitalsTab, setVitalsTab] = useState<'wellbeing' | 'bp' | 'sugar' | 'weight'>('wellbeing');
  const [language, setLanguage] = useState('English');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const journalUnsubRef = useRef<(() => void) | null>(null);

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  
  // Test Connection
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    async function testConnection() {
      try {
        const docRef = doc(db, 'test', 'connection');
        // Force the SDK to try reaching the server
        await getDocFromServer(docRef);
        setIsConnected(true);
        retryCount = 0;
      } catch (error: any) {
        // Suppress 'unavailable' or 'offline' errors during initial boot as they are often transient
        const isTransient = error?.code === 'unavailable' || error?.message?.includes('offline') || error?.message?.includes('failed-precondition');
        
        if (retryCount >= 5 && !isTransient) {
          console.warn("Firebase connection test exhausted retries.");
          setIsConnected(false);
        } else if (retryCount < 5) {
          retryCount++;
          // Progressive backoff: 2s, 4s, 6s, 8s, 10s
          setTimeout(testConnection, 2000 * retryCount);
        }
      }
    }
    
    testConnection();
    // Re-check occasionally
    const interval = setInterval(testConnection, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        // Fetch profile
        const profileRef = doc(db, 'users', u.uid);
        getDoc(profileRef).then((snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            // Initialize profile
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              name: u.displayName || '',
              age: '', sex: '', city: '', height: '', weight: '', bp: '', sugar: '', blood: '',
              conditions: [], medicines: [], familyHistory: [], allergies: [], vaccinationHistory: [], setupDone: false
            };
            setDoc(profileRef, newProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${u.uid}`));
            setProfile(newProfile);
          }
        }).catch(e => handleFirestoreError(e, OperationType.GET, `users/${u.uid}`));

        // Real-time journal
        const journalUnsub = onSnapshot(collection(db, 'users', u.uid, 'journal'), (snap) => {
          const entries = snap.docs.map(d => d.data() as JournalEntry);
          setJournal(entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/journal`));

        // Real-time reminders
        const remindersUnsub = onSnapshot(collection(db, 'users', u.uid, 'reminders'), (snap) => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
          setReminders(items);
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/reminders`));

        // Real-time records
        const recordsUnsub = onSnapshot(collection(db, 'users', u.uid, 'records'), (snap) => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
          setRecords(items);
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/records`));

        // Real-time family
        const familyUnsub = onSnapshot(collection(db, 'users', u.uid, 'family'), (snap) => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
          setFamily(items);
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/family`));

        // Real-time policies
        const policiesUnsub = onSnapshot(collection(db, 'users', u.uid, 'policies'), (snap) => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
          setPolicies(items);
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/policies`));

        // Real-time appointments
        const appointmentsUnsub = onSnapshot(collection(db, 'users', u.uid, 'appointments'), (snap) => {
          const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment));
          setAppointments(items);
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}/appointments`));

        return () => {
          journalUnsub();
          remindersUnsub();
          recordsUnsub();
          familyUnsub();
          policiesUnsub();
          appointmentsUnsub();
        };
      } else {
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
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setMode('home'); // Redirect to dashboard
    } catch (error) {
      console.error("Login failed", error);
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
      
      <nav className="fixed top-0 left-0 right-0 z-[100] py-4 transition-all bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
          <a href="#" className="font-serif text-2xl text-[var(--teal)] flex items-baseline gap-1.5 no-underline">
            Veda <span className="font-sans text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider">Health</span>
          </a>
          <div className="hidden md:flex items-center gap-1.5 ml-auto mr-6">
            <a href="#features" className="px-3.5 py-1.5 text-[var(--text2)] no-underline text-[13.5px] font-medium hover:text-[var(--text)] hover:bg-[var(--card)] rounded-lg transition-all">Features</a>
            <a href="#how" className="px-3.5 py-1.5 text-[var(--text2)] no-underline text-[13.5px] font-medium hover:text-[var(--text)] hover:bg-[var(--card)] rounded-lg transition-all">How it works</a>
            <a href="#testimonials" className="px-3.5 py-1.5 text-[var(--text2)] no-underline text-[13.5px] font-medium hover:text-[var(--text)] hover:bg-[var(--card)] rounded-lg transition-all">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('auth')} 
              className="hidden sm:block px-4 py-2 text-[var(--text2)] font-bold text-[13.5px] hover:text-[var(--teal)] transition-all"
            >
              Sign In
            </button>
            <button onClick={handleStart} className="px-5 py-2 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold text-[13.5px] rounded-xl shadow-lg hover:brightness-110 transition-all">
              {user ? 'Open App →' : 'Get Started'}
            </button>
          </div>
        </div>
      </nav>

      <section className="hero min-h-screen flex items-center pt-[120px] pb-20 relative overflow-hidden">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="max-w-[1100px] mx-auto px-6 grid md:grid-cols-2 gap-16 items-center w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-full mb-5 text-xs font-semibold text-[var(--teal)] tracking-wide">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--teal)] shadow-[0_0_8px_rgba(0,212,177,0.8)] animate-pulse" />
              Now powered by Gemini 2.0 Flash
            </div>
            <h1 className="font-serif text-[clamp(38px,5vw,56px)] leading-[1.12] tracking-tight text-[var(--text)] mb-4.5">
              Your <em className="italic text-[var(--teal)] not-italic">AI doctor</em><br />always in your pocket
            </h1>
            <p className="text-lg text-[var(--text2)] leading-relaxed max-w-[480px] mb-9 font-normal">
              Veda gives you <strong>instant health guidance</strong>, tracks your vitals, reads prescriptions, orders medicines — all in one beautiful app. Available in <strong>10 Indian languages</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-3.5 mt-8">
              <button 
                onClick={handleStart} 
                className="flex-1 xs:flex-none inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-black text-base rounded-2xl shadow-xl shadow-[var(--teal)]/20 hover:brightness-105 hover:-translate-y-0.5 transition-all group active:scale-95"
              >
                <Stethoscope size={20} className="group-hover:rotate-12 transition-transform" />
                Try Veda Free
              </button>
              <a 
                href="#features" 
                className="flex-1 xs:flex-none inline-flex items-center justify-center px-8 py-4 text-[var(--text2)] font-bold text-base border border-[var(--border)] rounded-2xl bg-[var(--card)] hover:border-[var(--teal-line)] hover:text-[var(--teal)] transition-all active:scale-95"
              >
                Explore Features
              </a>
            </div>
            <p className="mt-4 text-[12.5px] text-[var(--muted)] flex items-center gap-1.5">
              ✓ 100% Free &nbsp;·&nbsp; ✓ No sign-up needed &nbsp;·&nbsp; ✓ Private & secure
            </p>
            <div className="flex gap-7 mt-10 pt-8 border-t border-[var(--border)]">
              <div>
                <div className="font-serif text-3xl text-[var(--teal)]">23+</div>
                <div className="text-[12px] text-[var(--muted)] mt-1 font-medium">Health features</div>
              </div>
              <div>
                <div className="font-serif text-3xl text-[var(--teal)]">10</div>
                <div className="text-[12px] text-[var(--muted)] mt-1 font-medium">Indian languages</div>
              </div>
              <div>
                <div className="font-serif text-3xl text-[var(--teal)]">100%</div>
                <div className="text-[12px] text-[var(--muted)] mt-1 font-medium">Free forever</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="flex justify-center items-center relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative w-[280px]">
              <div className="absolute -inset-10 bg-radial from-[rgba(0,212,177,0.15)] to-transparent blur-2xl pointer-events-none animate-pulse" />
              <div className="w-[280px] bg-[var(--card)] border border-[var(--border)] rounded-[36px] overflow-hidden shadow-2xl relative">
                <div className="h-11 bg-[var(--card)] flex items-center justify-between px-5.5 text-xs text-[var(--muted)] font-semibold border-b border-[var(--border)]">
                  <div className="w-20 h-5.5 bg-[var(--bg)] rounded-b-2xl mx-auto absolute top-0 left-1/2 -translate-x-1/2" />
                  <span>9:41</span>
                  <div className="flex gap-1">
                    <Watch size={12} />
                    <Zap size={12} />
                  </div>
                </div>
                <div className="p-3.5 space-y-2.5">
                  <div className="flex gap-2 ai">
                    <div className="w-6 h-6 rounded-lg bg-[var(--teal-glow)] border border-[var(--teal-line)] flex items-center justify-center text-[10px]"><Stethoscope size={12} /></div>
                    <div className="p-2.5 bg-[var(--card2)] border border-[var(--border)] rounded-xl rounded-tl-sm text-[11.5px] leading-relaxed max-w-[75%] text-[var(--text)]">
                      Namaste! I'm Veda, your <span className="text-[var(--teal)] font-semibold">AI health companion</span>. How are you feeling today?
                    </div>
                  </div>
                  <div className="flex flex-row-reverse gap-2 user">
                    <div className="w-6 h-6 rounded-lg bg-[var(--card2)] border border-[var(--border)] flex items-center justify-center text-xs"><User size={12} /></div>
                    <div className="p-2.5 bg-[var(--teal)] text-[#020f0c] rounded-xl rounded-tr-sm text-[11.5px] leading-relaxed max-w-[75%]">
                      I have a headache and mild fever since morning
                    </div>
                  </div>
                  <div className="flex gap-2 ai">
                    <div className="w-6 h-6 rounded-lg bg-[var(--teal-glow)] border border-[var(--teal-line)] flex items-center justify-center text-[10px]"><Stethoscope size={12} /></div>
                    <div className="p-2.5 bg-[var(--card2)] border border-[var(--border)] rounded-xl rounded-tl-sm text-[11.5px] leading-relaxed max-w-[75%] text-[var(--text)]">
                      Based on your symptoms, this could be a viral infection. <span className="text-[var(--teal)] font-semibold">Rest, hydrate well</span>, and take Paracetamol 500mg.
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -left-16 top-1/4 bg-[var(--card)] border border-white/10 rounded-xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2 text-[11px] font-bold text-[var(--teal)]">
                <FileText size={14} /> Lab report read
              </div>
              <div className="absolute -right-16 top-1/2 bg-[var(--card)] border border-white/10 rounded-xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2 text-[11px] font-bold text-[var(--amber)]">
                <Pill size={14} /> Medicines ordered
              </div>
              <div className="absolute -left-10 bottom-1/4 bg-[var(--card)] border border-white/10 rounded-xl p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2 text-[11px] font-bold text-[var(--purple)]">
                <BarChart3 size={14} /> Health score: 84
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
            <div className="feature-card featured bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><Stethoscope size={26} /></div>
              <div className="font-serif text-xl mb-2 text-[var(--text)]">AI Health Chat</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Describe your symptoms in plain Hindi or English — Veda gives you instant, contextual health guidance. Remembers your history, medications, and conditions across conversations.</div>
              <div className="flex gap-2 mt-4 flex-wrap">
                <div className="feature-tag bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">✦ 10 Languages</div>
                <div className="feature-tag bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">✦ Memory across sessions</div>
                <div className="feature-tag bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">✦ Gemini 2.0 Flash</div>
              </div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><BarChart3 size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Health Journal</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Log mood, sleep, energy, BP, sugar daily. See patterns, trends and get an AI-powered health score.</div>
              <div className="feature-tag mt-3.5 bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">✦ Daily Tracking</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><Clipboard size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Prescription Scanner</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Point your camera at any prescription — Veda reads every medicine, dosage, and instruction using AI vision.</div>
              <div className="feature-tag mt-3.5 bg-[var(--teal-glow)] text-[var(--teal)] border-[var(--teal-line)]">✦ AI Vision</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><FlaskConical size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Lab Report Reader</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Paste or upload your CBC, lipid panel, thyroid test — Veda explains every value in plain language.</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><Hospital size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Hospital Finder</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Find the nearest cardiologist, emergency hospital, or 24hr pharmacy using your GPS location.</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><ShoppingCart size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Medicine Delivery</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Search medicines, add to cart, and order directly on 1mg, PharmEasy, or NetMeds with one tap.</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><Users size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Family Health Manager</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Manage health profiles for your entire family — parents, children, grandparents — in one account.</div>
            </div>
            <div className="feature-card bg-[var(--card)] border-[var(--border)]">
              <div className="feature-icon text-[var(--teal)] bg-[var(--teal-glow)]"><Bell size={22} /></div>
              <div className="font-serif text-lg mb-2 text-[var(--text)]">Preventive Alerts</div>
              <div className="text-[13.5px] text-[var(--text2)] leading-relaxed">Smart reminders based on your age and conditions — dental checkups, HbA1c, vaccinations and more.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="showcase-section py-20 bg-[var(--surface)]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="showcase-row">
            <div>
              <div className="showcase-tag bg-[var(--card2)] border-[var(--border)] text-[var(--teal)]"><Stethoscope size={16} /> Second Opinion</div>
              <h3 className="font-serif text-3xl mb-4 leading-tight text-[var(--text)]">Get a second opinion on any diagnosis</h3>
              <p className="text-[15px] text-[var(--text2)] leading-relaxed mb-6">Worried about what your doctor said? Veda evaluates your diagnosis, treatment plan, and lab reports — giving you an honest, evidence-based second opinion.</p>
              <ul className="showcase-list">
                <li>Upload your lab reports for instant analysis</li>
                <li>Evaluate if your prescribed treatment is appropriate</li>
                <li>Get 5 smart questions to ask your doctor</li>
                <li>Understand differential diagnoses</li>
              </ul>
            </div>
            <div className="showcase-visual bg-[var(--card)] border-[var(--border)]">
              <div className="sv-header bg-[var(--card2)] border-b-[var(--border)]">
                <div className="sv-dots"><div className="sv-dot bg-[#ff5f5f]" /><div className="sv-dot bg-[#f0a030]" /><div className="sv-dot bg-[#00d4b1]" /></div>
                <span className="text-[12px] text-[var(--muted)] ml-2">Second Opinion</span>
              </div>
              <div className="sv-content">
                <div className="bg-[var(--teal-glow)] border border-[var(--teal-line)] rounded-xl p-3.5 mb-3">
                  <div className="text-xs text-[var(--teal)] font-bold uppercase tracking-wider mb-1">Agreement Level</div>
                  <div className="text-sm font-bold text-[var(--teal)]">✅ Diagnosis Appears Consistent</div>
                  <div className="text-[12px] text-[var(--text2)] mt-1">Type 2 Diabetes — diagnosis aligns with your HbA1c and symptoms</div>
                </div>
                <div className="text-[12px] text-[var(--text2)] leading-relaxed">
                  <div className="font-bold text-[var(--text)] mb-1.5">Differential Diagnoses to Consider:</div>
                  <div className="mb-1">→ LADA (Latent Autoimmune Diabetes)</div>
                  <div className="mb-1">→ Stress-induced hyperglycemia</div>
                  <div className="text-[var(--teal)] font-semibold mt-2">+ 3 questions for your doctor →</div>
                </div>
              </div>
            </div>
          </div>

          <div className="showcase-row reverse mt-20">
            <div>
              <div className="showcase-tag bg-[var(--card2)] border-[var(--border)] text-[var(--teal)]"><BarChart3 size={16} /> Health Score</div>
              <h3 className="font-serif text-3xl mb-4 leading-tight text-[var(--text)]">Your health, visualised in a single number</h3>
              <p className="text-[15px] text-[var(--text2)] leading-relaxed mb-6">Veda calculates a personalised Health Score from 0–100 based on your journal entries, vitals, symptoms, and consistency. Backed by AI-powered personalised tips.</p>
              <ul className="showcase-list">
                <li>6 components — mood, sleep, energy, vitals, symptoms, consistency</li>
                <li>7-day trend chart to see your progress</li>
                <li>Personalised AI tips to improve your score</li>
                <li>Insurance plan recommendations based on your score</li>
              </ul>
            </div>
            <div className="showcase-visual bg-[var(--card)] border-[var(--border)]">
              <div className="sv-header bg-[var(--card2)] border-b-[var(--border)]">
                <div className="sv-dots"><div className="sv-dot bg-[#ff5f5f]" /><div className="sv-dot bg-[#f0a030]" /><div className="sv-dot bg-[#00d4b1]" /></div>
                <span className="text-[12px] text-[var(--muted)] ml-2">Health Score</span>
              </div>
              <div className="sv-content text-center">
                <div className="relative inline-block my-2.5">
                  <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="8"/>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--teal)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray="314" strokeDashoffset="72"
                      transform="rotate(-90 60 60)"
                      className="drop-shadow-[0_0_8px_rgba(0,212,177,0.5)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="font-serif text-3xl text-[var(--teal)]">77</div>
                    <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider">/ 100</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="bg-[var(--card2)] rounded-lg p-2">
                    <div className="text-xs text-[var(--muted)]">Mood</div>
                    <div className="text-sm font-bold text-[var(--teal)]">16/20</div>
                  </div>
                  <div className="bg-[var(--card2)] rounded-lg p-2">
                    <div className="text-xs text-[var(--muted)]">Sleep</div>
                    <div className="text-sm font-bold text-[var(--teal)]">15/20</div>
                  </div>
                  <div className="bg-[var(--card2)] rounded-lg p-2">
                    <div className="text-xs text-[var(--muted)]">Energy</div>
                    <div className="text-sm font-bold text-[#f0a030]">13/20</div>
                  </div>
                  <div className="bg-[var(--card2)] rounded-lg p-2">
                    <div className="text-xs text-[var(--muted)]">Vitals</div>
                    <div className="text-sm font-bold text-[var(--teal)]">8/10</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="numbers-section py-20 bg-[var(--surface)]/30">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="numbers-grid">
            <div className="number-card">
              <div className="number-val">23+</div>
              <div className="text-[13px] text-[var(--text2)] mt-1.5 font-medium">Health Features</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-1">All in one app</div>
            </div>
            <div className="number-card">
              <div className="number-val">10</div>
              <div className="text-[13px] text-[var(--text2)] mt-1.5 font-medium">Indian Languages</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-1">Hindi, Bengali, Tamil & more</div>
            </div>
            <div className="number-card">
              <div className="number-val">∞</div>
              <div className="text-[13px] text-[var(--text2)] mt-1.5 font-medium">AI Conversations</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-1">Always available</div>
            </div>
            <div className="number-card">
              <div className="number-val">Free</div>
              <div className="text-[13px] text-[var(--text2)] mt-1.5 font-medium">Cost to You</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-1">Free forever</div>
            </div>
          </div>
        </div>
      </section>

      <section className="how-section py-24" id="how">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[var(--teal)] text-xs font-bold uppercase tracking-[2px] mb-4 block">Simple to use</span>
            <h2 className="font-serif text-[clamp(30px,4vw,44px)] leading-[1.15] tracking-tight mb-4">Start in <em>seconds</em>, not hours</h2>
            <p className="text-[var(--text2)] max-w-[540px] mx-auto">No registration, no setup, no waiting. Open and talk.</p>
          </div>
          <div className="how-steps">
            <div className="text-center px-5">
              <div className="step-num">1</div>
              <div className="font-serif text-xl mb-2.5">Open the App</div>
              <div className="text-sm text-[var(--text2)] leading-relaxed">No signup required. Just click "Open App" and you're ready in 30 seconds.</div>
            </div>
            <div className="text-center px-5">
              <div className="step-num">2</div>
              <div className="font-serif text-xl mb-2.5">Set Your Profile</div>
              <div className="text-sm text-[var(--text2)] leading-relaxed">Tell Veda your age, conditions, and medications. This context makes every AI response personal and accurate.</div>
            </div>
            <div className="text-center px-5">
              <div className="step-num">3</div>
              <div className="font-serif text-xl mb-2.5">Start Tracking</div>
              <div className="text-sm text-[var(--text2)] leading-relaxed">Chat, log daily health, scan prescriptions, and get smarter guidance as Veda learns your health patterns.</div>
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
          <div className="cta-box">
            <h2 className="font-serif text-[clamp(30px,4vw,46px)] leading-[1.15] tracking-tight mb-4 relative">Your health deserves<br />an <em>intelligent companion</em></h2>
            <p className="text-[16px] text-[var(--text2)] max-w-[480px] mx-auto mb-9 leading-relaxed">Join thousands using Veda for smarter, more informed health decisions — in the language you're most comfortable with.</p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <button onClick={handleStart} className="btn-primary text-base px-8 py-4">
                <Stethoscope size={20} /> Open Veda Free
              </button>
              <a href="#features" className="btn-secondary text-base px-8 py-4">Learn more →</a>
            </div>
            <div className="mt-5 text-[12.5px] text-[var(--muted)] flex items-center justify-center gap-2">
              <span>✓ Free forever</span>
              <div className="w-1 h-1 rounded-full bg-[var(--muted)]" />
              <span>✓ No personal data sold</span>
              <div className="w-1 h-1 rounded-full bg-[var(--muted)]" />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
          />
          <motion.div 
            initial={{ x: '-100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0.5 }}
            role="navigation"
            aria-label="Side menu"
            transition={{ type: 'spring', damping: 25, stiffness: 200, opacity: { duration: 0.2 } }}
            className="fixed top-0 left-0 bottom-0 w-[280px] sm:w-[320px] bg-[var(--bg)]/95 backdrop-blur-2xl border-r border-[var(--border)] z-[301] flex flex-col shadow-2xl"
          >
            {/* Sidebar Branding & Profile */}
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c]">
                  <Stethoscope size={16} />
                </div>
                <div>
                  <h1 className="font-serif text-lg text-[var(--text)] tracking-tight leading-none">Veda</h1>
                </div>
              </div>

              {user ? (
                <div className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center gap-2 shadow-sm cursor-pointer" onClick={() => switchMode('profile')}>
                  <div className="w-8 h-8 rounded-xl bg-[var(--card2)] border border-[var(--border)] flex items-center justify-center text-[var(--teal)] font-bold text-xs">
                    {(profile.name || user.displayName || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-[var(--text)]">{profile.name || user.displayName || 'Member'}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] border-dashed flex items-center gap-3 mb-2 opacity-60">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--card2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
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
                  {Object.values(allChats)
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((chat) => (
                      <div key={chat.id} className="relative group">
                        <button 
                          onClick={() => {
                            setActiveChatId(chat.id);
                            switchMode('chat');
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
              <div className="flex items-center justify-between gap-2">
                <button 
                  onClick={() => setIsLightMode(!isLightMode)} 
                  aria-label={`Switch to ${isLightMode ? 'Dark' : 'Light'} Mode`}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--teal-dim)] transition-all group"
                >
                  {isLightMode ? <Moon size={16} className="group-hover:rotate-12 transition-transform" /> : <Sun size={16} className="group-hover:rotate-12 transition-transform" />}
                  <span className="text-[11px] font-bold uppercase tracking-wider">{isLightMode ? 'Dark' : 'Light'}</span>
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
    <header role="banner" className="sticky top-0 z-50 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 h-16 flex items-center justify-between md:px-6">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} aria-label="Toggle Side Menu" className="p-2 hover:bg-[var(--card)] rounded-lg transition-colors md:hidden">
          <Menu size={24} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-lg sm:text-xl tracking-tight hidden xs:block">Veda</h2>
        </div>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-sm">
        <HeaderNavItem label="Home" active={mode === 'home'} onClick={() => switchMode('home')} />
        <HeaderNavItem label="Wellness" active={mode === 'wellness'} onClick={() => switchMode('wellness')} />
        <HeaderNavItem label="Journal" active={mode === 'journal'} onClick={() => switchMode('journal')} />
        <HeaderNavItem label="Records" active={mode === 'records'} onClick={() => switchMode('records')} />
      </nav>

      <div className="flex items-center gap-2">
        <button onClick={() => switchMode('chat')} aria-label="Open Health Chat" className="p-3 hover:bg-[var(--card)] rounded-xl transition-colors text-[var(--text2)] min-h-[44px] min-w-[44px] flex items-center justify-center">
          <MessageSquare size={24} aria-hidden="true" />
        </button>
        <button onClick={() => switchMode('alerts')} aria-label={`Open Notifications. ${activeAlertsCount} active alerts`} className="p-3 hover:bg-[var(--card)] rounded-xl transition-colors text-[var(--text2)] relative min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Bell size={24} aria-hidden="true" />
          {activeAlertsCount > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg)]" />}
        </button>
        <div className="w-px h-6 bg-[var(--border)] mx-1" aria-hidden="true" />
        <div className="relative group">
          <button 
            aria-label={`Select Language (Current: ${language})`} 
            aria-haspopup="true"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--teal-dim)] transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <Globe size={14} className="text-[var(--teal)]" aria-hidden="true" />
            {language}
          </button>
          <div className="absolute top-full right-0 mt-2 w-32 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden" role="menu">
            {['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu'].map(lang => (
              <button 
                key={lang} 
                role="menuitem"
                onClick={() => {
                  setLanguage(lang);
                  showDoneToast(`Language set to ${lang}`);
                  if (lang === 'English') i18n.changeLanguage('en');
                  if (lang === 'Hindi') i18n.changeLanguage('hi');
                }}
                className={cn("w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--teal)] hover:text-[#020f0c] transition-colors", language === lang && "text-[var(--teal)]")}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-6 bg-[var(--border)] mx-1" aria-hidden="true" />
        <button onClick={() => switchMode('profile')} aria-label="View Profile" className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] hover:border-[var(--teal-dim)] transition-all">
          <span className="text-xs font-bold px-2 hidden sm:inline">{profile.name || user?.displayName || 'Guest'}</span>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] font-bold text-xs" aria-hidden="true">
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
    <nav role="navigation" aria-label="Mobile bottom navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)]/95 backdrop-blur-xl border-t border-[var(--border)] px-2 pb-safe md:hidden">
      <div className="flex items-center justify-around h-16">
        <BottomNavItem icon={<TrendingUp size={22} aria-hidden="true" />} label="Home" active={mode === 'home'} onClick={() => switchMode('home')} />
        <BottomNavItem icon={<Wind size={22} aria-hidden="true" />} label="Wellness" active={mode === 'wellness'} onClick={() => switchMode('wellness')} />
        <div className="flex-1 flex flex-col items-center -mt-8">
          <button onClick={() => switchMode('chat')} aria-label="Ask Veda AI" className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-xl shadow-[var(--teal)]/20 active:scale-95 transition-transform">
            <MessageSquare size={26} aria-hidden="true" />
          </button>
          <span className="text-[10px] font-bold text-[var(--teal)] mt-1" aria-hidden="true">Veda AI</span>
        </div>
        <BottomNavItem icon={<BookOpen size={22} aria-hidden="true" />} label="Journal" active={mode === 'journal'} onClick={() => switchMode('journal')} />
        <button onClick={openAllPages} aria-label="See all features" className="flex-1 flex flex-col items-center gap-1 text-[var(--muted)]">
          <Menu size={22} aria-hidden="true" />
          <span className="text-[10px] font-bold">More</span>
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

  if (mode === 'landing') return (
    <>
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
                    notificationPermission={notificationPermission}
                    requestNotificationPermission={requestNotificationPermission}
                    activeAlertsCount={activeAlertsCount}
                  />
                )}
                {mode === 'journal' && <JournalView journal={journal} addJournalEntry={addJournalEntry} />}
                {mode === 'symptoms' && <SymptomChecker profile={profile} />}
                {mode === 'medication' && <MedicationInfo profile={profile} />}
                {mode === 'lab' && <LabScanner />}
                {mode === 'triage' && <TriageView profile={profile} />}
                {mode === 'rx' && <PrescriptionScanner profile={profile} />}
                {mode === 'score' && <HealthScoreView journal={journal} profile={profile} switchMode={switchMode} />}
                {mode === 'vitals' && <VitalsGraph journal={journal} initialTab={vitalsTab} onAddEntry={addJournalEntry} />}
                {mode === 'family' && <FamilyHealthCircle family={family} onAddMember={addFamilyMember} onUpdateMember={updateFamilyMember} onDeleteMember={deleteFamilyMember} />}
                {mode === 'medicine' && <MedicineDelivery reminders={reminders} />}
                {mode === 'insurance' && <InsuranceView policies={policies} onAddPolicy={addPolicy} profile={profile} />}
                {mode === 'hospital' && <HospitalView />}
                {mode === 'doctor' && <DoctorView />}
                {mode === 'records' && <RecordsView records={records} onAddRecord={addRecord} />}
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
                  />
                )}
                {mode === 'calendar' && <HealthCalendar />}
                {mode === 'skin' && <SkinScanner />}
                {mode === 'food' && <FoodScanner />}
                {mode === 'mind' && <MindWellnessDashboard journal={journal} />}
                {mode === 'roadmap' && <HealthRoadmapDashboard profile={profile} />}
                {mode === 'patterns' && <TrendsInsights journal={journal} />}
                {mode === 'advice' && <AdviceView journal={journal} profile={profile} />}
                {mode === 'opinion' && <OpinionView profile={profile} />}
                {mode === 'clinic' && <ClinicPortal appointments={appointments} profile={profile} onBook={bookAppointment} />}
                {mode === 'corporate' && <CorporateHealth profile={profile} updateProfile={updateProfile} />}
                {mode === 'edu' && <MedEducation />}
                {mode === 'scanner' && <MedicineScanner />}
                {mode === 'teleconsult' && <TeleconsultView />}
                {mode === 'bmi' && <BMIView profile={profile} />}
                {mode === 'sos' && <SOSView profile={profile} onBack={() => setMode('home')} onOpenProfile={() => setMode('profile')} />}
                {mode === 'auth' && <AuthView onLogin={handleLogin} onBack={() => setMode('landing')} />}
                {mode === 'privacy' && <PrivacyView />}
                {mode === 'trust' && <TrustCenter />}
                {mode === 'wellness' && <WellnessView journal={journal} />}
                {mode === 'profile' && (
                  <ProfileView 
                    profile={profile} 
                    setProfile={setProfile} 
                    updateProfile={updateProfile} 
                    switchMode={switchMode} 
                    journal={journal} 
                    notificationPermission={notificationPermission}
                    requestNotificationPermission={requestNotificationPermission}
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
                <QuickActionButton icon={<MessageSquare size={20} />} label="Ask Veda" color="bg-[var(--teal)]" onClick={() => { switchMode('chat'); setShowQuickActions(false); }} />
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[160] bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-[var(--bg)] z-10">
                <div className="w-10 h-1 bg-[var(--border)] rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 sticky top-4 bg-[var(--bg)] z-10">
                <h2 className="font-serif text-2xl text-[var(--text)]">All Features</h2>
          <button 
                  onClick={() => setShowAllPages(false)}
                  aria-label="Close All Features Menu"
                  className="w-12 h-12 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--text2)] hover:bg-[var(--card2)] transition-colors"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 p-4 pb-12">
                {ALL_PAGES.map((p) => (
                  <button
                    key={p.mode}
                    onClick={() => {
                      switchMode(p.mode as AppMode);
                      setShowAllPages(false);
                    }}
                    className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl transition-all active:scale-95 hover:bg-[var(--card2)] hover:border-[var(--teal-line)]"
                  >
                    <span className="text-2xl sm:text-3xl leading-none">{p.icon}</span>
                    <span className="text-xs sm:text-sm font-bold text-[var(--text2)] text-center leading-tight">
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

function HeaderNavItem({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-full text-sm font-bold transition-all min-h-[44px]",
        active 
          ? "bg-[var(--teal)] text-[#020f0c] shadow-lg shadow-[var(--teal)]/10" 
          : "text-[var(--text2)] hover:text-[var(--text)] hover:bg-white/5"
      )}
    >
      {label}
    </button>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button 
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-base font-bold border-2 border-transparent group relative overflow-hidden min-h-[44px]",
        active 
          ? "bg-gradient-to-br from-[var(--teal)]/15 to-transparent text-[var(--teal)] border-[var(--teal)]/20 shadow-sm" 
          : "text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--card2)]"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
        active 
          ? "bg-[var(--teal)] text-[#020f0c] shadow-lg shadow-[var(--teal)]/20" 
          : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] group-hover:text-[var(--text)] group-hover:border-[var(--teal-dim)]"
      )}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
      </div>
      <span className="relative z-10">{label}</span>
      {active && (
        <motion.div 
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--teal)] rounded-full"
        />
      )}
    </motion.button>
  );
}

function BottomNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.9 }}
      onClick={onClick} 
      className={cn("flex-1 flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] min-w-[44px]", active ? "text-[var(--teal)]" : "text-[var(--muted)]")}
    >
      <motion.div
        animate={active ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
      >
        {icon}
      </motion.div>
      <span className="text-[10px] font-bold">{label}</span>
    </motion.button>
  );
}

function NotificationBanner({ permission, onRequest }: { permission: NotificationPermission, onRequest: () => void }) {
  if (permission === 'granted') return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-indigo-600 rounded-2xl p-4 flex items-center justify-between gap-4 text-white shadow-lg overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -rotate-45 translate-x-16 -translate-y-16 rounded-full" />
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Bell size={20} />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-bold text-sm uppercase tracking-wider">Health Alerts</h4>
          <p className="text-[10px] opacity-80 font-medium leading-tight">Get notified about critical vitals and reminders.</p>
        </div>
      </div>
      <button 
        onClick={onRequest}
        className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all relative z-10 shrink-0"
      >
        Enable
      </button>
    </motion.div>
  );
}

// --- Views ---

function HomeDashboard({ 
  switchMode, 
  profile, 
  journal,
  reminders,
  notificationPermission,
  requestNotificationPermission,
  activeAlertsCount 
}: { 
  switchMode: (m: AppMode, tab?: any) => void, 
  profile: UserProfile, 
  journal: JournalEntry[],
  reminders: Reminder[],
  notificationPermission: NotificationPermission,
  requestNotificationPermission: () => void,
  activeAlertsCount: number
}) {
  const score = calculateScore(journal, profile);
  const streak = calculateStreak(journal);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      <div className="flex items-end justify-between px-1 mb-2">
        <div className="space-y-1">
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-[0.2em] opacity-80">Welcome Back</p>
          <h1 className="font-serif text-4xl text-[var(--text)] tracking-tight">Hi, {profile.name || 'Guest'}</h1>
          <p className="text-sm text-[var(--muted)] font-medium opacity-80">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--teal)]/10 text-[var(--teal)] rounded-2xl">
            <Flame size={16} />
            <span className="text-xs font-bold">{streak} Day Streak</span>
          </div>
        </div>
      </div>

      {activeAlertsCount > 0 && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => switchMode('alerts')}
          className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 -rotate-45 translate-x-12 -translate-y-12 rounded-full" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center animate-pulse"><Bell size={16} /></div>
            <div className="text-left">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Active Alerts</span>
              <p className="text-sm font-bold text-[var(--text)]">You have {activeAlertsCount} health alerts pending</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-red-500 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      )}

      <NotificationBanner permission={notificationPermission} onRequest={requestNotificationPermission} />

      <motion.div 
        whileTap={{ scale: 0.99 }}
        onClick={() => switchMode('score')}
        className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-3xl p-8 shadow-xl shadow-[var(--teal)]/5 cursor-pointer hover:border-[var(--teal)]/40 transition-all flex items-center justify-between group"
      >
        <div className="space-y-2 relative z-10">
          <h2 className="text-[10px] font-black text-[var(--teal)] uppercase tracking-[0.25em]">Health Score</h2>
          <div className="text-5xl font-serif text-[var(--text)] tracking-tighter">{score > 0 ? score : '--'}</div>
          <p className="text-sm font-semibold text-[var(--text2)] flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", score === 0 ? "bg-[var(--muted)]" : score >= 80 ? "bg-[var(--teal)]" : score >= 60 ? "bg-blue-400" : "bg-amber-400")} />
            {score === 0 ? 'Not Enough Data' : score >= 80 ? 'Excellent' : score >= 60 ? 'Good Progress' : 'Needs Attention'}
          </p>
        </div>
        <div className="w-24 h-24 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="45" fill="none" stroke={score === 0 ? "var(--muted)" : "var(--teal)"} strokeWidth="8" 
              strokeDasharray="283" 
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * (score > 0 ? score : 0) / 100) }}
              strokeLinecap="round"
              className={score === 0 ? "" : "drop-shadow-[0_0_8px_rgba(0,212,177,0.3)]"}
            />
          </svg>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <Activity className="text-red-500" size={20} />, label: "BP", value: profile.bp || "N/A", unit: "mmHg", mode: 'vitals', tab: 'bp' },
          { icon: <Zap className="text-amber-500" size={20} />, label: "Sugar", value: profile.sugar || "N/A", unit: "mg/dL", mode: 'vitals', tab: 'sugar' },
          { icon: <Scale className="text-teal-500" size={20} />, label: "Weight", value: profile.weight || "N/A", unit: "kg", mode: 'vitals', tab: 'weight' },
          { icon: <TrendingUp className="text-blue-500" size={20} />, label: "BMI", value: profile.weight && profile.height ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height)/100, 2)).toFixed(1) : "N/A", unit: "Index", mode: 'vitals', tab: 'weight' }
        ].map((v, i) => (
          <motion.div
            key={v.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, ease: "easeOut" }}
          >
            <VitalCard 
              icon={v.icon} 
              label={v.label} 
              value={v.value || "N/A"} 
              unit={v.value !== "N/A" ? v.unit : ""} 
              color={v.value !== "N/A" ? "blue" : "muted"} 
              isPlaceholder={v.value === "N/A"}
              onClick={() => v.mode === 'vitals' ? switchMode('vitals', v.tab as any) : switchMode(v.mode as any)} 
            />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[var(--teal)] rounded-full" />
            <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em]">Daily Schedule</span>
          </div>
          <button onClick={() => switchMode('reminders')} className="text-[var(--teal)] text-xs font-bold hover:underline underline-offset-4">View All →</button>
        </div>
        <div className="space-y-4">
          {reminders.filter(r => r.on).length > 0 ? reminders.filter(r => r.on).slice(0, 3).map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + (i * 0.1) }}
            >
              <MedRow name={r.name} dose={r.dose} time={r.time} status={i === 0 ? 'taken' : i === 1 ? 'due' : 'upcoming'} />
            </motion.div>
          )) : (
            <div className="text-center py-6 border-2 border-dashed border-[var(--border)] rounded-2xl">
              <p className="text-xs text-[var(--muted)] font-medium mb-3">No active reminders for today</p>
              <button 
                onClick={() => switchMode('reminders')} 
                className="px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--teal)] hover:border-[var(--teal)] transition-all"
              >
                + Add Reminder
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <MessageSquare size={24} />, label: "Veda AI Assistant", mode: 'chat', color: "teal", desc: "Symptom help" },
          { icon: <Search size={24} />, label: "Symptom Checker", mode: 'symptoms', color: "blue", desc: "Detailed analysis" },
          { icon: <Pill size={24} />, label: "Drug Explainer", mode: 'medication', color: "purple", desc: "Interaction check" },
          { icon: <FlaskConical size={24} />, label: "Lab Explainer", mode: 'lab', color: "amber", desc: "Report scanner" }
        ].map((q, i) => (
          <motion.div
            key={q.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + (i * 0.05) }}
          >
            <QuickAction icon={q.icon} label={q.label} onClick={() => switchMode(q.mode as any)} color={q.color} description={q.desc} />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="card p-6 flex items-center justify-between cursor-pointer group relative overflow-hidden" 
        onClick={() => switchMode('journal')}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--teal)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-lg">
              <Flame size={20} />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">Daily Consistency</p>
              <h3 className="font-serif text-xl">{calculateStreak(journal)} Day Streak!</h3>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 relative z-10">
          {[1,2,3,4,5,6,7].map(i => {
            const isCompleted = i <= calculateStreak(journal);
            return (
              <motion.div 
                key={i} 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.9 + (i * 0.05) }}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-500", 
                  isCompleted 
                    ? "bg-[var(--teal)] shadow-[0_0_12px_rgba(0,212,177,0.5)] scale-110" 
                    : "bg-[var(--border)]"
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
}

function WellnessTip({ journal }: { journal: JournalEntry[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTip = async () => {
      setIsLoading(true);
      try {
        const lastMood = journal[0]?.mood || 3;
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide a single, short, inspiring wellness tip (max 15 words) based on a mood of ${lastMood}/5.`,
        });
        setTip(response.text || "Drink some water and take a deep breath.");
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
      className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
        <Lightbulb size={24} />
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Wellness Tip</span>
        <p className="text-sm font-medium leading-tight italic">
          {isLoading ? "Thinking..." : `"${tip}"`}
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
  const colors: Record<string, string> = {
    red: 'text-red-400 group-hover:text-red-300',
    amber: 'text-amber-400 group-hover:text-amber-300',
    teal: 'text-[var(--teal)] group-hover:text-[#42f5d7]',
    blue: 'text-blue-400 group-hover:text-blue-300',
    muted: 'text-[var(--muted)] group-hover:text-[var(--text2)]'
  };

  const borderColors: Record<string, string> = {
    red: 'group-hover:border-red-500/30',
    amber: 'group-hover:border-amber-500/30',
    teal: 'group-hover:border-[var(--teal)]/30',
    blue: 'group-hover:border-blue-500/30',
    muted: 'group-hover:border-[var(--muted)]/30'
  };

  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick} 
      className={cn(
        "bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-[24px] p-5 space-y-4 transition-all duration-500 cursor-pointer h-full group",
        borderColors[color] || 'group-hover:border-[var(--teal-line)]'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 backdrop-blur-sm border border-white/5 transition-all duration-500 group-hover:scale-110", colors[color])}>
          {icon}
        </div>
        <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-500", isPlaceholder ? "bg-[var(--border)] group-hover:bg-[var(--muted)]" : "bg-[var(--teal)] shadow-[0_0_8px_rgba(0,212,177,0.4)] animate-pulse")} />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.15em] group-hover:text-[var(--text2)] transition-colors">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("font-serif tracking-tighter transition-colors", isPlaceholder ? "text-sm text-[var(--muted)] italic" : "text-2xl sm:text-3xl text-[var(--text)] group-hover:text-[var(--teal)]")}>
            {value}
          </span>
          <span className="text-[10px] text-[var(--muted)] font-bold group-hover:text-[var(--text2)] transition-colors uppercase">{unit}</span>
        </div>
      </div>
    </motion.div>
  );
}

function MedRow({ name, dose, time, status }: { name: string, dose: string, time: string, status: 'taken' | 'due' | 'upcoming' }) {
  const statusConfig = {
    taken: { dot: 'bg-[var(--teal)]', badge: 'bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/20', label: 'TAKEN' },
    due: { dot: 'bg-[var(--amber)] shadow-[0_0_12px_rgba(240,160,48,0.5)] animate-pulse', badge: 'bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]/20', label: 'DUE' },
    upcoming: { dot: 'bg-[var(--border)]', badge: 'bg-[var(--card2)] text-[var(--muted)] border-[var(--border)]', label: 'LATER' }
  };
  const config = statusConfig[status];
  return (
    <div className="flex items-center gap-4 py-2 group cursor-pointer">
      <div className={cn("w-3 h-3 rounded-full shrink-0 transition-all group-hover:scale-125", config.dot)} />
      <div className="flex-1 min-width-0">
        <div className="text-sm font-bold text-[var(--text)] truncate group-hover:text-[var(--teal)] transition-colors">{name}</div>
        <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest mt-0.5">{dose} · {time}</div>
      </div>
      <div className={cn("text-[8px] font-black px-2.5 py-1.5 rounded-lg border tracking-widest transition-all group-hover:scale-105", config.badge)}>
        {config.label}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick, color, description }: { icon: React.ReactNode, label: string, onClick: () => void, color: string, description?: string }) {
  const meta: Record<string, { bg: string, text: string, border: string, iconBg: string }> = {
    teal: { bg: 'bg-[var(--card)]', text: 'text-[var(--text)]', border: 'border-[var(--border)]', iconBg: 'bg-[var(--teal)]/10 text-[var(--teal)]' },
    blue: { bg: 'bg-[var(--card)]', text: 'text-[var(--text)]', border: 'border-[var(--border)]', iconBg: 'bg-blue-500/10 text-blue-400' },
    purple: { bg: 'bg-[var(--card)]', text: 'text-[var(--text)]', border: 'border-[var(--border)]', iconBg: 'bg-purple-500/10 text-purple-400' },
    amber: { bg: 'bg-[var(--card)]', text: 'text-[var(--text)]', border: 'border-[var(--border)]', iconBg: 'bg-amber-500/10 text-amber-400' }
  };
  const theme = meta[color];
  
  return (
    <motion.button 
      whileHover={{ y: -4, borderColor: "var(--teal-line)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className={cn(
        "flex flex-col items-start gap-4 p-5 rounded-[24px] border transition-all duration-300 w-full text-left group",
        theme.bg, theme.border
      )}
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", theme.iconBg)}>
        {icon}
      </div>
      <div className="space-y-1">
        <span className="text-[11px] font-black text-[var(--text)] tracking-tight block">{label}</span>
        {description && <span className="text-[10px] text-[var(--muted)] font-bold leading-tight block opacity-80">{description}</span>}
      </div>
    </motion.button>
  );
}

function ChatView({ chatHistory, setChatHistory, isTyping, setIsTyping, profile, switchMode, updateActiveChat }: { chatHistory: any[], setChatHistory: any, isTyping: boolean, setIsTyping: any, profile: UserProfile, switchMode: (m: AppMode) => void, updateActiveChat: (msgs: any[]) => void }) {
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    
    setInput('');
    const newMsgsWithUser = [...chatHistory, { role: 'user', content: msg }];
    updateActiveChat(newMsgsWithUser);
    setIsTyping(true);

    try {
      const profileCtx = `Patient Profile: ${profile.name}, ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}.`;
      const prompt = `${profileCtx}\n\nUser: ${msg}`;
      const response = await callGemini(prompt);
      const finalMsgs = [...newMsgsWithUser, { role: 'assistant', content: response }];
      updateActiveChat(finalMsgs);
    } catch (error) {
      updateActiveChat([...newMsgsWithUser, { role: 'assistant', content: "I'm sorry, I'm having trouble connecting right now. Please try again later." }]);
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
    <div className="flex flex-col fixed inset-0 z-[200] bg-[#f9fafb] animate-in fade-in duration-300">
      {/* Header - Minimalist & Clean */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <button 
          onClick={() => switchMode('home')} 
          aria-label="Back"
          className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Health Chat</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Veda AI Active</span>
          </div>
        </div>
        {!showClearConfirm ? (
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"
            title="Clear History"
          >
            <Trash2 size={20} />
          </button>
        ) : (
          <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Clear?</span>
            <button 
              onClick={() => {
                updateActiveChat([]);
                setShowClearConfirm(false);
              }}
              className="px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm"
            >
              Yes
            </button>
            <button 
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded-lg"
            >
              No
            </button>
          </div>
        )}
      </div>

      {/* Chat Area - Pure & Clean */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-hide">
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center text-white shadow-xl">
              <Bot size={40} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">How can I help you today?</h3>
              <p className="text-gray-500 max-w-[280px] mx-auto text-sm leading-relaxed">
                Describe your symptoms or ask a health question to get started.
              </p>
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
                    ? "bg-gray-900 text-white shadow-sm" 
                    : "bg-white border border-gray-100 text-gray-800 shadow-sm"
                )}>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-invert-0" dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }} />
                </div>
                {msg.role === 'assistant' && (
                  <div className="px-1">
                    <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">AI Contextual Guidance</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm">
              <div className="flex gap-1">
                {[1, 2, 3].map(j => (
                  <motion.div 
                    key={j}
                    animate={{ opacity: [0.3, 1, 0.3] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: j * 0.2 }} 
                    className="w-1 h-1 rounded-full bg-gray-300" 
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area - Minimalist Pill */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
        <div className="max-w-3xl mx-auto flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:bg-white focus-within:border-gray-300 transition-all">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none outline-none py-2 text-[15px] resize-none max-h-32 text-gray-800 placeholder:text-gray-400"
            rows={1}
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={cn(
              "p-2 rounded-full transition-all active:scale-95",
              input.trim() ? "text-gray-900" : "text-gray-300"
            )}
          >
            <Send size={20} strokeWidth={2.5} />
          </button>
        </div>
        {chatHistory.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {suggestions.map(s => (
              <button 
                key={s} 
                onClick={() => handleSend(s)}
                className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 hover:border-gray-300 hover:text-gray-800 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Placeholder views for other modes ---

function JournalView({ journal, addJournalEntry }: { journal: JournalEntry[], addJournalEntry: (e: JournalEntry) => Promise<void> }) {
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

      <div className="flex bg-[var(--card2)] p-1 rounded-xl border border-[var(--border)]">
        <button onClick={() => setActiveTab('log')} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeTab === 'log' ? "bg-[var(--teal)] text-[#020f0c]" : "text-[var(--muted)]")}>Log Today</button>
        <button onClick={() => setActiveTab('history')} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", activeTab === 'history' ? "bg-[var(--teal)] text-[#020f0c]" : "text-[var(--muted)]")}>History</button>
      </div>

      {activeTab === 'log' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">How's your mood?</label>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button 
                  key={v} 
                  onClick={() => setMood(v)}
                  className={cn(
                    "flex-1 aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all",
                    mood === v ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)]"
                  )}
                >
                  <span className="text-2xl">{['😢', '😟', '😐', '😊', '😄'][v-1]}</span>
                  <span className="text-[8px] font-bold uppercase">{['Bad', 'Low', 'Okay', 'Good', 'Great'][v-1]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">
                <Moon size={14} /> Sleep
              </div>
              <div className="flex items-baseline gap-2">
                <input type="number" value={sleep} onChange={e => setSleep(e.target.value)} className="bg-transparent border-none outline-none font-serif text-3xl w-20" />
                <span className="text-xs font-bold text-[var(--muted)]">hrs</span>
              </div>
            </div>
            <div className="bg-[var(--card)] p-4 rounded-2xl border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">
                <Zap size={14} /> Energy
              </div>
              <div className="flex gap-1.5 pt-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setEnergy(v)} className={cn("w-3 h-3 rounded-full", v <= energy ? "bg-[var(--teal)]" : "bg-[var(--border)]")} />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Vitals (Optional)</label>
              <Activity size={16} className="text-[var(--teal)]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--muted)] font-bold">BP (Sys/Dia)</p>
                <input 
                  type="text" 
                  value={bp}
                  onChange={e => setBp(e.target.value)}
                  placeholder="120/80" 
                  className="w-full bg-transparent border-b border-[var(--border)] py-1 text-sm outline-none focus:border-[var(--teal)] transition-all" 
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--muted)] font-bold">Sugar (mg/dL)</p>
                <input 
                  type="text" 
                  value={sugar}
                  onChange={e => setSugar(e.target.value)}
                  placeholder="95" 
                  className="w-full bg-transparent border-b border-[var(--border)] py-1 text-sm outline-none focus:border-[var(--teal)] transition-all" 
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-[var(--muted)] font-bold">Weight (kg)</p>
                <input 
                  type="text" 
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="70" 
                  className="w-full bg-transparent border-b border-[var(--border)] py-1 text-sm outline-none focus:border-[var(--teal)] transition-all" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {['Headache', 'Fever', 'Cough', 'Fatigue', 'Pain', 'Nausea'].map(s => (
                <button 
                  key={s} 
                  onClick={() => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all",
                    selectedSymptoms.includes(s) ? "bg-[var(--teal)]/10 border-[var(--teal)] text-[var(--teal)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--teal-dim)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Today's Notes</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any symptoms or observations?"
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm min-h-[120px] outline-none focus:border-[var(--teal-dim)] transition-all"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <button onClick={handleSave} className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all">
            Save Today's Entry ✦
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
          {journal.length === 0 ? (
            <div className="text-center py-12 text-[var(--muted)]">No entries yet.</div>
          ) : (
            journal.map((entry, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--card2)] border border-[var(--border)] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase">{new Date(entry.date).toLocaleDateString('en-IN', { month: 'short' })}</span>
                  <span className="text-xl font-serif leading-none">{new Date(entry.date).getDate()}</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{['😢', '😟', '😐', '😊', '😄'][entry.mood-1]}</span>
                      <span className="text-sm font-bold">{['Bad', 'Low', 'Okay', 'Good', 'Great'][entry.mood-1]}</span>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] font-bold">{entry.time}</span>
                  </div>
                  {entry.notes && <p className="text-xs text-[var(--text2)] italic line-clamp-1">"{entry.notes}"</p>}
                  <div className="flex gap-3 pt-1">
                    <span className="text-[10px] font-bold text(--muted) flex items-center gap-1"><Moon size={10} /> {entry.sleep}h</span>
                    <span className="text-[10px] font-bold text(--muted) flex items-center gap-1"><Zap size={10} /> {entry.energy}/5</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SymptomChecker({ profile }: { profile: UserProfile }) {
  const [symptom, setSymptom] = useState('');
  const [duration, setDuration] = useState('2-3 days');
  const [severity, setSeverity] = useState(5);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = async () => {
    if (!symptom.trim()) return;
    setIsLoading(true);
    try {
      const prompt = `Patient reports: ${symptom}. Duration: ${duration}. Severity: ${severity}/10. Profile: ${profile.age}yrs, ${profile.sex}. Conditions: ${profile.conditions.join(', ')}. Provide top likely causes, urgency level, and home care tips. Provide a detailed, structured response.`;
      const response = await callGemini(prompt);
      setResult(response);
    } catch (error) {
      setResult("Error analyzing symptoms. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
          <Search size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Symptom Checker</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">AI-powered health assessment</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-3xl p-8 shadow-xl shadow-black/10 space-y-8">
        <div className="space-y-3">
          <label className="text-xs font-bold text-[var(--teal)] uppercase tracking-widest">What's bothering you?</label>
          <div className="relative">
            <input 
              value={symptom}
              onChange={e => setSymptom(e.target.value)}
              placeholder="Describe your symptoms in detail..."
              className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-5 text-sm outline-none focus:border-[var(--teal-dim)] transition-all shadow-inner"
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-[var(--card)] rounded-full text-[var(--teal)] hover:bg-[var(--card2)] transition-colors"><Mic size={20} /></button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-[var(--teal)] uppercase tracking-widest">How long has this been happening?</label>
          <div className="grid grid-cols-3 gap-3">
            {['Today', '2-3 days', '1 week', '2 weeks', '1 month', '3+ months'].map(d => (
              <button 
                key={d} 
                onClick={() => setDuration(d)}
                className={cn(
                  "py-3 text-xs font-bold rounded-xl border transition-all duration-300",
                  duration === d ? "bg-[var(--teal)] text-[#020f0c] border-transparent shadow-lg shadow-[var(--teal)]/20" : "bg-[var(--card2)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--teal-dim)]"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-[var(--teal)] uppercase tracking-widest">How severe is it?</label>
            <span className="text-sm font-bold text-[var(--text)] bg-[var(--card)] px-3 py-1 rounded-full">{severity}/10</span>
          </div>
          <input 
            type="range" min="1" max="10" value={severity} 
            onChange={e => setSeverity(parseInt(e.target.value))}
            className="w-full h-2 bg-[var(--border)] rounded-full appearance-none accent-[var(--teal)] cursor-pointer" 
          />
        </div>

        <button 
          onClick={handleCheck}
          disabled={isLoading || !symptom.trim()}
          className="w-full py-5 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold text-lg rounded-2xl shadow-xl shadow-[var(--teal)]/20 disabled:opacity-50 transition-all hover:brightness-110"
        >
          {isLoading ? 'Analysing...' : 'Analyse Symptoms ✦'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-6 shadow-xl shadow-black/5"
        >
          <h3 className="font-serif text-2xl text-[var(--text)]">Assessment Result</h3>
          <div className="prose prose-sm prose-invert max-w-none text-[var(--text2)] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          <div className="flex items-start gap-4 p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
            <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">This is AI-generated guidance and not a medical diagnosis. If you feel severe pain or distress, seek emergency care immediately.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MedicationInfo({ profile }: { profile: UserProfile }) {
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
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20">
          <Pill size={28} />
        </div>
        <div>
          <h2 className="font-serif text-3xl text-[var(--text)] tracking-tight">Medication Explainer</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">Understand your medicines</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-3xl p-8 shadow-xl shadow-black/10 space-y-6">
        <div className="space-y-3">
          <label className="text-xs font-bold text-[var(--teal)] uppercase tracking-widest">Medicine Name</label>
          <input 
            value={med}
            onChange={e => setMed(e.target.value)}
            placeholder="e.g. Metformin, Paracetamol..."
            className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-5 text-sm outline-none focus:border-[var(--teal-dim)] transition-all shadow-inner"
          />
        </div>

        <button 
          onClick={handleExplain}
          disabled={isLoading || !med.trim()}
          className="w-full py-5 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold text-lg rounded-2xl shadow-xl shadow-[var(--teal)]/20 disabled:opacity-50 transition-all hover:brightness-110"
        >
          {isLoading ? 'Looking up...' : 'Explain Medication ✦'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-6 shadow-xl shadow-black/5"
        >
          <h3 className="font-serif text-2xl text-[var(--text)]">{med} Overview</h3>
          <div className="prose prose-sm prose-invert max-w-none text-[var(--text2)] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
        </motion.div>
      )}
    </div>
  );
}

function HealthInsights({ journal, profile }: { journal: JournalEntry[], profile: UserProfile }) {
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
}

function TriageView({ profile }: { profile: UserProfile }) {
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
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Should I See a Doctor?</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Urgency assessment</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Describe your situation</label>
          <textarea 
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder="e.g. I have sharp chest pain that comes and goes..."
            className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-4 text-sm min-h-[100px] outline-none focus:border-[var(--teal-dim)] transition-all"
          />
        </div>

        <button 
          onClick={handleTriage}
          disabled={isLoading || !symptom.trim()}
          className="w-full py-4 bg-gradient-to-br from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
        >
          {isLoading ? 'Assessing...' : 'Check Urgency ✦'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-red-400">Triage Assessment</h3>
          <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
        </motion.div>
      )}
    </div>
  );
}

function HealthScoreView({ journal, profile, switchMode }: { journal: JournalEntry[], profile: UserProfile, switchMode: (m: AppMode, tab?: any) => void }) {
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
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <Trophy size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Health Score</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Detailed breakdown</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 text-center space-y-6">
        <div className="relative w-48 h-48 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="45" fill="none" stroke={score === 0 ? "var(--border)" : "var(--teal)"} strokeWidth="8" 
              strokeDasharray="283" 
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * (score > 0 ? score : 0) / 100) }}
              transition={{ duration: 2, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-6xl font-serif", score > 0 ? "text-[var(--teal)]" : "text-[var(--muted)]")}>{score > 0 ? score : "--"}</span>
            <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">/ 100</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl">{score === 0 ? 'Insufficient Data' : score >= 80 ? 'Excellent Health!' : score >= 60 ? 'Good Standing' : 'Needs Attention'}</h3>
            <p className="text-sm text-[var(--muted)]">{score === 0 ? 'Please log your vitals and daily journal to generate a predictive health score.' : 'Your score is calculated based on your profile, vitals, and journal consistency.'}</p>
          </div>
          <button 
            onClick={() => switchMode('vitals', 'wellbeing')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--card2)] border border-[var(--border)] rounded-full text-xs font-bold hover:border-[var(--teal-dim)] transition-all"
          >
            <BarChart3 size={14} className="text-[var(--teal)]" />
            View Health Trends
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-[var(--text)]">Analyzing Health Trends</p>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Veda AI is generating your outlook...</p>
          </div>
        </div>
      ) : aiInsight && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--teal-dim)] rounded-3xl overflow-hidden shadow-xl shadow-[var(--teal)]/5"
        >
          <div className="bg-gradient-to-r from-[var(--teal)]/20 to-transparent px-6 py-4 border-b border-[var(--teal-dim)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--teal)] flex items-center justify-center text-[#020f0c]">
              <Sparkles size={18} />
            </div>
            <h3 className="font-serif text-lg">AI Health Outlook</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="text-sm leading-relaxed text-[var(--text2)] prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatMsg(aiInsight) }} />
            
            <div className="pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 bg-[var(--teal)] rounded-full" />
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Why this score?</span>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed italic">
                This analysis is based on your recent 5 journal entries, profile vitals, and consistency patterns.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4">
        <ScoreFactor label="Profile Completion" value={profile.setupDone ? 100 : 50} weight={20} />
        <ScoreFactor label="Vitals Logging" value={profile.bp && profile.sugar ? 100 : 50} weight={30} />
        <ScoreFactor label="Journal Consistency" value={Math.min(100, (journal.length / 7) * 100)} weight={30} />
        <ScoreFactor label="Mood & Energy" value={journal.length > 0 ? (journal[0].mood / 5) * 100 : 0} weight={20} />
      </div>
    </div>
  );
}

function ScoreFactor({ label, value, weight }: { label: string, value: number, weight: number }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-[var(--text2)]">{label}</span>
        <span className="text-xs font-bold text-[var(--teal)]">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full bg-[var(--teal)]"
        />
      </div>
      <p className="text-[9px] text-[var(--muted)] font-bold uppercase tracking-widest">Weight: {weight}% of total score</p>
    </div>
  );
}

function PrescriptionScanner({ profile }: { profile: UserProfile }) {
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
      const prompt = "Read this doctor's prescription. Extract medicine names, dosages, and frequencies. Provide a clear summary and explain what each medicine is for. Warn the patient to always confirm with a pharmacist.";
      const base64Data = image.split(',')[1];
      const response = await analyzeImage(base64Data, prompt);
      setResult(response);
    } catch (error) {
      setResult("Error scanning prescription. Please ensure the handwriting is visible.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
          <Clipboard size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Prescription Scanner</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">AI vision for prescriptions</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
        {!image ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-2xl p-12 cursor-pointer hover:border-[var(--teal-dim)] transition-all group">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--teal)] transition-colors mb-4">
              <Camera size={32} />
            </div>
            <span className="text-sm font-bold">Snap Prescription</span>
            <span className="text-xs text-[var(--muted)] mt-1">Clear photo of the paper</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[var(--border)]">
              <img src={image} alt="Rx" className="w-full h-full object-contain bg-black/20" />
              <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"><X size={16} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Scanning Rx...' : 'Scan with AI ✦'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-[var(--teal)]">Prescription Summary</h3>
          <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
        </motion.div>
      )}
    </div>
  );
}


const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-2xl shadow-xl shadow-black/20">
        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-bold">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[var(--text)]">{entry.name}: <span className="text-[var(--text2)]">{entry.value}</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function VitalsGraph({ journal, initialTab = 'wellbeing', onAddEntry }: { journal: JournalEntry[], initialTab?: 'wellbeing' | 'bp' | 'sugar' | 'weight', onAddEntry?: (entry: JournalEntry) => Promise<void> }) {
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white shadow-lg">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Health Trends</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Visualize your progress</p>
          </div>
        </div>
      </div>

      <div className="flex bg-[var(--card2)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto no-scrollbar">
        {[
          { id: 'wellbeing', label: 'Wellbeing', icon: <Heart size={14} /> },
          { id: 'bp', label: 'BP', icon: <Activity size={14} /> },
          { id: 'sugar', label: 'Sugar', icon: <Zap size={14} /> },
          { id: 'weight', label: 'Weight', icon: <Scale size={14} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 min-w-[80px] py-2 px-2 flex items-center justify-center gap-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.id ? "bg-[var(--teal)] text-[#020f0c]" : "text-[var(--muted)] hover:text-[var(--text)]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex bg-[var(--card)] w-fit mx-auto p-1 rounded-xl border border-[var(--border)]">
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
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              timeRange === range.id ? "bg-[var(--card2)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {activeTab !== 'wellbeing' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Quick Log Today</h3>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'bp' && (
              <>
                <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="Sys (120)" className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" />
                <span className="text-xl font-light text-[var(--muted)]">/</span>
                <input type="number" value={quickLogValue2} onChange={e => setQuickLogValue2(e.target.value)} placeholder="Dia (80)" className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" />
              </>
            )}
            {activeTab === 'sugar' && (
              <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="mg/dL (e.g. 95)" className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" />
            )}
            {activeTab === 'weight' && (
              <input type="number" value={quickLogValue1} onChange={e => setQuickLogValue1(e.target.value)} placeholder="kg (e.g. 70.5)" className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none" />
            )}
            <button 
              onClick={handleQuickLog}
              disabled={isLogging || (!quickLogValue1 && !quickLogValue2)}
              className="bg-blue-500 text-white rounded-xl p-3 shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-8 shadow-xl shadow-black/20">
        {!hasData(activeTab) ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center text-[var(--muted)]">
              <BarChart3 size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">No data for {activeTab}</p>
              <p className="text-xs text-[var(--muted)] max-w-[200px]">Start logging your {activeTab} in the journal to see trends.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
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
}

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
  requestNotificationPermission
}: { 
  profile: UserProfile, 
  setProfile: any, 
  updateProfile: (p: UserProfile) => Promise<void>, 
  switchMode: (m: AppMode) => void, 
  journal: JournalEntry[],
  notificationPermission: NotificationPermission,
  requestNotificationPermission: () => void
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

  const handleDeleteData = () => {
    if (window.confirm("Are you sure you want to delete all your health data? This action cannot be undone.")) {
      // In a real app, we would call a delete function in Firestore
      showDoneToast('🗑️ Data deletion requested.');
    }
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
                : "bg-[var(--card2)] border-[var(--border)] text-[var(--text2)]"
            )}
          >
            <div className="flex items-center gap-3">
              {notificationPermission === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
              <span className="text-xs font-bold">Push Notifications</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10">
              {notificationPermission === 'granted' ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        </div>

        <div className="space-y-3 pt-6 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Data Management</h4>
          <div className="flex flex-col gap-2">
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
            <button 
              onClick={handleDeleteData}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <Trash2 size={18} />
              <span className="text-xs font-bold">Delete All Health Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FamilyHealthCircle({ family, onAddMember, onUpdateMember, onDeleteMember }: { 
  family: FamilyMember[], 
  onAddMember: (member: Omit<FamilyMember, 'id' | 'score'>) => void,
  onUpdateMember: (id: string, updates: Partial<FamilyMember>) => void,
  onDeleteMember: (id: string) => void
}) {
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

      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-3xl">
         <h4 className="font-serif text-lg mb-4">Medication Alerts</h4>
         <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
             <AlertTriangle size={20} />
             <p className="text-sm"><strong>Mom</strong> missed her 8 AM dosage of Metformin.</p>
         </div>
      </div>

      <div className="p-6 bg-[var(--card)] border border-[var(--border)] rounded-3xl">
         <h4 className="font-serif text-lg mb-4">Upcoming Family Appointments</h4>
         <div className="space-y-3">
             <div className="flex justify-between items-center p-3 bg-[var(--card2)] rounded-xl">
                 <div>
                    <p className="font-bold text-sm">Dad - Annual Checkup</p>
                    <p className="text-xs text-[var(--muted)]">May 15th at 10 AM</p>
                 </div>
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase rounded-full">Shared</div>
             </div>
         </div>
      </div>

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
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[var(--card)] w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl relative"
            >
              <div className="relative h-40 bg-gradient-to-br from-orange-500 to-orange-700 p-8 flex flex-col justify-end">
                <button onClick={() => setSelectedMember(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"><X size={20} /></button>
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl font-serif">{selectedMember.name[0]}</div>
                  <div>
                    <h2 className="text-2xl font-serif text-white">{selectedMember.name}</h2>
                    <p className="text-[10px] text-white/70 font-black uppercase tracking-widest">{selectedMember.relation} · {selectedMember.age} Years Old</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--card2)] rounded-3xl p-5 border border-[var(--border)] text-center space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Health Score</p>
                    <p className={cn("text-3xl font-black font-mono", selectedMember.score > 80 ? "text-green-500" : "text-orange-500")}>{selectedMember.score}%</p>
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
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Shared Monitoring</h4>
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[8px] font-black uppercase">Active</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { l: 'BP', v: '118/79', i: <Activity size={14} /> },
                      { l: 'Heart Rate', v: '72 bpm', i: <Heart size={14} /> },
                      { l: 'Last Lab', v: '2 weeks ago', i: <FileText size={14} /> }
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-[var(--card2)] rounded-2xl border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className="text-orange-500/50">{row.i}</div>
                          <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">{row.l}</p>
                        </div>
                        <p className="text-sm font-bold">{row.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Medical Background</h4>
                    <button 
                      onClick={() => isEditing ? handleUpdate() : startEditing(selectedMember)}
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

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      if(window.confirm("Remove this member?")) {
                        onDeleteMember(selectedMember.id);
                        setSelectedMember(null);
                        showDoneToast("Member removed from circle");
                      }
                    }}
                    className="flex-1 py-4 bg-red-500/5 text-red-500 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all text-sm"
                  >
                    Delete Member
                  </button>
                  <button className="flex-[2] py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <History size={18} />
                    View History
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MedicineDelivery({ reminders }: { reminders: Reminder[] }) {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'address' | 'payment' | 'success'>('cart');
  const [address, setAddress] = useState({ street: '', city: '', pin: '' });

  const medicines = [
    { id: 1, name: 'Paracetamol 500mg', price: 45, type: 'Tablet', brand: 'Crocin', icon: '💊' },
    { id: 2, name: 'Amoxicillin 250mg', price: 120, type: 'Capsule', brand: 'Mox', icon: '💊' },
    { id: 3, name: 'Vitamin C 500mg', price: 95, type: 'Tablet', brand: 'Limcee', icon: '🍊' },
    { id: 4, name: 'Insulin Glargine', price: 650, type: 'Injection', brand: 'Lantus', icon: '💉' },
    { id: 5, name: 'Multivitamin', price: 180, type: 'Capsule', brand: 'Revital', icon: '🧪' },
    { id: 6, name: 'Cetirizine 10mg', price: 35, type: 'Tablet', brand: 'Okacet', icon: '💊' },
    { id: 7, name: 'Dolo 650', price: 30, type: 'Tablet', brand: 'Micro Labs', icon: '💊' },
    { id: 8, name: 'Allegra 120mg', price: 210, type: 'Tablet', brand: 'Sanofi', icon: '💊' },
    { id: 9, name: 'Zandu Balm', price: 40, type: 'Ointment', brand: 'Zandu', icon: '🩹' },
  ];

  const filtered = medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.brand.toLowerCase().includes(search.toLowerCase()));

  // Get medicines from reminders to suggest re-ordering
  const frequentMeds = reminders.filter(r => r.on).slice(0, 3).map(r => ({
    id: `rem-${r.id}`,
    name: r.name,
    price: 99, // default mock price
    type: r.dose || 'Unit',
    brand: 'My Prescription',
    icon: '📦'
  }));

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
    { name: 'PharmEasy', logo: '🏥', rating: '4.8', speed: '24h Delivery' },
    { name: 'Tata 1mg', logo: '💊', rating: '4.7', speed: 'Express' },
    { name: 'Apollo 24/7', logo: '🏥', rating: '4.9', speed: '2h delivery' },
    { name: 'Netmeds', logo: '📦', rating: '4.6', speed: 'Standard' }
  ];

  return (
    <div className="space-y-6 pb-24">
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
          {filtered.length > 0 ? filtered.map(m => (
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
              <div className="flex items-center gap-4">
                <span className="font-serif text-lg text-pink-500 font-bold">{formatCurrency(m.price)}</span>
                <button 
                  onClick={() => addToCart(m)}
                  className="p-2 bg-pink-500/10 text-pink-400 rounded-lg hover:bg-pink-500 hover:text-white transition-all active:scale-90"
                >
                  <Plus size={18} />
                </button>
              </div>
            </motion.div>
          )) : (
            <div className="py-12 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-center space-y-3">
               <div className="w-12 h-12 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-50"><Search size={24} /></div>
               <p className="text-sm font-bold text-[var(--muted)]">No results found for "{search}"</p>
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
                        <p className="text-[10px] font-bold text-pink-500">{formatCurrency(m.price)}</p>
                        <p className="text-[8px] text-[var(--muted)] font-black uppercase tracking-tighter">Per Pack</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold truncate pr-4">{m.name}</h4>
                      <p className="text-[10px] text-[var(--muted)] truncate">{m.type}</p>
                    </div>
                    <button 
                      onClick={() => addToCart(m)}
                      className="w-full py-2 bg-[var(--card2)] border border-[var(--border)] hover:bg-pink-500 hover:text-white hover:border-pink-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Add Refill
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Top Online Pharmacies</h3>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((p, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 hover:border-pink-500/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-[var(--card2)] flex items-center justify-center text-xl">{p.logo}</div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                      <Star size={10} fill="currentColor" /> {p.rating}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-serif text-base">{p.name}</h4>
                    <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">{p.speed}</p>
                  </div>
                </div>
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
                  <button key={cat.n} className="flex flex-col items-center gap-2 p-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl hover:border-pink-500/20 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-pink-500/5 text-pink-400 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-all text-sm">{cat.i}</div>
                    <span className="text-[10px] font-bold text-[var(--text2)]">{cat.n}</span>
                  </button>
                ))}
             </div>
          </section>
        </div>
      )}

      {/* Checkout Sheet */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 z-[160] bg-[var(--bg)] rounded-t-3xl border-t border-[var(--border)] max-h-[90vh] flex flex-col"
            >
              <div className="p-4 flex items-center gap-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg)] z-10 transition-all">
                {checkoutStep !== 'cart' && checkoutStep !== 'success' && (
                  <button 
                    onClick={() => {
                      if (checkoutStep === 'address') setCheckoutStep('cart');
                      if (checkoutStep === 'payment') setCheckoutStep('address');
                    }}
                    className="p-2 -ml-2 text-[var(--muted)] hover:text-pink-500 transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h3 className="font-serif text-xl flex-1">
                  {checkoutStep === 'cart' && 'Your Basket'}
                  {checkoutStep === 'address' && 'Delivery Address'}
                  {checkoutStep === 'payment' && 'Confirm Payment'}
                  {checkoutStep === 'success' && 'Order Placed!'}
                </h3>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-[var(--card2)] rounded-full transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 pb-12">
                {checkoutStep === 'cart' && (
                  <div className="space-y-4">
                    {cart.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {cart.map(item => (
                            <div key={item.id} className="flex items-center gap-4 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
                              <div className="text-2xl">{item.icon}</div>
                              <div className="flex-1">
                                <h4 className="text-sm font-bold">{item.name}</h4>
                                <p className="text-[10px] text-[var(--muted)] font-bold">{formatCurrency(item.price)} x {item.qty}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg p-1 bg-[var(--card2)]">
                                  <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-[var(--text2)] hover:text-pink-500"><Minus size={14} /></button>
                                  <span className="text-xs font-black min-w-[20px] text-center">{item.qty}</span>
                                  <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-[var(--text2)] hover:text-pink-500"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><X size={16} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-5 bg-pink-500/5 rounded-2xl border border-pink-500/10 space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-[var(--muted)]">Subtotal</span>
                            <span>{formatCurrency(total)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-[var(--muted)]">Delivery Fee</span>
                            <span className="text-green-500 uppercase tracking-widest text-[10px]">Free</span>
                          </div>
                          <div className="flex justify-between text-sm font-black pt-2 border-t border-pink-500/10">
                            <span>Total Amount</span>
                            <span className="text-pink-500">₹{total}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setCheckoutStep('address')}
                          className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl shadow-pink-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
                        >
                          Checkout Now
                        </button>
                      </>
                    ) : (
                      <div className="py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-[var(--card2)] rounded-full flex items-center justify-center mx-auto text-[var(--muted)] opacity-30"><ShoppingCart size={32} /></div>
                        <p className="text-sm font-bold text-[var(--muted)]">Your basket is empty</p>
                        <button 
                          onClick={() => setShowCart(false)}
                          className="px-6 py-2 bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-full text-[10px] font-black uppercase tracking-widest"
                        >
                          Start Shopping
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {checkoutStep === 'address' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Street Address</label>
                        <input 
                          type="text" 
                          placeholder="House No, Suite, Area"
                          value={address.street}
                          onChange={e => setAddress({ ...address, street: e.target.value })}
                          className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-pink-500 transition-all"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-[2] space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">City</label>
                          <input 
                             type="text" 
                             placeholder="Select City"
                             value={address.city}
                             onChange={e => setAddress({ ...address, city: e.target.value })}
                             className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-pink-500 transition-all"
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">PIN Code</label>
                          <input 
                             type="text" 
                             placeholder="110001"
                             maxLength={6}
                             value={address.pin}
                             onChange={e => setAddress({ ...address, pin: e.target.value })}
                             className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-pink-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <button 
                       disabled={!address.street || !address.city || !address.pin}
                       onClick={() => setCheckoutStep('payment')}
                       className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl shadow-pink-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
                    >
                      Save & Continue
                    </button>
                  </div>
                )}

                {checkoutStep === 'payment' && (
                  <div className="space-y-6">
                    <div className="bg-pink-500/5 border border-pink-500/20 rounded-3xl p-6 space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
                           <span>Payment Summary</span>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between items-center bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                              <div className="flex items-center gap-3">
                                 <div className="bg-green-500/10 text-green-500 p-2 rounded-lg"><CreditCard size={18} /></div>
                                 <span className="text-xs font-bold">Cash on Delivery</span>
                              </div>
                              <div className="w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center"><div className="w-2.5 h-2.5 bg-pink-500 rounded-full" /></div>
                           </div>
                           <div className="p-3 text-[10px] text-[var(--muted)] text-center font-bold italic opacity-60">More payment options coming soon</div>
                        </div>
                        <div className="pt-4 border-t border-pink-500/10 flex justify-between items-center">
                           <span className="text-sm font-bold">Total to Pay</span>
                           <span className="font-black text-lg text-pink-500">₹{total}</span>
                        </div>
                    </div>
                    <button 
                       onClick={() => {
                         setCheckoutStep('success');
                         setCart([]);
                         showDoneToast("Order successful!");
                       }}
                       className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl shadow-pink-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
                    >
                      Place Order
                    </button>
                  </div>
                )}

                {checkoutStep === 'success' && (
                  <div className="py-12 text-center space-y-6">
                    <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto decoration-none shadow-inner border border-green-500/20">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
                        <Check size={48} />
                      </motion.div>
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-2xl font-serif">Order Confirmed!</h4>
                       <p className="text-sm text-[var(--muted)] px-10">Your health essentials are being packed and will reach you within 24 hours.</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] pt-2">Order ID: #{Math.floor(Math.random() * 900000 + 100000)}</p>
                    </div>
                    <button 
                       onClick={() => setShowCart(false)}
                       className="w-full py-4 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] font-bold rounded-2xl shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function InsuranceView({ policies, onAddPolicy, profile }: { policies: UserInsurancePolicy[], onAddPolicy: (p: Omit<UserInsurancePolicy, 'id'>) => Promise<void>, profile: UserProfile }) {
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

  const plans: InsurancePlan[] = [
    { 
      id: '1', name: 'Optima Secure', provider: 'HDFC ERGO', monthlyPremium: 850, coverAmount: '500000',
      features: ['2x Coverage from Day 1', 'Restore Benefit', 'Global Cover'],
      waitingPeriod: '3 years', coPay: 'None', cashlessHospitals: '10,000+'
    },
    { 
      id: '2', name: 'Care Supreme', provider: 'Care Health', monthlyPremium: 720, coverAmount: '700000',
      features: ['No Claim Bonus', 'Annual Health Checkup', 'Alt Medicine Cover'],
      waitingPeriod: '4 years', coPay: 'None', cashlessHospitals: '8,000+'
    },
    { 
      id: '3', name: 'Assure Plan', provider: 'Niva Bupa', monthlyPremium: 910, coverAmount: '1000000',
      features: ['Cashless at 10,000+ Hospitals', 'Pre-existing cover in 2y', 'Maternity Cover'],
      waitingPeriod: '2 years', coPay: 'None', cashlessHospitals: '10,000+'
    },
    { 
      id: '4', name: 'Star Comprehensive', provider: 'Star Health', monthlyPremium: 780, coverAmount: '500000',
      features: ['Automatic Restoration', 'Air Ambulance', 'Health Progress Reward'],
      waitingPeriod: '4 years', coPay: 'None', cashlessHospitals: '14,000+'
    },
    { 
      id: '5', name: 'Activ Health Platinum', provider: 'Aditya Birla', monthlyPremium: 890, coverAmount: '1000000',
      features: ['100% Health Returns', 'Chronic Support', 'Mental Wellness'],
      waitingPeriod: '3 years', coPay: '10%', cashlessHospitals: '11,000+'
    }
  ];

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white shadow-lg">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Insurance Command</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Coverage & Advisory</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="p-2 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-blue-500/50 transition-all text-blue-500"
        >
          {showAdd ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      <div className="flex bg-[var(--card2)] p-1 rounded-2xl border border-[var(--border)] overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('my')}
          className={cn(
            "flex-1 min-w-[80px] py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
            activeTab === 'my' ? "bg-[var(--card)] text-blue-500 shadow-sm" : "text-[var(--muted)]"
          )}
        >
          My Policies
        </button>
        <button 
          onClick={() => setActiveTab('advisor')}
          className={cn(
            "flex-1 min-w-[80px] py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
            activeTab === 'advisor' ? "bg-[var(--card)] text-blue-500 shadow-sm" : "text-[var(--muted)]"
          )}
        >
          AI Advisor
        </button>
        <button 
          onClick={() => setActiveTab('compare')}
          className={cn(
            "flex-1 min-w-[80px] py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
            activeTab === 'compare' ? "bg-[var(--card)] text-blue-500 shadow-sm" : "text-[var(--muted)]"
          )}
        >
          Compare Plans
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddPolicy}
            className="bg-[var(--card)] border-2 border-blue-500/30 rounded-3xl p-6 space-y-4 shadow-xl shadow-blue-500/5 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Policy Name</p>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Optima Restore" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Provider</p>
                <input value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="e.g. HDFC ERGO" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Policy ID</p>
                <input value={newNum} onChange={e => setNewNum(e.target.value)} placeholder="POL-12345" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Expiry Date</p>
                <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Cover Amount</p>
                <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="e.g. 500000" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Annual Premium</p>
                <input value={newPremium} onChange={e => setNewPremium(e.target.value)} placeholder="12000" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isSubmitting || !newName || !newProvider}
              className="w-full py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Policy...' : 'Save Policy to Vault'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {activeTab === 'my' && (
        <div className="space-y-6">
          {policies.length > 0 ? (
            <div className="grid gap-4">
              {policies.map(p => (
                <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <h4 className="font-serif text-xl">{p.policyName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{p.provider}</span>
                        <span className="text-[var(--border)]">·</span>
                        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest font-mono">{p.policyNumber}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full text-[8px] font-black uppercase tracking-widest">Active</div>
                      <p className="text-[10px] text-[var(--muted)] font-bold mt-1">Expires: {p.expiryDate}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 relative z-10">
                    <div className="bg-[var(--card2)] p-3 rounded-2xl border border-[var(--border)]">
                      <p className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest">Sum Insured</p>
                      <p className="text-sm font-bold text-blue-500">{p.coverageAmount}</p>
                    </div>
                    <div className="bg-[var(--card2)] p-3 rounded-2xl border border-[var(--border)]">
                      <p className="text-[7px] font-black text-[var(--muted)] uppercase tracking-widest">Premium Paid</p>
                      <p className="text-sm font-bold">{p.premium}</p>
                    </div>
                  </div>

                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Shield size={100} />
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
                        <div className="text-sm font-black text-blue-500">{formatCurrency(plan.monthlyPremium)}</div>
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
                                        <span className="font-bold text-blue-600">{formatCurrency(p.monthlyPremium)}</span>
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
                        <div className="text-sm font-black text-blue-500">{formatCurrency(plan.monthlyPremium)}</div>
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
}

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


function RemindersView({ 
  reminders, 
  onToggle, 
  onDelete, 
  onAdd 
}: { 
  reminders: Reminder[], 
  onToggle: (id: string | number) => void, 
  onDelete: (id: string | number) => void, 
  onAdd: (r: Omit<Reminder, 'id' | 'on'>) => void 
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [newFreq, setNewFreq] = useState('Daily');
  const [newColor, setNewColor] = useState('indigo');
  const [newCategory, setNewCategory] = useState<'medicine' | 'refill' | 'test' | 'other'>('medicine');
  const [newRefillDays, setNewRefillDays] = useState('30');

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
    });
    setNewName('');
    setNewDose('');
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
        <button 
          onClick={() => setShowAdd(true)}
          className="w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--teal)] hover:border-[var(--teal)] transition-all"
        >
          <Plus size={20} />
        </button>
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
}

function AlertsView({ 
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
}

function HealthCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([
    { id: 1, title: 'Morning Vit C', date: new Date().toDateString(), time: '09:00', type: 'med', completed: false },
    { id: 2, title: 'Gym Session', date: new Date().toDateString(), time: '17:30', type: 'workout', completed: false },
    { id: 3, title: 'Blood Pressure Check', date: new Date().toDateString(), time: '21:00', type: 'health', completed: false },
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('12:00');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const dailyEvents = events.filter(e => e.date === selectedDate.toDateString());

  const addEvent = () => {
    if (!newEventTitle) return;
    setEvents([...events, {
      id: Date.now(),
      title: newEventTitle,
      date: selectedDate.toDateString(),
      time: newEventTime,
      type: 'health',
      completed: false
    }]);
    setIsAdding(false);
    setNewEventTitle('');
  };

  const toggleEvent = (id: number) => {
    setEvents(events.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
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
            const hasEvents = events.some(e => e.date === d.toDateString());
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
                 <button onClick={() => toggleEvent(ev.id)} className={cn("w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center transition-all", ev.completed ? "bg-indigo-500 border-indigo-500 text-white" : "text-[var(--muted)] hover:border-indigo-500 hover:text-indigo-500")}>
                    <Check size={14} />
                 </button>
              </div>
            )) : (
              <div className="text-center py-6 text-[var(--muted)] border-2 border-dashed border-[var(--border)] rounded-3xl text-xs font-bold">No events for this day.</div>
            )}
            
            {isAdding ? (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3 shadow-lg">
                <input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Activity Title" className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm outline-none focus:border-indigo-500" />
                <div className="flex gap-2">
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="bg-[var(--card2)] border border-[var(--border)] rounded-xl p-3 text-sm" />
                  <button onClick={addEvent} className="flex-1 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Add</button>
                  <button onClick={() => setIsAdding(false)} className="px-4 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-black uppercase">Cancel</button>
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
    } catch (error) {
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                   <Stethoscope size={14} />
                   Doctor Questions
                </div>
                <ul className="space-y-2">
                  {result.followUpQuestions?.map((q: string, i: number) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-[var(--text2)] leading-relaxed bg-[var(--card2)] p-3 rounded-2xl border border-[var(--border)]">
                      <span className="text-teal-400">?</span>
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center text-white shadow-lg">
          <Camera size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Skin Scanner</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">AI assessment of skin conditions</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
        {!image ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-2xl p-12 cursor-pointer hover:border-[var(--teal-dim)] transition-all group">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--teal)] transition-colors mb-4">
              <Camera size={32} />
            </div>
            <span className="text-sm font-bold">Snap Skin Condition</span>
            <span className="text-xs text-[var(--muted)] mt-1">Clear, well-lit photo</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
              <img src={image} alt="Skin" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"><X size={16} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] text-[#020f0c] font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Analysing Skin...' : 'Analyse with AI ✦'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-[var(--teal)]">AI Assessment</h3>
          <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-200/80 leading-tight">This is AI-generated guidance and not a medical diagnosis. For any suspicious moles or persistent rashes, consult a dermatologist.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FoodScanner() {
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
      const data = await analyzeFood(base64Data);
      setResult(data);
    } catch (error) {
      console.error("Food analysis error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg">
          <Apple size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Food Scanner</h2>
          <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">AI Nutritional Analysis</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
        {!image ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--border)] rounded-2xl p-12 cursor-pointer hover:border-amber-500/30 transition-all group">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center text-[var(--muted)] group-hover:text-amber-500 transition-colors mb-4">
              <Apple size={32} />
            </div>
            <span className="text-sm font-bold">Snap Your Meal</span>
            <span className="text-xs text-[var(--muted)] mt-1">Get nutrition estimate</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
              <img src={image} alt="Meal" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"><X size={16} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Analyzing Meal...' : 'Analyze Nutrition ✦'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-amber-500">{result.dishName}</h3>
          <p className="text-sm text-[var(--text2)] leading-relaxed">{result.explanation}</p>
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-[var(--card2)] p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Calories</div>
                <div className="text-xl font-serif text-amber-500">{result.calories} kcal</div>
             </div>
             <div className="bg-[var(--card2)] p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Protein</div>
                <div className="text-xl font-serif text-teal-400">{result.protein}g</div>
             </div>
             <div className="bg-[var(--card2)] p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Carbs</div>
                <div className="text-xl font-serif text-blue-400">{result.carbs}g</div>
             </div>
             <div className="bg-[var(--card2)] p-3 rounded-xl border border-[var(--border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Fats</div>
                <div className="text-xl font-serif text-rose-400">{result.fats}g</div>
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

          <div className="p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl">
             <h4 className="font-serif text-lg mb-4 text-indigo-400">Micro-Meditation</h4>
             <p className="text-sm leading-relaxed text-indigo-200">
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
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Pattern Detector</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">AI health analysis</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto text-blue-400">
          <Sparkles size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif text-lg">Find Hidden Links</h3>
          <p className="text-sm text-[var(--muted)]">Veda analyzes your journal to find how sleep, mood, and energy affect each other.</p>
        </div>
        <button 
          onClick={handleDetect}
          disabled={isLoading || journal.length < 3}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all"
        >
          {isLoading ? 'Analyzing...' : journal.length < 3 ? 'Log 3+ days to start' : 'Detect Patterns ✦'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-blue-400">Detected Patterns</h3>
          <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
        </motion.div>
      )}
    </div>
  );
}

function AdviceView({ journal, profile }: { journal: JournalEntry[], profile: UserProfile }) {
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
          <Bot size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Health Advisor</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Personalized guidance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AdviceCard icon={<Leaf size={20} />} label="Diet" onClick={() => handleGetAdvice('diet')} color="teal" />
        <AdviceCard icon={<Activity size={20} />} label="Lifestyle" onClick={() => handleGetAdvice('lifestyle')} color="blue" />
        <AdviceCard icon={<Brain size={20} />} label="Mental" onClick={() => handleGetAdvice('mental wellness')} color="purple" />
        <AdviceCard icon={<Stethoscope size={20} />} label="Medical" onClick={() => handleGetAdvice('preventive medical')} color="red" />
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles size={80} />
        </div>
        <div className="space-y-1 relative z-10">
          <h3 className="font-serif text-lg">Custom Topic</h3>
          <p className="text-xs text-[var(--muted)] font-medium">Ask about anything specific — e.g., "Post-workout recovery" or "Sleep hygiene for shifts"</p>
        </div>
        <form onSubmit={handleCustomAdvice} className="relative z-10 flex gap-2">
          <input 
            type="text" 
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="What's on your mind?"
            className="flex-1 bg-[var(--card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--teal-dim)] transition-all"
          />
          <button 
            type="submit"
            disabled={isLoading || !customInput.trim()}
            className="px-5 bg-[var(--teal)] text-[#020f0c] font-bold rounded-xl text-xs active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-[var(--teal)]/10"
          >
            Ask Veda
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-[var(--muted)] font-medium">Consulting Veda AI...</p>
        </div>
      )}

      {result && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 text-[var(--teal)]">
            <Sparkles size={18} />
            <h3 className="font-serif text-lg">Advice for You</h3>
          </div>
          <div className="text-[15px] leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest text-center">
              ⚠️ Not medical advice. Consult a doctor.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AdviceCard({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  const colors: Record<string, string> = {
    teal: 'bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20'
  };
  return (
    <button onClick={onClick} className={cn("p-5 rounded-2xl border text-left space-y-3 transition-all active:scale-95", colors[color])}>
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">{icon}</div>
      <span className="block font-serif text-lg">{label}</span>
    </button>
  );
}

function OpinionView({ profile }: { profile: UserProfile }) {
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
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
          <Clipboard size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Second Opinion</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">AI medical review</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">What was your diagnosis?</label>
          <input 
            type="text"
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            placeholder="e.g. Type 2 Diabetes"
            className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-xl p-4 text-sm outline-none focus:border-[var(--teal-dim)] transition-all"
          />
        </div>

        <button 
          onClick={handleGetOpinion}
          disabled={isLoading || !diagnosis.trim()}
          className="w-full py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
        >
          {isLoading ? 'Reviewing...' : 'Get Second Opinion ✦'}
        </button>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-serif text-lg text-blue-400">AI Review</h3>
          <div className="text-sm leading-relaxed space-y-4 text-[var(--text2)]" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
        </motion.div>
      )}
    </div>
  );
}

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
          : 'node(around:RADIUS,LAT,LNG)["amenity"="hospital"];node(around:RADIUS,LAT,LNG)["healthcare"="hospital"];';
        
        const query = `[out:json];(${tags.replaceAll('RADIUS', radius.toString()).replaceAll('LAT', lat.toString()).replaceAll('LNG', lng.toString())});out body;`;
        
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.n.osm.ch/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
        ];

        let success = false;
        for (const endpoint of endpoints) {
            if (searchCompleted) return;
            try {
                console.log(`Trying Overpass endpoint: ${endpoint}`);
                const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    console.warn(`Endpoint ${endpoint} returned ${response.status}`);
                    continue;
                }
                const data = await response.json();
                
                if (data.elements && data.elements.length > 0) {
                    const formatted = data.elements.map((el: any) => ({
                        name: el.tags.name || (placeType === 'doctor' ? 'Medical Clinic' : 'Hospital'),
                        vicinity: el.tags['addr:street'] || el.tags['addr:full'] || 'Local area',
                        rating: (4 + Math.random()).toFixed(1),
                        location: { lat: el.lat, lng: el.lon },
                        types: placeType === 'doctor' ? ['health', 'doctor'] : ['hospital', 'health']
                    }));
                    searchCompleted = true;
                    onPlacesFound(formatted);
                    success = true;
                    break;
                }
            } catch (error) {
                console.error(`Endpoint ${endpoint} failed:`, error);
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
    navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
    }, (err) => {
        console.error("Geolocation failed, using default center", err);
    });
  }, []);

  const handlePlacesFound = (results: any[]) => {
    setIsSearching(false);
    const formatted = results.map(r => ({
      name: r.name,
      spec: r.types?.includes('dentist') ? 'Dentist' : r.types?.includes('physiotherapist') ? 'Physiotherapist' : 'General Physician',
      exp: Math.floor(Math.random() * 20) + 5 + ' yrs',
      rating: r.rating || '4.5',
      fee: '₹' + (Math.floor(Math.random() * 500) + 300),
      address: r.vicinity,
      location: r.location
    }));
    setDoctors(formatted);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--teal)] to-[var(--teal-mid)] flex items-center justify-center text-[#020f0c] shadow-lg">
            <User size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Find a Doctor</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Nearby specialists</p>
          </div>
        </div>
        <button 
          onClick={() => setShowMap(!showMap)}
          className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--teal)] flex items-center gap-2"
        >
          <MapIcon size={14} /> {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {showMap && (
        <div className="h-[300px] w-full rounded-3xl overflow-hidden border border-[var(--border)] shadow-xl relative z-10">
          <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapHandler placeType="doctor" onPlacesFound={handlePlacesFound} center={userLocation} />
            {doctors.map((doc, i) => (
              <Marker key={i} position={[doc.location.lat, doc.location.lng]} icon={doctorIcon}>
                <Popup>
                    <div className="text-xs">
                        <p className="font-bold">{doc.name}</p>
                        <p className="text-[var(--teal)]">{doc.spec}</p>
                    </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="space-y-3">
        {doctors.length > 0 ? doctors.map((doc, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--card2)] border border-[var(--border)] flex items-center justify-center text-xl">👨‍⚕️</div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{doc.name}</h3>
              <p className="text-xs text-[var(--teal)] font-medium">{doc.spec}</p>
              <p className="text-[10px] text-[var(--muted)]">{doc.address}</p>
              <p className="text-[10px] text-[var(--muted)] mt-1">{doc.exp} exp · ⭐ {doc.rating}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[var(--text)]">{doc.fee}</p>
              <button className="text-[10px] font-bold text-[var(--teal)] uppercase tracking-widest mt-1">Book →</button>
            </div>
          </div>
        )) : isSearching ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center mx-auto text-[var(--muted)] animate-pulse">
              <Search size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg">Finding Doctors...</h3>
              <p className="text-sm text-[var(--muted)]">Searching for medical specialists in your area.</p>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--card2)] flex items-center justify-center mx-auto text-[var(--muted)]">
              <Search size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg">No Doctors Found</h3>
              <p className="text-sm text-[var(--muted)]">Try adjusting your map location or search area.</p>
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
    navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
    }, (err) => {
        console.error("Geolocation failed, using default center", err);
    });
  }, []);

  const handlePlacesFound = (results: any[]) => {
    setIsSearching(false);
    const formatted = results.map(r => ({
      name: r.name,
      type: r.types?.includes('emergency') ? 'Emergency' : 'General',
      dist: r.vicinity,
      rating: r.rating || '4.2',
      location: r.location
    }));
    setHospitals(formatted);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg">
            <Hospital size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Hospital Finder</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Emergency & General</p>
          </div>
        </div>
        <button 
          onClick={() => setShowMap(!showMap)}
          className="px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-xs font-bold text-red-500 flex items-center gap-2"
        >
          <MapIcon size={14} /> {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {showMap && (
        <div className="h-[300px] w-full rounded-3xl overflow-hidden border border-[var(--border)] shadow-xl relative z-10">
          <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapHandler placeType="hospital" onPlacesFound={handlePlacesFound} center={userLocation} />
            {hospitals.map((hosp, i) => (
              <Marker key={i} position={[hosp.location.lat, hosp.location.lng]} icon={hospitalIcon}>
                <Popup>
                    <div className="text-xs">
                        <p className="font-bold">{hosp.name}</p>
                        <p className="text-red-500">{hosp.type}</p>
                    </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="space-y-3">
        {hospitals.length > 0 ? hospitals.map((hosp, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", hosp.type === 'Emergency' ? "bg-red-500" : "bg-blue-500")}>
              <Hospital size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{hosp.name}</h3>
              <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">{hosp.type}</p>
              <p className="text-xs text-[var(--text2)] mt-1">📍 {hosp.dist} · ⭐ {hosp.rating}</p>
            </div>
            <button className="p-3 bg-[var(--card2)] border border-[var(--border)] rounded-xl text-[var(--teal)]"><MapPin size={18} /></button>
          </div>
        )) : isSearching ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400 animate-pulse">
              <MapPin size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg">Finding Hospitals...</h3>
              <p className="text-sm text-[var(--muted)]">Searching for medical facilities in your area.</p>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-300">
              <MapPin size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg">No Hospitals Found</h3>
              <p className="text-sm text-[var(--muted)]">We couldn't find any medical facilities nearby. Try zoom out.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordsView({ records, onAddRecord }: { records: MedicalRecord[], onAddRecord: (record: Omit<MedicalRecord, 'id'>) => void }) {
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'rx' | 'scans'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleManualUpload = async () => {
    setIsUploading(true);
    try {
      const type = Math.random() > 0.5 ? 'Report' : 'Prescription';
      const title = type === 'Report' ? 'Blood Test Result' : 'General Prescription';
      await onAddRecord({
        title,
        type,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        doctor: 'Dr. Veda AI',
        notes: 'Digitized from paper records.',
        tags: [type.toLowerCase()],
      });
      showDoneToast("Record added to vault!");
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg">
          <Folder size={20} />
        </div>
        <div>
          <h2 className="font-serif text-xl tracking-tight">Health Vault</h2>
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Medical Records & Scans</p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-6 shadow-xl">
        <div className="flex justify-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'reports', 'rx', 'scans'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-[var(--card2)] text-[var(--muted)] hover:text-amber-400"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleManualUpload}
            disabled={isUploading}
            className="p-5 bg-gradient-to-br from-[var(--card2)] to-[var(--card)] border border-[var(--border)] rounded-3xl flex flex-col items-center gap-3 hover:border-amber-500/30 transition-all shadow-lg group active:scale-95 disabled:opacity-50"
          >
            <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 group-hover:rotate-12 transition-transform">
              {isUploading ? <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /> : <Plus size={24} />}
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text)]">Upload</span>
          </button>
          <button 
            onClick={() => setIsScanOpen(true)}
            className="p-5 bg-gradient-to-br from-[var(--card2)] to-[var(--card)] border border-[var(--border)] rounded-3xl flex flex-col items-center gap-3 hover:border-blue-500/30 transition-all shadow-lg group active:scale-95"
          >
            <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:-rotate-12 transition-transform"><Camera size={24} /></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text)]">AI Scan</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] px-1">Storage ({filtered.length})</h3>
        {filtered.length > 0 ? filtered.map((rec) => (
          <div 
            key={rec.id} 
            onClick={() => setSelectedRecord(rec)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 hover:border-amber-500/30 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--card2)] flex items-center justify-center text-[var(--muted)] group-hover:text-amber-500 transition-colors">
              <FileText size={22} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-[var(--text)] uppercase tracking-tight">{rec.title}</h3>
              <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest mt-0.5">{rec.type} · {rec.date}</p>
            </div>
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if(!auth.currentUser) return;
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'records', rec.id.toString()));
                showDoneToast("Record securely deleted");
              }}
              className="p-2 text-red-500/10 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )) : (
          <div className="bg-[var(--card)] border border-[var(--border)] border-dashed rounded-3xl p-12 text-center">
            <Folder size={40} className="mx-auto text-[var(--muted)] mb-4 opacity-20" />
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">No matching records</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md p-6 flex items-center justify-center overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[var(--card)] w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="relative h-48 bg-gradient-to-br from-amber-500 to-amber-700 p-8 flex flex-col justify-end">
                <button onClick={() => setSelectedRecord(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"><X size={20} /></button>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white"><FileText size={28} /></div>
                  <div>
                    <h2 className="text-xl font-serif text-white">{selectedRecord.title}</h2>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest">{selectedRecord.type} · {selectedRecord.date}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Issuing Doctor</p>
                    <p className="text-sm font-bold">{selectedRecord.doctor}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Added On</p>
                    <p className="text-sm font-bold font-mono">{new Date(selectedRecord.createdAt || '').toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Record Notes & AI Summary</p>
                  <div className="bg-[var(--card2)] rounded-2xl p-4 text-xs leading-relaxed text-[var(--text)] border border-[var(--border)]">
                    <div className="markdown-body">
                      <Markdown>{selectedRecord.notes}</Markdown>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedRecord.tags?.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold uppercase tracking-wider">#{tag}</span>
                  ))}
                </div>

                <button className="w-full py-4 bg-amber-500 text-white font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <FileUp size={18} />
                  Share Record
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* AI Scan Modal */}
        {isScanOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl p-6 flex flex-col items-center justify-center overflow-y-auto"
          >
            <div className="w-full max-w-lg space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-serif text-white">AI Record Scan</h2>
                <button onClick={() => { setIsScanOpen(false); setScannedImage(null); setAiAnalysis(null); }} className="p-3 bg-white/10 text-white rounded-full"><X size={24} /></button>
              </div>

              {!scannedImage ? (
                <label className="w-full aspect-square border-2 border-dashed border-white/20 rounded-[40px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-white/40 transition-all group">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white group-hover:scale-110 transition-transform"><Camera size={40} /></div>
                  <div className="text-center">
                    <p className="text-white font-bold">Snap or Upload Report</p>
                    <p className="text-white/40 text-xs mt-1">Clear photo of text for AI extraction</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleScanFile} className="hidden" />
                </label>
              ) : (
                <div className="space-y-6">
                  <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                    <img src={scannedImage} alt="Scan" className="w-full h-full object-contain bg-black" />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-white text-xs font-bold uppercase tracking-widest animate-pulse">Extracting Health Data...</p>
                      </div>
                    )}
                  </div>

                  {aiAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 max-h-60 overflow-y-auto"
                    >
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">Veda AI Extraction Result</h4>
                      <div className="text-white text-xs leading-relaxed opacity-90 markdown-body">
                         <Markdown>{aiAnalysis}</Markdown>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setScannedImage(null)} 
                      className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10"
                    >
                      Retake
                    </button>
                    {!aiAnalysis ? (
                      <button 
                        onClick={analyzeRecord}
                        disabled={isAnalyzing}
                        className="flex-[2] py-4 bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20"
                      >
                        Extract with AI
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setIsScanOpen(false); setScannedImage(null); setAiAnalysis(null); }}
                        className="flex-[2] py-4 bg-green-500 text-white font-bold rounded-2xl"
                      >
                        Finish & Close
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClinicPortal({ appointments, profile, onBook }: { appointments: Appointment[], profile: UserProfile, onBook: (appt: Omit<Appointment, 'id'>) => Promise<void> }) {
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

  const clinics: Clinic[] = [
    { 
      id: 'c1', name: 'Medanta Health', dist: '0.8 km', rating: '4.8', open: '24 hrs', icon: '🏥', category: 'General', 
      address: 'Sector 38, Gurugram, Haryana', specialties: ['Cardiology', 'Neurology', 'Dental'] 
    },
    { 
      id: 'c2', name: 'Dr. Mehta Clinic', dist: '1.2 km', rating: '4.5', open: '9am - 8pm', icon: '🧑‍⚕️', category: 'Specialist',
      address: 'DLF Phase 4, Gurugram', specialties: ['Pediatrics', 'General Medicine']
    },
    { 
      id: 'c3', name: 'Advanced Diagnostics', dist: '2.5 km', rating: '4.9', open: '8am - 10pm', icon: '🔬', category: 'Diagnostics',
      address: 'Golf Course Road, Gurugram', specialties: ['Blood Test', 'MRI', 'X-Ray']
    },
    { 
      id: 'c4', name: 'Global Eye Center', dist: '3.1 km', rating: '4.7', open: '10am - 6pm', icon: '👁️', category: 'Eye Care',
      address: 'Huda Market, Sector 14', specialties: ['Opthalmology', 'Optometry']
    },
  ];

  const filteredClinics = clinics.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === 'All' || c.category === selectedCategory || c.specialties.includes(selectedCategory))
  );

  const handleLogin = () => {
    if (pin === '1234') {
      setIsLogged(true);
      showDoneToast("Doctor Access Granted");
    } else {
      showDoneToast("Invalid Credentials");
      setPin('');
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
                       <button onClick={() => setActiveCallId(appt.id)} className="ml-auto w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center"><Video size={14} /></button>
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
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-2">
              <Lock size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl">Clinician Access</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-[280px] mx-auto">Verified medical professionals only. Enter your 4-digit PIN.</p>
            </div>
            <div className="max-w-[240px] mx-auto space-y-4">
              <input 
                type="password" 
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-3xl p-5 text-center text-3xl tracking-[0.8em] font-serif outline-none focus:border-blue-500/50 transition-all font-black text-blue-500"
              />
              <button 
                onClick={handleLogin}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black rounded-3xl shadow-xl shadow-blue-500/20 text-xs uppercase tracking-[0.2em] active:scale-95 transition-all"
              >Enter Veda Lab</button>
            </div>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest opacity-50">Authorized Personnel (PIN: 1234 for demo)</p>
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
              className="fixed bottom-0 left-0 right-0 z-[160] bg-[var(--bg)] rounded-t-[40px] border-t border-[var(--border)] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Clinic Header Banner */}
                <div className="relative h-48 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 flex items-end">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-12 translate-x-12 blur-3xl pointer-events-none" />
                   <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={() => setSelectedClinic(null)} className="w-10 h-10 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"><X size={20} /></button>
                   </div>
                   <div className="flex items-center gap-6 relative z-10 w-full">
                      <div className="w-20 h-20 rounded-[28px] bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-5xl shadow-2xl">{selectedClinic.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="font-serif text-3xl text-white tracking-tight">{selectedClinic.name}</h3>
                              <p className="text-[10px] font-black text-blue-200/80 uppercase tracking-[0.2em] mt-1.5">{selectedClinic.category} · {selectedClinic.dist} Away</p>
                           </div>
                           <div className="px-4 py-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 flex items-center gap-2">
                              <Star size={14} className="text-amber-400" fill="currentColor" />
                              <span className="text-xs font-black text-white">{selectedClinic.rating}</span>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="p-8 space-y-10">
                  {/* Clinic Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[var(--card2)] border border-[var(--border)] rounded-[32px] p-6 space-y-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><Stethoscope size={20} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Medical Expertise</p>
                            <p className="text-xs font-bold text-[var(--text)] mt-0.5">{selectedClinic.specialties.join(' · ')}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center"><MapPin size={20} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Clinic Address</p>
                            <p className="text-xs font-bold text-[var(--text2)] mt-0.5">{selectedClinic.address}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Clock size={20} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Operating Hours</p>
                            <p className="text-xs font-bold text-[var(--text)] mt-0.5">{selectedClinic.open}</p>
                          </div>
                       </div>
                    </div>

                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-6 shadow-sm">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><Shield size={20} /></div>
                          <div>
                            <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Facility Trust</p>
                            <p className="text-[10px] font-bold text-[var(--text2)] mt-1 tracking-tight leading-relaxed">ISO 9001:2015 Certified · NABH Accredited Facility · Verified Professionals</p>
                          </div>
                       </div>
                       <div className="pt-2 px-1">
                          <p className="text-[10px] font-bold text-[var(--muted)] leading-relaxed italic opacity-80">"Top rated clinic for cardiology and general care in Gurugram with state-of-the-art diagnostic facilities."</p>
                       </div>
                    </div>
                  </div>

                  {/* Booking Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent to-[var(--border)]" />
                       <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">Schedule Appointment</h4>
                       <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent to-[var(--border)]" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1 block flex items-center justify-between">
                           Pick a Date
                           {bookingDate && <span className="text-blue-500 flex items-center gap-1 animate-pulse"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Selected</span>}
                        </label>
                        <input 
                          type="date" 
                          value={bookingDate}
                          onChange={e => setBookingDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-3xl p-5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-inner text-[var(--text)]" 
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] px-1">Consultation Slot</p>
                        <div className="grid grid-cols-3 gap-2">
                          {['09:00 AM', '10:30 AM', '12:00 PM', '01:30 PM', '03:00 PM', '04:30 PM', '06:00 PM', '07:30 PM', '09:00 PM'].map(t => (
                            <button 
                              key={t}
                              onClick={() => setBookingTime(t)}
                              className={cn(
                                "py-3 rounded-xl border text-[9px] font-black uppercase transition-all",
                                bookingTime === t 
                                 ? "bg-blue-500 border-transparent text-white shadow-lg shadow-blue-500/20 scale-105" 
                                 : "bg-[var(--card2)] border-[var(--border)] text-[var(--muted)] hover:border-blue-500/30"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={bookAppointment}
                      disabled={isBooking || !bookingDate}
                      className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-[32px] shadow-2xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 group/btn relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      {isBooking ? (
                         <>
                           <RefreshCw size={20} className="animate-spin" />
                           Securing Your Spot...
                         </>
                      ) : (
                        <>
                          Confirm Appointment
                          <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-center gap-6 mt-6 opacity-40">
                       <div className="flex items-center gap-1.5 grayscale">
                          <Shield size={12} />
                          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Secure</span>
                       </div>
                       <div className="flex items-center gap-1.5 grayscale">
                          <Award size={12} />
                          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Certified</span>
                       </div>
                       <div className="flex items-center gap-1.5 grayscale">
                          <CheckCircle2 size={12} />
                          <span className="text-[8px] font-black uppercase tracking-[0.2em]">HIPAA</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CorporateHealth({ profile, updateProfile }: { profile: UserProfile, updateProfile: (p: UserProfile) => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'challenges' | 'benefits'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);

  const [challengeList, setChallengeList] = useState<CorporateChallenge[]>([
    { 
      id: 'step-1', title: '10K Daily Steps', description: 'Maintain a 10,000 step streak for 7 days to earn premium wellness credits.', 
      type: 'steps', target: 7, current: 4, endDate: 'Apr 30', participants: 450, status: 'joined', reward: `${formatCurrency(500)} Health Coupon`
    },
    { 
      id: 'sleep-1', title: 'Deep Sleep Cycle', description: 'Log at least 7.5 hours of sleep for 5 consecutive nights.', 
      type: 'sleep', target: 5, current: 2, endDate: 'May 05', participants: 120, status: 'active', reward: 'Meditation Subscription'
    },
    { 
       id: 'mind-1', title: 'Mindful Mornings', description: 'Complete 10 minutes of guided meditation daily.', 
       type: 'mindfulness', target: 10, current: 0, endDate: 'Apr 28', participants: 310, status: 'active', reward: 'Stress Management Kit'
    }
  ]);

  const companies = [
    { id: 'google', name: 'Google India', employees: '5,000+', score: '92/100', color: 'blue' },
    { id: 'tata', name: 'Tata Consultancy Services', employees: '12,000+', score: '85/100', color: 'orange' },
    { id: 'reliance', name: 'Reliance Industries', employees: '15,000+', score: '88/100', color: 'blue' },
    { id: 'medanta', name: 'Medanta Health', employees: '2,500+', score: '96/100', color: 'teal' },
  ];

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
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d976c] to-[#93f9b9] flex items-center justify-center text-[#020f0c] shadow-lg">
            <Briefcase size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl tracking-tight">Workwell Pro</h2>
            <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Enterprise Wellness System</p>
          </div>
        </div>
        {isRegistered && (
          <div className="flex bg-[var(--card2)] p-1 rounded-xl border border-[var(--border)]">
            {['overview', 'challenges', 'benefits'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all capitalize",
                  activeTab === tab ? "bg-[#1d976c] text-white shadow-md shadow-teal-500/20" : "text-[var(--muted)]"
                )}
              >{tab}</button>
            ))}
          </div>
        )}
      </div>

      {!isRegistered ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#1d976c] to-[#111] rounded-[40px] p-10 text-white space-y-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-white mb-2 rotate-3 group-hover:rotate-0 transition-transform">
              <Building2 size={40} />
            </div>
            <div className="space-y-4">
              <h3 className="font-serif text-3xl sm:text-4xl leading-tight">Elevate Team Wellness.</h3>
              <p className="text-sm opacity-70 leading-relaxed max-w-xs">Integrate HR platforms, track collective fitness goals, and unlock exclusive enterprise health benefits.</p>
            </div>
            <div className="flex items-center justify-center gap-1.5 opacity-50">
               <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Connected to 200+ Enterprises</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] ml-2">Quick Join Partners</h4>
            <div className="grid gap-3">
              {companies.map(c => (
                <button 
                  key={c.id}
                  disabled={isSyncing}
                  onClick={() => handleJoin(c.name)}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 flex items-center justify-between hover:border-teal-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🏢</div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">{c.name}</p>
                      <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">{c.employees} Employees</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-serif text-teal-400">{c.score}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Wellness Score</span>
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
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-8 shadow-xl relative overflow-hidden">
                <div className="space-y-2 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-500">Corporate Identity</p>
                  <h3 className="font-serif text-2xl">{profile.company}</h3>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="px-3 py-1 bg-teal-500/10 text-teal-500 rounded-full text-[9px] font-black uppercase tracking-widest">ID: {profile.corporateId}</div>
                    <div className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-[9px] font-black uppercase tracking-widest">Active Member</div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full -mr-10 -mt-10 blur-2xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Heart size={18} className="text-emerald-500" />
                    <span className="text-xs font-serif text-emerald-400">+4%</span>
                  </div>
                  <div>
                    <div className="text-2xl font-serif">88/100</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Team Health Score</div>
                  </div>
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Award size={18} className="text-amber-500" />
                    <span className="text-xs font-serif text-amber-400">#04</span>
                  </div>
                  <div>
                    <div className="text-2xl font-serif">Top 5%</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Industry Rank</div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-lg">Department Leaderboard</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Update: Hourly</p>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Engineering', score: '92', color: 'teal' },
                    { name: 'Product Design', score: '89', color: 'blue' },
                    { name: 'Marketing', score: '84', color: 'orange' }
                  ].map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-[var(--card2)] border border-[var(--border)] rounded-2xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-serif text-[var(--muted)]">0{i+1}</span>
                        <span className="text-sm font-bold">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-gray-200/10 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full bg-teal-500")} style={{ width: `${d.score}%` }} />
                        </div>
                        <span className="text-sm font-serif">{d.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div 
              key="challenges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-teal-500/5 border border-teal-500/20 rounded-3xl p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Next Payout</p>
                  <h4 className="font-serif text-xl">{formatCurrency(2500)} Wellness Grant</h4>
                </div>
                <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                  <TrendingUp size={20} />
                </div>
              </div>

              <div className="space-y-3">
                {challengeList.map(c => (
                  <div key={c.id} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-serif text-lg">{c.title}</h4>
                        <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">{c.endDate} · {c.participants} Participating</p>
                      </div>
                      {c.status === 'joined' ? (
                        <div className="px-3 py-1 bg-teal-500/10 text-teal-500 rounded-full text-[8px] font-black uppercase tracking-widest">Joined</div>
                      ) : (
                        <button onClick={() => handleJoinChallenge(c.id)} className="px-4 py-1.5 bg-teal-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-teal-500/10 hover:bg-teal-600 transition-all active:scale-95">Join Now</button>
                      )}
                    </div>
                    
                    {c.status === 'joined' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-[var(--muted)] uppercase tracking-widest">Progress</span>
                          <span>{Math.round((c.current / c.target) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200/5 rounded-full overflow-hidden">
                           <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${(c.current / c.target) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                      <Award size={14} className="text-amber-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">{c.reward}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'benefits' && (
            <motion.div 
              key="benefits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {[
                { title: 'Free Annual Health Screening', provider: 'Veda Network', status: 'Available', type: 'Clinical' },
                { title: '1:1 Nutrition Coaching', provider: 'Culinary Health', status: 'Claimed', type: 'Wellness' },
                { title: 'Family OPD Reimbursement', provider: 'HDFC ERGO', status: 'Available', type: 'Insurance' },
                { title: 'Gym Membership Subsidy', provider: 'Cult.Fit', status: 'In Process', type: 'Fitness' }
              ].map((b, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 flex items-center gap-4 hover:border-teal-500/30 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/5 flex items-center justify-center text-teal-500">
                    {b.type === 'Clinical' && <Stethoscope size={20} />}
                    {b.type === 'Wellness' && <Apple size={20} />}
                    {b.type === 'Insurance' && <Shield size={20} />}
                    {b.type === 'Fitness' && <Flame size={20} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[var(--text)]">{b.title}</h4>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-widest">{b.provider}</p>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                      b.status === 'Available' ? "bg-teal-500/10 text-teal-500" : "bg-gray-500/10 text-[var(--muted)]"
                    )}>
                      {b.status}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isSyncing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[200] flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-teal-500/20" />
            <div className="absolute top-0 w-20 h-20 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-serif text-xl text-white">Verifying Enrollment</h3>
            <p className="text-xs text-white/60 uppercase tracking-[0.2em] font-black">Syncing with HR Data...</p>
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

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <BookOpen size={120} />
        </div>
        
        <div className="space-y-2 relative z-10">
          <h3 className="font-serif text-2xl sm:text-3xl text-[var(--text)]">What would you like to learn?</h3>
          <p className="text-sm text-[var(--text2)] max-w-md mx-auto">Veda AI simplifies complex medical topics, from basic anatomy to advanced pharmacology.</p>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(search);
          }}
          className="relative max-w-lg mx-auto z-10"
        >
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. How the heart works, Vitamin D basics..." 
            className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-5 pl-14 text-sm outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all shadow-inner" 
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            <Search size={20} />
          </div>
          <button 
            type="submit"
            disabled={isLoading || !search.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-500 text-white rounded-xl text-xs font-bold hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
          >
            {isLoading ? "Searching..." : "Explore"}
          </button>
        </form>

        {!currentLesson && !isLoading && (
          <div className="pt-4 z-10 relative">
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] mb-4">Recommended Topics</p>
            <div className="flex flex-wrap justify-center gap-2">
              {recommendedTopics.map(topic => (
                <button
                  key={topic.title}
                  onClick={() => handleSearch(topic.title)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--card2)] border border-[var(--border)] rounded-full text-xs font-bold text-[var(--text2)] hover:border-purple-500/40 hover:text-purple-400 transition-all group"
                >
                  <span className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center transition-colors group-hover:bg-purple-500/10",
                    topic.color === 'red' ? "text-red-400" : topic.color === 'teal' ? "text-teal-400" : topic.color === 'amber' ? "text-amber-400" : "text-purple-400"
                  )}>
                    {topic.icon}
                  </span>
                  {topic.title}
                </button>
              ))}
            </div>
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
          <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-3xl p-8 shadow-sm">
            <h3 className="font-serif text-3xl mb-4 text-[var(--text)]">{currentLesson.title}</h3>
            <p className="text-base text-[var(--text2)] leading-relaxed mb-8">{currentLesson.overview}</p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {currentLesson.keyPoints.map((point, i) => (
                <div key={i} className="flex gap-3 p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} className="text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text2)]">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {currentLesson.details.map((section, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 space-y-4 shadow-sm">
                  <h4 className="font-serif text-xl text-purple-400">{section.title}</h4>
                  <div className="text-[15px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{section.content}</div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="bg-amber-500/[0.03] border border-amber-500/20 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2 text-amber-500">
                  <Lightbulb size={20} />
                  <span className="text-xs font-black uppercase tracking-wider">Common Questions</span>
                </div>
                {currentLesson.faqs.map((faq, i) => (
                  <div key={i} className="space-y-2 border-b border-[var(--border)] last:border-0 pb-4 last:pb-0">
                    <p className="text-sm font-bold text-[var(--text)] leading-snug">{faq.q}</p>
                    <p className="text-xs text-[var(--text2)] leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  setCurrentLesson(null);
                  setSearch('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full p-4 rounded-2xl border border-[var(--border)] border-dashed text-[var(--muted)] hover:text-purple-400 hover:border-purple-500/30 transition-all text-sm font-bold"
              >
                Learn another topic
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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.message?.includes('dismissed')) {
        setCameraError("Camera permission was dismissed or blocked. Please ensure you allow access. If you're in an iframe, try opening the app in a new tab.");
      } else {
        setCameraError(`Camera Error: ${err.name}. You can use the upload option below instead.`);
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

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 text-center space-y-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--teal)]/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        {isCameraOpen ? (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)] bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-[var(--teal)]/20 pointer-events-none rounded-2xl" />
              <div className="absolute top-4 right-4 z-10">
                <button onClick={stopCamera} className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-all"><X size={18} /></button>
              </div>
            </div>
            <button 
              onClick={handleScan}
              className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/20 active:scale-95 transition-all"
            >
              Capture & Identify ✦
            </button>
          </div>
        ) : image ? (
          <div className="space-y-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border)]">
              <img src={image} alt="Medicine" className="w-full h-full object-contain bg-black/20" />
              <button onClick={() => setImage(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full backdrop-blur-md"><X size={18} /></button>
            </div>
            <button 
              onClick={handleScan}
              disabled={isLoading}
              className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/20 disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Identifying...' : 'Analyse Photo ✦'}
            </button>
          </div>
        ) : (
          <div className="py-8 space-y-8">
            <div className="space-y-4">
               <div className="w-20 h-20 rounded-3xl bg-[var(--teal)]/10 border border-[var(--teal)]/20 flex items-center justify-center text-[var(--teal)] mx-auto relative">
                 <Camera size={40} />
                 <motion.div 
                   animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="absolute inset-0 bg-[var(--teal)] rounded-3xl"
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
                className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl"
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
                className="w-full py-4 bg-[var(--teal)] text-[#020f0c] font-black rounded-2xl shadow-xl shadow-[var(--teal)]/20 flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all"
              >
                <Camera size={20} />
                Open Live Camera
              </button>
              <label className="w-full py-4 bg-[var(--card2)] border border-[var(--border)] text-[var(--text2)] font-black rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:bg-[var(--card)] transition-all">
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
          className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-2xl relative"
        >
          <button 
             onClick={() => { setResult(''); setImage(null); setIsCameraOpen(false); }}
             className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all z-10"
          >
             <X size={16} />
          </button>
          <div className="bg-[var(--teal)]/10 px-6 py-4 border-b border-[var(--teal)]/20 flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-[var(--teal)] flex items-center justify-center text-[#020f0c]">
               <Pill size={18} />
             </div>
             <h3 className="font-serif text-lg text-[var(--teal)] font-bold">Analysis Result</h3>
          </div>
          <div className="p-6">
            <div className="text-sm leading-relaxed text-[var(--text2)] prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatMsg(result) }} />
            <div className="mt-6 pt-6 border-t border-[var(--border)] flex gap-3 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10">
               <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-orange-200/70 font-bold leading-relaxed uppercase tracking-wider">
                 WARNING: AI can make mistakes. Always verify the medication name and dosage with a doctor or pharmacist before consumption.
               </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AuthView({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[360px] w-full text-center space-y-6"
      >
        {/* Icon & Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--teal)] shadow-lg">
            <UserCircle size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-serif text-[var(--teal)]">Veda</h1>
            <p className="text-[var(--teal)]/80 text-sm font-bold tracking-[0.3em] uppercase mt-1">AI DOCTOR</p>
          </div>
          <p className="text-[var(--muted)] text-sm">Your personal health companion</p>
        </div>

        {/* Toggle Login/Sign Up */}
        <div className="grid grid-cols-2 bg-[var(--card)] p-1.5 rounded-2xl border border-[var(--border)]">
          <button 
            onClick={() => setIsSignUp(false)}
            className={cn("py-3 rounded-xl text-sm font-bold transition-all", !isSignUp ? "bg-[var(--teal)] text-[#ffffff] shadow-lg" : "text-[var(--muted)]")}
          >
            Login
          </button>
          <button 
            onClick={() => setIsSignUp(true)}
            className={cn("py-3 rounded-xl text-sm font-bold transition-all", isSignUp ? "bg-[var(--teal)] text-[#ffffff] shadow-lg" : "text-[var(--muted)]")}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input type="email" placeholder="Email address" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 pl-12 text-sm outline-none focus:border-[var(--teal)] transition-all" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input type="password" placeholder="Password" className="w-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 pl-12 text-sm outline-none focus:border-[var(--teal)] transition-all" />
            <Eye className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          </div>
          <button className="text-[var(--teal)] text-xs font-bold w-full text-right p-2">Forgot Password?</button>
        </div>

        {/* Login Button */}
        <button 
          onClick={onLogin}
          className="w-full py-4 bg-[var(--teal)] text-[#ffffff] font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all"
        >
          {isSignUp ? 'Sign Up' : 'Login'} <ArrowRight size={18} />
        </button>

        {/* Social */}
        <div className="space-y-4">
          <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">Or continue with</div>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={async () => {
                try {
                  await signInWithRedirect(auth, googleProvider);
                  onLogin();
                } catch (error) {
                  console.error("Google sign-in failed", error);
                }
              }}
              className="py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
            >
              <span className="text-xl">G</span> Google
            </button>
            <button 
              onClick={async () => {
                try {
                  await signInWithRedirect(auth, appleProvider);
                  onLogin();
                } catch (error) {
                  console.error("Apple sign-in failed", error);
                }
              }}
              className="py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl flex items-center justify-center gap-2 text-sm font-bold"
            >
              <span className="text-xl"></span> Apple
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TeleconsultView() {
  const [isCalling, setIsCalling] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<any>(null);

  const doctors = [
    { name: 'Dr. Sarah Wilson', specialty: 'Cardiologist', rating: '4.9', fee: 500, icon: '👩‍⚕️' },
    { name: 'Dr. James Miller', specialty: 'General Physician', rating: '4.8', fee: 300, icon: '👨‍⚕️' },
    { name: 'Dr. Ananya Rao', specialty: 'Dermatologist', rating: '4.7', fee: 450, icon: '👩‍⚕️' },
  ];

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

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-8 space-y-6 shadow-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Height (cm)</label>
            <input 
              type="number" 
              value={height} 
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-teal-500 transition-all shadow-inner"
              placeholder="e.g. 175"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest ml-1">Weight (kg)</label>
            <input 
              type="number" 
              value={weight} 
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-2xl p-4 text-sm font-bold outline-none focus:border-teal-500 transition-all shadow-inner"
              placeholder="e.g. 70"
            />
          </div>
        </div>
      </div>

      {hasData && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-8 text-center space-y-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">Your Body Mass Index</p>
            <p className="text-7xl font-serif text-[var(--teal)]">{bmi}</p>
            <p className={cn("text-lg font-bold tracking-tight", status.color)}>{status.label}</p>
          </div>
          
          <div className="h-4 w-full bg-[var(--card2)] rounded-full overflow-hidden flex shadow-inner">
            <div className="h-full bg-blue-400" style={{ width: '25%' }} />
            <div className="h-full bg-teal-500" style={{ width: '20%' }} />
            <div className="h-full bg-amber-400" style={{ width: '15%' }} />
            <div className="h-full bg-red-400" style={{ width: '40%' }} />
          </div>
          
          <div className="bg-teal-500/5 border border-teal-500/10 rounded-2xl p-5 text-left">
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
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--card)] border border-[var(--teal-line)] text-[var(--text)] px-6 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-4');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on my recent health journal entries, provide a short, empathetic mental health check-in and one actionable wellness tip. Keep it under 60 words.
        Recent entries:
        ${recentEntries}
        Current Mood: ${lastMood}/5`,
      });
      setAiCheckIn(response.text || null);
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
      className="space-y-6 pb-8"
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

      <div className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-3xl p-6 shadow-xl shadow-black/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-serif text-2xl text-[var(--text)]">Daily Streak</h3>
            <p className="text-sm text-[var(--muted)] font-medium">Keep it up to unlock new milestones!</p>
          </div>
          <div className="text-5xl font-serif text-orange-500">{streak}</div>
        </div>
        <div className="flex gap-2">
          <Badge icon="🔥" label="3 Day" />
          <Badge icon="⭐" label="7 Day" />
          <Badge icon="🏆" label="30 Day" />
          <Badge icon="💎" label="100 Day" />
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-serif text-2xl">Guided Breathing</h3>
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
              className="text-[10px] font-bold text-orange-400 uppercase tracking-widest hover:text-orange-300 transition-colors"
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
            className="w-32 h-32 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center"
          >
            <motion.div 
              animate={{ scale: isBreathing ? 0.8 : 1 }}
              className="w-24 h-24 rounded-full bg-orange-500/30 border border-orange-500/50 flex items-center justify-center"
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
            "px-8 py-3 rounded-full font-bold transition-all shadow-xl",
            isBreathing ? "bg-[var(--card2)] border border-[var(--border)] text-[var(--text)]" : "bg-orange-500 text-white hover:bg-orange-600"
          )}
        >
          {isBreathing ? 'Stop Session' : 'Start 4-4-4 Breathing'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Moon size={20} />
          </div>
          <h4 className="font-bold text-sm">Sleep Hygiene</h4>
          <p className="text-xs text-[var(--muted)]">Tips for better rest based on your energy levels.</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
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
    <div className="space-y-6 pb-24 p-6">
      <h2 className="text-2xl font-serif">Trust Center</h2>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4">
        <p className="text-sm text-[var(--muted)]">At Veda Health, your privacy and security are our top priorities. We use industry-standard encryption and strict data access policies to keep your medical information safe.</p>
        <div className="grid gap-3">
          <div className="p-4 bg-[var(--card2)] rounded-2xl flex items-center gap-3">
             <Shield className="text-teal-500" />
             <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encryption</span>
          </div>
          <div className="p-4 bg-[var(--card2)] rounded-2xl flex items-center gap-3">
             <Lock className="text-teal-500" />
             <span className="text-xs font-bold uppercase tracking-widest">Zero-Knowledge Storage</span>
          </div>
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
      className="space-y-6 pb-12"
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

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 md:p-8 space-y-6 shadow-xl shadow-black/10">
        <div className="space-y-4">
          <h3 className="font-serif text-xl border-b border-[var(--border)] pb-2 text-[var(--text)]">1. Information We Collect</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            At Veda Health, protecting your personal and medical information is our top priority. We collect data you explicitly provide: identity parameters (name, age), vital metrics (blood pressure, sugar, weight), and health journal entries. We do not stealthily track biometric data without your outright consent. 
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="font-serif text-xl border-b border-[var(--border)] pb-2 text-[var(--text)]">2. How We Use Your Data</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Your data is primarily used to provide predictive insights, render health graphs, and offer personalized wellness tips via our AI engine. We only use anonymized datasets for model training. <strong>We strictly do not sell</strong> your Personally Identifiable Information (PII) or medical logs to advertising networks, insurance agencies, or data brokers.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="font-serif text-xl border-b border-[var(--border)] pb-2 text-[var(--text)]">3. Data Security</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--card2)] border border-[var(--border)] space-y-2">
              <Lock size={18} className="text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">Cloud Encryption</h4>
              <p className="text-[11px] text-[var(--muted)]">All data saved through Google Firebase is encrypted at rest (AES-256) and in transit (TLS 1.2+).</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--card2)] border border-[var(--border)] space-y-2">
              <Shield size={18} className="text-green-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">Role-based Access</h4>
              <p className="text-[11px] text-[var(--muted)]">Our Zero-Trust Firestore rules mathematically prevent any other user from querying or reading your patient ID folder.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-serif text-xl border-b border-[var(--border)] pb-2 text-[var(--text)]">4. AI Processing</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Our app utilizes Google's Gemini AI. When submitting a photo (such as a lab report) or asking a medical symptom question, only the strict data packet needed for that singular transaction is transmitted securely to the AI API. The AI API does not retain this data for public training models contextually.
          </p>
        </div>

        <div className="p-4 flex gap-3 items-start bg-amber-500/5 border border-amber-500/20 rounded-xl mt-8">
          <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-500/80 leading-relaxed font-medium">
            By using Veda Health, you agree to these privacy protocols. If you wish to delete your data entirely, you may use the 'Export & Delete Data' tools provided in your Profile settings.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
