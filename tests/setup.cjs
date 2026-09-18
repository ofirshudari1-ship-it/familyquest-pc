// Points electron-store (via electron/store.cjs's FAMILYQUEST_TEST_STORE_DIR
// check) at a throwaway temp directory for the whole test run, so tests never
// touch a real parent/child's actual persisted data file. A fresh directory
// per process run means every `npm test` starts from a clean slate.
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'familyquest-test-'));
process.env.FAMILYQUEST_TEST_STORE_DIR = dir;
