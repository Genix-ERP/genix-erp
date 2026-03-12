import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  X,
  Search,
  Settings,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from "lucide-react";
import { pbxService } from '@/api/services';
import { useTranslation } from "@/components/utils/translations";
import { useLanguage } from "@/components/contexts/LanguageContext";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { useCompany } from "@/components/contexts/CompanyContext";

export default function PhoneWidget({ isOpen, onClose }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { customers, leads } = useCustomers();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;

  const [dialNumber, setDialNumber] = useState('+998');
  const [activeCall, setActiveCall] = useState(null);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showRecents, setShowRecents] = useState(false);
  const [recentCalls, setRecentCalls] = useState([]);
  const [isConfigured, setIsConfigured] = useState(false);

  const timerRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const widgetRef = useRef(null);
  const contactsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Close contacts dropdown on outside click
  useEffect(() => {
    if (!showContacts) return;
    const handleClick = (e) => {
      if (contactsRef.current && !contactsRef.current.contains(e.target)) {
        setShowContacts(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showContacts]);

  useEffect(() => {
    if (isOpen) {
      const loadConfig = async () => {
        const config = await pbxService.getConfig();
        setIsConfigured(pbxService.isConfigured(config));
      };
      loadConfig();
      loadRecentCalls();
    }
  }, [isOpen, companyId]);

  const loadRecentCalls = useCallback(async () => {
    try {
      const logs = await pbxService.getCallLogs(companyId);
      setRecentCalls(Array.isArray(logs) ? logs.slice(0, 5) : []);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    }
  }, [companyId]);

  // Call timer
  useEffect(() => {
    if (activeCall && isCallInProgress) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeCall, isCallInProgress]);

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredContacts = [...(Array.isArray(customers) ? customers : []), ...(Array.isArray(leads) ? leads : [])]
    .filter(c => c.phone)
    .filter(c => {
      if (!contactSearch) return true;
      const s = contactSearch.toLowerCase();
      return (
        c.company_name?.toLowerCase().includes(s) ||
        c.contact_name?.toLowerCase().includes(s) ||
        c.name?.toLowerCase().includes(s) ||
        c.phone?.includes(contactSearch)
      );
    })
    .slice(0, 6);

  const handleDialDigit = (digit) => setDialNumber(prev => prev + digit);
  const handleBackspace = () => setDialNumber(prev => prev.slice(0, -1));

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setDialNumber(contact.phone || '');
    setShowContacts(false);
    setContactSearch('');
  };

  const handleMakeCall = async () => {
    if (!dialNumber.trim()) return;
    setIsCallInProgress(true);
    try {
      const result = await pbxService.makeCall(dialNumber, {
        customerId: selectedContact?.id,
        customerName: selectedContact?.company_name || selectedContact?.contact_name || selectedContact?.name,
        companyId
      });
      setActiveCall({ id: result.callId, number: dialNumber, status: 'connecting' });
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
      }, 2000);
    } catch (error) {
      console.error('Failed to make call:', error);
      setIsCallInProgress(false);
    }
  };

  const handleEndCall = async () => {
    if (activeCall) {
      try {
        await pbxService.endCall(activeCall.id, companyId);
        await pbxService.updateCallLog(activeCall.id, { call_duration: callDuration, call_outcome: 'completed' }, companyId);
        await loadRecentCalls();
      } catch (error) {
        console.error('Failed to end call:', error);
      }
    }
    setActiveCall(null);
    setIsCallInProgress(false);
    setCallDuration(0);
  };

  // Reset state when widget is closed
  useEffect(() => {
    if (!isOpen) {
      setDialNumber('+998');
      setSelectedContact(null);
      setContactSearch('');
      setShowContacts(false);
      setShowRecents(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  return (
    <div
      ref={widgetRef}
      className="fixed right-4 top-16 z-50 w-[300px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200"
      style={{ maxHeight: 'calc(100vh - 80px)' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-white" />
          <span className="text-white font-semibold text-sm">
            {t('phone') || 'Telefon'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isConfigured && (
            <Badge className="bg-white/20 text-white text-[10px] border-0">
              {t('not_configured') || 'Sozlanmagan'}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Active Call View */}
      {activeCall && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-6 text-center">
          <div className="w-14 h-14 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-3">
            <PhoneCall className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-white font-medium text-lg">{activeCall.number}</p>
          {selectedContact && (
            <p className="text-slate-400 text-xs mt-1">
              {selectedContact.company_name || selectedContact.contact_name || selectedContact.name}
            </p>
          )}
          <p className="text-emerald-400 text-sm mt-2 font-mono">
            {activeCall.status === 'connecting' ? (t('connecting') || 'Ulanmoqda...') : formatDuration(callDuration)}
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className={`h-10 w-10 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleEndCall}
              className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialer View */}
      {!activeCall && (
        <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          {/* Contact Picker */}
          {selectedContact ? (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2">
              <User className="w-4 h-4 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-800 truncate">
                  {selectedContact.company_name || selectedContact.contact_name || selectedContact.name}
                </p>
                <p className="text-[10px] text-emerald-600">{selectedContact.phone}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedContact(null); setDialNumber('+998'); }}
                className="h-5 w-5 text-emerald-600 hover:text-red-500 rounded-full"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="relative" ref={contactsRef}>
              <Button
                variant="outline"
                className="w-full justify-start text-xs text-slate-500 h-8"
                onClick={() => setShowContacts(!showContacts)}
              >
                <Search className="w-3 h-3 mr-2" />
                {t('select_contact') || 'Kontaktni tanlash...'}
              </Button>
              {showContacts && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  <div className="p-2">
                    <Input
                      placeholder={t('search') || 'Qidirish...'}
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">{t('no_results_found')}</p>
                    ) : (
                      filteredContacts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSelectContact(c)}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {c.contact_name || c.name || c.company_name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {c.company_name && (c.contact_name || c.name) ? `${c.company_name} · ` : ''}{c.phone}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phone Number Display */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-3 py-2">
            <Input
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              className="border-0 bg-transparent text-center text-lg font-mono font-semibold h-8 focus-visible:ring-0 px-0"
              placeholder="+998"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackspace}
              className="h-7 w-7 text-slate-400 hover:text-red-500 rounded-full flex-shrink-0"
            >
              <Delete className="w-4 h-4" />
            </Button>
          </div>

          {/* Dial Pad */}
          <div className="grid grid-cols-3 gap-1.5">
            {dialPad.flat().map((digit) => (
              <Button
                key={digit}
                variant="ghost"
                onClick={() => handleDialDigit(digit)}
                className="h-11 text-lg font-semibold hover:bg-slate-100 rounded-xl transition-all active:scale-95"
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Call Button */}
          <Button
            onClick={handleMakeCall}
            disabled={!dialNumber.trim() || isCallInProgress}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
          >
            {isCallInProgress ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Phone className="w-4 h-4 mr-2" />
                {t('call') || "Qo'ng'iroq"} {dialNumber && dialNumber !== '+998' ? dialNumber : ''}
              </>
            )}
          </Button>

          {/* Recent Calls Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowRecents(!showRecents)}
            className="w-full h-7 text-xs text-slate-500 hover:text-slate-700"
          >
            <Clock className="w-3 h-3 mr-1" />
            {t('recent_calls') || "So'nggi qo'ng'iroqlar"}
            {showRecents ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>

          {/* Recent Calls */}
          {showRecents && recentCalls.length > 0 && (
            <div className="space-y-1">
              {recentCalls.map((call, i) => (
                <button
                  key={call.id || i}
                  onClick={() => setDialNumber(call.phone_number || call.to_number || '')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    call.call_type === 'outbound' ? 'bg-green-100' : call.call_type === 'missed' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    <Phone className={`w-3 h-3 ${
                      call.call_type === 'outbound' ? 'text-green-600' : call.call_type === 'missed' ? 'text-red-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {call.customer_name || call.phone_number || call.to_number}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {call.phone_number || call.to_number}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
