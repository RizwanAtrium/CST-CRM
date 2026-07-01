import { Schema, model } from 'mongoose';
export interface IAccessItem { label: string; required: boolean; received: boolean; notes?: string; }
export interface IOnboardingChecklist { client: Schema.Types.ObjectId; calledSameDay: boolean; welcomeMsgSameDay: boolean; accessReceived: boolean; accessItems: IAccessItem[]; productionGoAheadAt?: Date|null; delaySide: 'Our'|'Client'|'N/A'; highAlertSent: boolean; alertDatetime?: Date|null; delayReason?: string; flaggedToAsad: boolean; onboardStatus: 'Not Started'|'In Progress'|'Ready for review'|'Graduating this week'|'Completed'|'Delayed'; }
const accessItemSchema = new Schema<IAccessItem>({
  label: { type: String, required: true, trim: true },
  required: { type: Boolean, default: true },
  received: { type: Boolean, default: false },
  notes: { type: String, trim: true }
}, { _id: false });
const schema = new Schema<IOnboardingChecklist>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, unique: true }, calledSameDay: { type: Boolean, default: false }, welcomeMsgSameDay: { type: Boolean, default: false }, accessReceived: { type: Boolean, default: false }, accessItems: { type: [accessItemSchema], default: [] }, productionGoAheadAt: { type: Date, default: null }, delaySide: { type: String, enum: ['Our','Client','N/A'], default: 'N/A' }, highAlertSent: { type: Boolean, default: false }, alertDatetime: { type: Date, default: null }, delayReason: String, flaggedToAsad: { type: Boolean, default: false }, onboardStatus: { type: String, enum: ['Not Started','In Progress','Ready for review','Graduating this week','Completed','Delayed'], default: 'Not Started' } }, { timestamps: true });
schema.pre('validate', function () {
  const requiredItems = this.accessItems.filter((item) => item.required);
  if (requiredItems.length) this.accessReceived = requiredItems.every((item) => item.received);
  if (this.delaySide !== 'N/A' && !this.delayReason?.trim()) this.invalidate('delayReason', 'delayReason is required for delays');
  if (this.delaySide !== 'N/A' && this.onboardStatus !== 'Completed') this.onboardStatus = 'Delayed';
  if (this.delaySide === 'N/A') this.delayReason = undefined;
  if (this.onboardStatus === 'Completed' && !this.accessReceived) this.invalidate('accessItems', 'All required access and asset items must be received before completion');
  if (this.onboardStatus === 'Completed' && !this.productionGoAheadAt) this.productionGoAheadAt = new Date();
});
export const OnboardingChecklist = model<IOnboardingChecklist>('OnboardingChecklist', schema);
