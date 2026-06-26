import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Contact } from '../models/Contact.js';
import { Complaint } from '../models/Complaint.js';
import { Report } from '../models/Report.js';
import { Upsell } from '../models/Upsell.js';
import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { Service } from '../models/Service.js';
import type { UserDocument } from '../models/User.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { pagination } from '../utils/pagination.js';
import { businessDateFromIso } from '../utils/dates.js';
import { visibleClientIds } from '../services/visibility.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const idParams = z.object({ id: objectId }).strict();
const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  client: objectId.optional(),
  status: z.string().min(1).optional(),
  category: z.enum(['Retention', 'Onboarding']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'from must be on or before to' });
const dateFields: Record<string, string> = { Contact: 'contactDate', Complaint: 'dateRaised', Report: 'dueDate', Upsell: 'upsellDate' };

function list(model: any) { return asyncHandler(async (req,res) => {
  const {page,limit,skip}=pagination(req);
  const filter:Record<string,unknown>={};
  const scopedIds = await visibleClientIds(req.user);
  if (scopedIds !== null) filter.client = { $in: scopedIds };
  for(const key of ['status','category','resolved']) if(req.query[key]!==undefined) filter[key]=key==='resolved'?req.query[key]==='true':req.query[key];
  if (req.query.client !== undefined) {
    const requested = String(req.query.client);
    filter.client = scopedIds === null ? requested : { $in: scopedIds.filter((id) => String(id) === requested) };
  }
  if (req.query.from || req.query.to) {
    const field = dateFields[model.modelName] ?? 'createdAt';
    filter[field] = {
      ...(req.query.from ? { $gte: businessDateFromIso(String(req.query.from)) } : {}),
      ...(req.query.to ? { $lte: businessDateFromIso(String(req.query.to), true) } : {})
    };
  }
  const [data,total]=await Promise.all([model.find(filter).populate('client','businessName customerName').sort({createdAt:-1}).skip(skip).limit(limit),model.countDocuments(filter)]);
  res.json({success:true,data,meta:{page,limit,total,pages:Math.ceil(total/limit)}});
}); }
function detail(model:any,name:string) { return asyncHandler(async(req,res)=>{const scopedIds=await visibleClientIds(req.user);const filter:Record<string,unknown>={_id:String(req.params.id)};if(scopedIds!==null)filter.client={$in:scopedIds};const row=await model.findOne(filter).populate('client');if(!row)throw new AppError(404,`${name} not found`);res.json({success:true,data:row});}); }
function remove(model:any,name:string) { return asyncHandler(async (req)=>{await findScopedRecord(model,String(req.params.id),req.user,name);await audit({actor:req.user?._id,action:'REMOVAL_REQUEST_BLOCKED',recordType:name,recordId:String(req.params.id),after:{reason:'Direct deletion is disabled by CST-6/CST-37/CST-38'}});throw new AppError(405,'Direct deletion is disabled. Request removal from IT for Super Admin assessment.');}); }
async function ensureClient(client: string, user?: UserDocument) {
  const scopedIds = await visibleClientIds(user);
  const filter: Record<string, unknown> = { _id: client };
  if (scopedIds !== null) filter._id = { $in: scopedIds.filter((id) => String(id) === client) };
  if (!await Client.exists(filter)) throw new AppError(422, 'Client not found');
}
async function findScopedRecord(model: any, id: string, user: UserDocument | undefined, name: string) {
  const scopedIds = await visibleClientIds(user);
  const filter: Record<string, unknown> = { _id: id };
  if (scopedIds !== null) filter.client = { $in: scopedIds };
  const row = await model.findOne(filter);
  if (!row) throw new AppError(404, `${name} not found`);
  return row;
}
async function applyUpsellMrr(row: InstanceType<typeof Upsell>) {
  if (row.status !== 'Converted' || row.mrrApplied || row.revenue <= 0) return;
  const service = await Service.findOneAndUpdate({ name: row.servicePitched }, { $set: { active: true }, $setOnInsert: { name: row.servicePitched } }, { upsert: true, new: true });
  await ClientService.findOneAndUpdate(
    { client: row.client, service: service._id },
    { $inc: { monthlyAmount: row.revenue }, $set: { active: true, billingType: 'Recurring' }, $setOnInsert: { client: row.client, service: service._id } },
    { upsert: true }
  );
  row.mrrApplied = true;
  await row.save();
}

