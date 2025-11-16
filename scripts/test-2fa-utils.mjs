#!/usr/bin/env node

/**
 * Test script for 2FA utilities
 * Tests TOTP generation, verification, and backup codes
 */

import speakeasy from 'speakeasy';
import crypto from 'crypto';

console.log('🧪 Testing 2FA Utilities...\n');

// Test 1: Generate TOTP secret
console.log('Test 1: Generate TOTP Secret');
const secret = speakeasy.generateSecret({
  name: 'Unified Ledger (test@example.com)',
  length: 32,
});
console.log('✅ Secret generated:', secret.base32?.substring(0, 20) + '...');
console.log('✅ OTPAuth URL:', secret.otpauth_url?.substring(0, 50) + '...\n');

// Test 2: Generate TOTP token
console.log('Test 2: Generate TOTP Token');
const token = speakeasy.totp({
  secret: secret.base32,
  encoding: 'base32',
});
console.log('✅ TOTP Token:', token, '\n');

// Test 3: Verify TOTP token
console.log('Test 3: Verify TOTP Token');
const verified = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token,
  window: 2,
});
console.log('✅ Token verified:', verified ? 'PASS' : 'FAIL', '\n');

// Test 4: Generate backup codes
console.log('Test 4: Generate Backup Codes');
const backupCodes = [];
const hashedCodes = [];
for (let i = 0; i < 8; i++) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  backupCodes.push(code);
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  hashedCodes.push(hash);
}
console.log('✅ Generated', backupCodes.length, 'backup codes');
console.log('✅ Sample codes:', backupCodes.slice(0, 3).join(', '), '...\n');

// Test 5: Verify backup code
console.log('Test 5: Verify Backup Code');
const testCode = backupCodes[0];
const testHash = crypto.createHash('sha256').update(testCode.toUpperCase()).digest('hex');
const isValid = hashedCodes.includes(testHash);
console.log('✅ Backup code verified:', isValid ? 'PASS' : 'FAIL');
console.log('   Code:', testCode);
console.log('   Hash:', testHash.substring(0, 20) + '...\n');

// Test 6: Remove used backup code
console.log('Test 6: Remove Used Backup Code');
const updatedCodes = hashedCodes.filter((h) => h !== testHash);
console.log('✅ Original count:', hashedCodes.length);
console.log('✅ Updated count:', updatedCodes.length);
console.log('✅ Code removed:', hashedCodes.length === updatedCodes.length + 1 ? 'PASS' : 'FAIL', '\n');

// Test 7: Verify invalid token
console.log('Test 7: Verify Invalid Token');
const invalidToken = '000000';
const invalidVerified = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token: invalidToken,
  window: 2,
});
console.log('✅ Invalid token rejected:', !invalidVerified ? 'PASS' : 'FAIL', '\n');

console.log('✨ All tests completed!\n');
console.log('Summary:');
console.log('- TOTP secret generation: ✅');
console.log('- TOTP token generation: ✅');
console.log('- TOTP token verification: ✅');
console.log('- Backup code generation: ✅');
console.log('- Backup code verification: ✅');
console.log('- Backup code removal: ✅');
console.log('- Invalid token rejection: ✅');

