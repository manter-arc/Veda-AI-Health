import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, 
  MapPin, 
  Share2, 
  Heart, 
  AlertTriangle, 
  Stethoscope, 
  Pill, 
  Dna,
  ArrowLeft,
  Settings,
  Activity
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface SOSViewProps {
  profile: UserProfile;
  onBack: () => void;
  onOpenProfile: () => void;
}

export function SOSView({ profile, onBack, onOpenProfile }: SOSViewProps) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setSharing(true);
    setError(null);

    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    const successCallback = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      const message = `EMERGENCY: I need help. My current location: ${mapsLink}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'SOS Emergency Location',
            text: message,
            url: mapsLink
          });
        } catch (err) {
          console.error("Error sharing:", err);
          // Fallback to copy if share canceled or fails but we have the link
          copyToClipboard(message);
        }
      } else {
        copyToClipboard(message);
      }
      setSharing(false);
    };

    const errorCallback = (err: GeolocationPositionError) => {
      console.warn(`Geolocation error (${err.code}): ${err.message}`);
      
      // If high accuracy failed, try one more time with low accuracy
      if (options.enableHighAccuracy) {
        options.enableHighAccuracy = false;
        navigator.geolocation.getCurrentPosition(successCallback, (err2) => {
          let msg = "Could not get your location. Please check GPS settings.";
          if (err2.code === 1) msg = "Location permission denied. Please allow location access in your browser settings.";
          if (err2.code === 3) msg = "Location request timed out. Please try again in an open area.";
          
          setError(msg);
          setSharing(false);
        }, options);
      } else {
        setError("Could not get your location. Please ensure GPS is enabled.");
        setSharing(false);
      }
    };

    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Location link copied to clipboard. You can now paste it into a message.");
  };

  const hasEmergencyContact = profile.emergencyContactName && profile.emergencyContactPhone;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-20 relative overflow-hidden">
      {/* Dynamic Background Pulse */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div 
          animate={{ opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-red-600 blur-[120px]"
        />
      </div>

      <header role="banner" className="p-4 flex items-center justify-between bg-[var(--bg)]/80 backdrop-blur-xl border-b border-red-500/10 sticky top-0 z-50">
        <button onClick={onBack} aria-label="Go back to dashboard" className="p-2.5 hover:bg-white/5 rounded-2xl transition-all">
          <ArrowLeft size={22} className="text-[var(--text2)]" aria-hidden="true" />
        </button>
        <h1 className="font-serif text-xl text-red-500 font-bold flex items-center gap-2 tracking-tight">
          <AlertTriangle size={24} className="animate-pulse" aria-hidden="true" />
          {t('sos.title', 'Emergency SOS')}
        </h1>
        <div className="w-10" />
      </header>

      <div className="p-5 max-w-md mx-auto space-y-8 relative z-10">
        {/* Emergency Contact Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">
              {t('sos.contact_header', 'Primary Responder')}
            </h2>
            <div className="flex gap-1">
               <div className="w-1 h-1 rounded-full bg-red-500" />
               <div className="w-1 h-1 rounded-full bg-red-500/40" />
               <div className="w-1 h-1 rounded-full bg-red-500/20" />
            </div>
          </div>
          
          {hasEmergencyContact ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-red-950/20 border border-red-500/20 rounded-[28px] p-7 shadow-2xl space-y-6 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/20 relative">
                  <Heart size={32} fill="currentColor" className="animate-pulse" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--card)] rounded-full flex items-center justify-center border-2 border-[var(--card)]">
                    <div className="w-full h-full bg-green-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold tracking-tight">{profile.emergencyContactName}</h3>
                  <p className="text-[10px] text-red-400 uppercase tracking-[0.15em] font-black mt-1">{profile.emergencyContactRelation}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <motion.a 
                  whileHover={{ scale: 1.02, backgroundColor: "#dc2626" }}
                  whileTap={{ scale: 0.98 }}
                  href={`tel:${profile.emergencyContactPhone}`}
                  aria-label={`Call emergency contact ${profile.emergencyContactName}`}
                  className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-red-900/30 transition-all"
                >
                  <Phone size={18} aria-hidden="true" />
                  {t('sos.call_now', 'CALL CONTACT')}
                </motion.a>
              </div>
            </motion.div>
          ) : (
            <div className="bg-[var(--card)] border-2 border-dashed border-red-500/20 rounded-[28px] p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/40 mx-auto">
                <Heart size={32} />
              </div>
              <p className="text-sm text-[var(--text2)] font-medium max-w-[200px] mx-auto opacity-80 leading-relaxed">
                Connect your primary emergency responder for instant help tracking.
              </p>
              <button 
                onClick={onOpenProfile}
                className="bg-white/5 border border-white/10 text-red-500 px-6 py-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-white/10 transition-all"
              >
                <Settings size={16} />
                {t('sos.setup_now', 'SET UP NOW')}
              </button>
            </div>
          )}
        </section>

        {/* Location Sharing Card */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[var(--card)] to-[var(--card2)] border border-[var(--border)] rounded-[28px] p-7 shadow-xl space-y-5 relative overflow-hidden"
        >
          <div className="flex items-center gap-4 text-[var(--text)]">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <MapPin size={22} />
            </div>
            <h3 className="font-serif text-xl tracking-tight">{t('sos.share_location', 'Live Location Alert')}</h3>
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed font-medium">
            {t('sos.location_desc', 'Safety coordinates will be sent instantly to your emergency contact for tracking.')}
          </p>
          
          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={shareLocation}
            disabled={sharing}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-2xl",
              sharing ? "bg-[var(--card2)] text-[var(--muted)] border border-[var(--border)]" : "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-orange-900/20"
            )}
          >
            {sharing ? (
              <div className="w-5 h-5 border-2 border-[var(--muted)] border-t-[var(--teal)] rounded-full animate-spin" />
            ) : (
              <Share2 size={18} />
            )}
            {sharing ? t('sos.getting_location', 'LOCATING...') : t('sos.send_sos', 'BROADCAST SOS')}
          </motion.button>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl"
            >
              <p className="text-[10px] text-red-500 font-bold text-center leading-relaxed">{error}</p>
            </motion.div>
          )}
        </motion.section>

        {/* Medical Summary Card */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] px-1">
            {t('sos.medical_id', 'Responder Medical ID')}
          </h2>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-b from-[var(--card)] to-[var(--bg)] border border-[var(--border)] rounded-[28px] overflow-hidden shadow-2xl"
          >
            {/* Header info */}
            <div className="bg-gradient-to-br from-red-600 via-red-700 to-rose-700 p-6 text-white flex justify-between items-end relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
              <div className="relative z-10">
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-80 font-black mb-1">{t('sos.patient_name', 'Patient Card')}</p>
                <h4 className="font-serif text-3xl tracking-tight">{profile.name}</h4>
              </div>
              <div className="text-right relative z-10">
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-80 font-black mb-1">{t('sos.blood_group', 'Blood')}</p>
                <div className="text-4xl font-serif leading-none tracking-tighter">{profile.blood || '--'}</div>
              </div>
            </div>

            <div className="p-7 space-y-7">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-orange-400">
                    <AlertTriangle size={14} />
                    {t('sos.allergies', 'Allergies')}
                  </div>
                  <p className="text-sm font-bold text-[var(--text2)] leading-relaxed">
                    {profile.allergies.length > 0 ? profile.allergies.join(', ') : t('common.none', 'N/A')}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-blue-400">
                    <Pill size={14} />
                    {t('sos.medications', 'Meds')}
                  </div>
                  <p className="text-sm font-bold text-[var(--text2)] leading-relaxed">
                    {profile.medicines.length > 0 ? profile.medicines.map(m => m.name).join(', ') : t('common.none', 'N/A')}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t border-[var(--border)]">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--teal)]">
                  <Stethoscope size={14} />
                  {t('sos.conditions', 'Active Conditions')}
                </div>
                <p className="text-sm font-bold text-[var(--text2)] leading-relaxed">
                  {profile.conditions.length > 0 ? profile.conditions.join(', ') : t('common.none', 'Clear')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[var(--border)]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-red-400">
                    <Activity size={14} />
                    {t('sos.vitals', 'Latest Vitals')}
                  </div>
                  <div className="text-xs flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                      <span className="text-[var(--text2)] font-bold text-[9px]">BP</span>
                      <span className="text-[var(--text)] font-black text-[11px]">{profile.bp || '--'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-2 py-1.5 border border-white/5">
                      <span className="text-[var(--text2)] font-bold text-[9px]">BS</span>
                      <span className="text-[var(--text)] font-black text-[11px]">{profile.sugar || '--'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-purple-400">
                    <Dna size={14} />
                    {t('sos.history', 'Family Hist')}
                  </div>
                  <p className="text-[10px] font-bold text-[var(--muted)] leading-relaxed line-clamp-3">
                    {profile.familyHistory.length > 0 ? profile.familyHistory.join(', '): 'No major records'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Quick Help Action */}
        <div className="pt-4 pb-8">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.location.href = 'tel:112'}
            className="w-full bg-red-600 text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-red-900/30 transition-all border-b-4 border-red-800"
          >
            <Phone size={24} fill="white" />
            {t('sos.emergency_services', 'Emergency 112')}
          </motion.button>
          <div className="flex items-center gap-3 mt-5 px-4">
             <div className="h-px flex-1 bg-[var(--border)]" />
             <p className="text-[9px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">Regional Dispatch</p>
             <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <p className="text-[10px] text-center text-[var(--muted)] mt-4 font-medium leading-relaxed opacity-60">
            {t('sos.call_disclaimer', 'Connection to nearest emergency response. Please use for life-threatening emergencies only.')}
          </p>
        </div>
      </div>
    </div>
  );
}

