import { Schema, model } from 'mongoose';

export interface IWorkspaceSettings {
  key: 'default';
  name: string;
  timezone: string;
  currency: string;
  weekStart: string;
  description: string;
  issueOffset: string;
  shortMonth: string;
  autoGeneration: string;
  delayAlerts: string;
  recipient: string;
  invoiceDigest: string;
  reportReminder: string;
}

export const defaultWorkspaceSettings: IWorkspaceSettings = {
  key: 'default',
  name: 'The Fine Dudes',
  timezone: 'America/New_York',
  currency: 'USD',
  weekStart: 'Monday',
  description: 'Customer success operations workspace',
  issueOffset: '5 days before due',
  shortMonth: 'Use final calendar day',
  autoGeneration: 'Enabled',
  delayAlerts: 'In-app only',
  recipient: 'In-app notifications',
  invoiceDigest: 'Every morning',
  reportReminder: '2 days before cutoff'
};

const schema = new Schema<IWorkspaceSettings>({
  key: { type: String, enum: ['default'], default: 'default', unique: true },
  name: { type: String, required: true },
  timezone: { type: String, required: true },
  currency: { type: String, required: true },
  weekStart: { type: String, required: true },
  description: { type: String, default: '' },
  issueOffset: { type: String, required: true },
  shortMonth: { type: String, required: true },
  autoGeneration: { type: String, required: true },
  delayAlerts: { type: String, required: true },
  recipient: { type: String, required: true },
  invoiceDigest: { type: String, required: true },
  reportReminder: { type: String, required: true }
}, { timestamps: true });

export const WorkspaceSettings = model<IWorkspaceSettings>('WorkspaceSettings', schema);
