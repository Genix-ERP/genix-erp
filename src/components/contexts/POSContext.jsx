import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import posService from '@/api/services/pos';
import { toast } from 'sonner';

const POSContext = createContext();

export function POSProvider({ children }) {
  // Session state
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState([]);

  // Customer state
  const [customer, setCustomer] = useState(null);

  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Configs state
  const [configs, setConfigs] = useState([]);

  // Orders state
  const [orders, setOrders] = useState([]);

  // ==========================================
  // SESSION OPERATIONS
  // ==========================================

  const loadCurrentSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const response = await posService.getCurrentSession();
      setSession(response.data);
    } catch (error) {
      // No open session is fine
      setSession(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const openSession = useCallback(async (configId, openingBalance = 0) => {
    try {
      const response = await posService.openSession({
        pos_config_id: configId,
        opening_balance: openingBalance,
      });
      setSession(response.data);
      toast.success('Session opened successfully');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to open session');
      throw error;
    }
  }, []);

  const closeSession = useCallback(async (closingBalance, notes = '') => {
    if (!session) return;
    try {
      const response = await posService.closeSession(session.id, {
        closing_balance: closingBalance,
        notes,
      });
      setSession(null);
      setCart([]);
      setCustomer(null);
      toast.success('Session closed successfully');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to close session');
      throw error;
    }
  }, [session]);

  // ==========================================
  // CART OPERATIONS
  // ==========================================

  const addToCart = useCallback((product, quantity = 1) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product_id === product.id);

      if (existingIndex >= 0) {
        // Update existing item
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + quantity,
        };
        return newCart;
      }

      // Add new item
      return [
        ...prevCart,
        {
          product_id: product.id,
          product_name: product.name,
          product_code: product.code || '',
          barcode: product.barcode || '',
          quantity,
          unit_price: product.sale_price,
          discount_percent: 0,
          tax_percent: 12, // Default tax rate
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((index) => {
    setCart(prevCart => prevCart.filter((_, i) => i !== index));
  }, []);

  const updateCartItem = useCallback((index, updates) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      newCart[index] = { ...newCart[index], ...updates };
      return newCart;
    });
  }, []);

  const updateQuantity = useCallback((index, quantity) => {
    if (quantity <= 0) {
      removeFromCart(index);
    } else {
      updateCartItem(index, { quantity });
    }
  }, [removeFromCart, updateCartItem]);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
  }, []);

  // ==========================================
  // CART CALCULATIONS
  // ==========================================

  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const lineSubtotal = item.quantity * item.unit_price;
      const lineDiscount = lineSubtotal * (item.discount_percent || 0) / 100;
      const lineNet = lineSubtotal - lineDiscount;
      const lineTax = lineNet * (item.tax_percent || 0) / 100;

      subtotal += lineNet;
      totalTax += lineTax;
    });

    const total = subtotal + totalTax;

    return {
      subtotal,
      taxAmount: totalTax,
      total,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cart]);

  // ==========================================
  // ORDER OPERATIONS
  // ==========================================

  const completeOrder = useCallback(async (payments) => {
    if (!session) {
      toast.error('No open session');
      return;
    }

    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid < cartTotals.total) {
      toast.error('Payment amount is less than total');
      return;
    }

    try {
      const orderData = {
        customer_id: customer?.id || null,
        customer_name: customer?.name || '',
        customer_phone: customer?.phone || '',
        discount_percent: 0,
        notes: '',
        lines: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 0,
        })),
        payments: payments.map(p => ({
          payment_method_name: p.method_name,
          payment_type: p.type,
          amount: p.amount,
          transaction_id: p.transaction_id || '',
          card_last_four: p.card_last_four || '',
        })),
      };

      const response = await posService.createOrder(orderData);
      toast.success(`Order ${response.data.order_number} completed`);

      // Clear cart after successful order
      clearCart();

      // Return order for receipt printing
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create order');
      throw error;
    }
  }, [session, cart, cartTotals.total, customer, clearCart]);

  // ==========================================
  // PRODUCT OPERATIONS
  // ==========================================

  const searchProducts = useCallback(async (query = '', categoryId = null) => {
    setProductsLoading(true);
    try {
      const response = await posService.searchProducts(query, categoryId);
      setProducts(response.data || []);
    } catch (error) {
      toast.error('Failed to search products');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // ==========================================
  // CONFIG OPERATIONS
  // ==========================================

  const loadConfigs = useCallback(async () => {
    try {
      const response = await posService.listConfigs();
      setConfigs(response.data || []);
    } catch (error) {
      setConfigs([]);
    }
  }, []);

  // ==========================================
  // ORDERS HISTORY
  // ==========================================

  const loadSessionOrders = useCallback(async () => {
    if (!session) return;
    try {
      const response = await posService.listOrders({ session_id: session.id });
      setOrders(response.data || []);
    } catch (error) {
      setOrders([]);
    }
  }, [session]);

  // Load session on mount
  useEffect(() => {
    loadCurrentSession();
    loadConfigs();
  }, [loadCurrentSession, loadConfigs]);

  // Load products when session opens
  useEffect(() => {
    if (session) {
      searchProducts();
      loadSessionOrders();
    }
  }, [session, searchProducts, loadSessionOrders]);

  const value = useMemo(() => ({
    // Session
    session,
    sessionLoading,
    openSession,
    closeSession,
    loadCurrentSession,

    // Cart
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    updateQuantity,
    clearCart,
    cartTotals,

    // Customer
    customer,
    setCustomer,

    // Products
    products,
    productsLoading,
    searchProducts,

    // Configs
    configs,
    loadConfigs,

    // Orders
    orders,
    loadSessionOrders,
    completeOrder,
  }), [session, sessionLoading, openSession, closeSession, loadCurrentSession, cart, addToCart, removeFromCart, updateCartItem, updateQuantity, clearCart, cartTotals, customer, products, productsLoading, searchProducts, configs, loadConfigs, orders, loadSessionOrders, completeOrder]);

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}

export default POSContext;
