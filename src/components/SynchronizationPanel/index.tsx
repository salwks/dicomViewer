/**
 * Synchronization Panel Component
 * Interactive panel for controlling viewport synchronization settings
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import { viewportSynchronizer } from '../../services/ViewportSynchronizer';
import {
  SynchronizationSettings,
  CrossReferenceSettings,
  SyncType,
} from '../../types/dicom';
import { log } from '../../utils/logger';

interface SynchronizationPanelProps {
  className?: string;
  showAdvancedSettings?: boolean;
  onSettingsChange?: (settings: SynchronizationSettings) => void;
  onCrossReferenceChange?: (settings: CrossReferenceSettings) => void;
}

interface SyncGroupInfo {
  id: string;
  name: string;
  viewportIds: string[];
  isActive: boolean;
}

const SYNC_TYPE_LABELS: Record<SyncType, string> = {
  windowLevel: 'Window/Level',
  zoom: 'Zoom',
  pan: 'Pan',
  scroll: 'Scroll',
  crosshairs: 'Crosshairs',
  orientation: 'Orientation',
};

const CROSSREFERENCE_COLORS = [
  { value: '#00ff00', label: 'Green' },
  { value: '#ff0000', label: 'Red' },
  { value: '#0000ff', label: 'Blue' },
  { value: '#ffff00', label: 'Yellow' },
  { value: '#ff00ff', label: 'Magenta' },
  { value: '#00ffff', label: 'Cyan' },
  { value: '#ffffff', label: 'White' },
];

export const SynchronizationPanel: React.FC<SynchronizationPanelProps> = ({
  className = '',
  showAdvancedSettings = false,
  onSettingsChange,
  onCrossReferenceChange,
}) => {
  const [settings, setSettings] = useState<SynchronizationSettings>(
    viewportSynchronizer.getSyncSettings(),
  );
  const [crossRefSettings, setCrossRefSettings] = useState<CrossReferenceSettings>(
    viewportSynchronizer.getCrossReferenceSettings(),
  );
  const [syncGroups, setSyncGroups] = useState<SyncGroupInfo[]>([]);
  const [activeViewports, setActiveViewports] = useState<string[]>([]);

  // Update sync groups and active viewports
  useEffect(() => {
    const updateSyncInfo = () => {
      const groups = viewportSynchronizer.getSyncGroups();
      const viewportStates = viewportSynchronizer.getAllViewportStates();

      const groupInfo: SyncGroupInfo[] = [];
      for (const [groupId, viewportIds] of groups) {
        groupInfo.push({
          id: groupId,
          name: groupId === 'global' ? 'Global Sync' : `Group ${groupId}`,
          viewportIds: Array.from(viewportIds),
          isActive: viewportIds.size > 1, // Active if has multiple viewports
        });
      }

      setSyncGroups(groupInfo);
      setActiveViewports(Array.from(viewportStates.keys()));
    };

    const handleSettingsUpdate = () => {
      setSettings(viewportSynchronizer.getSyncSettings());
    };

    const handleCrossRefUpdate = () => {
      setCrossRefSettings(viewportSynchronizer.getCrossReferenceSettings());
    };

    const handleSyncGroupCreated = () => updateSyncInfo();
    const handleViewportAdded = () => updateSyncInfo();
    const handleViewportRemoved = () => updateSyncInfo();

    // Subscribe to events
    viewportSynchronizer.on('syncSettingsUpdated', handleSettingsUpdate);
    viewportSynchronizer.on('crossReferenceSettingsUpdated', handleCrossRefUpdate);
    viewportSynchronizer.on('syncGroupCreated', handleSyncGroupCreated);
    viewportSynchronizer.on('viewportAdded', handleViewportAdded);
    viewportSynchronizer.on('viewportRemoved', handleViewportRemoved);

    // Initial update
    updateSyncInfo();

    return () => {
      viewportSynchronizer.off('syncSettingsUpdated', handleSettingsUpdate);
      viewportSynchronizer.off('crossReferenceSettingsUpdated', handleCrossRefUpdate);
      viewportSynchronizer.off('syncGroupCreated', handleSyncGroupCreated);
      viewportSynchronizer.off('viewportAdded', handleViewportAdded);
      viewportSynchronizer.off('viewportRemoved', handleViewportRemoved);
    };
  }, []);

  // Handle sync setting changes
  const handleSyncToggle = useCallback((syncType: keyof SynchronizationSettings, enabled: boolean) => {
    const newSettings = { ...settings, [syncType]: enabled };
    setSettings(newSettings);
    viewportSynchronizer.updateSyncSettings(newSettings);

    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }

    log.info('Sync setting changed', {
      component: 'SynchronizationPanel',
      metadata: { syncType, enabled },
    });
  }, [settings, onSettingsChange]);

  // Handle cross-reference setting changes
  const handleCrossRefChange = useCallback((key: keyof CrossReferenceSettings, value: unknown) => {
    const newSettings = { ...crossRefSettings, [key]: value };
    setCrossRefSettings(newSettings);
    viewportSynchronizer.updateCrossReferenceSettings(newSettings);

    if (onCrossReferenceChange) {
      onCrossReferenceChange(newSettings);
    }

    log.info('Cross-reference setting changed', {
      component: 'SynchronizationPanel',
      metadata: { key, value },
    });
  }, [crossRefSettings, onCrossReferenceChange]);

  // Quick sync presets
  const handlePreset = useCallback((presetName: string) => {
    let newSettings: Partial<SynchronizationSettings>;

    switch (presetName) {
      case 'all':
        newSettings = {
          windowLevel: true,
          zoom: true,
          pan: true,
          scroll: true,
          crosshairs: true,
          orientation: false,
          globalSync: true,
        };
        break;
      case 'basic':
        newSettings = {
          windowLevel: true,
          zoom: false,
          pan: false,
          scroll: true,
          crosshairs: false,
          orientation: false,
          globalSync: true,
        };
        break;
      case 'none':
        newSettings = {
          windowLevel: false,
          zoom: false,
          pan: false,
          scroll: false,
          crosshairs: false,
          orientation: false,
          globalSync: false,
        };
        break;
      default:
        return;
    }

    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    viewportSynchronizer.updateSyncSettings(updatedSettings);

    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }

    log.info('Sync preset applied', {
      component: 'SynchronizationPanel',
      metadata: { presetName, settings: newSettings },
    });
  }, [settings, onSettingsChange]);

  // Get sync status summary
  const getSyncSummary = (): { active: number; total: number } => {
    const syncTypes: (keyof SynchronizationSettings)[] = [
      'windowLevel', 'zoom', 'pan', 'scroll', 'crosshairs', 'orientation',
    ];

    const active = syncTypes.filter(type => settings[type]).length;
    return { active, total: syncTypes.length };
  };

  const syncSummary = getSyncSummary();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Viewport Synchronization</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={syncSummary.active > 0 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {syncSummary.active}/{syncSummary.total} Active
                </Badge>
                {activeViewports.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {activeViewports.length} Viewports
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreset('basic')}
                className="text-xs"
              >
                Basic
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreset('all')}
                className="text-xs"
              >
                All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePreset('none')}
                className="text-xs"
              >
                None
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Main Sync Controls */}
          <div className="space-y-3">
            {/* Global Sync Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Global Synchronization</label>
                <p className="text-xs text-muted-foreground">
                  Sync all viewports together
                </p>
              </div>
              <Switch
                checked={settings.globalSync}
                onCheckedChange={(checked) => handleSyncToggle('globalSync', checked)}
              />
            </div>

            <Separator />

            {/* Individual Sync Types */}
            <div className="grid grid-cols-1 gap-3">
              {(Object.entries(SYNC_TYPE_LABELS) as Array<[SyncType, string]>).map(([syncType, label]) => (
                <div key={syncType} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">{label}</label>
                    <p className="text-xs text-muted-foreground">
                      {syncType === 'windowLevel' && 'Synchronize brightness and contrast'}
                      {syncType === 'zoom' && 'Synchronize zoom level'}
                      {syncType === 'pan' && 'Synchronize pan position'}
                      {syncType === 'scroll' && 'Synchronize slice/frame navigation'}
                      {syncType === 'crosshairs' && 'Show cross-reference lines'}
                      {syncType === 'orientation' && 'Synchronize view orientation'}
                    </p>
                  </div>
                  <Switch
                    checked={settings[syncType]}
                    onCheckedChange={(checked) => handleSyncToggle(syncType, checked)}
                    disabled={!settings.globalSync && syncType !== 'crosshairs'}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cross-Reference Settings */}
      {settings.crosshairs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cross-Reference Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Enable Lines</label>
                <Switch
                  checked={crossRefSettings.enabled}
                  onCheckedChange={(checked) => handleCrossRefChange('enabled', checked)}
                />
              </div>

              {crossRefSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Line Color</label>
                    <Select
                      value={crossRefSettings.color}
                      onValueChange={(value) => handleCrossRefChange('color', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CROSSREFERENCE_COLORS.map(color => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded border"
                                style={{ backgroundColor: color.value }}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Thickness</label>
                      <Select
                        value={crossRefSettings.thickness.toString()}
                        onValueChange={(value) => handleCrossRefChange('thickness', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1px</SelectItem>
                          <SelectItem value="2">2px</SelectItem>
                          <SelectItem value="3">3px</SelectItem>
                          <SelectItem value="4">4px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Opacity</label>
                      <Select
                        value={(crossRefSettings.opacity * 100).toString()}
                        onValueChange={(value) => handleCrossRefChange('opacity', parseInt(value) / 100)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25%</SelectItem>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="75">75%</SelectItem>
                          <SelectItem value="100">100%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Groups Info */}
      {showAdvancedSettings && syncGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncGroups.map(group => (
                <div key={group.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium text-sm">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.viewportIds.length} viewports: {group.viewportIds.join(', ')}
                    </div>
                  </div>
                  <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
                    {group.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-center text-sm text-muted-foreground">
            {syncSummary.active === 0 && 'No synchronization active'}
            {syncSummary.active > 0 && syncSummary.active < syncSummary.total &&
              `Partial synchronization: ${syncSummary.active} of ${syncSummary.total} types enabled`}
            {syncSummary.active === syncSummary.total && 'Full synchronization active'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
