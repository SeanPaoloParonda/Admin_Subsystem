// ── What this file does ──────────────────────────────────────────────────────
// This file sets up the database connection using Sequelize ORM.
// Sequelize lets us talk to the PostgreSQL database using JavaScript
// instead of writing raw SQL queries.
//
// The database we connect to is hosted on Supabase (a cloud PostgreSQL service).
// The connection string (DATABASE_URL) is stored in the .env file for security —
// it contains the username, password, and host address of the database.
// ─────────────────────────────────────────────────────────────────────────────

// Import the Sequelize class from the sequelize package
const { Sequelize } = require('sequelize');

// Load environment variables from the .env file
require('dotenv').config();

// Create a new Sequelize instance — this is our database connection object.
// We pass the full DATABASE_URL connection string from the environment.
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  // Tell Sequelize we are using PostgreSQL
  dialect: 'postgres',

  // Disable SQL query logging in the console (set to true during debugging if needed)
  logging: false,

  // SSL settings required by Supabase (and most cloud PostgreSQL providers).
  // SSL encrypts the connection between our server and the database.
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
      // Skip the server identity check — safe for Supabase's pooler connections
      checkServerIdentity: () => undefined
    }
  },

  // Connection pool settings — a "pool" keeps a set of database connections
  // open and ready to use, instead of opening a new connection for every request.
  pool: {
    max: 10,       // Maximum number of connections open at the same time
    min: 0,        // Minimum connections to keep open (0 = none when idle)
    acquire: 30000, // How long (ms) to wait for a connection before throwing an error
    idle: 10000    // How long (ms) a connection can sit unused before being released
  }
});

// Export the sequelize instance so other files can use it to define models and run queries
module.exports = sequelize;
