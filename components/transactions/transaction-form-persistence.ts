import type { Split } from './split-builder';

type HouseholdFetch = (input: string, init?: RequestInit) => Promise<Response>;
type HouseholdPut = (url: string, data: Record<string, unknown>) => Promise<Response>;

interface SyncTagsParams {
  transactionId: string;
  selectedTagIds: string[];
  isEditMode: boolean;
  fetchWithHousehold: HouseholdFetch;
}

interface SyncCustomFieldsParams {
  transactionId: string;
  customFieldValues: Record<string, string>;
  isEditMode: boolean;
}

interface SyncSplitsParams {
  transactionId: string;
  useSplits: boolean;
  splits: Split[];
  isEditMode: boolean;
  putWithHousehold: HouseholdPut;
}

export async function syncTransactionTags({
  transactionId,
  selectedTagIds,
  isEditMode,
  fetchWithHousehold,
}: SyncTagsParams) {
  if (selectedTagIds.length === 0) return;

  if (isEditMode) {
    const existingTags = await fetchWithHousehold(`/api/transactions/${transactionId}/tags`);
    if (existingTags.ok) {
      const existingTagIds = await existingTags.json();
      for (const tag of existingTagIds) {
        await fetch('/api/transaction-tags', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            transactionId,
            tagId: tag.id,
          }),
        });
      }
    }
  }

  for (const tagId of selectedTagIds) {
    await fetch('/api/transaction-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId,
        tagId,
      }),
    });
  }
}

export async function syncTransactionCustomFields({
  transactionId,
  customFieldValues,
  isEditMode,
}: SyncCustomFieldsParams) {
  if (Object.keys(customFieldValues).length === 0) return;

  if (isEditMode) {
    const existingValues = await fetch(`/api/custom-field-values?transactionId=${transactionId}`, { credentials: 'include' });
    if (existingValues.ok) {
      const existingData = await existingValues.json();
      for (const fieldValue of existingData.data || []) {
        await fetch(`/api/custom-field-values?valueId=${fieldValue.id}`, { credentials: 'include', method: 'DELETE' });
      }
    }
  }

  for (const [fieldId, value] of Object.entries(customFieldValues)) {
    if (!value) continue;

    await fetch('/api/custom-field-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customFieldId: fieldId,
        transactionId,
        value,
      }),
    });
  }
}

export async function syncTransactionSplits({
  transactionId,
  useSplits,
  splits,
  isEditMode,
  putWithHousehold,
}: SyncSplitsParams) {
  if (useSplits && splits.length > 0) {
    const batchSplits = splits.map((split, index) => ({
      id: split.id && !split.id.startsWith('split-') ? split.id : undefined,
      categoryId: split.categoryId,
      amount: split.amount || 0,
      percentage: split.percentage || 0,
      isPercentage: split.isPercentage,
      description: split.description,
      sortOrder: index,
    }));

    const batchResponse = await putWithHousehold(
      `/api/transactions/${transactionId}/splits/batch`,
      { splits: batchSplits, deleteOthers: true }
    );

    if (!batchResponse.ok) {
      const errorData = await batchResponse.json();
      throw new Error(errorData.error || 'Failed to save splits');
    }

    return;
  }

  if (isEditMode && !useSplits) {
    const batchResponse = await putWithHousehold(
      `/api/transactions/${transactionId}/splits/batch`,
      { splits: [], deleteOthers: true }
    );

    if (!batchResponse.ok) {
      const errorData = await batchResponse.json();
      throw new Error(errorData.error || 'Failed to remove splits');
    }
  }
}
