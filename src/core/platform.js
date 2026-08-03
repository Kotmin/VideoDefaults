export function isMacPlatform(nav) {
  const platform = typeof nav?.platform === 'string' ? nav.platform : '';
  const uaPlatform = typeof nav?.userAgentData?.platform === 'string' ? nav.userAgentData.platform : '';
  return /mac/i.test(platform) || /mac/i.test(uaPlatform);
}
