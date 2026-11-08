import { CustomPanel, PanelFeature, UserRole } from '../types';
import {
  getCustomPanels as storageGetCustomPanels,
  fetchCustomPanelsFromFirestore as storageFetchCustomPanels,
  subscribeToCustomPanels as storageSubscribeToCustomPanels,
  addCustomPanel as storageAddCustomPanel,
  updateCustomPanel as storageUpdateCustomPanel,
  deleteCustomPanel as storageDeleteCustomPanel,
  fetchSystemPanelsConfig,
  saveSystemPanelsConfig,
  SystemPanelConfig,
  DEFAULT_SYSTEM_PANELS,
} from './storage';

/**
 * Centralized Panel Management Service
 * Standardizes panel creation, editing, deletion, role assignment, feature configuration, and real-time synchronization.
 * Separates System Panels (Admin, Mod, Staff) configuration from Custom Panels.
 */

export async function getPanels(): Promise<CustomPanel[]> {
  return await storageFetchCustomPanels();
}

export function getPanelsLocal(): CustomPanel[] {
  return storageGetCustomPanels();
}

export async function createPanel(
  panelData: Omit<CustomPanel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CustomPanel> {
  return await storageAddCustomPanel(panelData);
}

export async function updatePanel(
  id: string,
  updates: Partial<CustomPanel>
): Promise<CustomPanel | null> {
  return await storageUpdateCustomPanel(id, updates);
}

export async function deletePanel(id: string): Promise<void> {
  await storageDeleteCustomPanel(id);
}

export function subscribeToPanels(
  onUpdate: (panels: CustomPanel[]) => void
): () => void {
  return storageSubscribeToCustomPanels(onUpdate);
}

export async function assignPanelRole(
  id: string,
  role: UserRole
): Promise<CustomPanel | null> {
  return await updatePanel(id, { assignedRole: role });
}

export async function updatePanelFeatures(
  id: string,
  features: PanelFeature[]
): Promise<CustomPanel | null> {
  return await updatePanel(id, { features });
}

// --- System Panels Management ---

export async function getSystemPanels(): Promise<Record<string, SystemPanelConfig>> {
  return await fetchSystemPanelsConfig();
}

export async function updateSystemPanel(
  panelKey: string,
  updates: Partial<SystemPanelConfig>
): Promise<Record<string, SystemPanelConfig>> {
  const current = await fetchSystemPanelsConfig();
  const target = current[panelKey] || DEFAULT_SYSTEM_PANELS[panelKey];
  if (!target) {
    throw new Error(`System panel config not found for key: ${panelKey}`);
  }
  const updated = {
    ...current,
    [panelKey]: {
      ...target,
      ...updates,
    },
  };
  await saveSystemPanelsConfig(updated);
  return updated;
}

export async function resetSystemPanelToDefault(
  panelKey: string
): Promise<Record<string, SystemPanelConfig>> {
  const defaultPanel = DEFAULT_SYSTEM_PANELS[panelKey];
  if (!defaultPanel) {
    throw new Error(`Default config not found for system panel key: ${panelKey}`);
  }
  return await updateSystemPanel(panelKey, defaultPanel);
}
