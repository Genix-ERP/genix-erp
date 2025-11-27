import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Volume2,
  Mic,
  MicOff,
  Clock
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CallInterface({ callLogs, onUpdate }) {
  const [activeCall, setActiveCall] = useState(null);
  const [dialNumber, setDialNumber] = useState("");
  const [isMuted, setIsMuted] = useState(false);

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
    if (score > 0.3) return <Badge className="bg-green-100 text-green-800">Positive</Badge>;
    if (score < -0.3) return <Badge className="bg-red-100 text-red-800">Negative</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800">Neutral</Badge>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Call Interface */}
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-green-600" />
            VOIP Interface
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dialer */}
          <div className="space-y-3">
            <Input
              placeholder="Enter phone number"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="aspect-square"
                  onClick={() => setDialNumber(prev => prev + digit)}
                >
                  {digit}
                </Button>
              ))}
            </div>
          </div>

          {/* Call Controls */}
          <div className="space-y-3">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!dialNumber.trim()}
            >
              <PhoneCall className="w-4 h-4 mr-2" />
              Call {dialNumber}
            </Button>

            {activeCall && (
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium">Active Call</span>
                  <Badge className="bg-green-100 text-green-800">00:45</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Volume2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="ml-auto"
                    onClick={() => setActiveCall(null)}
                  >
                    End Call
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <div className="lg:col-span-2">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Calls & AI Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callLogs.slice(0, 10).map((call) => (
                    <TableRow key={call.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div>
                          <p className="font-medium">{call.caller_number}</p>
                          <p className="text-sm text-slate-500">
                            {new Date(call.call_start_time).toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCallTypeIcon(call.call_type)}
                          <span className="capitalize">{call.call_type}</span>
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
                            {call.call_outcome.replace('_', ' ')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline">
                            Call Back
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}