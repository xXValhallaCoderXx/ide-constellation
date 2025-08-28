// ... existing code ...
import type { HealthAnalysis, RiskScore } from '../../types/health-analysis.types';

/**
 * Pure domain service functions for Health Dashboard.
 * No VS Code or Node APIs should be used here.
 */
export function deriveHealthStatus(healthScore: number): { label: string; color: string } {
    // Mirror the thresholds/colors used in the legacy display service
    if (healthScore < 50) {
        return { label: 'Critical', color: '#ef4444' };
    } else if (healthScore < 70) {
        return { label: 'Needs Attention', color: '#f97316' };
    } else if (healthScore < 85) {
        return { label: 'Good', color: '#eab308' };
    }
    return { label: 'Excellent', color: '#22c55e' };
}

export function calculateAverages(analysis: HealthAnalysis): {
    avgComplexity: number;
    avgChurn: number;
    avgDependencies: number;
} {
    const scores = analysis.riskScores;
    const complexities = scores
        .map(s => s.metrics.complexity.cyclomaticComplexity || 0)
        .filter(c => c > 0);
    const churns = scores.map(s => s.metrics.churn.commitCount);
    const deps = scores.map(s => s.metrics.dependencies);

    const avgComplexity = complexities.length > 0
        ? complexities.reduce((a, b) => a + b, 0) / complexities.length
        : 0;
    const avgChurn = churns.length > 0
        ? churns.reduce((a, b) => a + b, 0) / churns.length
        : 0;
    const avgDependencies = deps.length > 0
        ? deps.reduce((a, b) => a + b, 0) / deps.length
        : 0;

    return { avgComplexity, avgChurn, avgDependencies };
}

export function generateMetricsReport(analysis: HealthAnalysis): string {
    const lines: string[] = [];
    lines.push('DETAILED METRICS REPORT');
    lines.push('==================================================');
    lines.push(`Analysis Timestamp: ${analysis.timestamp}`);
    lines.push(`Total Files: ${analysis.totalFiles}`);
    lines.push(`Health Score: ${analysis.healthScore}/100`);
    lines.push('');

    const { avgComplexity, avgChurn, avgDependencies } = calculateAverages(analysis);
    lines.push('AVERAGE METRICS:');
    lines.push(`  Cyclomatic Complexity: ${avgComplexity.toFixed(2)}`);
    lines.push(`  Churn (commits/30d): ${avgChurn.toFixed(2)}`);
    lines.push(`  Dependencies: ${avgDependencies.toFixed(2)}`);
    lines.push('');

    const topFiles = [...analysis.riskScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    lines.push('TOP 10 FILES BY RISK:');
    lines.push('Rank | File | Risk | Complexity | Churn | Deps | LOC');
    lines.push('--------------------------------------------------------------------------------');

    topFiles.forEach((risk, index) => {
        const fileName = risk.metrics.path.split('/').pop() || risk.metrics.path;
        const truncatedName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
        lines.push(
            `${(index + 1).toString().padStart(4)} | ` +
            `${truncatedName.padEnd(25)} | ` +
            `${risk.percentile.toString().padStart(3)} | ` +
            `${(risk.metrics.complexity.cyclomaticComplexity || 0).toString().padStart(10)} | ` +
            `${risk.metrics.churn.commitCount.toString().padStart(5)} | ` +
            `${risk.metrics.dependencies.toString().padStart(4)} | ` +
            `${risk.metrics.complexity.linesOfCode.toString().padStart(3)}`
        );
    });

    return lines.join('\n');
}

export function createSummaryMessage(analysis: HealthAnalysis): string {
    const criticalCount = analysis.distribution.critical;
    const highCount = analysis.distribution.high;

    if (criticalCount > 0) {
        return `Health analysis complete! Score: ${analysis.healthScore}/100. ⚠️ ${criticalCount} critical risk files need immediate attention.`;
    } else if (highCount > 0) {
        return `Health analysis complete! Score: ${analysis.healthScore}/100. 📊 ${highCount} high risk files should be prioritized.`;
    } else if (analysis.healthScore > 85) {
        return `Health analysis complete! Score: ${analysis.healthScore}/100. ✨ Excellent codebase health!`;
    } else {
        return `Health analysis complete! Score: ${analysis.healthScore}/100. Check the analysis panel for recommendations.`;
    }
}

export function exportToJSON(analysis: HealthAnalysis): string {
    return JSON.stringify(analysis, null, 2);
}

export function exportToCSV(analysis: HealthAnalysis): string {
    const headers = [
        'File Path',
        'Risk Category',
        'Risk Score',
        'Risk Percentile',
        'Lines of Code',
        'Cyclomatic Complexity',
        'Commit Count',
        'Unique Authors',
        'Days Since Change',
        'Dependencies'
    ];

    const rows = analysis.riskScores.map((risk: RiskScore) => [
        risk.metrics.path,
        risk.category,
        risk.score.toFixed(3),
        risk.percentile.toString(),
        risk.metrics.complexity.linesOfCode.toString(),
        (risk.metrics.complexity.cyclomaticComplexity || 0).toString(),
        risk.metrics.churn.commitCount.toString(),
        risk.metrics.churn.uniqueAuthors.toString(),
        risk.metrics.churn.daysSinceLastChange.toString(),
        risk.metrics.dependencies.toString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function formatAnalysisLogLines(analysis: HealthAnalysis): string[] {
    const lines: string[] = [];
    const log = (s: string) => lines.push(s);

    log('============================================================');
    log('CODEBASE HEALTH ANALYSIS RESULTS');
    log('============================================================');
    log(`Timestamp: ${new Date(analysis.timestamp).toLocaleString()}`);
    log(`Total Files Analyzed: ${analysis.totalFiles}`);
    log(`Overall Health Score: ${analysis.healthScore}/100`);
    log('');

    log('RISK DISTRIBUTION:');
    const pct = (n: number) => (analysis.totalFiles > 0 ? Math.round((n / analysis.totalFiles) * 100) : 0);
    log(`  Critical: ${analysis.distribution.critical} files (${pct(analysis.distribution.critical)}%)`);
    log(`  High:     ${analysis.distribution.high} files (${pct(analysis.distribution.high)}%)`);
    log(`  Medium:   ${analysis.distribution.medium} files (${pct(analysis.distribution.medium)}%)`);
    log(`  Low:      ${analysis.distribution.low} files (${pct(analysis.distribution.low)}%)`);
    log('');

    if (analysis.topRisks.length > 0) {
        log('TOP RISK FILES:');
        analysis.topRisks.forEach((risk, index) => {
            log(`  ${index + 1}. ${risk.metrics.path} (${risk.category.toUpperCase()}, ${risk.percentile}th percentile)`);
            log(`     Complexity: ${risk.metrics.complexity.cyclomaticComplexity || 'N/A'}, Churn: ${risk.metrics.churn.commitCount} commits, Dependencies: ${risk.metrics.dependencies}`);
        });
        log('');
    }

    if (analysis.recommendations.length > 0) {
        log('RECOMMENDATIONS:');
        analysis.recommendations.forEach((rec, index) => {
            const cleanRec = rec.replace(/[📊🚨⚠️🔧📝🔄📏✨💚🧮🏛️🚀📚📈🎉🎯📋🐌📅🔄✅]/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
            log(`  ${index + 1}. ${cleanRec}`);
        });
        log('');
    }

    log('============================================================');
    return lines;
}
// ... existing code ...