'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Link2,
  Unlink,
  AlertTriangle,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { betterAuthClient } from '@/lib/better-auth-client';

interface OAuthProvider {
  providerId: string;
  accountId: string;
  linkedAt: string;
  isPrimary: boolean;
}

interface AvailableProvider {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
}

export function OAuthProvidersSection() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [primaryLoginMethod, setPrimaryLoginMethod] = useState<string>('email');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchAvailableProviders();
  }, []);

  async function fetchProviders() {
    try {
      const response = await fetch('/api/user/oauth/providers', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        setPrimaryLoginMethod(data.primaryLoginMethod || 'email');
      }
    } catch (error) {
      console.error('Failed to fetch OAuth providers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableProviders() {
    try {
      const response = await fetch('/api/user/oauth/available', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to fetch available providers:', error);
    }
  }

  async function handleLinkProvider(providerId: string) {
    try {
      setLinking(providerId);

      // Validate provider first
      const validateResponse = await fetch(`/api/user/oauth/link/${providerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || 'Failed to validate provider');
      }

      // Use Better Auth client to initiate OAuth flow
      const callbackURL = `${window.location.origin}/dashboard/settings`;
      const result = await betterAuthClient.oauth2.link({
        providerId,
        callbackURL,
      });

      if (result.url) {
        // Redirect to OAuth provider
        window.location.href = result.url;
      } else {
        throw new Error('Failed to get OAuth authorization URL');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to link provider'
      );
      setLinking(null);
    }
  }

  async function handleUnlinkProvider(providerId: string) {
    try {
      setUnlinking(providerId);
      const response = await fetch(`/api/user/oauth/unlink/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unlink provider');
      }

      toast.success(`${providerId} account unlinked successfully`);
      setUnlinkDialogOpen(false);
      setUnlinkProvider(null);
      fetchProviders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to unlink provider'
      );
    } finally {
      setUnlinking(null);
    }
  }

  async function handleSetPrimary(providerId: string) {
    try {
      const response = await fetch('/api/user/oauth/set-primary', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set primary login method');
      }

      toast.success('Primary login method updated');
      setPrimaryLoginMethod(providerId);
      fetchProviders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to set primary method'
      );
    }
  }

  function getProviderIcon(providerId: string) {
    // Use Globe as default icon - can be replaced with actual provider icons
    return Globe;
  }

  function getProviderName(providerId: string) {
    const provider = availableProviders.find((p) => p.id === providerId);
    return provider?.name || providerId.charAt(0).toUpperCase() + providerId.slice(1);
  }

  function isProviderLinked(providerId: string) {
    return providers.some((p) => p.providerId === providerId);
  }

  const enabledProviders = availableProviders.filter((p) => p.enabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading OAuth providers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          OAuth Providers
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Link your accounts for easier sign-in. You can set a primary login method.
        </p>

        {enabledProviders.length === 0 ? (
          <Card className="p-6 bg-elevated border-border text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              No OAuth providers are configured. Contact your administrator.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {enabledProviders.map((availableProvider) => {
              const isLinked = isProviderLinked(availableProvider.id);
              const linkedProvider = providers.find(
                (p) => p.providerId === availableProvider.id
              );
              const IconComponent = getProviderIcon(availableProvider.id);

              return (
                <Card
                  key={availableProvider.id}
                  className="p-4 bg-elevated border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">
                            {availableProvider.name}
                          </span>
                          {isLinked && (
                            <Badge
                              variant="secondary"
                              className="bg-[var(--color-success)] text-white"
                            >
                              Linked
                            </Badge>
                          )}
                          {linkedProvider?.isPrimary && (
                            <Badge
                              variant="secondary"
                              className="bg-[var(--color-primary)] text-white"
                            >
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {availableProvider.description}
                        </p>
                        {isLinked && linkedProvider && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Linked on{' '}
                            {new Date(linkedProvider.linkedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLinked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUnlinkProvider(availableProvider.id);
                            setUnlinkDialogOpen(true);
                          }}
                          disabled={unlinking === availableProvider.id}
                          className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                        >
                          {unlinking === availableProvider.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Unlinking...
                            </>
                          ) : (
                            <>
                              <Unlink className="w-4 h-4 mr-1" />
                              Unlink
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLinkProvider(availableProvider.id)}
                          disabled={linking === availableProvider.id}
                          className="border-border"
                        >
                          {linking === availableProvider.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Linking...
                            </>
                          ) : (
                            <>
                              <Link2 className="w-4 h-4 mr-1" />
                              Link {availableProvider.name}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Primary Login Method Selector */}
        {providers.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium text-foreground">
              Primary Login Method
            </label>
            <Select
              value={primaryLoginMethod}
              onValueChange={handleSetPrimary}
            >
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="email" className="text-foreground hover:bg-elevated">
                  Email / Password
                </SelectItem>
                {providers.map((provider) => (
                  <SelectItem
                    key={provider.providerId}
                    value={provider.providerId}
                    className="text-foreground hover:bg-elevated"
                  >
                    {getProviderName(provider.providerId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Your primary login method will be used as the default when signing in.
            </p>
          </div>
        )}
      </div>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Unlink Provider</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to unlink {unlinkProvider ? getProviderName(unlinkProvider) : 'this provider'}? You'll need to link it again to use it for sign-in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnlinkDialogOpen(false);
                setUnlinkProvider(null);
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => unlinkProvider && handleUnlinkProvider(unlinkProvider)}
              disabled={!unlinkProvider || unlinking === unlinkProvider}
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
            >
              {unlinking === unlinkProvider ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-2" />
                  Unlink
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

