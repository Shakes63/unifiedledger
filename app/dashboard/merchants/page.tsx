'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt?: string;
  totalSpent: number;
  averageTransaction: number;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '' });

  // Fetch merchants
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/merchants?limit=1000');
        if (response.ok) {
          const data = await response.json();
          setMerchants(data);
        } else {
          toast.error('Failed to load merchants');
        }
      } catch (error) {
        console.error('Error fetching merchants:', error);
        toast.error('Error loading merchants');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Merchant name is required');
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedMerchant) {
        // Update merchant
        const response = await fetch(`/api/merchants/${selectedMerchant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name }),
        });

        if (response.ok) {
          toast.success('Merchant updated successfully');
          setMerchants(
            merchants.map((m) =>
              m.id === selectedMerchant.id
                ? { ...m, name: formData.name }
                : m
            )
          );
          setIsDialogOpen(false);
          setSelectedMerchant(null);
          setFormData({ name: '' });
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to update merchant');
        }
      } else {
        // Create merchant
        const response = await fetch('/api/merchants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name }),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success('Merchant created successfully');
          setMerchants([result, ...merchants]);
          setIsDialogOpen(false);
          setFormData({ name: '' });
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to create merchant');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(selectedMerchant ? 'Error updating merchant' : 'Error creating merchant');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (merchantId: string) => {
    if (!confirm('Are you sure you want to delete this merchant?')) {
      return;
    }

    try {
      const response = await fetch(`/api/merchants/${merchantId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Merchant deleted successfully');
        setMerchants(merchants.filter((m) => m.id !== merchantId));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete merchant');
      }
    } catch (error) {
      console.error('Error deleting merchant:', error);
      toast.error('Error deleting merchant');
    }
  };

  // Handle edit
  const handleEdit = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setFormData({ name: merchant.name });
    setIsDialogOpen(true);
  };

  // Handle create
  const handleCreate = () => {
    setSelectedMerchant(null);
    setFormData({ name: '' });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[#242424] rounded w-1/4"></div>
          <div className="grid grid-cols-1 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-[#242424] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Merchants</h1>
          <p className="text-gray-400 mt-2">Manage your merchants and track spending</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Merchant
        </Button>
      </div>

      {merchants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Usage Count</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Total Spent</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Avg Transaction</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr
                  key={merchant.id}
                  className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a]/50 transition-all"
                >
                  <td className="py-3 px-4 text-white">{merchant.name}</td>
                  <td className="py-3 px-4 text-gray-400">{merchant.usageCount}</td>
                  <td className="py-3 px-4 text-gray-400">
                    ${merchant.totalSpent?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    ${merchant.averageTransaction?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(merchant)}
                        className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(merchant.id)}
                        className="bg-[#242424] border-[#3a3a3a] text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No merchants yet</p>
          <Button
            onClick={handleCreate}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Merchant
          </Button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedMerchant ? 'Edit Merchant' : 'Create Merchant'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-white">
                Merchant Name *
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Starbucks, Amazon"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                className="bg-[#242424] border-[#3a3a3a] text-white"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedMerchant(null);
                  setFormData({ name: '' });
                }}
                className="bg-[#242424] border-[#3a3a3a] text-gray-400"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {isSubmitting ? 'Saving...' : selectedMerchant ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
