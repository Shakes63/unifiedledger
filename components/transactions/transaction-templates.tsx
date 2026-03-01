'use client';

import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Fuel,
  UtensilsCrossed,
  Zap,
  Droplets,
  Smartphone,
  Home,
  Plus,
} from 'lucide-react';

interface Template {
  name: string;
  description: string;
  icon: React.ReactNode;
  suggestedAmount?: number;
}

const TEMPLATES: Template[] = [
  {
    name: 'groceries',
    description: 'Groceries',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    name: 'gas',
    description: 'Gas/Fuel',
    icon: <Fuel className="w-5 h-5" />,
  },
  {
    name: 'dining_out',
    description: 'Dining Out',
    icon: <UtensilsCrossed className="w-5 h-5" />,
  },
  {
    name: 'electricity',
    description: 'Electric Bill',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    name: 'water',
    description: 'Water Bill',
    icon: <Droplets className="w-5 h-5" />,
  },
  {
    name: 'phone',
    description: 'Phone Bill',
    icon: <Smartphone className="w-5 h-5" />,
  },
  {
    name: 'rent',
    description: 'Rent/Mortgage',
    icon: <Home className="w-5 h-5" />,
  },
  {
    name: 'other',
    description: 'Other',
    icon: <Plus className="w-5 h-5" />,
  },
];

interface TransactionTemplatesProps {
  onSelectTemplate: (template: Template) => void;
}

export function TransactionTemplates({ onSelectTemplate }: TransactionTemplatesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {TEMPLATES.map((template) => (
        <Button
          key={template.name}
          variant="outline"
          className="h-auto flex-col gap-2 py-3"
          onClick={() => onSelectTemplate(template)}
        >
          {template.icon}
          <span className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
            {template.description}
          </span>
        </Button>
      ))}
    </div>
  );
}
