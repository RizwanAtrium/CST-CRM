import { Router } from 'express';
import { z } from 'zod';
import { allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { Complaint } from '../models/Complaint.js';
import { Contact } from '../models/Contact.js';
import { Invoice } from '../models/Invoice.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Report } from '../models/Report.js';
import { Upsell } from '../models/Upsell.js';
import { asyncHandler } from '../utils/async-handler.js';
import { currentWeekRange, dateRange, monthsActive } from '../utils/dates.js';

const pct=(n:number,d:number)=>d?Math.round(n/d*10000)/100:100;
export const dashboardRouter=Router();
dashboardRouter.use(allowRoles('DIRECTOR', 'CST_MANAGER', 'CST_HANDLER', 'CST'));
dashboardRouter.get('/',validate(z.object({from:z.iso.date().optional(),to:z.iso.date().optional()}).strict().refine((value)=>!value.from||!value.to||value.from<=value.to,{message:'from must be on or before to'}),'query'),asyncHandler(async(req,res)=>{
  const {start,end}=dateRange(req.query.from as string|undefined,req.query.to as string|undefined);const week=currentWeekRange();
  const [clients,newSigned,churnedPeriod,contacts,invoices,reports,complaints,upsells,delays,mrrRows,revenueHistory]=await Promise.all([
    Client.find().lean(),Client.countDocuments({saleDate:{$gte:start,$lte:end}}),Client.countDocuments({dateChurned:{$gte:start,$lte:end}}),
    Contact.aggregate([{$match:{contactDate:{$gte:week.start,$lt:week.end}}},{$group:{_id:'$client',count:{$sum:1}}}]),
    Invoice.find({dueDate:{$gte:start,$lte:end}}).lean(),Report.find({dueDate:{$gte:start,$lte:end}}).lean(),
    Complaint.find({dateRaised:{$gte:start,$lte:end}}).lean(),Upsell.find({$or:[{upsellDate:{$gte:start,$lte:end}},{upsellDate:null,createdAt:{$gte:start,$lte:end}}]}).lean(),
    OnboardingChecklist.aggregate([{$group:{_id:'$delaySide',count:{$sum:1}}}]),
    ClientService.aggregate([{$match:{active:true}},{$lookup:{from:'clients',localField:'client',foreignField:'_id',as:'client'}},{$unwind:'$client'},{$match:{'client.lifecycleStage':{$in:['Active','In Progress']}}},{$group:{_id:'$client.lifecycleStage',amount:{$sum:'$monthlyAmount'}}}]),
    Invoice.aggregate([{$group:{_id:'$billingMonth',invoiced:{$sum:'$amount'},paid:{$sum:{$cond:['$paid','$amount',0]}},outstanding:{$sum:{$cond:['$paid',0,'$amount']}}}},{$sort:{_id:1}}])
  ]);
  const live=clients.filter(c=>c.lifecycleStage!=='Not Active'),active=clients.filter(c=>c.lifecycleStage==='Active'),inProgress=clients.filter(c=>c.lifecycleStage==='In Progress');
  const fourPlus=active.filter(c=>monthsActive(c.workStartDate,c.dateChurned)>=4).length;const avgMonths=clients.length?clients.reduce((s,c)=>s+monthsActive(c.workStartDate,c.dateChurned),0)/clients.length:0;
  const contactMap=new Map(contacts.map(x=>[String(x._id),x.count]));const contacted=live.filter(c=>(contactMap.get(String(c._id))??0)>=3).length;
  const early=invoices.filter(i=>i.sentDate&&(i.dueDate.getTime()-i.sentDate.getTime())/86400000>=5).length;const lateInvoices=invoices.filter(i=>i.status==='Late'||(!i.sentDate&&i.dueDate<new Date())).length;
  const retention=reports.filter(r=>r.category==='Retention'),sentRetention=retention.filter(r=>r.dateSent);const report1=sentRetention.filter(r=>r.label==='Report 1').length,report2=sentRetention.filter(r=>r.label==='Report 2').length;
  const bothMap=new Map<string,Set<string>>();for(const r of sentRetention){const key=String(r.client);if(!bothMap.has(key))bothMap.set(key,new Set());bothMap.get(key)!.add(r.label);}const bothSent=[...bothMap.values()].filter(x=>x.has('Report 1')&&x.has('Report 2')).length;
  const resolved=complaints.filter(c=>c.resolved).length;const converted=upsells.filter(u=>u.status==='Converted');const allOpen=await Complaint.countDocuments({resolved:false});const unpaid=await Invoice.aggregate([{$match:{paid:false}},{$group:{_id:null,total:{$sum:'$amount'}}}]);
  const mrr=new Map(mrrRows.map(x=>[x._id,x.amount]));const invoiceRate=pct(early,invoices.length);const contactRate=pct(contacted,live.length);const reportRate=pct(sentRetention.length,active.length*2);const complaintRate=pct(resolved,complaints.length);const retentionRate=pct(fourPlus,active.length);
  const score=Math.round((invoiceRate*.2+contactRate*.25+reportRate*.2+complaintRate*.2+retentionRate*.15)*100)/100;
  res.json({success:true,data:{
    range:{from:start,to:end},clients:{total:clients.length,active:active.length,inProgress:inProgress.length,churnedAllTime:clients.length-live.length,newSigned,churnedPeriod,fourPlusMonths:fourPlus,averageMonthsActive:Math.round(avgMonths*100)/100},
    engagement:{contactedThreePlus:contacted,missed:live.length-contacted,target:3},
    invoicing:{early,late:lateInvoices,notSent:invoices.filter(i=>!i.sentDate).length,totalInvoiced:invoices.reduce((s,i)=>s+i.amount,0),unpaidReceivables:unpaid[0]?.total??0},
    reports:{retentionReport1Sent:report1,retentionReport2Sent:report2,late:reports.filter(r=>!r.dateSent&&r.dueDate<new Date()).length,bothSent,onboardingWeek1Sent:reports.filter(r=>r.category==='Onboarding'&&r.label==='Week 1'&&r.dateSent).length,onboardingBiweeklySent:reports.filter(r=>r.category==='Onboarding'&&r.label==='Biweekly'&&r.dateSent).length,onboardingMonthlySent:reports.filter(r=>r.category==='Onboarding'&&r.label==='Monthly'&&r.dateSent).length},
    complaints:{total:complaints.length,resolved,open:allOpen,resolutionRate:pct(resolved,complaints.length)},
    upsells:{converted:converted.length,revenue:converted.reduce((s,u)=>s+u.revenue,0),inProgress:await Upsell.countDocuments({status:'In Progress'})},
    delays:Object.fromEntries(delays.map(x=>[x._id,x.count])),revenue:{activeMrr:mrr.get('Active')??0,activePlusInProgressMrr:(mrr.get('Active')??0)+(mrr.get('In Progress')??0),upsellRevenue:converted.reduce((s,u)=>s+u.revenue,0),totalRevenue:invoices.reduce((s,i)=>s+i.amount,0)+converted.reduce((s,u)=>s+u.revenue,0),history:revenueHistory.map(x=>({month:x._id,invoiced:x.invoiced,paid:x.paid,outstanding:x.outstanding}))},
    performance:{components:{invoiceTiming:invoiceRate,clientContact:contactRate,retentionReports:reportRate,complaintResolution:complaintRate,retention:retentionRate},score,bonusTier:score>=90?'Full KPI bonus':score>=60?'Partial bonus':'No bonus / review'}
  }});
}));
