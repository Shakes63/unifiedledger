'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const calculateScenarios = useCallback(async () => {
    if (scenarios.length === 0 || !selectedHouseholdId) return;

    try {
      setLoading(true);
      const response = await postWithHousehold('/api/debts/scenarios', {
        scenarios: scenarios.map(s => ({
          name: s.name,
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
  }, [scenarios, selectedHouseholdId, postWithHousehold]);

  // Auto-calculate when scenarios change (debounced)
  useEffect(() => {
    if (!selectedHouseholdId) return;
    
    const timer = setTimeout(() => {
      calculateScenarios();
    }, 500);

    return () => clearTimeout(timer);
  }, [calculateScenarios, selectedHouseholdId]);

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
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
            <Sparkles className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            What-If Scenario Calculator
          </h2>
          <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Compare different payment strategies to find the best debt payoff plan
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetScenarios}
            className="[&:hover]:[color:var(--color-foreground)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground)' }}>Quick Scenarios</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-50')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            +$50/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-100')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            +$100/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-200')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            +$200/month
          </Button>
          {currentFrequency !== 'weekly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('weekly')}
              style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              className="[&:hover]:bg-[color-mix(in_oklch,var(--color-success)_20%,transparent)]"
            >
              Weekly
            </Button>
          )}
          {currentFrequency !== 'biweekly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('biweekly')}
              style={{ borderColor: 'var(--color-income)', color: 'var(--color-income)' }}
              className="[&:hover]:bg-[color-mix(in_oklch,var(--color-income)_20%,transparent)]"
            >
              Bi-Weekly
            </Button>
          )}
          {currentFrequency !== 'quarterly' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuickScenario('quarterly')}
              style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
              className="[&:hover]:bg-[color-mix(in_oklch,var(--color-warning)_20%,transparent)]"
            >
              Quarterly
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('tax-refund')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            Tax Refund
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('bonus')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            Bonus
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('double')}
            className="[&:hover]:[color:var(--color-foreground)] [&:hover]:[background-color:var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            Double Pay
          </Button>
        </div>
      </div>

      {/* Scenario Builders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Your Scenarios</h3>
          <Button
            onClick={() => addScenario()}
            className="hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            disabled={scenarios.length >= 4}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Scenario
          </Button>
        </div>

        {scenarios.length >= 4 && (
          <p
            className="text-sm rounded p-2 mb-4"
            style={{
              color: 'var(--color-warning)',
              backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)',
            }}
          >
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
          <div
            className="inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          ></div>
          <p className="mt-4" style={{ color: 'var(--color-muted-foreground)' }}>Calculating scenarios...</p>
        </div>
      ) : comparison && comparison.scenarios.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>Comparison Results</h3>
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
            <div
              className="mt-6 rounded-xl p-6"
              style={{
                background: 'linear-gradient(to right, color-mix(in oklch, var(--color-primary) 10%, transparent), color-mix(in oklch, var(--color-success) 10%, transparent))',
                border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)',
              }}
            >
              <h4 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
                <Sparkles className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Fastest Payoff:</span>
                  <div className="font-semibold mt-1" style={{ color: 'var(--color-foreground)' }}>
                    {comparison.recommendation.bestForTime}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Saves Most Money:</span>
                  <div className="font-semibold mt-1" style={{ color: 'var(--color-foreground)' }}>
                    {comparison.recommendation.bestForMoney}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Most Balanced:</span>
                  <div className="font-semibold mt-1" style={{ color: 'var(--color-foreground)' }}>
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
