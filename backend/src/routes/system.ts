import { Router } from 'express';
import type { RequestHandler } from 'express';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { runAllJobs } from '../jobs/index.js';
import { AuditLog } from '../models/AuditLog.js';
import { SchedulerRun } from '../models/SchedulerRun.js';
import { asyncHandler } from '../utils/async-handler.js';
import { pagination } from '../utils/pagination.js';

export const systemRouter=Router();
const requireDirectorOrCron: RequestHandler = (req,res,next) => {
  if (req.headers['x-cron-secret'] === env.CRON_SECRET) return next();
  return requireAuth(req,res,(error?: unknown) => {
    if (error) return next(error);
    return allowRoles('SUPER_ADMIN', 'DIRECTOR')(req,res,next);
  });
};
systemRouter.post('/jobs/run',requireDirectorOrCron,asyncHandler(async(req,res)=>res.json({success:true,data:await runAllJobs()})));
systemRouter.get('/jobs',requireAuth,allowRoles('SUPER_ADMIN', 'DIRECTOR'),asyncHandler(async(_req,res)=>res.json({success:true,data:await SchedulerRun.find().sort({createdAt:-1}).limit(100)})));
systemRouter.get('/audit',requireAuth,allowRoles('SUPER_ADMIN', 'DIRECTOR'),asyncHandler(async(req,res)=>{const {page,limit,skip}=pagination(req);const [data,total]=await Promise.all([AuditLog.find().populate('actor','name email').sort({createdAt:-1}).skip(skip).limit(limit),AuditLog.countDocuments()]);res.json({success:true,data,meta:{page,limit,total}});}));
