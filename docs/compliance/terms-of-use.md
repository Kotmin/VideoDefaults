# Terms of Use — VideoDefaults

**Last updated:** 2026-07-03

These terms govern your use of the VideoDefaults browser extension. See `docs/compliance/privacy.md` for what data is (and isn't) collected, and the `LICENSE` file for the terms governing the source code itself. These terms cover the shipped extension as a *user*, not as a developer.

## What VideoDefaults Does

VideoDefaults applies a playback speed you configure to YouTube videos automatically, and lets you change it manually at any time via the popup. See `docs/compliance/youtube-policy-posture.md` for the full technical description of its behaviour.

## Your Responsibility

Playback speed values between 0.25× and 4× are exposed by YouTube's own native player controls, and VideoDefaults only ever sets the standard `video.playbackRate` property that those controls also use — it does not unlock, bypass, or exceed anything YouTube itself doesn't already allow a signed-in user to do manually.

That said, **you are responsible for complying with YouTube's Terms of Service and any additional restriction that may apply to your specific account** — for example a managed school, workplace, or family account that restricts playback behaviour by policy rather than by the player UI. VideoDefaults assumes you are permitted to change your own playback speed; it has no way to know about account-specific restrictions and takes no responsibility if that assumption doesn't hold for your account.

## No Affiliation

VideoDefaults is an independent, unofficial project. It is not affiliated with, endorsed by, or sponsored by YouTube, Google, or Alphabet Inc.

## No Warranty

VideoDefaults is provided "as is," without warranty of any kind. To the extent permitted by law, the author is not liable for any damages or losses arising from its use, including but not limited to changes in your account standing on any platform. This mirrors the disclaimer in the source `LICENSE`.

## Intended Use

VideoDefaults is a personal convenience tool for controlling your own viewing experience. It is not intended for, and must not be used for, automating interactions with YouTube's UI, evading rate limits, or any use prohibited by YouTube's Terms of Service.

## Changes

Any future version that changes what the extension does, what data it touches, or the platforms it supports will update this document alongside the changelog entry for that release.

## Contact

Questions or concerns: https://github.com/Kotmin/VideoDefaults/issues
