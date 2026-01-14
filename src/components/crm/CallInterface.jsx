import React, { useState, useEffect, useRef } from 'react';
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
  Volume2,
  Mic,
  MicOff,
  Clock,
  Settings,
  Check,
  X,
  Loader2,
  Delete
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { pbxService } from '@/api/services';
import { useTranslation } from "@/components/utils/translations";

export default function CallInterface({ callLogs = [], onUpdate, customer, language = 'en', companyId }) {
  const { t } = useTranslation(language);
  const [activeCall, setActiveCall] = useState(null);
  const [dialNumber, setDialNumber] = useState(customer?.phone || '');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pbxConfig, setPbxConfig] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [localCallLogs, setLocalCallLogs] = useState([]);
  const timerRef = useRef(null);

  // Load PBX config on mount
  useEffect(() => {
    const config = pbxService.getConfig();
    setPbxConfig(config || {
      enabled: false,
      serverUrl: '',
      apiKey: '',
      extension: '',
      callerId: ''
    });
    setIsConfigured(pbxService.isConfigured());

    // Load call logs (async)
    const loadCallLogs = async () => {
      const logs = await pbxService.getCallLogs(companyId);
      setLocalCallLogs(Array.isArray(logs) ? logs : []);
    };
    loadCallLogs();
  }, [companyId]);

  // Update dial number when customer changes
  useEffect(() => {
    if (customer?.phone) {
      setDialNumber(customer.phone);
    }
  }, [customer]);

  // Call timer
  useEffect(() => {
    if (activeCall && isCallInProgress) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeCall, isCallInProgress]);

  const getCallTypeIcon = (type) => {
    switch(type) {
      case 'inbound': return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
      case 'outbound': return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
      case 'missed': return <PhoneMissed className="w-4 h-4 text-red-500" />;
      default: return <PhoneCall className="w-4 h-4" />;
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSentimentBadge = (score) => {
    if (score > 0.3) return <Badge className="bg-green-100 text-green-800">{t('positive')}</Badge>;
    if (score < -0.3) return <Badge className="bg-red-100 text-red-800">{t('negative')}</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800">{t('neutral')}</Badge>;
  };

  const handleDialDigit = (digit) => {
    setDialNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const handleMakeCall = async () => {
    if (!dialNumber.trim()) return;

    setIsCallInProgress(true);

    try {
      const result = await pbxService.makeCall(dialNumber, {
        customerId: customer?.id,
        customerName: customer?.company_name || customer?.contact_name,
        companyId
      });

      setActiveCall({
        id: result.callId,
        number: dialNumber,
        status: 'connecting'
      });

      // Simulate call connected after 2 seconds (in real integration, this would come from WebSocket)
      setTimeout(() => {
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
        await pbxService.endCall(activeCall.id);

        // Update call log with duration
        pbxService.updateCallLog(activeCall.id, {
          call_duration: callDuration,
          call_outcome: 'completed'
        }, companyId);

        // Refresh call logs
        const refreshedLogs = await pbxService.getCallLogs(companyId);
        setLocalCallLogs(Array.isArray(refreshedLogs) ? refreshedLogs : []);
      } catch (error) {
        console.error('Failed to end call:', error);
      }
    }

    setActiveCall(null);
    setIsCallInProgress(false);
    setCallDuration(0);
  };

  const handleSaveConfig = () => {
    pbxService.saveConfig(pbxConfig);
    setIsConfigured(pbxService.isConfigured());
    setShowSettings(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    const success = await pbxService.testConnection(pbxConfig);
    setConnectionStatus(success ? 'success' : 'failed');
    setTestingConnection(false);
  };

  const handleCallBack = (phoneNumber) => {
    setDialNumber(phoneNumber);
    handleMakeCall();
  };

  // Combine provided callLogs with local logs
  const safeCallLogs = Array.isArray(callLogs) ? callLogs : [];
  const safeLocalCallLogs = Array.isArray(localCallLogs) ? localCallLogs : [];
  const allCallLogs = [...safeCallLogs, ...safeLocalCallLogs]
    .filter((log, index, self) =>
      index === self.findIndex((l) => l.id === log.id)
    )
    .sort((a, b) => new Date(b.call_start_time) - new Date(a.call_start_time));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Call Interface */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-green-600" />
              {t('pbx_interface')}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-700 w-fit">{t('pbx_connected')}</Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-700 w-fit">{t('pbx_not_configured')}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer Info (if provided) */}
          {customer && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900">{customer.company_name || customer.contact_name}</p>
              <p className="text-sm text-blue-700">{customer.phone}</p>
            </div>
          )}

          {/* Active Call Display */}
          {activeCall && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">{t('active_call')}</p>
                  <p className="font-bold text-green-900">{activeCall.number}</p>
                </div>
                <Badge className={`${activeCall.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} text-white`}>
                  {activeCall.status === 'connecting' ? t('connecting') : formatDuration(callDuration)}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMuted(!isMuted)}
                  className={isMuted ? 'bg-red-50 border-red-200' : ''}
                >
                  {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm">
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="w-4 h-4 mr-1" />
                  {t('end_call')}
                </Button>
              </div>
            </div>
          )}

          {/* Dialer */}
          {!activeCall && (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder={t('enter_phone_number')}
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  className="pr-10 text-lg font-mono"
                />
                {dialNumber && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={handleBackspace}
                  >
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
                {t('call')} {dialNumber || ''}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <div className="lg:col-span-2">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle>{t('recent_calls')}</CardTitle>
          </CardHeader>
          <CardContent>
            {allCallLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <PhoneCall className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>{t('no_call_history')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('contact')}</TableHead>
                      <TableHead>{t('type')}</TableHead>
                      <TableHead>{t('duration')}</TableHead>
                      <TableHead>{t('sentiment')}</TableHead>
                      <TableHead>{t('outcome')}</TableHead>
                      <TableHead>{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCallLogs.slice(0, 10).map((call) => (
                      <TableRow key={call.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div>
                            <p className="font-medium">{call.customer_name || call.caller_number}</p>
                            <p className="text-sm text-slate-500">
                              {new Date(call.call_start_time).toLocaleString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getCallTypeIcon(call.call_type)}
                            <span className="capitalize">{t(call.call_type) || call.call_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDuration(call.call_duration || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {call.sentiment_score !== undefined && getSentimentBadge(call.sentiment_score)}
                        </TableCell>
                        <TableCell>
                          {call.call_outcome && (
                            <Badge variant="outline" className="capitalize">
                              {t(call.call_outcome) || call.call_outcome.replace('_', ' ')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCallBack(call.caller_number)}
                              disabled={isCallInProgress}
                            >
                              <PhoneCall className="w-3 h-3 mr-1" />
                              {t('call_back')}
                            </Button>
                          </div>
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
                {/* Server URL */}
                <div className="space-y-2">
                  <Label htmlFor="server-url">{t('pbx_server_url')}</Label>
                  <Input
                    id="server-url"
                    placeholder="https://pbx.example.com"
                    value={pbxConfig?.serverUrl || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
                  />
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="api-key">{t('pbx_api_key')}</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="API Key"
                    value={pbxConfig?.apiKey || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, apiKey: e.target.value }))}
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
                    placeholder="+1234567890"
                    value={pbxConfig?.callerId || ''}
                    onChange={(e) => setPbxConfig(prev => ({ ...prev, callerId: e.target.value }))}
                  />
                </div>

                {/* Test Connection */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !pbxConfig?.serverUrl}
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
