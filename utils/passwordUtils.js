// ── What this file does ──────────────────────────────────────────────────────
// This file provides helper functions for securely handling passwords.
//
// Passwords must NEVER be stored as plain text in the database.
// Instead, we use bcrypt to turn a password into a "hash" — a scrambled,
// one-way representation that cannot be reversed back to the original password.
//
// When a user logs in, we hash what they typed and compare it to the stored hash.
// If they match, the password is correct — without ever storing the real password.
// ─────────────────────────────────────────────────────────────────────────────

// bcryptjs is the library that handles password hashing and comparison
const bcrypt = require('bcryptjs');

/**
 * hashPassword
 *
 * Takes a plain text password and returns a secure hash.
 * This is called when creating a new user or changing a password.
 *
 * The "salt" is a random value added to the password before hashing.
 * It ensures that two users with the same password get different hashes,
 * which protects against "rainbow table" attacks.
 *
 * The number 10 is the "salt rounds" — how many times the hashing algorithm
 * runs. Higher = more secure but slower. 10 is the standard safe value.
 *
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} - The hashed password string (safe to store in DB)
 */
const hashPassword = async (password) => {
  // Generate a random salt with 10 rounds of processing
  const salt = await bcrypt.genSalt(10);

  // Hash the password using the salt and return the result
  return bcrypt.hash(password, salt);
};

/**
 * comparePassword
 *
 * Checks whether a plain text password matches a stored hash.
 * This is called during login to verify the user's password.
 *
 * bcrypt handles the comparison securely — it extracts the salt from
 * the stored hash, re-hashes the input, and compares the results.
 *
 * @param {string} password       - The plain text password the user typed
 * @param {string} hashedPassword - The hashed password stored in the database
 * @returns {Promise<boolean>}    - true if the passwords match, false if not
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// Export both functions so they can be used in controllers
module.exports = { hashPassword, comparePassword };
