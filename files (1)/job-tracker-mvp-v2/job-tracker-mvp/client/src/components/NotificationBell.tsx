'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  className?: string;
  sidebarMode?: boolean;
  sidebarCollapsed?: boolean;
  dropdownAlign?: 'left' | 'right' | 'outside-right';
}

export function NotificationBell({
  className = '',
  sidebarMode = false,
  sidebarCollapsed = false,
  dropdownAlign = 'right',
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [fixedDropdownPosition, setFixedDropdownPosition] = useState({ top: 0, left: 0 });
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inDropdown = dropdownRef.current?.contains(target);
      const inButton = buttonRef.current?.contains(target);
      if (!inDropdown && !inButton) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const needsFixedOutsideDropdown = dropdownAlign === 'outside-right';
    if (!needsFixedOutsideDropdown || !isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 384; // w-96
      const dropdownMaxHeight = 600;
      const margin = 12;

      let left = rect.right + margin;
      let top = rect.top;

      if (left + dropdownWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - dropdownWidth - margin);
      }
      if (top + dropdownMaxHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - dropdownMaxHeight - margin);
      }

      setFixedDropdownPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, dropdownAlign]);

  const fetchNotifications = async () => {
    try {
      const data = await notificationsAPI.getAll({ unreadOnly: false, limit: 20 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error: any) {
      toast.error('Failed to mark all as read');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'GHOSTING_ALERT':
      case 'GHOSTING_DETECTED':
      case 'GHOSTING_WARNING':
        return '👻';
      case 'AI_REVIEW_REQUIRED':
        return '🧠';
      case 'STATUS_UPDATE':
        return '📧';
      case 'INTERVIEW_REMINDER':
        return '📅';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'GHOSTING_ALERT':
      case 'GHOSTING_DETECTED':
      case 'GHOSTING_WARNING':
        return 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'AI_REVIEW_REQUIRED':
        return 'bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'STATUS_UPDATE':
        return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'INTERVIEW_REMINDER':
        return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className={`${
            dropdownAlign === 'outside-right' ? 'fixed' : 'absolute'
          } ${
            dropdownAlign === 'left'
              ? 'left-0'
              : dropdownAlign === 'outside-right'
              ? ''
              : 'right-0'
          } mt-2 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 max-h-[600px] flex flex-col transition-colors`}
          style={{
            zIndex: 99999,
            ...(dropdownAlign === 'outside-right'
              ? { top: fixedDropdownPosition.top, left: fixedDropdownPosition.left }
              : {}),
          }}
          ref={dropdownAlign === 'outside-right' ? dropdownRef : undefined}
        >
          <div className="p-4 border-b-2 border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-black dark:text-white transition-colors">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <p className="text-gray-600 dark:text-gray-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            !notification.read
                              ? 'font-semibold text-black dark:text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          } transition-colors`}
                        >
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const usePortal = dropdownAlign === 'outside-right';

  return (
    <div className={`relative ${className}`} ref={usePortal ? undefined : dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={
          sidebarMode
            ? `relative w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all`
            : 'relative p-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors'
        }
        title="Notifications"
      >
        <svg className={`${sidebarMode ? 'w-5 h-5' : 'w-6 h-6'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {sidebarMode && !sidebarCollapsed && <span className="font-medium">Notifications</span>}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute ${sidebarMode ? 'top-2 right-2' : 'top-0 right-0'} w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {usePortal && typeof document !== 'undefined'
        ? createPortal(dropdownContent, document.body)
        : dropdownContent}
    </div>
  );
}
