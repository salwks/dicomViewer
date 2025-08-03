/**
 * Sync Settings Manager Component
 * Provides UI for managing synchronization settings persistence and profiles
 * Built with shadcn/ui components following the design system
 */

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { cn } from '../../lib/utils';
import { useSyncSettingsPersistence } from '../../hooks/useSyncSettingsPersistence';
import { SynchronizationSettings } from '../SynchronizationControls';

export interface SyncSettingsManagerProps {
  settings: SynchronizationSettings;
  onSettingsChange: (settings: SynchronizationSettings) => void;
  className?: string;
}

export const SyncSettingsManager: React.FC<SyncSettingsManagerProps> = ({
  settings,
  onSettingsChange,
  className = '',
}) => {
  const {
    profiles,
    createProfile,
    deleteSettings,
    loadSettings,
    saveSettings,
    setDefaultProfile,
    exportSettings,
    importSettings,
    resetToDefaults,
    isAutoSaving,
    lastSaved,
  } = useSyncSettingsPersistence(settings, {
    autoSave: true,
    enableProfiles: true,
    autoSaveDelay: 2000,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [importData, setImportData] = useState('');
  const [exportedData, setExportedData] = useState('');

  // Handle creating new profile
  const handleCreateProfile = async (): Promise<void> => {
    if (!newProfileName.trim()) return;

    try {
      await createProfile(newProfileName.trim(), settings);
      setNewProfileName('');
      console.info('Profile created successfully');
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  // Handle loading profile
  const handleLoadProfile = async (profileId: string): Promise<void> => {
    try {
      const success = await loadSettings(profileId);
      if (success) {
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
          onSettingsChange(profile.settings);
          console.info(`Profile "${profile.name}" loaded successfully`);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  // Handle deleting profile
  const handleDeleteProfile = async (profileId: string): Promise<void> => {
    try {
      const success = await deleteSettings(profileId);
      if (success) {
        console.info('Profile deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
    }
  };

  // Handle setting default profile
  const handleSetDefault = async (profileId: string): Promise<void> => {
    try {
      const success = await setDefaultProfile(profileId);
      if (success) {
        console.info('Default profile set successfully');
      }
    } catch (error) {
      console.error('Failed to set default profile:', error);
    }
  };

  // Handle manual save
  const handleManualSave = async (): Promise<void> => {
    try {
      await saveSettings();
      console.info('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Handle export
  const handleExport = async (): Promise<void> => {
    try {
      const data = await exportSettings();
      setExportedData(data);

      // Copy to clipboard
      await navigator.clipboard.writeText(data);
      console.info('Settings exported and copied to clipboard');
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  };

  // Handle import
  const handleImport = async (): Promise<void> => {
    if (!importData.trim()) return;

    try {
      const success = await importSettings(importData.trim());
      if (success) {
        setImportData('');
        console.info('Settings imported successfully');
        // Reload current settings if needed
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
    }
  };

  // Handle reset to defaults
  const handleReset = (): void => {
    resetToDefaults();
    onSettingsChange({
      enableZoom: false,
      enablePan: false,
      enableScroll: false,
      enableWindowLevel: false,
      enableReferenceLines: false,
      enableSliceSync: false,
      enableAnatomicalMapping: false,
    });
    console.info('Settings reset to defaults');
  };

  // Get active settings count
  const getActiveCount = (): number => {
    return Object.values(settings).filter(Boolean).length;
  };

  // Format last saved time
  const formatLastSaved = (): string => {
    if (!lastSaved) return 'Never';
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((lastSaved.getTime() - Date.now()) / 60000),
      'minute',
    );
  };

  const defaultProfile = profiles.find(p => p.isDefault);

  return (
    <TooltipProvider>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
            </svg>
            Manage Settings
            {isAutoSaving && (
              <Badge variant="secondary" className="text-xs">
                Saving...
              </Badge>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Synchronization Settings Manager
              <Badge variant="outline" className="text-xs">
                {getActiveCount()}/7 Active
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profiles" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
              <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
              <TabsTrigger value="import-export">Import/Export</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="profiles" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Saved Profiles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Create new profile */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Profile name..."
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleCreateProfile}
                      disabled={!newProfileName.trim()}
                      size="sm"
                    >
                      Create
                    </Button>
                  </div>

                  <Separator />

                  {/* Profile list */}
                  <div className="space-y-2">
                    {profiles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                        </svg>
                        <p className="text-sm">No saved profiles</p>
                        <p className="text-xs text-muted-foreground">Create a profile to save your current settings</p>
                      </div>
                    ) : (
                      profiles.map((profile) => (
                        <Card key={profile.id} className={cn(
                          'transition-colors',
                          profile.isDefault && 'ring-2 ring-primary ring-offset-2',
                        )}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">{profile.name}</h4>
                                  {profile.isDefault && (
                                    <Badge variant="default" className="text-xs">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>
                                    {Object.values(profile.settings).filter(Boolean).length}/7 active
                                  </span>
                                  <span>
                                    Created {new Date(profile.createdAt).toLocaleDateString()}
                                  </span>
                                  <span>
                                    Used {new Date(profile.lastUsed).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleLoadProfile(profile.id)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                      </svg>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Load profile</TooltipContent>
                                </Tooltip>

                                {!profile.isDefault && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSetDefault(profile.id)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Set as default</TooltipContent>
                                  </Tooltip>
                                )}

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    >
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18m-2 0V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2m3 0V4m4 0v2M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
                                      </svg>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{profile.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteProfile(profile.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quick-actions" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Save & Load</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={handleManualSave}
                      disabled={isAutoSaving}
                      className="w-full"
                      variant="default"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17,21 17,13 7,13 7,21" />
                        <polyline points="7,3 7,8 15,8" />
                      </svg>
                      Save Current Settings
                    </Button>

                    {defaultProfile && (
                      <Button
                        onClick={() => handleLoadProfile(defaultProfile.id)}
                        className="w-full"
                        variant="outline"
                      >
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976-2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        Load Default ({defaultProfile.name})
                      </Button>
                    )}

                    <div className="text-xs text-muted-foreground">
                      <p>Auto-save: {isAutoSaving ? 'Saving...' : 'Enabled'}</p>
                      <p>Last saved: {formatLastSaved()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Load</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-select" className="text-xs">
                        Load Profile:
                      </Label>
                      <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                        <SelectTrigger id="profile-select" className="h-8">
                          <SelectValue placeholder="Select profile..." />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <div className="flex items-center gap-2">
                                <span>{profile.name}</span>
                                {profile.isDefault && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => selectedProfileId && handleLoadProfile(selectedProfileId)}
                      disabled={!selectedProfileId}
                      className="w-full"
                      size="sm"
                    >
                      Load Selected
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                        >
                          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18m-2 0V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2m3 0V4m4 0v2M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6m-6 0V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2" />
                          </svg>
                          Reset to Defaults
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Settings</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will reset all synchronization settings to their default values. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleReset}>
                            Reset to Defaults
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="import-export" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Export Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={handleExport} className="w-full">
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5-5 5 5m-5-5v12" />
                      </svg>
                      Export to Clipboard
                    </Button>

                    {exportedData && (
                      <Textarea
                        readOnly
                        value={exportedData}
                        rows={8}
                        className="text-xs font-mono"
                        placeholder="Exported data will appear here..."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Import Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      rows={8}
                      className="text-xs font-mono"
                      placeholder="Paste exported settings data here..."
                    />

                    <Button
                      onClick={handleImport}
                      disabled={!importData.trim()}
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m7-10 5 5-5 5M8 4v12" />
                      </svg>
                      Import Settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Storage Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Total Profiles</Label>
                      <p className="font-medium">{profiles.length}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Auto-save Status</Label>
                      <p className="font-medium">{isAutoSaving ? 'Active' : 'Idle'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Current Settings</Label>
                      <p className="font-medium">{getActiveCount()}/7 features active</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Last Activity</Label>
                      <p className="font-medium">{formatLastSaved()}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Active Features</Label>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(settings).map(([key, value]) => (
                        <Badge
                          key={key}
                          variant={value ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {key.replace('enable', '').replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
