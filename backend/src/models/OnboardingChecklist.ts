import { Schema, model } from 'mongoose';
export interface IOnboardingChecklist { client: Schema.Types.ObjectId; calledSameDay: boolean; welcomeMsgSameDay: boolean; accessReceived: boolean; delaySide: 'Our'|'Client'|'N/A'; highAlertSent: boolean; alertDatetime?: Date|null; delayReason?: string; flaggedToAsad: boolean; onboardStatus: 'Not Started'|'In Progress'|'Completed'|'Delayed'; }
const schema = new Schema<IOnboardingChecklist>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, unique: true }, calledSameDay: { type: Boolean, default: false }, welcomeMsgSameDay: { type: Boolean, default: false }, accessReceived: { type: Boolean, default: false }, delaySide: { type: String, enum: ['Our','Client','N/A'], default: 'N/A' }, highAlertSent: { type: Boolean, default: false }, alertDatetime: { type: Date, default: null }, delayReason: String, flaggedToAsad: { type: Boolean, default: false }, onboardStatus: { type: String, enum: ['Not Started','In Progress','Completed','Delayed'], default: 'Not Started' } }, { timestamps: true });
schema.pre('validate', function () {
  if (this.delaySide !== 'N/A' && !this.delayReason?.trim()) this.invalidate('delayReason', 'delayReason is required for delays');
  if (this.delaySide !== 'N/A' && this.onboardStatus !== 'Completed') this.onboardStatus = 'Delayed';
  if (this.delaySide === 'N/A') this.delayReason = undefined;
});
export const OnboardingChecklist = model<IOnboardingChecklist>('OnboardingChecklist', schema);
