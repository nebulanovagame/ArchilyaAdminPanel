const fs = require('fs');

const original = fs.readFileSync('C:/NNG/proje61/archilya-web/functions/index.js.backup', 'utf8').split('\n');
const sharedNames = JSON.parse(fs.readFileSync('C:/NNG/proje61/archilya-web/functions/src/_shared-exports.json', 'utf8'));

const domains = {
  'ai-jobs': [
    { name: 'createAiStudioJobSecure', start: 3547, end: 3684 },
    { name: 'processAiStudioJob', start: 3685, end: 3839 },
    { name: 'runAiStudioToolSecure', start: 3840, end: 4061 },
    { name: 'runAiRevisionSecure', start: 4062, end: 4233 },
  ],
  'credits': [
    { name: 'deductCredits', start: 2359, end: 2395 },
    { name: 'refundCredits', start: 2396, end: 2427 },
    { name: 'deductWorkspacePoolCredits', start: 2769, end: 2799 },
    { name: 'refundWorkspacePoolCredits', start: 2800, end: 2821 },
  ],
  'workspaces': [
    { name: 'createWorkspaceSecure', start: 2698, end: 2752 },
    { name: 'inviteWorkspaceMemberSecure', start: 4371, end: 4465 },
    { name: 'acceptWorkspaceInviteSecure', start: 4467, end: 4581 },
    { name: 'declineWorkspaceInviteSecure', start: 4583, end: 4616 },
    { name: 'removeWorkspaceMemberSecure', start: 4618, end: 4655 },
    { name: 'deleteWorkspaceSecure', start: 4657, end: 4713 },
    { name: 'adjustWorkspaceStorage', start: 2822, end: 2857 },
  ],
  'projects': [
    { name: 'createProjectSecure', start: 1980, end: 2030 },
    { name: 'updateProjectSecure', start: 2031, end: 2081 },
    { name: 'sendProjectInviteSecure', start: 4715, end: 4819 },
    { name: 'acceptProjectInviteSecure', start: 4820, end: 4886 },
    { name: 'declineProjectInviteSecure', start: 4887, end: 4919 },
    { name: 'createProjectFolderSecure', start: 5029, end: 5073 },
    { name: 'addProjectFileSecure', start: 5074, end: 5113 },
    { name: 'moveProjectFileToTrashSecure', start: 5114, end: 5160 },
    { name: 'saveAiOutputToProjectSecure', start: 5161, end: 5281 },
    { name: 'softDeleteProjectSecure', start: 5282, end: 5301 },
    { name: 'restoreProjectSecure', start: 5302, end: 5321 },
    { name: 'hardDeleteProjectSecure', start: 5322, end: 5336 },
    { name: 'restoreProjectFileSecure', start: 5337, end: 5372 },
    { name: 'permanentlyDeleteProjectFileSecure', start: 5373, end: 5401 },
  ],
  'payments': [
    { name: 'upgradeSubscription', start: 2428, end: 2470 },
    { name: 'createIyzicoCheckoutForm', start: 2471, end: 2593 },
    { name: 'verifyIyzicoPayment', start: 2594, end: 2697 },
  ],
  'notifications': [
    { name: 'registerPushTokenSecure', start: 2139, end: 2162 },
    { name: 'markNotificationReadSecure', start: 2163, end: 2201 },
    { name: 'markAllNotificationsReadSecure', start: 2202, end: 2241 },
  ],
  'ai-legacy': [
    { name: 'getAiPromptHistorySecure', start: 2082, end: 2099 },
    { name: 'saveAiPromptHistorySecure', start: 2100, end: 2138 },
    { name: 'logAiHistoryEntrySecure', start: 2256, end: 2297 },
    { name: 'updateAiHistoryEntrySecure', start: 2298, end: 2358 },
    { name: 'transformImage', start: 5991, end: 6061 },
    { name: 'archRenderPipeline', start: 6067, end: 6191 },
    { name: 'generateArchitecturalContent', start: 6195, end: 6262 },
    { name: 'chatWithArchilyaAI', start: 6265, end: 6320 },
  ],
  'r2-admin': [
    { name: 'createR2UploadUrlAdminSecure', start: 5402, end: 5468 },
    { name: 'deleteR2ObjectAdminSecure', start: 5469, end: 5501 },
    { name: 'resolveR2TargetAdminSecure', start: 5502, end: 5522 },
  ],
  'r2-user': [
    { name: 'createR2UploadUrlSecure', start: 5523, end: 5588 },
    { name: 'createR2DownloadUrlSecure', start: 5589, end: 5630 },
    { name: 'createR2ProductDownloadUrlSecure', start: 5631, end: 5675 },
    { name: 'deleteR2ObjectSecure', start: 5676, end: 5706 },
  ],
  'contact': [
    { name: 'submitContactFormSecure', start: 5707, end: 5811 },
  ],
  'legacy': [
    { name: 'ensureUserProfile', start: 1971, end: 1979 },
    { name: 'deleteAccountSecure', start: 5812, end: 5940 },
  ],
};

for (const [domain, exports] of Object.entries(domains)) {
  const exportLines = [];
  for (const exp of exports) {
    for (let i = exp.start - 1; i < exp.end; i++) {
      exportLines.push(original[i]);
    }
  }
  const body = exportLines.join('\n');
  
  const usedNames = [];
  for (const name of sharedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(?<![a-zA-Z0-9_$_.])' + escaped + '(?![a-zA-Z0-9_$])', 'g');
    if (regex.test(body)) {
      usedNames.push(name);
    }
  }
  
  const importLines = [
    `const { onCall, HttpsError } = require('firebase-functions/v2/https');`,
    `const { onTaskDispatched } = require('firebase-functions/v2/tasks');`,
    `const shared = require('../shared');`,
    `const { ${usedNames.join(', ')} } = shared;`,
    ``,
  ];
  
  const content = importLines.join('\n') + body;
  fs.writeFileSync(`C:/NNG/proje61/archilya-web/functions/src/${domain}/index.js`, content);
  console.log(`${domain}: ${usedNames.length} imports, ${exports.length} exports`);
}
console.log('Done');
