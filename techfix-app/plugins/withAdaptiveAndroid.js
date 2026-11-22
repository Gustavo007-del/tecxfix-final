const { withAndroidManifest } = require('expo/config-plugins');

// Remove the orientation lock contributed by Google's scanner library at merge time.
module.exports = function withAdaptiveAndroid(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const application = manifest.application[0];
    const name = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
    const activities = (application.activity ??= []);
    let scanner = activities.find((activity) => activity.$['android:name'] === name);
    if (!scanner) {
      scanner = { $: { 'android:name': name } };
      activities.push(scanner);
    }
    delete scanner.$['android:screenOrientation'];
    const removed = new Set((scanner.$['tools:remove'] || '').split(',').map((s) => s.trim()).filter(Boolean));
    removed.add('android:screenOrientation');
    scanner.$['tools:remove'] = [...removed].join(',');
    return mod;
  });
};
