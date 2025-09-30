// Settings Service - Database operations for scanner settings
import { supabase } from './supabaseClient';
import { ScannerSettings, DEFAULT_SCANNER_SETTINGS } from './scannerSettings';

export class SettingsService {
  private static instance: SettingsService;
  private cachedSettings: Map<string, ScannerSettings> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Initialize settings table if it doesn't exist
   */
  async initializeSettingsTable(): Promise<void> {
    try {
      // Check if table exists by querying it
      const { error: testError } = await supabase
        .from('scanner_settings')
        .select('id')
        .limit(1);

      if (testError && testError.code === '42P01') {
        // Table doesn't exist - it should be created by migration
        console.warn('⚠️ Scanner settings table not found. Please run Supabase migrations.');
        console.log('Run: npx supabase db push or apply migration 20250925000000_create_scanner_settings.sql');
      } else if (testError) {
        console.error('Error checking scanner_settings table:', testError);
      } else {
        console.log('✅ Scanner settings table exists');
      }
    } catch (error) {
      console.error('❌ Failed to initialize settings table:', error);
      // Don't throw - we can still work with default settings
    }
  }

  /**
   * Get settings for an organization (with caching)
   */
  async getSettings(organizationId: string): Promise<ScannerSettings> {
    try {
      // Check cache first
      if (this.isCacheValid(organizationId)) {
        const cached = this.cachedSettings.get(organizationId);
        if (cached) {
          console.log('📋 Retrieved settings from cache');
          return cached;
        }
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('scanner_settings')
        .select('settings')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Failed to fetch settings:', error);
        return this.getDefaultSettings(organizationId);
      }

      if (!data || !data.settings) {
        // No settings found, create default settings
        console.log('📋 No settings found, creating defaults');
        return await this.createDefaultSettings(organizationId);
      }

      // Parse and validate settings
      const settings = { ...DEFAULT_SCANNER_SETTINGS, ...data.settings };
      settings.organizationId = organizationId;

      // Update cache
      this.updateCache(organizationId, settings);

      console.log('✅ Settings retrieved from database');
      return settings;

    } catch (error) {
      console.error('❌ Failed to get settings:', error);
      return this.getDefaultSettings(organizationId);
    }
  }

