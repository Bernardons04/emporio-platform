import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {(title || headerAction) && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">{footer}</div>}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
  className?: string;
}) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    primary: 'bg-[#2B5276]/10 text-[#2B5276] border-[#2B5276]/20 font-medium',
    secondary: 'bg-[#4986C1]/10 text-[#4986C1] border-[#4986C1]/20 font-medium',
    accent: 'bg-[#E6A211]/20 text-amber-900 border-[#E6A211]/40 font-semibold',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

