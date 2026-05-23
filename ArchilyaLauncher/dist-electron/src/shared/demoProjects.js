"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_DEMO_PROJECT_ID = void 0;
exports.getBuiltInDemoProjects = getBuiltInDemoProjects;
exports.BUILT_IN_DEMO_PROJECT_ID = 'archilya-villa-demo';
function getBuiltInDemoProjects() {
    return [
        {
            id: exports.BUILT_IN_DEMO_PROJECT_ID,
            title: 'Archilya Villa Demo',
            map_name: '002_Main_Map_vr',
            vrMapName: '002_Main_Map_vr',
            webShareMapName: '002_Main_Map',
            files: [],
            isBuiltInDemo: true,
            isEmbedded: true,
        },
    ];
}
