import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as customers from '../controllers/customerController.js';
import * as leads from '../controllers/leadController.js';
import * as opps from '../controllers/opportunityController.js';
import * as followups from '../controllers/followupController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as reports from '../controllers/reportController.js';
import * as audit from '../controllers/auditController.js';

const router = Router();

// Authentication
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/change-password', authenticate, auth.changePassword);

// Users & roles (assignable + roles are available to any logged-in user; the rest is Admin only)
router.get('/users/assignable', authenticate, users.assignable);
router.get('/users/roles', authenticate, users.roles);
router.use('/users', authenticate, authorize('Admin'));
router.get('/users', users.list);
router.post('/users', users.create);
router.put('/users/:id', users.update);
router.patch('/users/:id/status', users.setStatus);
router.post('/users/:id/unlock', users.unlock);
router.post('/users/:id/reset-password', users.resetPassword);

// Customers
router.use('/customers', authenticate);
router.get('/customers', customers.list);
router.post('/customers', customers.create);
router.get('/customers/:id', customers.get);
router.put('/customers/:id', customers.update);
router.delete('/customers/:id', customers.remove);

// Leads
router.use('/leads', authenticate);
router.get('/leads', leads.list);
router.post('/leads', leads.create);
router.get('/leads/:id', leads.get);
router.put('/leads/:id', leads.update);
router.post('/leads/:id/convert', leads.convert);
router.delete('/leads/:id', authorize('Admin', 'Manager'), leads.remove);

// Opportunities
router.use('/opportunities', authenticate);
router.get('/opportunities', opps.list);
router.post('/opportunities', opps.create);
router.get('/opportunities/:id', opps.get);
router.put('/opportunities/:id', opps.update);
router.delete('/opportunities/:id', authorize('Admin', 'Manager'), opps.remove);

// Follow-ups (also used for Call / Meeting / Email / Task activities)
router.use('/followups', authenticate);
router.get('/followups', followups.list);
router.post('/followups', followups.create);
router.put('/followups/:id', followups.update);
router.patch('/followups/:id/status', followups.setStatus);
router.patch('/followups/:id/reschedule', followups.reschedule);
router.delete('/followups/:id', followups.remove);

// Dashboard & reports
router.get('/dashboard', authenticate, dashboard.summary);
router.get('/reports/:type', authenticate, reports.report);

// Audit log (Admin only, read-only)
router.get('/audit', authenticate, authorize('Admin'), audit.list);

export default router;
