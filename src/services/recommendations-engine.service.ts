import { HealthAnalysis, RiskScore } from '../types/health-analysis.types';

/**
 * Service for generating actionable recommendations and insights
 * 
 * Analyzes health analysis results to identify hotspots, generate
 * specific refactoring recommendations, and provide interesting
 * statistics about codebase health patterns.
 */
export class RecommendationsEngine {

  /**
   * Generate comprehensive recommendations based on health analysis
   * @param analysis Complete health analysis results
   * @returns Array of actionable recommendation strings
   */
  generateRecommendations(analysis: HealthAnalysis): string[] {
    const recommendations: string[] = [];

    // Generate hotspot-based recommendations
    const hotspotRecommendations = this.generateHotspotRecommendations(analysis);
    recommendations.push(...hotspotRecommendations);

    // Generate statistical insights
    const statisticalInsights = this.generateStatisticalInsights(analysis);
    recommendations.push(...statisticalInsights);

    // Generate fun facts and patterns
    const funFacts = this.generateFunFacts(analysis);
    recommendations.push(...funFacts);

    // Generate priority recommendations
    const priorityRecommendations = this.generatePriorityRecommendations(analysis);
    recommendations.push(...priorityRecommendations);

    // Ensure we always have at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push('✅ Your codebase appears to be in good health! Keep up the good work with regular refactoring and code reviews.');
    }

