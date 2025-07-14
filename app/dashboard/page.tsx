'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AppContext';
import { usePayments } from '@/context/PaymentContext';
import { SiWebmoney } from 'react-icons/si';
import { VscCollapseAll, VscExpandAll } from 'react-icons/vsc';
import { toast } from 'react-hot-toast';
import { 
  FiPlus, 
  FiUser, 
  FiBell, 
  FiSearch, 
  FiLogOut, 
  FiPieChart, 
  FiArchive, 
  FiSettings, 
  FiCheckCircle, 
  FiEdit2, 
  FiTrash2,
  FiDollarSign,
  FiClock,
  FiAlertCircle,
  FiCalendar,
  FiTrendingUp,
  FiX,
  FiMenu,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';

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

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'overdue' | 'dueSoon' | 'reminder' | 'paymentAdded';
  paymentId?: string;
  read: boolean;
  timestamp: Date;
  persistent?: boolean;
}

export default function DashboardPage() {
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { user, logout, isAuthenticated } = useAuth();
  const { 
    payments, 
    addPayment, 
    markAsPaid, 
    archivePayment, 
    updatePayment,
    deletePayment,
    activePayments, 
    paidPayments, 
    archivedPayments, 
    overduePayments, 
    upcomingPayments 
  } = usePayments();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [newPayment, setNewPayment] = useState({
    title: '',
    description: '',
    dueDate: '',
    amount: 0
  });
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Click outside notifications dropdown handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const notificationsDropdown = document.getElementById('notifications-dropdown');
      const notificationsButton = document.getElementById('notifications-button');
      
      if (showNotificationsDropdown && 
          notificationsDropdown && 
          notificationsButton &&
          !notificationsDropdown.contains(event.target as Node) && 
          !notificationsButton.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationsDropdown]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Initialize notifications
  useEffect(() => {
    if (isAuthenticated) {
      const initialNotifications: Notification[] = overduePayments.map(payment => ({
        id: `overdue-${payment.id}`,
        title: 'Payment Overdue!',
        message: `${payment.title} is overdue by ${Math.abs(getDaysUntilDue(payment.dueDate))} days`,
        type: 'overdue',
        paymentId: payment.id,
        read: false,
        timestamp: new Date(),
        persistent: true
      }));

      setNotifications(prev => [...initialNotifications, ...prev]);
    }
  }, [isAuthenticated, overduePayments]);

  // Check and request notification permission
  useEffect(() => {
    const checkNotificationPermission = async () => {
      try {
        if (!('Notification' in window)) {
          console.warn('This browser does not support desktop notifications');
          return false;
        }
        
        if (Notification.permission === 'granted') {
          setNotificationPermission(true);
          return true;
        }
        
        if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          const granted = permission === 'granted';
          setNotificationPermission(granted);
          if (granted) {
            new Notification('Notifications Enabled', {
              body: 'You will now receive payment reminders',
              icon: '/favicon.ico'
            });
            toast.success('Notifications enabled');
          }
          return granted;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking notification permission:', error);
        return false;
      }
    };

    checkNotificationPermission();
  }, []);

  // Main notification system with 5-minute reminders
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let notificationTimeouts: NodeJS.Timeout[] = [];

    const createBrowserNotification = (title: string, body: string, paymentId?: string) => {
      if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: paymentId ? `payment-${paymentId}` : 'general-reminder'
        });

        notification.onclick = () => {
          window.focus();
          setActiveTab('dashboard');
          notification.close();
        };

        notificationTimeouts.push(setTimeout(() => notification.close(), 10000));
      }
    };

    const sendPaymentReminders = () => {
      const now = new Date();
      setLastNotificationTime(now);

      // Clear old non-persistent notifications older than 24 hours
      setNotifications(prev => 
        prev.filter(n => n.persistent || (now.getTime() - n.timestamp.getTime()) < 24 * 60 * 60 * 1000)
      );

      // Create notifications for each unpaid payment
      activePayments.forEach(payment => {
        const daysUntilDue = getDaysUntilDue(payment.dueDate);
        const isOverdue = daysUntilDue < 0;
        const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3;

        let notification: Notification;
        
        if (isOverdue) {
          notification = {
            id: `overdue-${payment.id}-${now.getTime()}`,
            title: 'Payment Overdue!',
            message: `${payment.title} is overdue by ${Math.abs(daysUntilDue)} days`,
            type: 'overdue',
            paymentId: payment.id,
            read: false,
            timestamp: now,
            persistent: true
          };
        } else if (isDueSoon) {
          notification = {
            id: `dueSoon-${payment.id}-${now.getTime()}`,
            title: 'Payment Due Soon!',
            message: `${payment.title} is due in ${daysUntilDue} days`,
            type: 'dueSoon',
            paymentId: payment.id,
            read: false,
            timestamp: now,
            persistent: true
          };
        } else {
          notification = {
            id: `reminder-${payment.id}-${now.getTime()}`,
            title: 'Payment Reminder',
            message: `${payment.title} is due in ${daysUntilDue} days`,
            type: 'reminder',
            paymentId: payment.id,
            read: false,
            timestamp: now,
            persistent: true
          };
        }

        setNotifications(prev => [notification, ...prev]);
        
        // Show browser notification
        createBrowserNotification(notification.title, notification.message, payment.id);
      });

      // General summary notification if there are multiple payments
      if (activePayments.length > 1) {
        const overdueCount = overduePayments.length;
        const unpaidCount = activePayments.length;
        
        const summaryNotification: Notification = {
          id: `summary-${now.getTime()}`,
          title: overdueCount > 0 ? 'Overdue Payments!' : 'Payment Reminder',
          message: overdueCount > 0 
            ? `You have ${overdueCount} overdue payment(s) and ${unpaidCount} total unpaid payments!`
            : `You have ${unpaidCount} unpaid payment(s) pending.`,
          type: overdueCount > 0 ? 'overdue' : 'reminder',
          read: false,
          timestamp: now
        };

        setNotifications(prev => [summaryNotification, ...prev]);
        createBrowserNotification(summaryNotification.title, summaryNotification.message);
      }
    };

    if (notificationPermission && activePayments.length > 0) {
      // Send immediately
      sendPaymentReminders();
      
      // Then every 5 minutes
      interval = setInterval(sendPaymentReminders, 5 * 60 * 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      notificationTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [activePayments, overduePayments, notificationPermission]);

  // Remove notifications when payments are marked as paid
  useEffect(() => {
    setNotifications(prev => 
      prev.filter(notification => {
        if (!notification.paymentId) return true;
        const payment = payments.find(p => p.id === notification.paymentId);
        return !payment || !payment.isPaid;
      })
    );
  }, [payments]);

  const handleAddPayment = () => {
    if (newPayment.title && newPayment.dueDate) {
      const addedPayment = addPayment(newPayment);
      setNewPayment({ title: '', description: '', dueDate: '', amount: 0 });
      
      toast.success('Payment added successfully!', {
        position: 'top-center',
        duration: 3000,
        icon: '💰',
        style: {
          background: '#4BB543',
          color: '#fff',
        }
      });
      
     
      const daysUntilDue = getDaysUntilDue(newPayment.dueDate);
      const now = new Date();
      
      const newNotification: Notification = {
        id: `new-${now.getTime()}`,
        title: 'New Payment Added',
        message: `${newPayment.title} for $${newPayment.amount.toFixed(2)} due in ${daysUntilDue} days`,
        type: 'paymentAdded',
        paymentId: addedPayment.id,
        read: false,
        timestamp: now
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      
  
      if (Notification.permission === 'granted') {
        new Notification('Payment Added', {
          body: `Added: ${newPayment.title} ($${newPayment.amount.toFixed(2)})`,
          icon: '/favicon.ico'
        });
      }
    } else {
      toast.error('Title and Due Date are required');
    }
  };

  const handleUpdatePayment = () => {
    if (editingPayment) {
      updatePayment(editingPayment.id, editingPayment);
      setEditingPayment(null);
      toast.success('Payment updated successfully');
    }
  };

  const handleDeletePayment = (id: string) => {
    deletePayment(id);
    setPaymentToDelete(null);
    toast.success('Payment deleted permanently');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleNotificationsDropdown = () => {
    setShowNotificationsDropdown(!showNotificationsDropdown);
    // Mark all notifications as read when dropdown is opened
    if (!showNotificationsDropdown) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.paymentId) {
      const payment = payments.find(p => p.id === notification.paymentId);
      if (payment) {
        setEditingPayment(payment);
      }
    }
    setShowNotificationsDropdown(false);
    if (isMobile) setMobileMenuOpen(false);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotificationsDropdown(false);
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const totalDue = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  const sidebarItems = [
    { id: 'dashboard', icon: FiPieChart, label: 'Dashboard' },
    { id: 'add-payment', icon: FiPlus, label: 'Add Payment' },
    { id: 'analytics', icon: FiTrendingUp, label: 'Analytics' },
    { id: 'archived', icon: FiArchive, label: 'Archived' },
    { id: 'paid', icon: FiCheckCircle, label: 'Paid' },
    { id: 'settings', icon: FiSettings, label: 'Settings' },
  ];

  const PaymentCard = ({ payment, isArchived = false }: { payment: Payment, isArchived?: boolean }) => {
    const daysUntilDue = getDaysUntilDue(payment.dueDate);
    const isOverdue = daysUntilDue < 0 && !payment.isPaid;
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3 && !payment.isPaid;
    
    return (
      <div className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isOverdue ? 'bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-400' : 
        isDueSoon ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-400' :
        payment.isPaid ? 'bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-400' :
        'bg-gradient-to-r from-white to-gray-50 border border-gray-200'
      } rounded-xl p-6 shadow-sm`}>
        {isOverdue && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">OVERDUE</div>
          </div>
        )}
        {isDueSoon && !isOverdue && (
          <div className="absolute top-2 right-2">
            <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">DUE SOON</div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{payment.title}</h3>
            <p className="text-gray-600 mb-3 leading-relaxed">{payment.description}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <FiDollarSign className="text-emerald-600" size={18} />
                <span className="text-2xl font-bold text-emerald-600">${payment.amount.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FiCalendar className={`${isOverdue ? 'text-red-500' : 'text-gray-500'}`} size={16} />
                <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                  {new Date(payment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {!payment.isPaid && (
                <div className="flex items-center gap-2">
                  <FiClock className={`${isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-gray-500'}`} size={16} />
                  <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days left`}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 w-full sm:w-auto">
            <button onClick={() => setEditingPayment(payment)} className="p-3 text-[#da8700] hover:text-[#b86f00] hover:bg-orange-50 rounded-lg transition-all duration-200" title="Edit payment">
              <FiEdit2 size={18} />
            </button>
            {!payment.isPaid && !isArchived && (
              <button onClick={() => {
                markAsPaid(payment.id);
                toast.success(`${payment.title} marked as paid!`);
              }} className="p-3 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all duration-200" title="Mark as paid">
                <FiCheckCircle size={18} />
              </button>
            )}
            {isArchived ? (
              <button onClick={() => setPaymentToDelete(payment.id)} className="p-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200" title="Delete permanently">
                <FiTrash2 size={18} />
              </button>
            ) : (
              <button onClick={() => archivePayment(payment.id)} className="p-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200" title="Archive payment">
                <FiArchive size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-4 sm:p-6 text-gray-600 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Due</p>
                    <p className="text-2xl sm:text-3xl py-2 font-bold">${totalDue.toFixed(2)}</p>
                    <p className="text-xs mt-1 text-gray-500">{activePayments.length} payments</p>
                  </div>
                  <div className="bg-white/40 p-2 sm:p-3 rounded-full shadow-sm">
                    <FiDollarSign size={20} className="text-gray-700" />
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-4 sm:p-6 text-gray-600 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Paid</p>
                    <p className="text-2xl sm:text-3xl py-2 font-bold">${totalPaid.toFixed(2)}</p>
                    <p className="text-xs mt-1 text-gray-500">{paidPayments.length} payments</p>
                  </div>
                  <div className="bg-white/40 p-2 sm:p-3 rounded-full shadow-sm">
                    <FiCheckCircle size={20} className="text-gray-700" />
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-4 sm:p-6 text-gray-600 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overdue</p>
                    <p className="text-2xl sm:text-3xl py-2 font-bold">{overduePayments.length}</p>
                    <p className="text-xs mt-1 text-gray-500">Need attention</p>
                  </div>
                  <div className="bg-white/40 p-2 sm:p-3 rounded-full shadow-sm">
                    <FiAlertCircle size={20} className="text-gray-700" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setActiveTab('add-payment')} className="flex items-center space-x-2 bg-[#ffcc33] text-gray-800 font-semibold px-4 py-2 rounded-lg hover:bg-[#ffd65e] duration-200 shadow-md">
                  <FiPlus size={16} />
                  <span>Add Payment</span>
                </button>
                <button onClick={() => setActiveTab('analytics')} className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-md">
                  <FiTrendingUp size={16} />
                  <span>View Analytics</span>
                </button>
              </div>
            </div>
            {overduePayments.length > 0 && (
              <div className="bg-white rounded-2xl p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FiAlertCircle className="text-red-500" size={20} />
                  <h2 className="text-xl font-bold text-red-700">Overdue Payments</h2>
                </div>
                <div className="space-y-4">
                  {overduePayments.map(payment => <PaymentCard key={payment.id} payment={payment} />)}
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Active Payments</h2>
              <div className="space-y-4">
                {activePayments.filter(p => !overduePayments.includes(p)).map(payment => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))}
                {activePayments.filter(p => !overduePayments.includes(p)).length === 0 && overduePayments.length === 0 && (
                  <div className="text-center py-12">
                    <FiCheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No active payments</p>
                    <p className="text-gray-400 text-sm">You're all caught up!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'add-payment':
        return (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Payment</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input type="text" value={newPayment.title} onChange={(e) => setNewPayment({...newPayment, title: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-transparent transition-all duration-200" placeholder="e.g., Monthly Rent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea value={newPayment.description} onChange={(e) => setNewPayment({...newPayment, description: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-transparent transition-all duration-200" placeholder="Additional details about this payment..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount ($)</label>
                  <input type="number" step="0.01" value={newPayment.amount} onChange={(e) => setNewPayment({...newPayment, amount: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-transparent transition-all duration-200" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date *</label>
                  <input type="date" value={newPayment.dueDate} onChange={(e) => setNewPayment({...newPayment, dueDate: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button onClick={handleAddPayment} className="flex items-center justify-center space-x-2 bg-[#ffcc33] text-gray-800 font-semibold px-6 py-3 rounded-lg hover:bg-[#ffd65e] transition-all duration-200 shadow-md">
                  <FiPlus size={18} />
                  <span>Add Payment</span>
                </button>
                <button onClick={() => setNewPayment({ title: '', description: '', dueDate: '', amount: 0 })} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium">
                  Clear Form
                </button>
              </div>
            </div>
          </div>
        );
      case 'paid':
        return (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Paid Payments</h2>
            <div className="space-y-4">
              {paidPayments.map(payment => <PaymentCard key={payment.id} payment={payment} />)}
              {paidPayments.length === 0 && (
                <div className="text-center py-12">
                  <FiCheckCircle className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-500 text-lg">No paid payments yet</p>
                  <p className="text-gray-400 text-sm">Completed payments will appear here</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'archived':
        return (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Archived Payments</h2>
            <div className="space-y-4">
              {archivedPayments.map(payment => <PaymentCard key={payment.id} payment={payment} isArchived={true} />)}
              {archivedPayments.length === 0 && (
                <div className="text-center py-12">
                  <FiArchive className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-500 text-lg">No archived payments</p>
                  <p className="text-gray-400 text-sm">Archived payments will appear here</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 sm:p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">Payment Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Total Payments:</span>
                      <span className="font-bold text-blue-900">{payments.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Active:</span>
                      <span className="font-bold text-blue-900">{activePayments.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Paid:</span>
                      <span className="font-bold text-green-600">{paidPayments.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Overdue:</span>
                      <span className="font-bold text-red-600">{overduePayments.length}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 sm:p-6 border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Total Due:</span>
                      <span className="font-bold text-red-600">${totalDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Total Paid:</span>
                      <span className="font-bold text-green-600">${totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Total Amount:</span>
                      <span className="font-bold text-green-900">${(totalDue + totalPaid).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 sm:p-6 border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700">Completion Rate:</span>
                      <span className="font-bold text-purple-900">{payments.length > 0 ? Math.round((paidPayments.length / payments.length) * 100) : 0}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700">On-Time Rate:</span>
                      <span className="font-bold text-purple-900">{paidPayments.length > 0 ? Math.round(((paidPayments.length - overduePayments.length) / paidPayments.length) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                    <input type="text" value={user?.name || ''} readOnly className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input type="email" value={user?.email || ''} readOnly className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-gray-50" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Browser Notifications</p>
                      <p className="text-sm text-gray-600">Receive reminders every 5 minutes for unpaid bills</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm ${notificationPermission ? 'text-green-600' : 'text-red-600'}`}>
                        {notificationPermission ? 'Enabled' : 'Disabled'}
                      </span>
                      <div className={`w-12 h-6 rounded-full ${notificationPermission ? 'bg-green-500' : 'bg-gray-300'} relative cursor-pointer`} onClick={async () => {
                          const permission = await Notification.requestPermission();
                          setNotificationPermission(permission === 'granted');
                          if (permission === 'granted') toast.success('Notifications enabled');
                        }}>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notificationPermission ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
 const NotificationBell = () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    
    return (
      <button 
        id="notifications-button"
        onClick={toggleNotificationsDropdown}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors relative"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  };
  const NotificationsDropdown = () => {
    if (!showNotificationsDropdown) return null;

    return (
      <div 
        id="notifications-dropdown"
        className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto"
      >
        <div className="p-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          <button 
            onClick={clearAllNotifications}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear All
          </button>
        </div>
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-3 hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex justify-between">
                  <p className="font-medium text-gray-900">{notification.title}</p>
                  <span className="text-xs text-gray-500">
                    {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                {notification.paymentId && (
                  <div className="mt-2 text-xs text-blue-600">
                    Click to view payment
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            No notifications
          </div>
        )}
      </div>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 backdrop-blur-sm shadow-sm px-4 py-3 sticky top-0 z-20 border-b border-gray-200 flex justify-between items-center">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <FiMenu size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">BillBuzz</h1>
        <div className="relative" ref={notificationsRef}>
          <NotificationBell />
          <NotificationsDropdown />
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30">
          <div className="bg-white h-full w-4/5 max-w-xs shadow-lg overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h1 className="text-xl font-bold text-gray-900">Menu</h1>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              {sidebarItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === item.id ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <FiLogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden md:block fixed left-0 top-0 h-full ${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white shadow-lg z-10 transition-all duration-300`}>
        <div className="p-4 flex justify-between items-center">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <SiWebmoney className="text-2xl text-black-600" />
              <h1 className="text-xl font-bold text-gray-900">BillBuzz</h1>
            </div>
          )}
          <button onClick={toggleSidebar} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            {sidebarCollapsed ? <VscExpandAll size={20} /> : <VscCollapseAll size={20} />}
          </button>
        </div>
        <nav className="mt-6 flex-1 overflow-hidden">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center sidebar-item ${sidebarCollapsed ? 'justify-center px-4' : 'space-x-3 px-4'} py-3 rounded-lg transition-colors ${
                activeTab === item.id ? 'active' : ''
              }`}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button onClick={handleLogout} className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors`}>
            <FiLogOut size={20} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex bg-gradient-to-br from-yellow-50 to-orange-50 flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Desktop Header */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-sm shadow-sm px-6 py-4 sticky top-0 z-5 border-b border-gray-200">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {sidebarItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {activeTab === 'dashboard' && `Welcome back, ${user?.name}!`}
                {activeTab === 'add-payment' && 'Create a new payment reminder'}
                {activeTab === 'analytics' && 'Track your payment performance'}
                {activeTab === 'paid' && 'View your completed payments'}
                {activeTab === 'archived' && 'Manage archived payments'}
                {activeTab === 'settings' && 'Customize your experience'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 z-50 transform -translate-y-1/2 text-gray-600" size={20} />
                <input type="text" placeholder="Search payments..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm" />
              </div>
              <div className="relative" ref={notificationsRef}>
                <NotificationBell />
                <NotificationsDropdown />
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#da8700] rounded-full flex items-center justify-center shadow-md">
                  <FiUser className="text-white" size={18} />
                </div>
                {!sidebarCollapsed && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Payment</h3>
              <button onClick={() => setEditingPayment(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                <input type="text" value={editingPayment.title} onChange={(e) => setEditingPayment({...editingPayment, title: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea value={editingPayment.description} onChange={(e) => setEditingPayment({...editingPayment, description: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount ($)</label>
                <input type="number" step="0.01" value={editingPayment.amount} onChange={(e) => setEditingPayment({...editingPayment, amount: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                <input type="date" value={editingPayment.dueDate} onChange={(e) => setEditingPayment({...editingPayment, dueDate: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" />
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                <button onClick={handleUpdatePayment} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md font-semibold">
                  Update Payment
                </button>
                <button onClick={() => setEditingPayment(null)} className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
              <button onClick={() => setPaymentToDelete(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <p className="mb-6 text-gray-600">Are you sure you want to permanently delete this payment? This action cannot be undone.</p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 justify-end">
              <button onClick={() => setPaymentToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium">
                Cancel
              </button>
              <button onClick={() => handleDeletePayment(paymentToDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}