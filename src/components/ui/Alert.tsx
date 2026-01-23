/**
 * Alert Component
 * Reusable alert/notification component
 */

import React, { memo, useCallback } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  onDismiss?: () => void;
  dismissible?: boolean;
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variantStyles: Record<AlertVariant, { icon: string; className: string }> = {
  info: { icon: 'ℹ️', className: 'alert--info' },
  success: { icon: '', className: 'alert--success' },
  warning: { icon: '', className: 'alert--warning' },
  error: { icon: '', className: 'alert--error' },
};

export const Alert: React.FC<AlertProps> = memo(({
  variant = 'info',
  title,
  message,
  onDismiss,
  dismissible = false,
  className = '',
  action,
}) => {
  const { icon, className: variantClass } = variantStyles[variant];

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div 
      className={`alert ${variantClass} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <span className="alert__icon" aria-hidden="true">{icon}</span>
      
      <div className="alert__content">
        {title && <strong className="alert__title">{title}</strong>}
        <p className="alert__message">{message}</p>
      </div>

      <div className="alert__actions">
        {action && (
          <button 
            className="alert__action-btn"
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )}
        
        {dismissible && (
          <button 
            className="alert__dismiss"
            onClick={handleDismiss}
            aria-label="Kapat"
            type="button"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
});

Alert.displayName = 'Alert';

export default Alert;