    return recommendations;
  }

  /**
   * Generate recommendations based on identified hotspots
   * @param analysis Health analysis results
   * @returns Array of hotspot-based recommendations
   */
  private generateHotspotRecommendations(analysis: HealthAnalysis): string[] {
    const recommendations: string[] = [];
    const hotspots = this.findHotspots(analysis.riskScores);

    if (hotspots.length === 0) {
      return recommendations;
    }

    // Generate specific recommendations for each hotspot
    for (const hotspot of hotspots.slice(0, 3)) { // Limit to top 3 hotspots
      const recommendation = this.generateHotspotRecommendation(hotspot);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Add general hotspot summary if we have many
    if (hotspots.length > 3) {
      recommendations.push(
        `🔥 You have ${hotspots.length} high-risk files that need attention. Focus on the most critical ones first.`
      );
    }

    return recommendations;
  }

  /**
   * Find hotspot files with high complexity and frequent changes
   * @param riskScores Array of all risk scores
   * @returns Array of hotspot risk scores
   */
  private findHotspots(riskScores: RiskScore[]): RiskScore[] {
    return riskScores
      .filter(score => {
        // High risk files with both complexity and churn issues
        const hasHighComplexity = (score.metrics.complexity.cyclomaticComplexity || 0) > 10;
        const hasHighChurn = score.metrics.churn.commitCount > 5;
        const isHighRisk = score.category === 'high' || score.category === 'critical';
        
        return isHighRisk && (hasHighComplexity || hasHighChurn);
      })
      .sort((a, b) => b.score - a.score); // Sort by risk score descending
  }

  /**
   * Generate specific recommendation for a hotspot file
   * @param hotspot Risk score for the hotspot file
   * @returns Specific recommendation string or null
   */
  private generateHotspotRecommendation(hotspot: RiskScore): string | null {
    const { metrics } = hotspot;
    const fileName = metrics.path.split('/').pop() || metrics.path;
    const complexity = metrics.complexity.cyclomaticComplexity || 0;
    const churn = metrics.churn.commitCount;
    const linesOfCode = metrics.complexity.linesOfCode;

    // Determine primary issue
    const isComplexityIssue = complexity > 10;
    const isChurnIssue = churn > 5;
    const isSizeIssue = linesOfCode > 500;

    if (isComplexityIssue && isChurnIssue) {
      return `🚨 **${fileName}** is a critical hotspot with high complexity (${complexity}) and frequent changes (${churn} commits). Consider breaking it into smaller, focused modules.`;
    } else if (isComplexityIssue && isSizeIssue) {
      return `⚠️ **${fileName}** has high complexity (${complexity}) and is large (${linesOfCode} LOC). Consider extracting functions or splitting into multiple files.`;
    } else if (isComplexityIssue) {
      return `🔧 **${fileName}** has high cyclomatic complexity (${complexity}). Consider simplifying conditional logic and extracting helper functions.`;
    } else if (isChurnIssue && isSizeIssue) {
      return `📝 **${fileName}** changes frequently (${churn} commits) and is large (${linesOfCode} LOC). This suggests it may have too many responsibilities.`;
    } else if (isChurnIssue) {
      return `🔄 **${fileName}** changes very frequently (${churn} commits). Consider if this file has a clear, single responsibility.`;
    } else if (isSizeIssue) {
      return `📏 **${fileName}** is quite large (${linesOfCode} LOC). Consider breaking it into smaller, more focused modules.`;
    }

    return null;
  }

  /**
   * Generate statistical insights about the codebase
   * @param analysis Health analysis results
   * @returns Array of statistical insight strings
   */
  private generateStatisticalInsights(analysis: HealthAnalysis): string[] {
    const insights: string[] = [];
    const { distribution, riskScores, totalFiles } = analysis;

    // Distribution insights
    const criticalPercentage = Math.round((distribution.critical / totalFiles) * 100);
    const highPercentage = Math.round((distribution.high / totalFiles) * 100);
    const lowPercentage = Math.round((distribution.low / totalFiles) * 100);

    if (criticalPercentage > 10) {
      insights.push(`📊 ${criticalPercentage}% of your files are in critical condition. This is higher than the recommended 5% threshold.`);
    } else if (criticalPercentage === 0 && highPercentage < 20) {
      insights.push(`✨ Excellent! You have no critical risk files and only ${highPercentage}% high-risk files.`);
    }

    if (lowPercentage > 60) {
      insights.push(`💚 Great news! ${lowPercentage}% of your files are low-risk, indicating a healthy codebase foundation.`);
    }

    // Complexity insights
    const avgComplexity = this.calculateAverageComplexity(riskScores);
    if (avgComplexity > 15) {
      insights.push(`🧮 Your average cyclomatic complexity is ${avgComplexity.toFixed(1)}, which is above the recommended threshold of 10.`);
    }

    // Churn insights
    const churnInsight = this.generateChurnInsight(riskScores);
    if (churnInsight) {
      insights.push(churnInsight);
    }

    return insights;
  }

  /**
   * Generate fun facts and interesting patterns
   * @param analysis Health analysis results
   * @returns Array of fun fact strings
   */
  private generateFunFacts(analysis: HealthAnalysis): string[] {
    const facts: string[] = [];
    const { riskScores } = analysis;

    // Find the most stable file (lowest churn)
    const mostStable = riskScores
      .filter(score => score.metrics.churn.daysSinceLastChange < 999)
      .sort((a, b) => b.metrics.churn.daysSinceLastChange - a.metrics.churn.daysSinceLastChange)[0];

    if (mostStable && mostStable.metrics.churn.daysSinceLastChange > 90) {
      const fileName = mostStable.metrics.path.split('/').pop() || mostStable.metrics.path;
      facts.push(`🏛️ **${fileName}** is your most stable file - it hasn't been changed in ${mostStable.metrics.churn.daysSinceLastChange} days!`);
    }

    // Find the busiest file (highest churn)
    const busiest = riskScores
      .sort((a, b) => b.metrics.churn.commitCount - a.metrics.churn.commitCount)[0];

    if (busiest && busiest.metrics.churn.commitCount > 10) {
      const fileName = busiest.metrics.path.split('/').pop() || busiest.metrics.path;
      facts.push(`🚀 **${fileName}** is your busiest file with ${busiest.metrics.churn.commitCount} commits in the last 30 days!`);
    }

    // Find the largest file
    const largest = riskScores
      .sort((a, b) => b.metrics.complexity.linesOfCode - a.metrics.complexity.linesOfCode)[0];

    if (largest && largest.metrics.complexity.linesOfCode > 200) {
      const fileName = largest.metrics.path.split('/').pop() || largest.metrics.path;
      facts.push(`📚 **${fileName}** is your largest file with ${largest.metrics.complexity.linesOfCode} lines of code.`);
    }

    // Total lines of code
    const totalLOC = riskScores.reduce((sum, score) => sum + score.metrics.complexity.linesOfCode, 0);
    if (totalLOC > 1000) {
      facts.push(`📈 Your codebase contains ${totalLOC.toLocaleString()} lines of code across ${riskScores.length} files.`);
    }

    return facts;
  }

  /**
   * Generate priority-based recommendations
   * @param analysis Health analysis results
   * @returns Array of priority recommendation strings
   */
  private generatePriorityRecommendations(analysis: HealthAnalysis): string[] {
    const recommendations: string[] = [];
    const { healthScore, distribution, totalFiles } = analysis;

    // Overall health recommendations
    if (healthScore < 50) {
      recommendations.push(`🚨 **Priority 1**: Your overall health score is ${healthScore}/100. Focus on reducing complexity in your highest-risk files.`);
    } else if (healthScore < 70) {
      recommendations.push(`⚠️ **Priority 2**: Your health score is ${healthScore}/100. Consider regular refactoring sessions to improve code quality.`);
    } else if (healthScore > 85) {
      recommendations.push(`🎉 **Excellent**: Your health score is ${healthScore}/100. Keep up the great work!`);
    }

    // Distribution-based recommendations
    const criticalCount = distribution.critical;
    const highCount = distribution.high;

    if (criticalCount > 0) {
      recommendations.push(`🎯 **Immediate Action**: Address ${criticalCount} critical-risk files first - they pose the highest maintenance burden.`);
    }

    if (highCount > totalFiles * 0.25) {
      recommendations.push(`📋 **Medium Priority**: You have ${highCount} high-risk files (${Math.round((highCount/totalFiles)*100)}% of codebase). Plan refactoring sprints to address these systematically.`);
    }

    return recommendations;
  }

  /**
   * Calculate average cyclomatic complexity across all files
   * @param riskScores Array of risk scores
   * @returns Average complexity value
   */
  private calculateAverageComplexity(riskScores: RiskScore[]): number {
    const complexities = riskScores
      .map(score => score.metrics.complexity.cyclomaticComplexity || 0)
      .filter(complexity => complexity > 0);

    if (complexities.length === 0) {
      return 0;
    }

    return complexities.reduce((sum, complexity) => sum + complexity, 0) / complexities.length;
  }

  /**
   * Generate insights about churn patterns
   * @param riskScores Array of risk scores
   * @returns Churn insight string or null
   */
  private generateChurnInsight(riskScores: RiskScore[]): string | null {
    const filesWithChurn = riskScores.filter(score => score.metrics.churn.commitCount > 0);
    
    if (filesWithChurn.length === 0) {
      return '📅 No recent changes detected in the analyzed timeframe.';
    }

    const totalCommits = filesWithChurn.reduce((sum, score) => sum + score.metrics.churn.commitCount, 0);
    const avgCommitsPerFile = totalCommits / filesWithChurn.length;

    if (avgCommitsPerFile > 5) {
      return `🔄 High activity detected: ${filesWithChurn.length} files have been modified with an average of ${avgCommitsPerFile.toFixed(1)} commits per file.`;
    } else if (avgCommitsPerFile < 1) {
      return `🐌 Low activity: Your codebase appears stable with minimal recent changes.`;
    }

    return null;
  }

  /**
   * Generate recommendations for specific risk categories
   * @param analysis Health analysis results
   * @param category Risk category to focus on
   * @returns Array of category-specific recommendations
   */
  generateCategoryRecommendations(analysis: HealthAnalysis, category: 'low' | 'medium' | 'high' | 'critical'): string[] {
    const categoryFiles = analysis.riskScores.filter(score => score.category === category);
    const recommendations: string[] = [];

    switch (category) {
      case 'critical':
        recommendations.push(`🚨 Critical files require immediate attention. Consider pair programming or code reviews for changes to these files.`);
        break;
      case 'high':
        recommendations.push(`⚠️ High-risk files should be prioritized for refactoring in upcoming sprints.`);
        break;
      case 'medium':
        recommendations.push(`📝 Medium-risk files are good candidates for gradual improvement during regular development.`);
        break;
      case 'low':
        recommendations.push(`✅ Low-risk files are in good shape. Use them as examples of good code structure.`);
        break;
    }

    if (categoryFiles.length > 0) {
      const avgComplexity = this.calculateAverageComplexity(categoryFiles);
      if (avgComplexity > 0) {
        recommendations.push(`📊 Average complexity for ${category}-risk files: ${avgComplexity.toFixed(1)}`);
      }
    }

    return recommendations;
  }
}