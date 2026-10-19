'use client';

import React from 'react';

const alertStyles = {
  success: {
    container: 'bg-feedback-success-bg border-feedback-success-border text-feedback-success-text',
    iconColor: 'text-feedback-success',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    container: 'bg-feedback-warning-bg border-feedback-warning-border text-feedback-warning-text',
    iconColor: 'text-feedback-warning',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  danger: {
    container: 'bg-feedback-danger-bg border-feedback-danger-border text-feedback-danger-text',
    iconColor: 'text-feedback-danger',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  info: {
    container: 'bg-feedback-info-bg border-feedback-info-border text-feedback-info-text',
    iconColor: 'text-stormy-dark',
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
}) {
  const current = alertStyles[variant] || alertStyles.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 border rounded-xl text-sm transition-all ${current.container} ${className}`}
    >
      <div className={current.iconColor}>{current.icon}</div>
      <div className="flex-1">
        {title && <strong className="font-semibold block mb-0.5">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
