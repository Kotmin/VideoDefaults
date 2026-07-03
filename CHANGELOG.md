# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

## [0.0.2] - 2026-07-03

### Fixed
- Declared `browser_specific_settings.gecko.data_collection_permissions` (`required: ["none"]`), required by AMO for all new submissions.
- Raised `strict_min_version` to 140.0 (gecko) and added `gecko_android.strict_min_version` 142.0, the minimum versions that support `data_collection_permissions`.
- Bumped `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` to their Node24-native majors in CI, clearing the Node20 deprecation warning.
