'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { Badge } from '@/components/ui/badge';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Merchant {
  id: string;
  name: string;
  categoryId?: string;
  isSalesTaxExempt?: boolean;
  usageCount: number;
  lastUsedAt?: string;
  totalSpent: number;
  averageTransaction: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function MerchantsPage() {
  const {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    deleteWithHousehold,
    selectedHouseholdId
  } = useHouseholdFetch();

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', categoryId: '', isSalesTaxExempt: false });

  // Fetch merchants and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch merchants
        const merchantsResponse = await fetchWithHousehold('/api/merchants?limit=1000');
        if (merchantsResponse.ok) {
          const merchantsData = await merchantsResponse.json();
          setMerchants(merchantsData);
        } else {
          toast.error('Failed to load merchants');
        }

        // Fetch categories
        const categoriesResponse = await fetchWithHousehold('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold]);

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
        const response = await putWithHousehold(`/api/merchants/${selectedMerchant.id}`, {
          name: formData.name,
          categoryId: formData.categoryId || null,
          isSalesTaxExempt: formData.isSalesTaxExempt,
        });

        if (response.ok) {
          const updatedMerchant = await response.json();
          toast.success('Merchant updated successfully');
          setMerchants(
            merchants.map((m) =>
              m.id === selectedMerchant.id
                ? updatedMerchant
                : m
            )
          );
          setIsDialogOpen(false);
          setSelectedMerchant(null);
          setFormData({ name: '', categoryId: '', isSalesTaxExempt: false });
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to update merchant');
        }
      } else {
        // Create merchant
        const response = await postWithHousehold('/api/merchants', {
          name: formData.name,
          categoryId: formData.categoryId || null,
          isSalesTaxExempt: formData.isSalesTaxExempt,
        });

        if (response.ok) {
          const result = await response.json();
          toast.success('Merchant created successfully');
          setMerchants([result, ...merchants]);
          setIsDialogOpen(false);
          setFormData({ name: '', categoryId: '', isSalesTaxExempt: false });
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
      const response = await deleteWithHousehold(`/api/merchants/${merchantId}`);

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
    setFormData({
      name: merchant.name,
      categoryId: merchant.categoryId || '',
      isSalesTaxExempt: merchant.isSalesTaxExempt || false,
    });
    setIsDialogOpen(true);
  };

  // Handle create
  const handleCreate = () => {
    setSelectedMerchant(null);
    setFormData({ name: '', categoryId: '', isSalesTaxExempt: false });
    setIsDialogOpen(true);
  };

  // Toggle tax exempt status
  const handleToggleTaxExempt = async (merchantId: string, newExemptStatus: boolean) => {
    try {
      const response = await putWithHousehold(`/api/merchants/${merchantId}`, {
        isSalesTaxExempt: newExemptStatus,
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchants(merchants.map((m) => m.id === merchantId ? updatedMerchant : m));
        toast.success(newExemptStatus ? 'Merchant marked as tax exempt' : 'Tax exempt status removed');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update tax exempt status');
      }
    } catch (error) {
      console.error('Error updating tax exempt status:', error);
      toast.error('Error updating tax exempt status');
    }
  };

  // Get category name by ID
  const getCategoryName = (categoryId?: string): string => {
    if (!categoryId) return 'None';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-elevated rounded w-1/4"></div>
          <div className="grid grid-cols-1 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-elevated rounded"></div>
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
          <h1 className="text-3xl font-bold text-foreground">Merchants</h1>
          <p className="text-muted-foreground mt-2">Manage your merchants and track spending</p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-primary hover:opacity-90 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Merchant
        </Button>
      </div>

      {merchants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Tax Exempt</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Category</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Usage Count</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Total Spent</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Avg Transaction</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr
                  key={merchant.id}
                  className="border-b border-border hover:bg-card/50 transition-all"
                >
                  <td className="py-3 px-4 text-foreground">
                    <div className="flex items-center gap-2">
                      <span>{merchant.name}</span>
                      <EntityIdBadge id={merchant.id} label="Mer" />
                      {merchant.categoryId && (
                        <EntityIdBadge id={merchant.categoryId} label="Cat" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {merchant.isSalesTaxExempt ? (
                      <Badge
                        variant="outline"
                        className="cursor-pointer bg-success/10 text-success border-success/30 hover:bg-success/20"
                        onClick={() => handleToggleTaxExempt(merchant.id, false)}
                      >
                        Exempt
                      </Badge>
                    ) : (
                      <button
                        onClick={() => handleToggleTaxExempt(merchant.id, true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Not exempt
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(merchant.categoryId)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{merchant.usageCount}</td>
                  <td className="py-3 px-4 text-muted-foreground">
                    ${merchant.totalSpent?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    ${merchant.averageTransaction?.toFixed(2) || '0.00'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(merchant)}
                        className="bg-elevated border-border text-muted-foreground hover:bg-elevated"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(merchant.id)}
                        className="bg-elevated border-border text-error hover:bg-error/10"
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
          <p className="text-muted-foreground mb-4">No merchants yet</p>
          <Button
            onClick={handleCreate}
            className="bg-primary hover:opacity-90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Merchant
          </Button>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedMerchant ? 'Edit Merchant' : 'Create Merchant'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add merchants and vendors to categorize your transactions automatically
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Merchant Name *
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., Starbucks, Amazon"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-elevated border-border text-foreground"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-medium text-foreground">
                Default Category
              </Label>
              <Select
                value={formData.categoryId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value === 'none' ? '' : value })}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select category (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This helps filter merchants by transaction type (income/expense)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isSalesTaxExempt"
                  checked={formData.isSalesTaxExempt}
                  onChange={(e) => setFormData({ ...formData, isSalesTaxExempt: e.target.checked })}
                  className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                />
                <Label htmlFor="isSalesTaxExempt" className="text-sm font-medium text-foreground cursor-pointer">
                  Sales Tax Exempt
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Income transactions from this merchant will be excluded from sales tax calculations. Useful for wholesale customers, tax-exempt organizations, or out-of-state sales.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedMerchant(null);
                  setFormData({ name: '', categoryId: '', isSalesTaxExempt: false });
                }}
                className="bg-elevated border-border text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-primary hover:opacity-90 text-primary-foreground"
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
