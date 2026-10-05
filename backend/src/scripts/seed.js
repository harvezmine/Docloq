// Database Seeder - Run: npm run db:seed

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, organizations } from '../db/schema.js';
import 'dotenv/config';

const ADMIN_EMAIL = 'admin@docloq.site';
const ADMIN_PASSWORD = 'Admin123!'; // Change in production!
const ORG_NAME = 'DocLoq Admin';

async function seed() {
  console.log('Starting database seed...\n');

  try {
    // Check if admin already exists
    const existingUsers = await db.select().from(users).limit(1);

    if (existingUsers.length > 0) {
      console.log('Database already has users. Skipping seed.');
      console.log('   If you want to reseed, clear the database first.\n');
      process.exit(0);
    }

    // Create organization
    console.log('Creating organization...');
    const orgId = uuidv4();
    await db.insert(organizations).values({
      id: orgId,
      name: ORG_NAME,
      slug: 'docloq-admin',
      subscriptionTier: 'enterprise',
      hasBlockchainFeature: true,
      awsRegion: 'ap-southeast-3', // Jakarta
      gdprCompliant: true,
      pdpCompliant: true,
    });
    console.log(`   Organization created: ${ORG_NAME}`);

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // Create admin user
    console.log('Creating admin user...');
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      organizationId: orgId,
      email: ADMIN_EMAIL,
      passwordHash: passwordHash,
      firstName: 'Admin',
      lastName: 'DocLoq',
      role: 'owner',
      isActive: true,
      isEmailVerified: true,
    });
    console.log(`   Admin user created: ${ADMIN_EMAIL}`);

    console.log('\nSeed completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Login Credentials (for testing):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