export const contactsRouter=Router();
contactsRouter.get('/',validate(listQuery,'query'),list(Contact));
contactsRouter.post('/',validate(z.object({client:objectId,contactDate:z.coerce.date().optional(),contactType:z.enum(['Complaint','Report','Upsell','Simple contact']),channel:z.enum(['Phone','WhatsApp','Email','Video']),notes:z.string().trim().min(1),nextReachBackDate:z.coerce.date()}).strict()),asyncHandler(async(req,res)=>{await ensureClient(req.body.client,req.user);const row=await Contact.create({...req.body,contactDate:req.body.contactDate??new Date(),createdBy:req.user?._id});await audit({actor:req.user?._id,action:'CREATE',recordType:'Contact',recordId:row._id,after:row.toObject()});res.status(201).json({success:true,data:row});}));
contactsRouter.get('/:id',validate(idParams,'params'),detail(Contact,'Contact'));
contactsRouter.patch('/:id',validate(idParams,'params'),validate(z.object({contactDate:z.coerce.date().optional(),contactType:z.enum(['Complaint','Report','Upsell','Simple contact']).optional(),channel:z.enum(['Phone','WhatsApp','Email','Video']).optional(),notes:z.string().trim().min(1).optional(),nextReachBackDate:z.coerce.date().optional()}).strict()),asyncHandler(async(req,res)=>{const row=await findScopedRecord(Contact,String(req.params.id),req.user,'Contact');const before=row.toObject();Object.assign(row,req.body);await row.save();await audit({actor:req.user?._id,action:'UPDATE',recordType:'Contact',recordId:row._id,before,after:row.toObject()});res.json({success:true,data:row});}));
contactsRouter.delete('/:id',validate(idParams,'params'),remove(Contact,'Contact'));

export const complaintsRouter=Router();
complaintsRouter.get('/',validate(listQuery,'query'),list(Complaint));
complaintsRouter.post('/',validate(z.object({client:objectId,dateRaised:z.coerce.date(),details:z.string().trim().min(1),forwardedTo:z.string().trim().optional(),resolved:z.boolean().default(false),dateResolved:z.coerce.date().nullable().optional()}).strict().refine((value)=>!value.resolved||value.dateResolved!=null,{message:'dateResolved is required when resolved is true',path:['dateResolved']})),asyncHandler(async(req,res)=>{await ensureClient(req.body.client,req.user);const row=await Complaint.create({...req.body,createdBy:req.user?._id});await audit({actor:req.user?._id,action:'CREATE',recordType:'Complaint',recordId:row._id,after:row.toObject()});res.status(201).json({success:true,data:row});}));
complaintsRouter.get('/:id',validate(idParams,'params'),detail(Complaint,'Complaint'));
complaintsRouter.patch('/:id',validate(idParams,'params'),validate(z.object({dateRaised:z.coerce.date().optional(),details:z.string().trim().min(1).optional(),forwardedTo:z.string().trim().optional(),resolved:z.boolean().optional(),dateResolved:z.coerce.date().nullable().optional()}).strict()),asyncHandler(async(req,res)=>{const row=await findScopedRecord(Complaint,String(req.params.id),req.user,'Complaint');const before=row.toObject();Object.assign(row,req.body);await row.save();await audit({actor:req.user?._id,action:'UPDATE',recordType:'Complaint',recordId:row._id,before,after:row.toObject()});res.json({success:true,data:row});}));
complaintsRouter.delete('/:id',validate(idParams,'params'),remove(Complaint,'Complaint'));

