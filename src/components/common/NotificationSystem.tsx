import { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // in milliseconds, default 5000
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationSystem({ notifications, onDismiss }: NotificationSystemProps) {
  // Auto-dismiss notifications after their duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    notifications.forEach(notification => {
      const duration = notification.duration || 5000;
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, duration);
      timers.push(timer);
    });
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-exclamation-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '400px',
      fontFamily: '"Montserrat", "Arial", sans-serif'
    }}>
      {notifications.map(notification => {
        const icon = getIcon(notification.type);
        
        return (
          <div
            key={notification.id}
            style={{
              backgroundColor: 'var(--color-bg-notification)',
              border: '1px solid var(--color-border-notification)',
              borderRadius: '6px',
              padding: '12px 16px',
              boxShadow: '0 4px 12px var(--color-shadow-elevated)',
              color: 'var(--color-text-secondary)',
              position: 'relative',
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <i 
                className={`fas ${icon}`} 
                style={{ 
                  color: 'var(--color-text-secondary)', 
                  fontSize: '16px',
                  marginTop: '2px',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  marginBottom: '4px',
                  color: 'var(--color-text-primary)'
                }}>
                  {notification.title}
                </div>
                <div style={{
                  fontSize: '13px',
                  lineHeight: '1.4',
                  color: 'var(--color-text-secondary)'
                }}>
                  {notification.message}
                </div>
              </div>
              <button
                onClick={() => onDismiss(notification.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0',
                  opacity: 0.7,
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
} 