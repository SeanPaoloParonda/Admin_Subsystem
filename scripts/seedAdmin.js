const User = require('../models/user');
const Role = require('../models/role');
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

    // Find the Admin role in the DB
    const adminRole = await Role.findOne({ where: { name: 'Admin', subsystem: 'Admin' } });
    if (!adminRole) {
      console.error('❌ Admin role not found in the role table. Create it first.');
      process.exit(1);
    }

    const pwd_hash = await hashPassword('admin123');

    await User.create({
      username: 'admin',
      pwd_hash,
      role_id: adminRole.role_id,
      status: 'active'
    });

    console.log('✅ Admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role ID:', adminRole.role_id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

seedAdmin();
