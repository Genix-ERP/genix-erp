import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Play,
  Pause,
  Volume2,
  Mic,
  MicOff,
  Clock,
  Settings,
  Check,
  X,
  Loader2,
  Delete,
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  Copy,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { pbxService } from '@/api/services';
import { useTranslation } from "@/components/utils/translations";
import { useCustomers } from "@/components/contexts/CustomersContext";
import { formatDateTime } from '@/utils/formatDate';
import { toast } from 'sonner';

export default function CallInterface({ callLogs = [], onUpdate, customer, language = 'en', companyId }) {
  const { t } = useTranslation(language);
  const { customers, leads } = useCustomers();
  const [activeCall, setActiveCall] = useState(null);
  const [dialNumber, setDialNumber] = useState(customer?.phone || '+998');
  const [selectedContact, setSelectedContact] = useState(customer || null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pbxConfig, setPbxConfig] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [localCallLogs, setLocalCallLogs] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const connectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current); };
  }, []);

  // Load PBX config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const config = await pbxService.getConfig();
      setPbxConfig(config || {
        enabled: false,
        provider: 'onlinepbx',
        domain: '',
        api_key: '',
        extension: '',
        caller_id: ''
      });
      setIsConfigured(pbxService.isConfigured(config));
    };
    loadConfig();
    loadCallLogs();
  }, [companyId]);

  const loadCallLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await pbxService.getCallLogs(companyId);
      setLocalCallLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    }
    setIsLoadingLogs(false);
  }, [companyId]);

  // Update dial number when customer prop changes
  useEffect(() => {
    if (customer?.phone) {
      setDialNumber(customer.phone);
      setSelectedContact(customer);
    }
  }, [customer]);

  // Filter contacts for the picker
  const filteredContacts = [...(Array.isArray(customers) ? customers : []), ...(Array.isArray(leads) ? leads : [])]
    .filter(c => c.phone)
    .filter(c => {
      if (!contactSearch) return true;
      const searchLower = contactSearch.toLowerCase();
      return (
        c.company_name?.toLowerCase().includes(searchLower) ||
        c.contact_name?.toLowerCase().includes(searchLower) ||
        c.name?.toLowerCase().includes(searchLower) ||
        c.phone?.includes(contactSearch)
      );
    })
    .slice(0, 10);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    setDialNumber(contact.phone || '');
    setShowContactPicker(false);
    setContactSearch('');
  };

  const handleClearContact = () => {
    setSelectedContact(null);
    setDialNumber('');
  };

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

  const getCallTypeIcon = (type) => {
    switch(type) {
      case 'inbound': return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
      case 'outbound': return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
      case 'missed': return <PhoneMissed className="w-4 h-4 text-red-500" />;
      default: return <PhoneCall className="w-4 h-4" />;
    }
  };

  const getCallTypeBadge = (type) => {
    const styles = {
      inbound: 'bg-blue-100 text-blue-700',
      outbound: 'bg-green-100 text-green-700',
      missed: 'bg-red-100 text-red-700',
    };
    return <Badge className={styles[type] || 'bg-slate-100 text-slate-700'}>{t(`call_${type}`) || type}</Badge>;
  };

  const getOutcomeBadge = (outcome) => {
    const styles = {
      answered: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      no_answer: 'bg-yellow-100 text-yellow-700',
      busy: 'bg-orange-100 text-orange-700',
      failed: 'bg-red-100 text-red-700',
      voicemail: 'bg-purple-100 text-purple-700',
      initiated: 'bg-slate-100 text-slate-600',
    };
    return <Badge variant="outline" className={styles[outcome] || ''}>{t(`call_${outcome}`) || outcome}</Badge>;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const locale = language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US';
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    if (isYesterday) return `${t('yesterday')} ${time}`;
    return formatDateTime(d);
  };

  const handleDialDigit = (digit) => setDialNumber(prev => prev + digit);
  const handleBackspace = () => setDialNumber(prev => prev.slice(0, -1));

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
        await loadCallLogs();
      } catch (error) {
        console.error('Failed to end call:', error);
      
        toast.error((error?.response?.data?.message) || (error?.response?.data?.error) || error?.message || 'Amalni bajarib bo\'lmadi');
      }
    }
    setActiveCall(null);
    setIsCallInProgress(false);
    setCallDuration(0);
  };

  const handleSaveConfig = async () => {
    await pbxService.saveConfig(pbxConfig);
    setIsConfigured(pbxService.isConfigured(pbxConfig));
    setShowSettings(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const success = await pbxService.testConnection(pbxConfig);
    setConnectionStatus(success ? 'success' : 'failed');
    setTestingConnection(false);
  };

  const handlePlayRecording = (url, callId) => {
    if (playingAudio === callId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    audioRef.current = audio;
    setPlayingAudio(callId);
  };

  // Combine and filter call logs
  const safeCallLogs = Array.isArray(callLogs) ? callLogs : [];
  const safeLocalCallLogs = Array.isArray(localCallLogs) ? localCallLogs : [];
  const allCallLogs = [...safeCallLogs, ...safeLocalCallLogs]
    .filter((log, index, self) => index === self.findIndex((l) => l.id === log.id))
    .sort((a, b) => new Date(b.call_start_time) - new Date(a.call_start_time));

  const filteredLogs = typeFilter === 'all'
    ? allCallLogs
    : allCallLogs.filter(log => log.call_type === typeFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />

      {/* Call Interface */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-green-600" />
              {t('pbx_interface') || 'PBX interfeysi'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-700 w-fit">{t('pbx_connected') || 'Ulangan'}</Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700 w-fit">{t('pbx_not_configured') || 'Sozlanmagan'}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Selector */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">{t('select_contact') || 'Kontaktni tanlash'}</Label>
            {selectedContact ? (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">
                    {selectedContact.company_name || selectedContact.contact_name || selectedContact.name}
                  </p>
                  <p className="text-sm text-blue-700">{selectedContact.phone}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearContact} className="h-8 w-8 p-0 text-blue-600">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Popover open={showContactPicker} onOpenChange={setShowContactPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-slate-500 font-normal">
                    <Users className="w-4 h-4 mr-2" />
                    {t('choose_customer_lead') || 'Mijoz yoki lidni tanlang...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder={t('search_contacts') || 'Qidirish...'}
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">
                        {t('no_contacts_found') || 'Kontaktlar topilmadi'}
                      </div>
                    ) : (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          className="w-full p-3 text-left hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                          onClick={() => handleSelectContact(contact)}
                        >
                          <p className="font-medium text-slate-900">
                            {contact.company_name || contact.contact_name || contact.name}
                          </p>
                          <p className="text-sm text-slate-500">{contact.phone}</p>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Active Call Display */}
          {activeCall && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">{t('active_call') || "Faol qo'ng'iroq"}</p>
                  <p className="font-bold text-green-900">{activeCall.number}</p>
                </div>
                <Badge className={`${activeCall.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} text-white`}>
                  {activeCall.status === 'connecting' ? (t('connecting') || 'Ulanmoqda...') : formatDuration(callDuration)}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsMuted(!isMuted)} className={isMuted ? 'bg-red-50 border-red-200' : ''}>
                  {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm"><Volume2 className="w-4 h-4" /></Button>
                <Button variant="destructive" size="sm" className="ml-auto" onClick={handleEndCall}>
                  <PhoneOff className="w-4 h-4 mr-1" />
                  {t('end_call') || 'Tugatish'}
                </Button>
              </div>
            </div>
          )}

          {/* Dialer */}
          {!activeCall && (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="+998"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  className="pr-10 text-lg font-mono"
                />
                {dialNumber && (
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={handleBackspace}>
                    <Delete className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="aspect-square text-lg font-semibold hover:bg-slate-100"
                    onClick={() => handleDialDigit(digit.toString())}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                disabled={!dialNumber.trim() || isCallInProgress}
                onClick={handleMakeCall}
              >
                {isCallInProgress ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <PhoneCall className="w-5 h-5 mr-2" />
                )}
                {t('call') || "Qo'ng'iroq"} {dialNumber || ''}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History */}
      <div className="lg:col-span-2">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('recent_calls')}</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_calls')}</SelectItem>
                    <SelectItem value="inbound">{t('call_inbound')}</SelectItem>
                    <SelectItem value="outbound">{t('call_outbound')}</SelectItem>
                    <SelectItem value="missed">{t('call_missed')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={loadCallLogs} disabled={isLoadingLogs}>
                  <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <PhoneCall className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>{t('no_call_history')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('type') || 'Turi'}</TableHead>
                      <TableHead>{t('contact') || 'Kontakt'}</TableHead>
                      <TableHead>{t('time') || 'Vaqt'}</TableHead>
                      <TableHead>{t('duration') || "Davomiyligi"}</TableHead>
                      <TableHead>{t('status') || 'Holat'}</TableHead>
                      <TableHead>{t('recording')}</TableHead>
                      <TableHead>{t('actions') || 'Amallar'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 50).map((call) => (
                      <TableRow key={call.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getCallTypeIcon(call.call_type)}
                            {getCallTypeBadge(call.call_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">
                              {call.contact_name || call.customer_name || (call.call_type === 'outbound' ? call.receiver_number : call.caller_number) || '-'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {call.call_type === 'outbound' ? call.receiver_number : call.caller_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">
                            {formatTime(call.call_start_time)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="tabular-nums">{formatDuration(call.call_duration || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getOutcomeBadge(call.call_outcome)}
                        </TableCell>
                        <TableCell>
                          {call.recording_url ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                onClick={() => handlePlayRecording(call.recording_url, call.id)}
                              >
                                {playingAudio === call.id ? (
                                  <Pause className="w-3 h-3 text-blue-600" />
                                ) : (
                                  <Play className="w-3 h-3 text-blue-600" />
                                )}
                              </Button>
                              <a
                                href={call.recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                              >
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Download className="w-3 h-3 text-slate-500" />
                                </Button>
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() => {
                              const num = call.call_type === 'inbound' ? call.caller_number : call.receiver_number;
                              if (num) setDialNumber(num);
                            }}
                            disabled={isCallInProgress}
                          >
                            <PhoneCall className="w-3 h-3 mr-1" />
                            {t('call')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PBX Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('pbx_settings')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Enable PBX */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pbx-enabled">{t('enable_pbx')}</Label>
                <p className="text-sm text-slate-500">{t('enable_pbx_desc')}</p>
              </div>
              <Switch
                id="pbx-enabled"
                checked={pbxConfig?.enabled || false}
                onCheckedChange={(checked) => setPbxConfig(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {pbxConfig?.enabled && (
              <>
                {/* Domain */}
                <div className="space-y-2">
                  <Label htmlFor="pbx-domain">{t('pbx_domain')}</Label>
                  <Input
                    id="pbx-domain"
                    placeholder="pbx36019.onpbx.ru"
                    value={pbxConfig?.domain || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, domain: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500">OnlinePBX panel domeni</p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="api-key">{t('pbx_api_key')}</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="API Key"
                    value={pbxConfig?.api_key || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  />
                </div>

                {/* Extension */}
                <div className="space-y-2">
                  <Label htmlFor="extension">{t('pbx_extension')}</Label>
                  <Input
                    id="extension"
                    placeholder="101"
                    value={pbxConfig?.extension || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, extension: e.target.value }))}
                  />
                </div>

                {/* Caller ID */}
                <div className="space-y-2">
                  <Label htmlFor="caller-id">{t('pbx_caller_id')}</Label>
                  <Input
                    id="caller-id"
                    placeholder="+998901234567"
                    value={pbxConfig?.caller_id || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, caller_id: e.target.value }))}
                  />
                </div>

                {/* Webhook Token */}
                <div className="space-y-2">
                  <Label htmlFor="webhook-token">Webhook Token</Label>
                  <Input
                    id="webhook-token"
                    placeholder="your-secret-token"
                    value={pbxConfig?.webhook_token || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, webhook_token: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500">OnlinePBX panel → Интеграции → Webhooks → Secret Token</p>
                </div>

                {/* Webhook URL info */}
                {(() => {
                  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
                  const webhookUrl = `${apiBase}/webhooks/pbx`;
                  return (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-700">Webhook URL</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      {t('copy')}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 font-mono break-all">
                    {webhookUrl}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Bu URL ni OnlinePBX panelda Webhook URL ga qo'ying. Token ni Secret Token maydoniga kiriting.
                  </p>
                </div>
                  );
                })()}

                {/* Test Connection */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !pbxConfig?.domain}
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : connectionStatus === 'success' ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : connectionStatus === 'failed' ? (
                      <X className="w-4 h-4 mr-2 text-red-500" />
                    ) : null}
                    {t('test_connection')}
                  </Button>
                  {connectionStatus === 'success' && (
                    <span className="text-sm text-green-600">{t('connection_successful')}</span>
                  )}
                  {connectionStatus === 'failed' && (
                    <span className="text-sm text-red-600">{t('connection_failed')}</span>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSaveConfig}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
