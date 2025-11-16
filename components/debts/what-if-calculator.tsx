'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScenarioBuilder, type Scenario } from './scenario-builder';
import { ScenarioComparisonCard } from './scenario-comparison-card';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { ScenarioComparisonResult } from '@/lib/debts/payoff-calculator';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface WhatIfCalculatorProps {
  currentExtraPayment: number;
  currentMethod: 'snowball' | 'avalanche';
  currentFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
}

export function WhatIfCalculator({
  currentExtraPayment,
  currentMethod,
  currentFrequency = 'monthly',
}: WhatIfCalculatorProps) {
  const { selectedHouseholdId } = useHousehold();
  const { postWithHousehold } = useHouseholdFetch();
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: '1',
      name: 'Current Plan',
      extraMonthlyPayment: currentExtraPayment,
      lumpSumPayments: [],
      method: currentMethod,
      paymentFrequency: currentFrequency,
    },
  ]);
  const [comparison, setComparison] = useState<ScenarioComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-calculate when scenarios change (debounced)
  useEffect(() => {
    if (!selectedHouseholdId) return;
    
    const timer = setTimeout(() => {
      calculateScenarios();
    }, 500);

    return () => clearTimeout(timer);
  }, [scenarios, selectedHouseholdId]);

  const calculateScenarios = async () => {
    if (scenarios.length === 0 || !selectedHouseholdId) return;

    try {
      setLoading(true);
      const response = await postWithHousehold('/api/debts/scenarios', {
        scenarios: scenarios.map(s => ({
          extraMonthlyPayment: s.extraMonthlyPayment,
          lumpSumPayments: s.lumpSumPayments,
          method: s.method,
          paymentFrequency: s.paymentFrequency,
        })),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate scenarios');
      }

      const data = await response.json();
      setComparison(data);
    } catch (error) {
      console.error('Error calculating scenarios:', error);
      toast.error('Failed to calculate scenarios');
    } finally {
      setLoading(false);
    }
  };

  const addScenario = (template?: Partial<Scenario>) => {
    const newId = (scenarios.length + 1).toString();
    const newScenario: Scenario = {
      id: newId,
      name: template?.name || `Scenario ${newId}`,
      extraMonthlyPayment: template?.extraMonthlyPayment ?? currentExtraPayment,
      lumpSumPayments: template?.lumpSumPayments || [],
      method: template?.method || currentMethod,
      paymentFrequency: template?.paymentFrequency || currentFrequency,
    };
    setScenarios([...scenarios, newScenario]);
  };

  const updateScenario = (id: string, updated: Scenario) => {
    setScenarios(scenarios.map((s) => (s.id === id ? updated : s)));
  };

  const deleteScenario = (id: string) => {
    // Don't allow deleting the last scenario
    if (scenarios.length === 1) {
      toast.error('You must have at least one scenario');
      return;
    }
    setScenarios(scenarios.filter((s) => s.id !== id));
  };

  const resetScenarios = () => {
    setScenarios([
      {
        id: '1',
        name: 'Current Plan',
        extraMonthlyPayment: currentExtraPayment,
        lumpSumPayments: [],
        method: currentMethod,
        paymentFrequency: currentFrequency,
      },
    ]);
    toast.success('Reset to current plan');
  };

  // Quick templates
  const addQuickScenario = (type: string) => {
    switch (type) {
      case 'extra-50':
        addScenario({
          name: 'Extra $50/month',
          extraMonthlyPayment: currentExtraPayment + 50,
        });
        break;
      case 'extra-100':
        addScenario({
          name: 'Extra $100/month',
          extraMonthlyPayment: currentExtraPayment + 100,
        });
        break;
      case 'extra-200':
        addScenario({
          name: 'Extra $200/month',
          extraMonthlyPayment: currentExtraPayment + 200,
        });
        break;
      case 'weekly':
        addScenario({
          name: 'Weekly Payments',
          extraMonthlyPayment: currentExtraPayment,
          paymentFrequency: 'weekly',
        });
        break;
      case 'biweekly':
        addScenario({
          name: 'Switch to Bi-Weekly',
          extraMonthlyPayment: currentExtraPayment,
          paymentFrequency: 'biweekly',
        });
        break;
      case 'quarterly':
        addScenario({
          name: 'Quarterly Payments',
          extraMonthlyPayment: currentExtraPayment,
          paymentFrequency: 'quarterly',
        });
        break;
      case 'tax-refund':
        addScenario({
          name: 'Tax Refund',
          lumpSumPayments: [{ month: 4, amount: 5000 }],
        });
        break;
      case 'bonus':
        addScenario({
          name: 'Year-End Bonus',
          lumpSumPayments: [{ month: 12, amount: 3000 }],
        });
        break;
      case 'double':
        addScenario({
          name: 'Double Payments',
          extraMonthlyPayment: currentExtraPayment * 2,
        });
        break;
    }
    toast.success('Scenario added');
  };

  const getBestBadge = (scenarioName: string): 'time' | 'money' | 'balanced' | null => {
    if (!comparison) return null;
    const { recommendation } = comparison;

    if (scenarioName === recommendation.bestForTime &&
        scenarioName === recommendation.bestForMoney &&
        scenarioName === recommendation.mostBalanced) {
      return 'balanced'; // Perfect scenario
    }

    if (scenarioName === recommendation.bestForTime) return 'time';
    if (scenarioName === recommendation.bestForMoney) return 'money';
    if (scenarioName === recommendation.mostBalanced) return 'balanced';
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
            What-If Scenario Calculator
          </h2>
          <p className="text-muted-foreground mt-1">
            Compare different payment strategies to find the best debt payoff plan
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetScenarios}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Scenarios</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-50')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            +$50/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-100')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            +$100/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-200')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            +$200/month
          </Button>
          {currentFrequency !== 'weekly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('weekly')}
              className="border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)]/20"
            >
              Weekly
            </Button>
          )}
          {currentFrequency !== 'biweekly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('biweekly')}
              className="border-[var(--color-income)] text-[var(--color-income)] hover:bg-[var(--color-income)]/20"
            >
              Bi-Weekly
            </Button>
          )}
          {currentFrequency !== 'quarterly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('quarterly')}
              className="border-[var(--color-warning)] text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20"
            >
              Quarterly
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('tax-refund')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            Tax Refund
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('bonus')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            Bonus
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('double')}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
          >
            Double Pay
          </Button>
        </div>
      </div>

      {/* Scenario Builders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Your Scenarios</h3>
          <Button
            onClick={() => addScenario()}
            className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
            disabled={scenarios.length >= 4}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Scenario
          </Button>
        </div>

        {scenarios.length >= 4 && (
          <p className="text-sm text-[var(--color-warning)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded p-2 mb-4">
            Maximum 4 scenarios can be compared at once
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scenarios.map((scenario, index) => (
            <ScenarioBuilder
              key={scenario.id}
              scenario={scenario}
              onUpdate={(updated) => updateScenario(scenario.id, updated)}
              onDelete={() => deleteScenario(scenario.id)}
              isBaseline={index === 0}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground mt-4">Calculating scenarios...</p>
        </div>
      ) : comparison && comparison.scenarios.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Comparison Results</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {comparison.scenarios.map((scenario, index) => (
              <ScenarioComparisonCard
                key={index}
                scenario={scenario}
                isBaseline={index === 0}
                isBest={getBestBadge(scenario.name)}
              />
            ))}
          </div>

          {/* Recommendation Summary */}
          {comparison.recommendation && comparison.scenarios.length > 1 && (
            <div className="mt-6 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-success)]/10 border border-[var(--color-primary)]/30 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fastest Payoff:</span>
                  <div className="text-foreground font-semibold mt-1">
                    {comparison.recommendation.bestForTime}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Saves Most Money:</span>
                  <div className="text-foreground font-semibold mt-1">
                    {comparison.recommendation.bestForMoney}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Most Balanced:</span>
                  <div className="text-foreground font-semibold mt-1">
                    {comparison.recommendation.mostBalanced}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
