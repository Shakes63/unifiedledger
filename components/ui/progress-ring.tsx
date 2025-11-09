'use client';

import { useEffect, useState } from 'react';

interface ProgressRingProps {
  percentage: number; // 0-100
  size?: 'small' | 'medium' | 'large';
  strokeWidth?: number;
  color?: 'red' | 'orange' | 'blue' | 'green' | 'gold';
  showPercentage?: boolean;
  className?: string;
}

export function ProgressRing({
  percentage,
  size = 'medium',
  strokeWidth,
  color,
  showPercentage = true,
  className = '',
}: ProgressRingProps) {
  const [displayPercentage, setDisplayPercentage] = useState(0);

  // Size configurations
  const sizeConfig = {
    small: { diameter: 80, stroke: strokeWidth || 6 },
    medium: { diameter: 140, stroke: strokeWidth || 8 },
    large: { diameter: 200, stroke: strokeWidth || 10 },
  };

  const { diameter, stroke } = sizeConfig[size];
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  // Calculate stroke offset
  const offset = circumference - (clampedPercentage / 100) * circumference;

  // Auto-select color based on percentage if not provided
  const getColor = () => {
    if (color) {
      const colorMap = {
        red: { from: '#ef4444', to: '#dc2626' },
        orange: { from: '#f97316', to: '#ea580c' },
        blue: { from: '#3b82f6', to: '#2563eb' },
        green: { from: '#10b981', to: '#059669' },
        gold: { from: '#fbbf24', to: '#f59e0b' },
      };
      return colorMap[color];
    }

    // Auto-select based on percentage
    if (clampedPercentage < 25) {
      return { from: '#ef4444', to: '#dc2626' }; // Red
    } else if (clampedPercentage < 50) {
      return { from: '#f97316', to: '#ea580c' }; // Orange
    } else if (clampedPercentage < 75) {
      return { from: '#3b82f6', to: '#2563eb' }; // Blue
    } else if (clampedPercentage < 100) {
      return { from: '#10b981', to: '#059669' }; // Green
    } else {
      return { from: '#fbbf24', to: '#f59e0b' }; // Gold
    }
  };

  const colors = getColor();
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Animate percentage on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayPercentage(clampedPercentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [clampedPercentage]);

  // Font size based on ring size
  const fontSize = {
    small: 'text-xl',
    medium: 'text-3xl',
    large: 'text-5xl',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: diameter, height: diameter }}
      role="progressbar"
      aria-valuenow={clampedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clampedPercentage}% complete`}
    >
      <svg
        width={diameter}
        height={diameter}
        className="transform -rotate-90"
      >
        {/* Define gradient */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={stroke}
        />

        {/* Progress circle */}
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out',
          }}
        />
      </svg>

      {/* Percentage text */}
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${fontSize} font-bold text-white`}>
            {Math.round(displayPercentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
