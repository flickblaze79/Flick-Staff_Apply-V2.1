import { addAuditLog } from './storage';
import { UserRole } from '../types';

export async function logAuditEvent(params: {
  action: string;
  actorUid: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  targetResource: string;
  targetUid?: string;
  metadata?: Record<string, any>;
}) {
  try {
    addAuditLog({
      action: params.action,
      actorUid: params.actorUid,
      actorName: params.actorName || 'Unknown',
      actorEmail: params.actorEmail || 'Unknown',
      actorRole: params.actorRole || 'USER',
      targetResource: params.targetResource,
      targetUid: params.targetUid || '',
      timestamp: new Date().toISOString(),
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.warn('Audit logging failed:', err);
  }
}
