import React from 'react';

export function Alert({ variant = 'info', title, children, className = '' }) {
  const variants = {
    info: 'bg-sky-950/60 border-sky-800 text-sky-200',
    success: 'bg-emerald-950/60 border-emerald-800 text-emerald-200',
    warning: 'bg-amber-950/60 border-amber-800 text-amber-200',
    danger: 'bg-rose-950/60 border-rose-800 text-rose-200',
  };

  return (
    <div className={`p-4 rounded-xl border text-sm space-y-1 ${variants[variant] || variants.info} ${className}`}>
      {title && <h5 className="font-bold leading-none tracking-tight">{title}</h5>}
      <div className="leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