  /**
   * Save settings to database
   */
  async saveSettings(settings: ScannerSettings, updatedBy: string): Promise<boolean> {
    try {
      const settingsData = {
        organization_id: settings.organizationId,
        settings: settings,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('scanner_settings')
        .upsert(settingsData, {
          onConflict: 'organization_id'
        });

      if (error) {
        console.error('Failed to save settings:', error);
        return false;
      }

      // Update cache
      this.updateCache(settings.organizationId, settings);

      console.log('✅ Settings saved successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Reset settings to defaults
   * This deletes the database record so defaults are used instead of storing default values
   */
  async resetToDefaults(organizationId: string, updatedBy: string): Promise<ScannerSettings> {
    try {
      // Delete the custom settings from database to force use of defaults
      const { error } = await supabase
        .from('scanner_settings')
        .delete()
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Failed to delete settings:', error);
        // Fallback: save default settings if delete fails
        const defaultSettings = this.getDefaultSettings(organizationId);
        defaultSettings.updatedBy = updatedBy;
        defaultSettings.updatedAt = new Date().toISOString();
        await this.saveSettings(defaultSettings, updatedBy);
        return defaultSettings;
      }

      // Clear cache to ensure fresh defaults are loaded
      this.clearCache(organizationId);

      console.log('✅ Settings reset to defaults (database record deleted)');

      // Return fresh default settings
      return this.getDefaultSettings(organizationId);

    } catch (error) {
      console.error('❌ Failed to reset settings:', error);
      // Return defaults even if reset failed
      return this.getDefaultSettings(organizationId);
    }
  }

  /**
   * Validate settings against constraints
   */
  validateSettings(settings: ScannerSettings): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Face quality thresholds
    if (settings.faceQualityThreshold < 0.1 || settings.faceQualityThreshold > 1.0) {
      errors.push('Face quality threshold must be between 0.1 and 1.0');
    }

    if (settings.faceMatchThreshold < 0.5 || settings.faceMatchThreshold > 0.99) {
      errors.push('Face match threshold must be between 0.5 and 0.99');
    }

    if (settings.faceMatchThreshold <= settings.faceQualityThreshold) {
      errors.push('Face match threshold should be higher than quality threshold');
    }

    // Cooldown times
    if (settings.faceProcessingCooldown < 1000 || settings.faceProcessingCooldown > 30000) {
      errors.push('Processing cooldown must be between 1-30 seconds');
    }

    // Camera settings
    if (settings.cameraResolutionWidth < 320 || settings.cameraResolutionHeight < 240) {
      errors.push('Camera resolution too low (minimum 320x240)');
    }

    if (settings.cameraFrameRate < 15 || settings.cameraFrameRate > 120) {
      errors.push('Frame rate must be between 15-120 fps');
    }

    // Aspect ratio validation
    if (settings.aspectRatioMin >= settings.aspectRatioMax) {
      errors.push('Minimum aspect ratio must be less than maximum');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Export settings as JSON
   */
  exportSettings(settings: ScannerSettings): string {
    const exportData = {
      ...settings,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(jsonData: string, organizationId: string): { settings: ScannerSettings | null; errors: string[] } {
    try {
      const importedData = JSON.parse(jsonData);

      // Validate imported data structure
      const settings: ScannerSettings = {
        ...DEFAULT_SCANNER_SETTINGS,
        ...importedData,
        organizationId,
        updatedAt: new Date().toISOString()
      };

      const validation = this.validateSettings(settings);

      if (!validation.isValid) {
        return { settings: null, errors: validation.errors };
      }

      return { settings, errors: [] };

    } catch (error) {
      return { settings: null, errors: ['Invalid JSON format'] };
    }
  }

  // Private helper methods
  private async createDefaultSettings(organizationId: string): Promise<ScannerSettings> {
    const defaultSettings = this.getDefaultSettings(organizationId);

    // Try to save to database
    await this.saveSettings(defaultSettings, 'system');

    return defaultSettings;
  }

  private getDefaultSettings(organizationId: string): ScannerSettings {
    return {
      ...DEFAULT_SCANNER_SETTINGS,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private isCacheValid(organizationId: string): boolean {
    const expiry = this.cacheExpiry.get(organizationId);
    return expiry ? Date.now() < expiry : false;
  }

  private updateCache(organizationId: string, settings: ScannerSettings): void {
    this.cachedSettings.set(organizationId, settings);
    this.cacheExpiry.set(organizationId, Date.now() + this.CACHE_DURATION);
  }

  /**
   * Clear cache for organization
   */
  clearCache(organizationId?: string): void {
    if (organizationId) {
      this.cachedSettings.delete(organizationId);
      this.cacheExpiry.delete(organizationId);
    } else {
      this.cachedSettings.clear();
      this.cacheExpiry.clear();
    }
  }
}

// Export singleton instance
export const settingsService = SettingsService.getInstance();

// SQL function to create the scanner_settings table
export const CREATE_SCANNER_SETTINGS_TABLE_SQL = `
CREATE OR REPLACE FUNCTION create_scanner_settings_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS scanner_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'system',
    updated_by TEXT DEFAULT 'system',

    UNIQUE(organization_id)
  );

  -- Create index for faster lookups
  CREATE INDEX IF NOT EXISTS idx_scanner_settings_org_id
    ON scanner_settings(organization_id);

  -- Enable RLS
  ALTER TABLE scanner_settings ENABLE ROW LEVEL SECURITY;

  -- Create RLS policies
  DROP POLICY IF EXISTS "Users can view their organization settings" ON scanner_settings;
  CREATE POLICY "Users can view their organization settings"
    ON scanner_settings FOR SELECT
    USING (organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    ));

  DROP POLICY IF EXISTS "Users can update their organization settings" ON scanner_settings;
  CREATE POLICY "Users can update their organization settings"
    ON scanner_settings FOR ALL
    USING (organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    ));
END;
$$;
`;