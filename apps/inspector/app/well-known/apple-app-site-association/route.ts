const TEAM_ID = 'KQ997HDJ7H';
const BUNDLE_ID = 'com.crossub.inspector';

const association = {
  applinks: {
    apps: [],
    details: [
      {
        appID: `${TEAM_ID}.${BUNDLE_ID}`,
        paths: ['/login/*', '/reset-password/*'],
      },
    ],
  },
};

export function GET() {
  return Response.json(association);
}
