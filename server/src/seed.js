// Creates demo users and sample CRM data. Run once: npm run seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Customer from './models/Customer.js';
import Lead from './models/Lead.js';
import Opportunity from './models/Opportunity.js';
import FollowUp from './models/FollowUp.js';

const DEMO_PASSWORD = 'Admin@123';

async function run() {
  await connectDB(process.env.MONGODB_URI);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const seedUsers = [
    { name: 'System Admin', email: 'admin@acxiom.com', role: 'Admin' },
    { name: 'Priya Manager', email: 'manager@acxiom.com', role: 'Manager' },
    { name: 'Rahul Sales', email: 'sales@acxiom.com', role: 'SalesExecutive' },
  ];

  const users = {};
  for (const u of seedUsers) {
    let user = await User.findOne({ email: u.email });
    if (!user) user = await User.create({ ...u, passwordHash: hash });
    users[u.role] = user;
  }

  if (await Customer.exists({})) {
    console.log('Sample data already exists. Demo users are ready.');
  } else {
    const sales = users.SalesExecutive;
    const customer = await Customer.create({
      customerName: 'Anita Sharma', email: 'anita@example.com', phone: '9876543210',
      companyName: 'Sharma Textiles', city: 'Kanpur', state: 'Uttar Pradesh', status: 'Active', ownerId: sales._id,
    });
    const lead = await Lead.create({
      leadName: 'Vikram Traders', email: 'vikram@example.com', phone: '9123456780', companyName: 'Vikram Traders',
      source: 'Referral', status: 'Qualified', priority: 'High', expectedValue: 250000, ownerId: sales._id,
    });
    const opp = await Opportunity.create({
      opportunityName: 'Textile ERP Rollout', customerId: customer._id, stage: 'Proposal', amount: 500000,
      probability: 60, expectedCloseDate: new Date(Date.now() + 45 * 86400000), ownerId: sales._id,
    });
    await FollowUp.create({
      relatedType: 'Opportunity', relatedId: opp._id, subject: 'Share proposal walkthrough',
      followUpType: 'Meeting', followUpDate: new Date(Date.now() + 2 * 86400000), assignedTo: sales._id,
    });
    console.log(`Sample customer ${customer.customerName}, lead ${lead.leadName} and opportunity created.`);
  }

  console.log('\nDemo logins (password for all: Admin@123)');
  console.log('  Admin:           admin@acxiom.com');
  console.log('  Manager:         manager@acxiom.com');
  console.log('  Sales Executive: sales@acxiom.com');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
