/** Environnement de test. Aucune de ces valeurs n'est utilisée en production. */
const env = process.env as Record<string, string>;
env.NODE_ENV = "test";
env.DATABASE_URL = "file:./test.db";
env.APP_SECRET = "test-secret-de-48-octets-minimum-pour-les-tests-xx";
env.STORAGE_ROOT = "./var/test-storage";
env.MAX_UPLOAD_MB = "25";
env.APP_URL = "http://localhost:3000";
