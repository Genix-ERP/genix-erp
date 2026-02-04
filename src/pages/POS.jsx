import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, X, Receipt,
  User, Play, Square, Printer, Clock, DollarSign, Package, RefreshCw, History
} from "lucide-react";
import { POSProvider, usePOS } from "@/components/contexts/POSContext";
import { toast } from 'sonner';

// ==========================================
// MAIN POS CONTENT
// ==========================================
function POSContent() {
  const {
    session, sessionLoading, openSession, closeSession, configs,
    cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotals,
    customer, setCustomer,
    products, productsLoading, searchProducts,
    orders, completeOrder
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const [selectedConfig, setSelectedConfig] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('0');
  const [closingNotes, setClosingNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  const searchInputRef = useRef(null);

  // Focus search on load
  useEffect(() => {
    if (session && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [session]);

  // Search products when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Handle product click
  const handleProductClick = (product) => {
    addToCart(product);
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Handle payment
  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (amount < cartTotals.total) {
      toast.error('Payment amount is less than total');
      return;
    }

    try {
      const payments = [{
        method_name: paymentMethod === 'cash' ? 'Cash' : 'Card',
        type: paymentMethod,
        amount: amount,
      }];

      const order = await completeOrder(payments);
      setLastOrder(order);
      setShowPayment(false);
      setShowReceipt(true);
      setPaymentAmount('');
    } catch (error) {
      // Error handled in context
    }
  };

  // Handle open session
  const handleOpenSession = async () => {
    if (!selectedConfig) {
      toast.error('Please select a POS configuration');
      return;
    }
    try {
      await openSession(selectedConfig, parseFloat(openingBalance) || 0);
      setShowOpenSession(false);
      setSelectedConfig('');
      setOpeningBalance('0');
    } catch (error) {
      // Error handled in context
    }
  };

  // Handle close session
  const handleCloseSession = async () => {
    try {
      await closeSession(parseFloat(closingBalance) || 0, closingNotes);
      setShowCloseSession(false);
      setClosingBalance('0');
      setClosingNotes('');
    } catch (error) {
      // Error handled in context
    }
  };

  // Calculate change
  const calculateChange = () => {
    const paid = parseFloat(paymentAmount) || 0;
    return Math.max(0, paid - cartTotals.total);
  };

  // Loading state
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No session - show open session dialog
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" />
              Point of Sale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              No active session. Open a new session to start selling.
            </p>
            <Button onClick={() => setShowOpenSession(true)} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Open Session
            </Button>
          </CardContent>
        </Card>

        {/* Open Session Dialog */}
        <Dialog open={showOpenSession} onOpenChange={setShowOpenSession}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open POS Session</DialogTitle>
              <DialogDescription>
                Select a POS configuration and enter the opening cash balance.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>POS Configuration</Label>
                <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Opening Cash Balance</Label>
                <Input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOpenSession(false)}>
                Cancel
              </Button>
              <Button onClick={handleOpenSession}>
                <Play className="w-4 h-4 mr-2" />
                Open Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main POS interface
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Point of Sale</h1>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.session_number}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowOrders(true)}>
              <History className="w-4 h-4 mr-1" />
              Orders ({orders.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCloseSession(true)}>
              <Square className="w-4 h-4 mr-1" />
              Close Session
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            ref={searchInputRef}
            placeholder="Search products by name, code, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {productsLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Package className="w-12 h-12 mb-2" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      {product.code && (
                        <p className="text-xs text-muted-foreground">{product.code}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">
                          {formatCurrency(product.sale_price)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Stock: {product.stock}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-96 bg-white border-l flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart ({cartTotals.itemCount} items)
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-2" />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.unit_price)} each
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFromCart(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="font-bold">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t p-4 space-y-4">
          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(cartTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (12%)</span>
              <span>{formatCurrency(cartTotals.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(cartTotals.total)}</span>
            </div>
          </div>

          {/* Pay Button */}
          <Button
            className="w-full h-14 text-lg"
            disabled={cart.length === 0}
            onClick={() => {
              setPaymentAmount(cartTotals.total.toString());
              setShowPayment(true);
            }}
          >
            <DollarSign className="w-5 h-5 mr-2" />
            Pay {formatCurrency(cartTotals.total)}
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-3xl font-bold">{formatCurrency(cartTotals.total)}</p>
            </div>

            <div>
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="h-12"
                >
                  <Banknote className="w-5 h-5 mr-2" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="h-12"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Card
                </Button>
              </div>
            </div>

            <div>
              <Label>Amount Received</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-12 text-lg text-center"
                autoFocus
              />
            </div>

            {paymentMethod === 'cash' && (
              <div className="grid grid-cols-4 gap-2">
                {[1000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(amount.toString())}
                  >
                    {amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
                  </Button>
                ))}
              </div>
            )}

            {paymentMethod === 'cash' && parseFloat(paymentAmount) > cartTotals.total && (
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">Change</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculateChange())}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={parseFloat(paymentAmount) < cartTotals.total}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Complete Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Receipt</DialogTitle>
          </DialogHeader>
          {lastOrder && (
            <div className="text-center space-y-4">
              <div className="text-6xl text-green-500">✓</div>
              <div>
                <p className="text-lg font-bold">Order Complete!</p>
                <p className="text-muted-foreground">{lastOrder.order_number}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-bold">{formatCurrency(lastOrder.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{formatCurrency(lastOrder.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Change</span>
                  <span className="font-bold">{formatCurrency(lastOrder.amount_return)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowReceipt(false)}>
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={showCloseSession} onOpenChange={setShowCloseSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Session</DialogTitle>
            <DialogDescription>
              Count your cash drawer and enter the closing balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Opening Balance</p>
                <p className="text-lg font-bold">{formatCurrency(session.opening_balance)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Sales</p>
                <p className="text-lg font-bold">{formatCurrency(session.total_cash_payments)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold">{formatCurrency(session.total_sales)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-lg font-bold">{session.order_count}</p>
              </div>
            </div>

            <div>
              <Label>Closing Cash Balance</Label>
              <Input
                type="number"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                placeholder="Enter closing balance"
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Any notes about this session..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseSession(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleCloseSession}>
              <Square className="w-4 h-4 mr-2" />
              Close Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders History Dialog */}
      <Dialog open={showOrders} onOpenChange={setShowOrders}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Orders</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders in this session yet
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <Card key={order.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.order_date).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(order.total_amount)}</p>
                        <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrders(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// MAIN POS PAGE WRAPPER
// ==========================================
export default function POS() {
  return (
    <POSProvider>
      <POSContent />
    </POSProvider>
  );
}