export const reportsRouter=Router();
reportsRouter.get('/',validate(listQuery,'query'),list(Report));
reportsRouter.post('/',validate(z.object({client:objectId,category:z.enum(['Retention','Onboarding']),label:z.string().trim().min(1),periodMonth:z.string().regex(/^\d{4}-\d{2}$/),dueDate:z.coerce.date(),notes:z.string().trim().optional()}).strict()),asyncHandler(async(req,res)=>{await ensureClient(req.body.client,req.user);const row=await Report.create({...req.body,status:new Date()>req.body.dueDate?'Late':'Pending'});await audit({actor:req.user?._id,action:'CREATE',recordType:'Report',recordId:row._id,after:row.toObject()});if(row.status!=='Sent')await audit({actor:req.user?._id,action:'IN_APP_NOTIFICATION_REPORT_NOT_SENT',recordType:'Report',recordId:row._id,source:'SYSTEM',after:{client:row.client,label:row.label,status:row.status}});res.status(201).json({success:true,data:row});}));
reportsRouter.get('/:id',validate(idParams,'params'),detail(Report,'Report'));
reportsRouter.patch('/:id',validate(idParams,'params'),validate(z.object({category:z.enum(['Retention','Onboarding']).optional(),label:z.string().trim().min(1).optional(),periodMonth:z.string().regex(/^\d{4}-\d{2}$/).optional(),dueDate:z.coerce.date().optional(),dateSent:z.coerce.date().nullable().optional(),notes:z.string().trim().optional()}).strict()),asyncHandler(async(req,res)=>{const row=await findScopedRecord(Report,String(req.params.id),req.user,'Report');const before=row.toObject();Object.assign(row,req.body);row.status=row.dateSent?'Sent':new Date()>row.dueDate?'Late':'Pending';await row.save();await audit({actor:req.user?._id,action:'UPDATE',recordType:'Report',recordId:row._id,before,after:row.toObject()});if(row.status!=='Sent')await audit({actor:req.user?._id,action:'IN_APP_NOTIFICATION_REPORT_NOT_SENT',recordType:'Report',recordId:row._id,source:'SYSTEM',after:{client:row.client,label:row.label,status:row.status}});res.json({success:true,data:row});}));
reportsRouter.delete('/:id',validate(idParams,'params'),remove(Report,'Report'));

export const upsellsRouter=Router();
upsellsRouter.get('/',validate(listQuery,'query'),list(Upsell));
upsellsRouter.post('/',validate(z.object({client:objectId,status:z.enum(['In Progress','Converted','Lost']).default('In Progress'),servicePitched:z.string().trim().min(1),revenue:z.number().nonnegative().default(0),upsellDate:z.coerce.date().nullable().optional()}).strict().refine((value)=>value.status!=='Converted'||value.upsellDate!=null,{message:'upsellDate is required when converted',path:['upsellDate']})),asyncHandler(async(req,res)=>{await ensureClient(req.body.client,req.user);const row=await Upsell.create({...req.body,createdBy:req.user?._id});await applyUpsellMrr(row);await audit({actor:req.user?._id,action:'CREATE',recordType:'Upsell',recordId:row._id,after:row.toObject()});res.status(201).json({success:true,data:row});}));
upsellsRouter.get('/:id',validate(idParams,'params'),detail(Upsell,'Upsell'));
upsellsRouter.patch('/:id',validate(idParams,'params'),validate(z.object({status:z.enum(['In Progress','Converted','Lost']).optional(),servicePitched:z.string().trim().min(1).optional(),revenue:z.number().nonnegative().optional(),upsellDate:z.coerce.date().nullable().optional()}).strict()),asyncHandler(async(req,res)=>{const row=await findScopedRecord(Upsell,String(req.params.id),req.user,'Upsell');const before=row.toObject();Object.assign(row,req.body);await row.save();await applyUpsellMrr(row);await audit({actor:req.user?._id,action:'UPDATE',recordType:'Upsell',recordId:row._id,before,after:row.toObject()});res.json({success:true,data:row});}));
upsellsRouter.delete('/:id',validate(idParams,'params'),remove(Upsell,'Upsell'));
