/**
 * In-Memory Auth Routes
 * Re-implements Person 2's auth flow (Signup, OTP, Login)
 * without PostgreSQL dependency.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ─── IN-MEMORY STATE ───
// Appended to what was in memoryStore, or kept separate for auth.
const users = [];
const otps = [];

// Constants
const SECRET = process.env.JWT_SECRET || 'dev_secret_123';

// ─── HELPERS ───
const emailRegex = /^\S+@\S+\.\S+$/;
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── ROUTES ───

router.post('/signup', async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (users.find(u => u.email === email || u.phone === phone)) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // Create unverified user entry
    const id = users.length + 1;
    const user = { id, name, email, phone, password, verified: false };
    users.push(user);

    // Generate OTP
    const code = generateOTP();
    const verificationId = crypto.randomUUID();
    otps.push({ verificationId, userId: id, code, expires: Date.now() + 15 * 60000 });

    // MOCK OTP SEND:
    console.log(`[AUTH-MOCK] OTP for ${email}/${phone}: ${code}`);

    const payload = { message: 'OTP sent to your email/phone', verificationId };
    // In non-production, also return OTP so the demo flow works
    if (process.env.NODE_ENV !== 'production') {
        payload.debugOtp = code;
    }

    res.json(payload);
});

router.post('/verify-signup', async (req, res) => {
    const { verificationId, otp } = req.body;
    const otpRecord = otps.find(o => o.verificationId === verificationId && o.code === otp);

    if (!otpRecord) return res.status(400).json({ message: 'Invalid or expired OTP' });
    if (Date.now() > otpRecord.expires) return res.status(400).json({ message: 'OTP expired' });

    // Mark user as verified
    const user = users.find(u => u.id === otpRecord.userId);
    if (!user) return res.status(400).json({ message: 'User not found' });
    user.verified = true;

    // Generate token
    const accessToken = jwt.sign({ id: user.id, name: user.name }, SECRET, { expiresIn: '1d' });

    // Cleanup OTP
    otps.splice(otps.indexOf(otpRecord), 1);

    res.json({ message: 'Signup complete!', accessToken, user: { id: user.id, name: user.name } });
});

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    // In demo, accept any credentials if no users exist yet:
    // this makes first-time login seamless even before signup is used.
    let user = users.find(u => (u.email === identifier || u.phone === identifier) && u.password === password);

    if (!user && users.length === 0 && identifier && password) {
        user = {
            id: 1,
            name: identifier,
            email: emailRegex.test(identifier) ? identifier : undefined,
            phone: emailRegex.test(identifier) ? undefined : identifier,
            password,
            verified: true,
        };
        users.push(user);
    }

    // Optional demo backdoor:
    if (!user && (identifier === 'admin@demo.com' || identifier === 'admin')) {
        user = { id: 999, name: 'Demo Administrator', verified: true };
    }

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.verified) return res.status(401).json({ message: 'Account not verified. Please complete signup.' });

    const accessToken = jwt.sign({ id: user.id, name: user.name }, SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful!', accessToken, user: { id: user.id, name: user.name } });
});

router.post('/forgot', async (req, res) => {
    const { identifier } = req.body;
    const user = users.find(u => u.email === identifier || u.phone === identifier);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = generateOTP();
    const verificationId = crypto.randomUUID();
    otps.push({ verificationId, userId: user.id, code, expires: Date.now() + 15 * 60000 });

    console.log(`[AUTH-MOCK] Reset OTP for ${identifier}: ${code}`);

    const payload = { message: 'Password reset OTP sent', verificationId };
    if (process.env.NODE_ENV !== 'production') {
        payload.debugOtp = code;
    }

    res.json(payload);
});

router.post('/reset', async (req, res) => {
    const { verificationId, otp, newPassword } = req.body;
    const otpRecord = otps.find(o => o.verificationId === verificationId && o.code === otp);

    if (!otpRecord) return res.status(400).json({ message: 'Invalid or expired OTP' });

    const user = users.find(u => u.id === otpRecord.userId);
    user.password = newPassword; // reset password

    otps.splice(otps.indexOf(otpRecord), 1);
    res.json({ message: 'Password reset successfully. Please login.' });
});

router.post('/resend-otp', (req, res) => {
    const { verificationId } = req.body || {};
    const otpRecord = verificationId
        ? otps.find(o => o.verificationId === verificationId)
        : null;

    if (!otpRecord) {
        return res.status(400).json({ message: 'Invalid or expired verification session' });
    }

    const code = generateOTP();
    otpRecord.code = code;
    otpRecord.expires = Date.now() + 15 * 60000;

    console.log(`[AUTH-MOCK] Resent OTP for verificationId=${verificationId}: ${code}`);

    const payload = { message: 'OTP resent', verificationId };
    if (process.env.NODE_ENV !== 'production') {
        payload.debugOtp = code;
    }

    res.json(payload);
});

// Add simple auth middleware exporter
router.requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = router;
