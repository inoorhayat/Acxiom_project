export const ROLES = ['Admin', 'Manager', 'SalesExecutive'];

export const CUSTOMER_STATUSES = ['Active', 'Inactive', 'Prospect'];

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
export const LEAD_OPEN_STATUSES = ['New', 'Contacted', 'Qualified'];
export const LEAD_SOURCES = ['Website', 'Referral', 'Campaign', 'Cold Call', 'Other'];
export const PRIORITIES = ['Low', 'Medium', 'High'];

// Configurable lead workflow: current status -> allowed next statuses
export const LEAD_TRANSITIONS = {
  New: ['Contacted', 'Unqualified', 'Lost'],
  Contacted: ['Qualified', 'Unqualified', 'Lost'],
  Qualified: ['Converted', 'Unqualified', 'Lost'],
  Unqualified: ['Contacted'],
  Converted: [],
  Lost: ['New'],
};

export const OPP_STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const CLOSED_STAGES = ['Won', 'Lost'];

export const FOLLOWUP_STATUSES = ['Planned', 'Completed', 'Missed', 'Cancelled'];
export const FOLLOWUP_TYPES = ['Call', 'Meeting', 'Email', 'Task'];
export const RELATED_TYPES = ['Customer', 'Lead', 'Opportunity'];
