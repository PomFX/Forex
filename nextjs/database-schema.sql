-- =====================================================
-- ATH Trader — PostgreSQL Database Schema
-- Auth, KYC & Wallet Transactions
-- =====================================================

-- ========================
-- 1. AUTH (การจัดการสมาชิก)
-- ========================

-- users (ขยายจากเดิม) — ตารางสมาชิก
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'none';
  -- kyc_status: 'none', 'pending', 'approved', 'rejected'

-- login_logs — ประวัติการเข้าใช้ระบบ
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) DEFAULT '',
  user_agent TEXT DEFAULT '',
  device VARCHAR(50) DEFAULT '',
  location VARCHAR(100) DEFAULT '',
  status VARCHAR(20) DEFAULT 'success',  -- success, failed
  failed_reason VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- refresh_tokens — จัดการ JWT Refresh Token
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- password_resets — ขอรีเซ็ตรหัสผ่าน
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- roles — ตารางสิทธิ์ (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- user_roles — map users → roles
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ========================
-- 2. KYC (ยืนยันตัวตน)
-- ========================

-- kyc_submissions — ข้อมูลคำขอ KYC
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  date_of_birth DATE,
  nationality VARCHAR(50) DEFAULT '',
  id_number VARCHAR(100) DEFAULT '',       -- เลขบัตรประชาชน / Passport
  id_type VARCHAR(30) DEFAULT 'id_card',   -- id_card, passport, driving_license
  address TEXT DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  country VARCHAR(100) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending',    -- pending, under_review, approved, rejected
  rejection_reason TEXT DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- kyc_documents — เอกสารประกอบ KYC
CREATE TABLE IF NOT EXISTS kyc_documents (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,      -- id_card_front, id_card_back, passport_selfie, address_proof, ...
  doc_url TEXT NOT NULL,              -- base64 data URL หรือ external URL
  doc_status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  rejection_reason TEXT DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- kyc_verification_log — log การตรวจสอบ KYC
CREATE TABLE IF NOT EXISTS kyc_verification_log (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,         -- submitted, under_review, approved, rejected, document_requested
  note TEXT DEFAULT '',
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- 3. WALLET TRANSACTIONS
-- (การเก็บประวัติฝาก-ถอนเงิน)
-- ========================

-- wallets — กระเป๋าเงินของสมาชิก
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(18,2) DEFAULT 0.00,        -- ยอดเงินคงเหลือ
  bonus_balance DECIMAL(18,2) DEFAULT 0.00,  -- ยอดโบนัส (แยกจากเงินจริง)
  locked_balance DECIMAL(18,2) DEFAULT 0.00, -- ยอดที่ถอนไม่ได้ (ระหว่างตรวจสอบ)
  currency VARCHAR(10) DEFAULT 'THB',
  daily_deposit_limit DECIMAL(18,2) DEFAULT 100000.00,
  daily_withdrawal_limit DECIMAL(18,2) DEFAULT 50000.00,
  is_frozen BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- transactions — ธุรกรรมทั้งหมด (ฝาก ถอน โอน โบนัส)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  tx_type VARCHAR(30) NOT NULL,     -- deposit, withdrawal, transfer_in, transfer_out, bonus, commission, adjustment, fee, refund
  tx_status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled, expired
  amount DECIMAL(18,2) NOT NULL,
  fee DECIMAL(18,2) DEFAULT 0.00,
  net_amount DECIMAL(18,2) NOT NULL,      -- amount - fee
  balance_before DECIMAL(18,2) DEFAULT 0.00,
  balance_after DECIMAL(18,2) DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'THB',
  payment_method VARCHAR(50) DEFAULT '',  -- bank_transfer, promptpay, truewallet, usdt_trc20, credit_card, ...
  payment_channel VARCHAR(50) DEFAULT '', -- ธนาคาร / กระเป๋า
  reference_id VARCHAR(100) DEFAULT '',   -- เลขอ้างอิงจากระบบ payment gateway
  slip_url TEXT DEFAULT '',               -- รูปสลิป (base64)
  description TEXT DEFAULT '',
  admin_note TEXT DEFAULT '',
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  tx_hash VARCHAR(255) DEFAULT '',        -- สำหรับ crypto tx hash
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- deposits — รายละเอียดการฝากเงิน
CREATE TABLE IF NOT EXISTS deposits (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL,
  fee DECIMAL(18,2) DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL,
  bank_name VARCHAR(100) DEFAULT '',
  bank_account VARCHAR(50) DEFAULT '',
  slip_url TEXT DEFAULT '',
  sender_name VARCHAR(200) DEFAULT '',
  sender_bank VARCHAR(100) DEFAULT '',
  sender_account VARCHAR(50) DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending',
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- withdrawals — รายละเอียดการถอนเงิน
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL,
  fee DECIMAL(18,2) DEFAULT 0.00,
  net_amount DECIMAL(18,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,     -- bank_transfer, crypto, ...
  bank_name VARCHAR(100) DEFAULT '',
  bank_account VARCHAR(50) DEFAULT '',
  account_holder VARCHAR(200) DEFAULT '',
  wallet_address VARCHAR(255) DEFAULT '',   -- crypto address
  status VARCHAR(20) DEFAULT 'pending',    -- pending, processing, completed, failed, cancelled
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  processed_at TIMESTAMP,
  rejection_reason TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- payment_gateway_logs — log การเชื่อมต่อ Payment Gateway
CREATE TABLE IF NOT EXISTS payment_gateway_logs (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  gateway VARCHAR(50) NOT NULL,
  request_body TEXT DEFAULT '',
  response_body TEXT DEFAULT '',
  http_status INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT false,
  error_message TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- INDEXES (เพิ่มประสิทธิภาพ)
-- ========================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_submission ON kyc_documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verification_log_submission ON kyc_verification_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(tx_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ========================
-- TRIGGER: อัปเดต updated_at
-- ========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated') THEN
    CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallets_updated') THEN
    CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transactions_updated') THEN
    CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
