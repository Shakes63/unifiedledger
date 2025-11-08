import { TransactionFormMobile } from '@/components/transactions/transaction-form-mobile';

/**
 * New transaction page with mobile-optimized form
 * - Mobile uses fixed header/footer with scrollable content
 * - Desktop shows traditional layout with card wrapper
 * - One-handed use optimized with larger touch targets
 */
export default function NewTransactionPage() {
  return <TransactionFormMobile defaultType="expense" showHeader={true} />;
}
