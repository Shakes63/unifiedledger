'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScenarioBuilder, type Scenario } from './scenario-builder';
import { ScenarioComparisonCard } from './scenario-comparison-card';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { ScenarioComparisonResult } from '@/lib/debts/payoff-calculator';

interface WhatIfCalculatorProps {
  currentExtraPayment: number;
  currentMethod: 'snowball' | 'avalanche';
}

export function WhatIfCalculator({
  currentExtraPayment,
  currentMethod,
}: WhatIfCalculatorProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: '1',
      name: 'Current Plan',
      extraMonthlyPayment: currentExtraPayment,
      lumpSumPayments: [],
      method: currentMethod,
    },
  ]);
  const [comparison, setComparison] = useState<ScenarioComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-calculate when scenarios change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateScenarios();
    }, 500);

    return () => clearTimeout(timer);
  }, [scenarios]);

  const calculateScenarios = async () => {
    if (scenarios.length === 0) return;

    try {
      setLoading(true);
      const response = await fetch('/api/debts/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios }),
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
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-400" />
            What-If Scenario Calculator
          </h2>
          <p className="text-[#808080] mt-1">
            Compare different payment strategies to find the best debt payoff plan
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetScenarios}
            className="border-[#2a2a2a] text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Scenarios</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-50')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            +$50/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-100')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            +$100/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('extra-200')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            +$200/month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('tax-refund')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            Tax Refund
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('bonus')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            Bonus
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addQuickScenario('double')}
            className="border-[#2a2a2a] text-gray-300 hover:text-white hover:bg-[#242424]"
          >
            Double Pay
          </Button>
        </div>
      </div>

      {/* Scenario Builders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Your Scenarios</h3>
          <Button
            onClick={() => addScenario()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={scenarios.length >= 4}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Scenario
          </Button>
        </div>

        {scenarios.length >= 4 && (
          <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2 mb-4">
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
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#808080] mt-4">Calculating scenarios...</p>
        </div>
      ) : comparison && comparison.scenarios.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Comparison Results</h3>
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
            <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/30 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[#808080]">Fastest Payoff:</span>
                  <div className="text-white font-semibold mt-1">
                    {comparison.recommendation.bestForTime}
                  </div>
                </div>
                <div>
                  <span className="text-[#808080]">Saves Most Money:</span>
                  <div className="text-white font-semibold mt-1">
                    {comparison.recommendation.bestForMoney}
                  </div>
                </div>
                <div>
                  <span className="text-[#808080]">Most Balanced:</span>
                  <div className="text-white font-semibold mt-1">
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
