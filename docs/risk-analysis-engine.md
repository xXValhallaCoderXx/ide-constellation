# Risk Analysis Engine

## Overview

The Risk Analysis Engine provides comprehensive codebase health assessment by analyzing code complexity, git churn patterns, and dependency relationships. It generates unified health scores and actionable recommendations to help developers identify problematic areas in their codebase.

## Features

- **Comprehensive Health Scoring**: Percentile-based risk calculation with weighted metrics (40% complexity, 40% churn, 20% dependencies)
- **Performance Optimized**: Multi-level caching, batch processing, and memory management for large codebases
- **Graceful Degradation**: Fallback mechanisms for missing git history and file access issues
- **Rich Visualizations**: Interactive HTML webview with VS Code theming and file navigation
- **Actionable Insights**: Smart recommendations based on hotspot detection and statistical analysis

## Usage

### Basic Health Analysis

1. Run `Constellation: Scan Project` to generate the dependency graph
2. Run `Constellation: Analyze Codebase Health` to perform health analysis
3. View results in the interactive webview panel

### Command Integration

The engine integrates with VS Code through the command palette:

- `Constellation: Analyze Codebase Health` - Performs complete codebase analysis

## Architecture

### Core Services

- **HealthAnalyzer**: Main orchestration service with singleton pattern
- **ComplexityAnalyzer**: Code complexity analysis for TypeScript/JavaScript
- **GitAnalyzer**: Git history and churn analysis with fallback support
- **MetricsCache**: High-performance caching with TTL support
- **RecommendationsEngine**: Actionable insights and hotspot detection
- **Health Dashboard**: Preact UI [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx) powered by [HealthDashboardProvider](src/webview/providers/health-dashboard.provider.ts) with domain logic in [health.services.ts](src/services/health/health.services.ts)

### Performance Features

- **Batch Processing**: Processes files in configurable batches (default: 50 files)
- **Multi-level Caching**: Complexity (1 week), churn (1 day), analysis (1 hour) TTLs
- **Memory Management**: Automatic garbage collection and resource monitoring
- **Error Recovery**: Comprehensive error handling with graceful degradation

### Risk Calculation

Risk scores are calculated using percentile-based normalization:

- **Complexity Weight**: 40% (cyclomatic complexity, lines of code)
- **Churn Weight**: 40% (commit frequency, author diversity)
- **Dependencies Weight**: 20% (incoming + outgoing dependencies)

Files are categorized as:

- **Low Risk**: 0-25th percentile (green)
- **Medium Risk**: 25-50th percentile (yellow)
- **High Risk**: 50-75th percentile (orange)
- **Critical Risk**: 75-100th percentile (red)

## Integration

### GraphService Integration

The engine integrates with the existing GraphService infrastructure:

- Uses constellation graph data for dependency analysis
- Leverages reverse dependency indexing for performance
- Validates graph structure before analysis

### Caching Strategy

- **Complexity Metrics**: Cached for 1 week (code structure changes infrequently)
- **Churn Metrics**: Cached for 1 day (git history changes daily)
- **Full Analysis**: Cached for 1 hour (combined results change more frequently)

## Error Handling

The engine provides comprehensive error handling:

- **Git Fallback**: Uses file system metadata when git is unavailable
- **File Access**: Graceful handling of permission and access issues
- **Memory Management**: Automatic batch size reduction on memory pressure
- **Resource Monitoring**: System resource checks with optimization suggestions

## Output Formats

- **Health Dashboard**: Preact-based panel UI with VS Code theming
- **Console Logging**: Structured output with detailed metrics
- **Export Options**: JSON and CSV formats for external analysis
- **Summary Notifications**: User-friendly progress and completion messages

## Performance Targets

- **Analysis Speed**: 2 seconds for 1,500 files
- **Cache Performance**: Sub-500ms for cached results
- **Memory Usage**: Under 100MB during analysis
- **Batch Processing**: Configurable batch sizes with automatic adjustment
