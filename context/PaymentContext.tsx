'use client'
import React, { createContext, useContext, useState, useEffect } from 'react';

interface Payment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  isArchived: boolean;
  createdAt: string;
}

interface PaymentContextType {
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'isPaid' | 'isArchived'>) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  markAsPaid: (id: string) => void;
  archivePayment: (id: string) => void;
  deletePayment: (id: string) => void;
  activePayments: Payment[];
  paidPayments: Payment[];
  archivedPayments: Payment[];
  overduePayments: Payment[];
  upcomingPayments: Payment[];
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export const usePayments = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayments must be used within a PaymentProvider');
  }
  return context;
};

export const PaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const savedPayments = localStorage.getItem('payments');
    if (savedPayments) {
      setPayments(JSON.parse(savedPayments));
    } else {
      const mockPayments: Payment[] = [
        {
          id: '1',
          title: 'Electricity Bill',
          description: 'Monthly electricity payment',
          dueDate: '2024-12-25',
          amount: 150,
          isPaid: false,
          isArchived: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Internet Bill',
          description: 'Monthly internet subscription',
          dueDate: '2024-12-20',
          amount: 50,
          isPaid: false,
          isArchived: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'Credit Card Payment',
          description: 'Monthly credit card payment',
          dueDate: '2024-12-15',
          amount: 200,
          isPaid: true,
          isArchived: false,
          createdAt: new Date().toISOString(),
        },
      ];
      setPayments(mockPayments);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('payments', JSON.stringify(payments));
  }, [payments]);

  const addPayment = (payment: Omit<Payment, 'id' | 'createdAt' | 'isPaid' | 'isArchived'>): Payment => {
    const newPayment: Payment = {
      ...payment,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      isPaid: false,
      isArchived: false,
    };
    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  };

  const updatePayment = (id: string, updates: Partial<Payment>) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const markAsPaid = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, isPaid: true } : p));
  };

  const archivePayment = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, isArchived: true } : p));
  };

  const deletePayment = (id: string) => {
    setPayments(prev => prev.filter(payment => payment.id !== id));
  };

  const activePayments = payments.filter(p => !p.isPaid && !p.isArchived);
  const paidPayments = payments.filter(p => p.isPaid && !p.isArchived);
  const archivedPayments = payments.filter(p => p.isArchived);
  
  const today = new Date();
  const overduePayments = activePayments.filter(p => new Date(p.dueDate) < today);
  const upcomingPayments = activePayments.filter(p => new Date(p.dueDate) >= today);

  return (
    <PaymentContext.Provider value={{
      payments,
      addPayment,
      updatePayment,
      markAsPaid,
      archivePayment,
      deletePayment, 
      activePayments,
      paidPayments,
      archivedPayments,
      overduePayments,
      upcomingPayments,
    }}>
      {children}
    </PaymentContext.Provider>
  );
};