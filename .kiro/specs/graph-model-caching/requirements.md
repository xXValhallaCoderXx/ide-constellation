# Requirements Document

## Introduction

This feature extends the existing `constellation.scanProject` command to transform raw scanner output from dependency-cruiser into an internal Graph Domain Model and persist it to a local cache. The goal is to create a fast, efficient data layer that enables quick access to processed graph data and reverse-dependency lookups for future features.

## Requirements

### Requirement 1

**User Story:** As a Developer, I want the constellation.scanProject command to transform raw scanner output into a clean graph model, so that the data is ready for consumption by other features.

#### Acceptance Criteria

1. WHEN constellation.scanProject command completes scanning THEN the system SHALL transform raw dependency-cruiser output into IConstellationNode[] and IConstellationEdge[] arrays
2. WHEN creating nodes THEN each SHALL have id, path, label, and optional package properties
3. WHEN creating edges THEN each SHALL have source and target properties referencing node IDs
4. WHEN normalizing paths THEN the system SHALL use workspace-relative file paths as IDs
5. WHEN processing monorepo structures THEN the system SHALL populate package property for nodes

### Requirement 2

**User Story:** As a Developer, I want scan results to be cached locally, so that I can avoid re-scanning my entire project every time I run the command.

#### Acceptance Criteria

1. WHEN constellation.scanProject completes processing THEN the system SHALL save the graph to .constellation-cache/graph-v1.json
2. WHEN constellation.scanProject is executed THEN the system SHALL check for existing cache before scanning
3. WHEN key project files are newer than cache THEN the system SHALL invalidate the cache and re-scan
4. WHEN cache is valid THEN the system SHALL load from cache instead of re-scanning
5. IF package.json, pnpm-lock.yaml, or tsconfig.json are modified THEN the cache SHALL be considered invalid

### Requirement 3

**User Story:** As a Future Feature Developer, I want access to a reverse-dependency index in memory, so that I can build features that need to query file dependencies efficiently.

#### Acceptance Criteria

1. WHEN graph data is loaded (from cache or new scan) THEN the system SHALL create a reverse-dependency index in memory
2. WHEN the index is created THEN it SHALL be a Map<string, string[]> where key is target file ID and value is array of source file IDs
3. WHEN the index is built THEN the system SHALL provide a service method getDependentsOf(fileId) for O(1) lookups
4. WHEN constellation.scanProject completes THEN the reverse-dependency index SHALL be available for other services to use

