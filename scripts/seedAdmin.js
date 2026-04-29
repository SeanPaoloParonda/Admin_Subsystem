const User = require('../models/user');
const { hashPassword } = require('../utils/passwordUtils');
const sequelize = require('../config/db');

const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');

    // Check if admin already exists
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (existing) {
      console.log('ℹ️ Admin user already exists');
      process.exit(0);
    }

    const pwd_hash = await hashPassword('admin123');

    const admin = await User.create({
      staff_id: 'ADM001',
      username: 'admin',
      pwd_hash,
      role: 'Admin',
      status: 'active'
    });

    console.log('✅ Admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: Admin');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

seedAdmin();

