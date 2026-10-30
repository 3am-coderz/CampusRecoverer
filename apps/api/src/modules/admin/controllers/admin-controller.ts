import { Request, Response, NextFunction } from 'express';
import { AppContext } from '../../../kernel/app.js';
import { AdminService } from '../services/admin-service.js';

export class AdminController {
  private adminService: AdminService;

  constructor(ctx: AppContext, adminService?: AdminService) {
    this.adminService = adminService || new AdminService(ctx.db);
  }

  getDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.adminService.getDashboardSummary();
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  };

  listItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        limit,
        offset,
        status,
        risk_level,
        category,
        search,
        sort_by,
        sort_order,
      } = req.query;

      const result = await this.adminService.listItems({
        limit: typeof limit === 'string' ? limit : undefined,
        offset: typeof offset === 'string' ? offset : undefined,
        status: typeof status === 'string' ? status : undefined,
        risk_level: typeof risk_level === 'string' ? risk_level : undefined,
        category: typeof category === 'string' ? category : undefined,
        search: typeof search === 'string' ? search : undefined,
        sort_by: typeof sort_by === 'string' ? sort_by : undefined,
        sort_order: typeof sort_order === 'string' ? sort_order : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  listClaims = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        limit,
        offset,
        status,
        item_id,
        claimant_id,
        confidence_label,
        start_date,
        from,
        end_date,
        to,
        sort_by,
        sort_order,
      } = req.query;

      const result = await this.adminService.listClaims({
        limit: typeof limit === 'string' ? limit : undefined,
        offset: typeof offset === 'string' ? offset : undefined,
        status: typeof status === 'string' ? status : undefined,
        item_id: typeof item_id === 'string' ? item_id : undefined,
        claimant_id: typeof claimant_id === 'string' ? claimant_id : undefined,
        confidence_label: typeof confidence_label === 'string' ? confidence_label : undefined,
        start_date: typeof start_date === 'string' ? start_date : undefined,
        from: typeof from === 'string' ? from : undefined,
        end_date: typeof end_date === 'string' ? end_date : undefined,
        to: typeof to === 'string' ? to : undefined,
        sort_by: typeof sort_by === 'string' ? sort_by : undefined,
        sort_order: typeof sort_order === 'string' ? sort_order : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        limit,
        offset,
        role,
        search,
        sort_by,
        sort_order,
      } = req.query;

      const result = await this.adminService.listUsers({
        limit: typeof limit === 'string' ? limit : undefined,
        offset: typeof offset === 'string' ? offset : undefined,
        role: typeof role === 'string' ? role : undefined,
        search: typeof search === 'string' ? search : undefined,
        sort_by: typeof sort_by === 'string' ? sort_by : undefined,
        sort_order: typeof sort_order === 'string' ? sort_order : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
