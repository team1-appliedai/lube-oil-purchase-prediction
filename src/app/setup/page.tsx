'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Database,
  Table,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

type Step = 'connection' | 'collections' | 'validate' | 'complete';

interface StepState {
  connection: {
    tested: boolean;
    ok: boolean;
    collections: string[];
  };
  collections: {
    confirmed: boolean;
  };
  validate: {
    validated: boolean;
    vesselCount: number;
    consumptionCount: number;
    priceCount: number;
    scheduleCount: number;
  };
}

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'connection', label: 'Test Connection', icon: Database },
  { key: 'collections', label: 'Verify Collections', icon: Table },
  { key: 'validate', label: 'Validate Data', icon: Settings },
  { key: 'complete', label: 'Complete', icon: CheckCircle },
];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState<Step>('connection');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<StepState>({
    connection: { tested: false, ok: false, collections: [] },
    collections: { confirmed: false },
    validate: {
      validated: false,
      vesselCount: 0,
      consumptionCount: 0,
      priceCount: 0,
      scheduleCount: 0,
    },
  });

  const currentStepIdx = steps.findIndex((s) => s.key === currentStep);

  const testConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/test-connection');
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        connection: {
          tested: true,
          ok: data.ok,
          collections: data.collections || [],
        },
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        connection: { tested: true, ok: false, collections: [] },
      }));
    } finally {
      setLoading(false);
    }
  };

  const validateData = async () => {
    setLoading(true);
    try {
      const [vessels, consumption, pricing] = await Promise.all([
        fetch('/api/vessels').then((r) => r.json()),
        fetch('/api/consumption/0').then((r) => r.json()).catch(() => []),
        fetch('/api/pricing').then((r) => r.json()),
      ]);

      setState((prev) => ({
        ...prev,
        validate: {
          validated: true,
          vesselCount: Array.isArray(vessels) ? vessels.length : 0,
          consumptionCount: Array.isArray(consumption) ? consumption.length : 0,
          priceCount: Array.isArray(pricing) ? pricing.length : 0,
          scheduleCount: 0,
        },
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        validate: { ...prev.validate, validated: true },
      }));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupComplete: true, setupDate: new Date().toISOString() }),
      });
      setCurrentStep('complete');
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Setup Wizard</h2>
        <p className="text-sm text-muted-foreground">
          Configure your connection and verify data access
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                idx === currentStepIdx
                  ? 'bg-primary text-primary-foreground'
                  : idx < currentStepIdx
                  ? 'bg-maritime-green/20 text-maritime-green'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <step.icon className="h-3 w-3" />
              {step.label}
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 mx-1 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {currentStep === 'connection' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Test Database Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test the connection to your MongoDB database using the URI from .env.local
            </p>
            <Button onClick={testConnection} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>

            {state.connection.tested && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {state.connection.ok ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-maritime-green" />
                      <span className="text-maritime-green font-medium">Connected successfully</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-maritime-red" />
                      <span className="text-maritime-red font-medium">Connection failed</span>
                    </>
                  )}
                </div>
                {state.connection.ok && state.connection.collections.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Found {state.connection.collections.length} collections:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {state.connection.collections.map((c) => (
                        <Badge key={c} variant="secondary" className="text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    collections: { confirmed: true },
                  }));
                  setCurrentStep('collections');
                }}
                disabled={!state.connection.ok}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'collections' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Verify Collections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirm that the required collections exist in your database
            </p>
            <div className="space-y-2">
              {[
                { name: 'common_vessel_details', purpose: 'Vessel master data' },
                { name: 'common_consumption_log_data_demo1', purpose: 'Noon reports' },
                { name: 'onesea-vessel-schedule-scraped', purpose: 'Voyage schedules' },
                { name: 'lube_oil_prices', purpose: 'Lube oil prices' },
                { name: 'vessel_lubeSupplier', purpose: 'Vessel-supplier mapping' },
              ].map((col) => {
                const exists = state.connection.collections.includes(col.name);
                return (
                  <div
                    key={col.name}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-mono">{col.name}</p>
                      <p className="text-xs text-muted-foreground">{col.purpose}</p>
                    </div>
                    {exists ? (
                      <CheckCircle className="h-4 w-4 text-maritime-green" />
                    ) : (
                      <XCircle className="h-4 w-4 text-maritime-red" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('connection')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setCurrentStep('validate')}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'validate' && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Validate Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check that data can be read from each collection
            </p>
            <Button onClick={validateData} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Validate Data
            </Button>

            {state.validate.validated && (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                  <span className="text-sm">Vessels</span>
                  <Badge variant={state.validate.vesselCount > 0 ? 'default' : 'destructive'}>
                    {state.validate.vesselCount} records
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                  <span className="text-sm">Pricing</span>
                  <Badge variant={state.validate.priceCount > 0 ? 'default' : 'destructive'}>
                    {state.validate.priceCount} records
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('collections')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={saveConfig} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Complete Setup
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'complete' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-maritime-green mb-4" />
            <h3 className="text-xl font-bold mb-2">Setup Complete</h3>
            <p className="text-muted-foreground text-center mb-6">
              Your database connection is configured and verified.
              You can now start using the optimizer.
            </p>
            <div className="flex gap-3">
              <a href="/">
                <Button>Go to Dashboard</Button>
              </a>
              <a href="/vessels">
                <Button variant="outline">View Vessels</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
