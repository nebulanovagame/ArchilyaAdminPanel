const fs = require('fs');

const lines = fs.readFileSync('C:/NNG/proje61/archilya-web/functions/index.js', 'utf8').split('\n');
const exportRanges = JSON.parse(fs.readFileSync('C:/NNG/proje61/archilya-web/functions/src/_export-ranges.json', 'utf8'));

// Sort exports by start line
exportRanges.sort((a, b) => a.start - b.start);

// Domain mapping
const domainMap = {
  createAiStudioJobSecure: 'ai-jobs',
  processAiStudioJob: 'ai-jobs',
  runAiStudioToolSecure: 'ai-jobs',
  runAiRevisionSecure: 'ai-jobs',
  deductCredits: 'credits',
  refundCredits: 'credits',
  deductWorkspacePoolCredits: 'credits',
  refundWorkspacePoolCredits: 'credits',
  createWorkspaceSecure: 'workspaces',
  inviteWorkspaceMemberSecure: 'workspaces',
  acceptWorkspaceInviteSecure: 'workspaces',
  declineWorkspaceInviteSecure: 'workspaces',
  removeWorkspaceMemberSecure: 'workspaces',
  deleteWorkspaceSecure: 'workspaces',
  adjustWorkspaceStorage: 'workspaces',
  createProjectSecure: 'projects',
  updateProjectSecure: 'projects',
  sendProjectInviteSecure: 'projects',
  acceptProjectInviteSecure: 'projects',
  declineProjectInviteSecure: 'projects',
  createProjectFolderSecure: 'projects',
  addProjectFileSecure: 'projects',
  moveProjectFileToTrashSecure: 'projects',
  saveAiOutputToProjectSecure: 'projects',
  softDeleteProjectSecure: 'projects',
  restoreProjectSecure: 'projects',
  hardDeleteProjectSecure: 'projects',
  restoreProjectFileSecure: 'projects',
  permanentlyDeleteProjectFileSecure: 'projects',
  registerPushTokenSecure: 'notifications',
  markNotificationReadSecure: 'notifications',
  markAllNotificationsReadSecure: 'notifications',
  getAiPromptHistorySecure: 'ai-legacy',
  saveAiPromptHistorySecure: 'ai-legacy',
  logAiHistoryEntrySecure: 'ai-legacy',
  updateAiHistoryEntrySecure: 'ai-legacy',
  transformImage: 'ai-legacy',
  archRenderPipeline: 'ai-legacy',
  generateArchitecturalContent: 'ai-legacy',
  chatWithArchilyaAI: 'ai-legacy',
  upgradeSubscription: 'payments',
  createIyzicoCheckoutForm: 'payments',
  verifyIyzicoPayment: 'payments',
  createR2UploadUrlAdminSecure: 'r2-admin',
  deleteR2ObjectAdminSecure: 'r2-admin',
  resolveR2TargetAdminSecure: 'r2-admin',
  createR2UploadUrlSecure: 'r2-user',
  createR2DownloadUrlSecure: 'r2-user',
  createR2ProductDownloadUrlSecure: 'r2-user',
  deleteR2ObjectSecure: 'r2-user',
  submitContactFormSecure: 'contact',
  deleteAccountSecure: 'legacy',
  ensureUserProfile: 'legacy',
};

// Collect shared lines (non-export lines)
const sharedLines = [];
let lastEnd = 0;

for (const exp of exportRanges) {
  // Add lines from last end to this start
  for (let i = lastEnd; i < exp.start - 1; i++) {
    sharedLines.push(lines[i]);
  }
  lastEnd = exp.end;
}
// Add trailing lines
for (let i = lastEnd; i < lines.length; i++) {
  sharedLines.push(lines[i]);
}

fs.writeFileSync('C:/NNG/proje61/archilya-web/functions/src/shared/index.js', sharedLines.join('\n'));
console.log('src/shared/index.js: ' + sharedLines.length + ' lines');

// Extract each export into its domain file
const domainFiles = {};
for (const exp of exportRanges) {
  const domain = domainMap[exp.name] || 'legacy';
  if (!domainFiles[domain]) {
    domainFiles[domain] = [];
  }
  const exportLines = [];
  for (let i = exp.start - 1; i < exp.end; i++) {
    exportLines.push(lines[i]);
  }
  domainFiles[domain].push(`// --- ${exp.name} (lines ${exp.start}-${exp.end}) ---\n` + exportLines.join('\n'));
}

for (const [domain, chunks] of Object.entries(domainFiles)) {
  const content = `// Archilya Functions - ${domain} module\n// Auto-extracted from index.js\n\nconst { onCall, HttpsError } = require('firebase-functions/v2/https');\nconst { onTaskDispatched } = require('firebase-functions/v2/tasks');\nconst admin = require('firebase-admin');\nconst db = admin.firestore();\n\n` + chunks.join('\n\n');
  fs.writeFileSync(`C:/NNG/proje61/archilya-web/functions/src/${domain}/index.js`, content);
  console.log(`src/${domain}/index.js: ${chunks.length} exports`);
}

console.log('\nDone!');
