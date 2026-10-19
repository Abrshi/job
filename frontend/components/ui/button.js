'use client';

import React from 'react';

const variantClasses = {
  primary:
    'text-white bg-stormy-dark hover:bg-stormy-darkHover shadow-subtle focus-visible:ring-stormy-sky',
  cta:
    'text-stormy-dark font-semibold bg-stormy-sky hover:bg-stormy-skyHover shadow-subtle focus-visible:ring-stormy-slate',
  outline:
    'text-stormy-dark bg-transparent border border-stormy-slate/40 hover:bg-stormy-canvas hover:border-stormy-slate focus-visible:ring-stormy-sky',
  ghost:
    'text-stormy-slate hover:text-stormy-dark hover:bg-stormy-mist/30',
  destructive:
    'text-white bg-feedback-danger hover:bg-red-600 shadow-subtle focus-visible:ring-red-400',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2.5 text-sm rounded-lg min-h-[44px]',
  lg: 'px-5 py-3 text-base rounded-xl min-h-[48px]',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  type = 'button',
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
