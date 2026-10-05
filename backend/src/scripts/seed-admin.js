// Admin Database Seeder - Run: npm run db:seed:admin

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { adminUsers, paymentHistory, apiRequestLogs, organizations, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const ADMIN_EMAIL = 'rafaeljosh18@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

async function seedAdmin() {
  console.log('Starting admin database seed...\n');

  try {
    const existingAdmin = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, ADMIN_EMAIL))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log(`Admin ${ADMIN_EMAIL} already exists. Skipping...\n`);
      process.exit(0);
    }

    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    console.log('Creating admin user...');
    const adminId = uuidv4();
    await db.insert(adminUsers).values({
      id: adminId,
      email: ADMIN_EMAIL,
      passwordHash: passwordHash,
      firstName: 'Rafael',
      lastName: 'Josh',
      role: 'super_admin',
      isActive: true,
    });
    console.log(`   Admin user created: ${ADMIN_EMAIL}`);

    console.log('Creating sample payment history...');
    const orgs = await db.select().from(organizations).limit(5);
    const usersList = await db.select().from(users).limit(5);

    if (orgs.length > 0) {
      const samplePayments = [
        {
          organizationId: orgs[0].id,
          userId: usersList[0]?.id || null,
          amount: 1500000, // IDR 1,500,000
          currency: 'IDR',
          paymentMethod: 'bank_transfer',
          paymentProvider: 'midtrans',
          transactionId: `TRX-${Date.now()}-001`,
          status: 'completed',
          description: 'Enterprise Plan - Monthly',
          paidAt: new Date(),
        },
        {
          organizationId: orgs[0].id,
          userId: usersList[0]?.id || null,
          amount: 500000,
          currency: 'IDR',
          paymentMethod: 'credit_card',
          paymentProvider: 'stripe',
          transactionId: `TRX-${Date.now()}-002`,
          status: 'completed',
          description: 'Professional Plan - Monthly',
          paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          organizationId: orgs[0].id,
          userId: usersList[0]?.id || null,
          amount: 250000,
          currency: 'IDR',
          paymentMethod: 'e_wallet',
          paymentProvider: 'gopay',
          transactionId: `TRX-${Date.now()}-003`,
          status: 'pending',
          description: 'Basic Plan - Monthly',
        },
      ];

      for (const payment of samplePayments) {
        try {
          await db.insert(paymentHistory).values(payment);
        } catch (e) {
          // Skip if insert fails
        }
      }
      console.log('   Sample payment history created');
    }

    console.log('Creating sample API request logs...');
    const sampleRequests = [
      { endpoint: '/api/auth/login', method: 'POST', statusCode: 200, requestDuration: 150 },
      { endpoint: '/api/documents', method: 'GET', statusCode: 200, requestDuration: 85 },
      { endpoint: '/api/documents/upload', method: 'POST', statusCode: 201, requestDuration: 1250 },
      { endpoint: '/api/users', method: 'GET', statusCode: 200, requestDuration: 45 },
      { endpoint: '/api/auth/register', method: 'POST', statusCode: 201, requestDuration: 320 },
      { endpoint: '/api/documents/verify', method: 'POST', statusCode: 200, requestDuration: 890 },
      { endpoint: '/api/totp/verify', method: 'POST', statusCode: 200, requestDuration: 78 },
    ];

    for (let i = 0; i < 20; i++) {
      const sample = sampleRequests[Math.floor(Math.random() * sampleRequests.length)];
      try {
        await db.insert(apiRequestLogs).values({
          ...sample,
          userId: usersList[Math.floor(Math.random() * usersList.length)]?.id || null,
          organizationId: orgs[Math.floor(Math.random() * orgs.length)]?.id || null,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        });
      } catch (e) {
        // Skip if insert fails
      }
    }
    console.log('   Sample API request logs created');

    console.log('\nAdmin seed completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('  URL:      /login2 (Admin Portal)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Admin seed failed:', error);
    process.exit(1);
  }
}

seedAdmin();
