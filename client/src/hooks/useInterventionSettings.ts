/**
 * Concordia Shrine - Intervention Settings Hook
 * 
 * 介入機能の設定を管理するカスタムフック
 */

import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';

export interface InterventionSettings {
  enabled: boolean;
  monologueThreshold: number; // 一方的状態の閾値（秒）
  silenceThreshold: number;   // 沈黙状態の閾値（秒）
  soundEnabled: boolean;
  visualHintEnabled: boolean;
}

const DEFAULT_SETTINGS: InterventionSettings = {
  enabled: true,
  monologueThreshold: 30,
  silenceThreshold: 8,
  soundEnabled: true,
  visualHintEnabled: true,
};

export function useInterventionSettings() {
  const { isAuthenticated } = useAuth();
  
  const settingsQuery = useQuery({
    queryKey: ["intervention", "settings", isAuthenticated],
    queryFn: () => api.intervention.getSettings(),
    enabled: isAuthenticated,
  });
  
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<InterventionSettings>) =>
      api.intervention.updateSettings(payload),
    onSuccess: () => {
      settingsQuery.refetch();
    },
  });

  const settings: InterventionSettings = isAuthenticated && settingsQuery.data
    ? (settingsQuery.data as unknown as InterventionSettings)
    : DEFAULT_SETTINGS;

  const updateSettings = useCallback(async (newSettings: Partial<InterventionSettings>) => {
    if (!isAuthenticated) {
      // ローカルモードでは設定を保存しない
      console.warn('Settings cannot be saved in local mode');
      return;
    }

    try {
      await updateMutation.mutateAsync(newSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }, [isAuthenticated, updateMutation]);

  return {
    settings,
    isLoading: settingsQuery.isLoading,
    updateSettings,
    isUpdating: updateMutation.isPending,
  };
}
