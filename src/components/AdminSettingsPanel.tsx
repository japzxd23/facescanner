import React, { useState, useEffect } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonRange,
  IonToggle,
  IonInput,
  IonButton,
  IonIcon,
  IonToast,
  IonSpinner,
  IonAccordion,
  IonAccordionGroup,
  IonText,
  IonNote,
  IonGrid,
  IonRow,
  IonCol,
  IonButtons,
  IonBadge
} from '@ionic/react';
import {
  settingsOutline,
  saveOutline,
  refreshOutline,
  downloadOutline,
  cloudUploadOutline,
  checkmarkCircle,
  alertCircle
} from 'ionicons/icons';
import { ScannerSettings, SETTINGS_CATEGORIES, SETTINGS_META, SETTINGS_VALIDATION } from '../services/scannerSettings';
import { settingsService } from '../services/settingsService';
import { supabase } from '../services/supabaseClient';

interface AdminSettingsPanelProps {
  organizationId: string;
  currentUser: string;
  onSettingsChange?: (settings: ScannerSettings) => void;
}

export const AdminSettingsPanel: React.FC<AdminSettingsPanelProps> = ({
  organizationId,
  currentUser,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<ScannerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');
  const [showToast, setShowToast] = useState(false);
  const [usingDefaults, setUsingDefaults] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const loadedSettings = await settingsService.getSettings(organizationId);
      setSettings(loadedSettings);

      // Check if we're using defaults by trying to fetch from database directly
      const { data } = await supabase
        .from('scanner_settings')
        .select('id')
        .eq('organization_id', organizationId)
        .single();

      setUsingDefaults(!data); // If no data, we're using defaults
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToastMessage('Failed to load settings', 'danger');
      setUsingDefaults(true); // Assume defaults on error
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    const validation = settingsService.validateSettings(settings);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      showToastMessage('Please fix validation errors', 'danger');
      return;
    }

    try {
      setSaving(true);
      const success = await settingsService.saveSettings(settings, currentUser);

      if (success) {
        showToastMessage('Settings saved successfully', 'success');
        onSettingsChange?.(settings);
        setValidationErrors([]);
        setUsingDefaults(false); // Now using custom settings
      } else {
        showToastMessage('Failed to save settings', 'danger');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToastMessage('Failed to save settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    try {
      setSaving(true);
      const defaultSettings = await settingsService.resetToDefaults(organizationId, currentUser);
      setSettings(defaultSettings);
      showToastMessage('Settings reset to defaults (database record deleted)', 'success');
      onSettingsChange?.(defaultSettings);
      setValidationErrors([]);
      setUsingDefaults(true); // Now using defaults
    } catch (error) {
      console.error('Reset error:', error);
      showToastMessage('Failed to reset settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const exportSettings = () => {
    if (!settings) return;

    const exportData = settingsService.exportSettings(settings);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scanner-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToastMessage('Settings exported', 'success');
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const jsonData = e.target?.result as string;
      const result = settingsService.importSettings(jsonData, organizationId);

      if (result.settings) {
        setSettings(result.settings);
        showToastMessage('Settings imported successfully', 'success');
        setValidationErrors([]);
      } else {
        setValidationErrors(result.errors);
        showToastMessage('Import failed: ' + result.errors.join(', '), 'danger');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const showToastMessage = (message: string, color: 'success' | 'danger') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
  };

  const updateSetting = (key: keyof ScannerSettings, value: any) => {
    if (!settings) return;

    const updatedSettings = { ...settings, [key]: value, updatedAt: new Date().toISOString() };
    setSettings(updatedSettings);
  };

  const renderSettingControl = (key: keyof ScannerSettings) => {
    if (!settings) return null;

    const meta = SETTINGS_META[key as keyof typeof SETTINGS_META];
    const validation = SETTINGS_VALIDATION[key as keyof typeof SETTINGS_VALIDATION];
    const value = settings[key];

    if (typeof value === 'boolean') {
      return (
        <IonItem key={key} style={{ '--background': 'var(--ion-color-light)', '--color': 'var(--ion-text-color)' }}>
          <IonLabel>
            <h3 style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>{meta?.label || key}</h3>
            <IonNote style={{ color: 'var(--ion-color-medium)', fontSize: '14px' }}>{meta?.description}</IonNote>
          </IonLabel>
          <IonToggle
            checked={value}
            onIonChange={(e) => updateSetting(key, e.detail.checked)}
          />
        </IonItem>
      );
    }

    if (typeof value === 'number' && validation) {
      return (
        <IonItem key={key} style={{ '--background': 'var(--ion-color-light)', '--color': 'var(--ion-text-color)' }}>
          <IonLabel>
            <h3 style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>{meta?.label || key}</h3>
            <IonNote style={{ color: 'var(--ion-color-medium)', fontSize: '14px' }}>{meta?.description}</IonNote>
            <IonText style={{ color: 'var(--ion-color-dark)' }}>
              <small>
                <strong>{value} {meta?.unit || ''}</strong>
                {validation.min !== undefined && validation.max !== undefined &&
                  ` (Range: ${validation.min}-${validation.max})`}
              </small>
            </IonText>
          </IonLabel>
          <IonRange
            min={validation.min}
            max={validation.max}
            step={validation.step}
            value={value}
            onIonChange={(e) => updateSetting(key, e.detail.value as number)}
            pin={true}
            snaps={true}
            style={{
              '--bar-background': 'var(--ion-color-light-shade)',
              '--knob-background': 'var(--ion-color-primary)',
              '--knob-size': '20px',
              '--bar-height': '6px',
              '--pin-background': 'var(--ion-color-primary)',
              '--pin-color': 'white'
            }}
          />
        </IonItem>
      );
    }

    if (key === 'qualityScoreWeights' && typeof value === 'object') {
      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <IonLabel style={{ padding: '16px', display: 'block' }}>
            <h3 style={{ color: 'var(--ion-text-color)', fontWeight: '600', margin: '0 0 8px 0' }}>Quality Score Weights</h3>
            <IonNote style={{ color: 'var(--ion-color-medium)', fontSize: '14px' }}>Relative importance of different face quality factors</IonNote>
          </IonLabel>
          {Object.entries(value).map(([weightKey, weightValue]) => (
            <IonItem key={weightKey} style={{ '--background': 'var(--ion-color-light)', '--color': 'var(--ion-text-color)' }}>
              <IonLabel>
                <h4 style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>{weightKey.charAt(0).toUpperCase() + weightKey.slice(1)} Weight</h4>
                <IonText style={{ color: 'var(--ion-color-dark)' }}>
                  <small><strong>{weightValue as number}</strong> (Range: 0.0-1.0)</small>
                </IonText>
              </IonLabel>
              <IonRange
                min={0}
                max={1}
                step={0.05}
                value={weightValue as number}
                onIonChange={(e) => updateSetting(key, {
                  ...value,
                  [weightKey]: e.detail.value as number
                })}
                pin={true}
                snaps={true}
                style={{
                  '--bar-background': 'var(--ion-color-light-shade)',
                  '--knob-background': 'var(--ion-color-primary)',
                  '--knob-size': '20px',
                  '--bar-height': '6px',
                  '--pin-background': 'var(--ion-color-primary)',
                  '--pin-color': 'white'
                }}
              />
            </IonItem>
          ))}
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <IonCard>
        <IonCardContent className="text-center py-8">
          <IonSpinner name="crescent" />
          <IonText>
            <p>Loading settings...</p>
          </IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  if (!settings) {
    return (
      <IonCard>
        <IonCardContent className="text-center py-8">
          <IonIcon icon={alertCircle} className="text-4xl text-red-500 mb-4" />
          <IonText>
            <p>Failed to load settings</p>
          </IonText>
          <IonButton fill="clear" onClick={loadSettings}>
            <IonIcon icon={refreshOutline} slot="start" />
            Retry
          </IonButton>
        </IonCardContent>
      </IonCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <IonCard style={{ '--background': 'var(--ion-background-color)', '--color': 'var(--ion-text-color)' }}>
        <IonCardHeader style={{ '--background': 'var(--ion-background-color)', '--color': 'var(--ion-text-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={settingsOutline} style={{ fontSize: '24px', color: 'var(--ion-color-primary)' }} />
                <IonCardTitle style={{ color: 'var(--ion-text-color)', fontSize: '20px' }}>Scanner Settings</IonCardTitle>
              </div>
              {usingDefaults && (
                <IonBadge
                  color="success"
                  style={{
                    '--background': 'var(--ion-color-success)',
                    '--color': 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}
                >
                  Using Defaults
                </IonBadge>
              )}
              {!usingDefaults && (
                <IonBadge
                  color="primary"
                  style={{
                    '--background': 'var(--ion-color-primary)',
                    '--color': 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}
                >
                  Custom Settings
                </IonBadge>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <input
                type="file"
                id="import-settings"
                accept=".json"
                onChange={importSettings}
                style={{ display: 'none' }}
              />
              <IonButton
                fill="clear"
                size="small"
                onClick={() => document.getElementById('import-settings')?.click()}
                title="Import Settings"
                style={{ '--padding-start': '8px', '--padding-end': '8px' }}
              >
                <IonIcon icon={cloudUploadOutline} slot="icon-only" style={{ fontSize: '18px' }} />
              </IonButton>
              <IonButton
                fill="clear"
                size="small"
                onClick={exportSettings}
                title="Export Settings"
                style={{ '--padding-start': '8px', '--padding-end': '8px' }}
              >
                <IonIcon icon={downloadOutline} slot="icon-only" style={{ fontSize: '18px' }} />
              </IonButton>
              <IonButton
                fill="clear"
                size="small"
                onClick={resetToDefaults}
                disabled={saving}
                title="Reset to Defaults"
                style={{ '--padding-start': '8px', '--padding-end': '8px' }}
              >
                <IonIcon icon={refreshOutline} slot="icon-only" style={{ fontSize: '18px' }} />
              </IonButton>
              <IonButton
                onClick={saveSettings}
                disabled={saving}
                size="small"
                style={{
                  '--padding-start': '16px',
                  '--padding-end': '16px',
                  minHeight: '36px'
                }}
              >
                {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={saveOutline} slot="start" style={{ fontSize: '16px' }} />}
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{saving ? 'Saving...' : 'Save'}</span>
              </IonButton>
            </div>
          </div>
        </IonCardHeader>

        {validationErrors.length > 0 && (
          <IonCardContent style={{ '--background': 'var(--ion-background-color)' }}>
            <div style={{
              background: 'rgba(244, 67, 54, 0.1)',
              border: '1px solid rgba(244, 67, 54, 0.3)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                <IonIcon icon={alertCircle} style={{ color: 'var(--ion-color-danger)', fontSize: '20px' }} />
                <IonText>
                  <h3 style={{ color: 'var(--ion-color-danger)', fontWeight: '600', margin: 0 }}>Validation Errors</h3>
                </IonText>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--ion-color-danger)' }}>
                {validationErrors.map((error, index) => (
                  <li key={index} style={{ fontSize: '14px', marginBottom: '4px' }}>{error}</li>
                ))}
              </ul>
            </div>
          </IonCardContent>
        )}

        {usingDefaults && (
          <IonCardContent style={{ '--background': 'var(--ion-background-color)' }}>
            <div style={{
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                <IonIcon icon={checkmarkCircle} style={{ color: 'var(--ion-color-success)', fontSize: '20px' }} />
                <IonText>
                  <h3 style={{ color: 'var(--ion-color-success)', fontWeight: '600', margin: 0 }}>Using Default Settings</h3>
                </IonText>
              </div>
              <p style={{
                color: 'var(--ion-color-success)',
                fontSize: '14px',
                margin: 0,
                lineHeight: '1.5'
              }}>
                You are currently using the default scanner settings. Any changes you save will be stored in the database.
                Click "Reset to Defaults" to delete custom settings and return to defaults.
              </p>
            </div>
          </IonCardContent>
        )}
      </IonCard>

      {/* Settings Categories */}
      <IonAccordionGroup expand="inset" multiple style={{ '--background': 'white' }}>
        {Object.entries(SETTINGS_CATEGORIES).map(([category, settingKeys]) => (
          <IonAccordion key={category} value={category}>
            <IonItem slot="header" style={{ '--background': 'white', '--color': 'var(--ion-text-color)', border: '1px solid var(--ion-color-light-shade)' }}>
              <IonLabel>
                <h2 style={{ color: 'var(--ion-text-color)', fontWeight: '700' }}>{category}</h2>
                <IonNote style={{ color: 'var(--ion-color-medium)' }}>{settingKeys.length} settings</IonNote>
              </IonLabel>
            </IonItem>
            <div slot="content" style={{
              padding: '16px',
              background: 'white',
              border: '1px solid var(--ion-color-light-shade)',
              borderTop: 'none'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {settingKeys.map((key) => renderSettingControl(key as keyof ScannerSettings))}
              </div>
            </div>
          </IonAccordion>
        ))}
      </IonAccordionGroup>

      {/* Settings Info */}
      <IonCard style={{ '--background': 'var(--ion-background-color)', '--color': 'var(--ion-text-color)' }}>
        <IonCardContent style={{ '--background': 'var(--ion-background-color)', '--color': 'var(--ion-text-color)' }}>
          <IonGrid>
            <IonRow>
              <IonCol size="12" sizeSm="6">
                <IonText>
                  <h3 style={{ color: 'var(--ion-text-color)', fontWeight: '600', margin: '0 0 8px 0' }}>Last Updated</h3>
                  <p style={{ color: 'var(--ion-color-medium)', fontSize: '14px', margin: 0, wordBreak: 'break-word' }}>
                    {new Date(settings.updatedAt).toLocaleString()}
                  </p>
                </IonText>
              </IonCol>
              <IonCol size="12" sizeSm="6">
                <IonText>
                  <h3 style={{ color: 'var(--ion-text-color)', fontWeight: '600', margin: '0 0 8px 0' }}>Updated By</h3>
                  <p style={{ color: 'var(--ion-color-medium)', fontSize: '14px', margin: 0, wordBreak: 'break-word' }}>{settings.updatedBy}</p>
                </IonText>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        color={toastColor}
        icon={toastColor === 'success' ? checkmarkCircle : alertCircle}
      />
    </div>
  );
};