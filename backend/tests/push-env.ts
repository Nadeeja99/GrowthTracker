// Imported first by push.test.ts: config is read once when src/config/env loads.
// The keys are generated for this run only.
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.DIGEST_CRON_SECRET = 'digest-secret-for-tests-0123456789abcdef';
