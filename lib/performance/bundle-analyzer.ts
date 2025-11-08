/**
 * Bundle Size Analysis Utility
 *
 * Provides tools for analyzing, monitoring, and optimizing bundle size.
 * Identifies large dependencies, suggests optimizations, and tracks trends.
 */

export interface BundleEntry {
  name: string;
  size: number; // bytes
  gzipSize: number; // gzipped bytes
  type: "module" | "library" | "component" | "other";
  chunks: string[];
  risk: "safe" | "warning" | "critical"; // risk level
}

export interface BundleAnalysis {
  totalSize: number;
  totalGzipSize: number;
  modules: BundleEntry[];
  largestModules: BundleEntry[]; // Top 10
  timestamp: number;
  warnings: string[];
  recommendations: string[];
}

/**
 * Size thresholds (in bytes)
 */
export const SIZE_THRESHOLDS = {
  LIBRARY_SAFE: 50 * 1024, // 50 KB - safe for any library
  LIBRARY_WARNING: 100 * 1024, // 100 KB - warning level
  LIBRARY_CRITICAL: 200 * 1024, // 200 KB - critical
  CHUNK_SAFE: 200 * 1024, // 200 KB - safe chunk size
  CHUNK_WARNING: 500 * 1024, // 500 KB - warning level
  CHUNK_CRITICAL: 1000 * 1024, // 1 MB - critical
};

/**
 * Get risk level for a module based on size
 */
export function getRiskLevel(
  size: number,
  isLibrary: boolean = true
): "safe" | "warning" | "critical" {
  const thresholds = isLibrary ? SIZE_THRESHOLDS : SIZE_THRESHOLDS;

  if (size <= thresholds.LIBRARY_SAFE) return "safe";
  if (size <= thresholds.LIBRARY_WARNING) return "warning";
  return "critical";
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(
  uncompressed: number,
  compressed: number
): number {
  if (uncompressed === 0) return 0;
  return (1 - compressed / uncompressed) * 100;
}

/**
 * Analyze bundle and generate recommendations
 */
export function analyzeBundle(modules: BundleEntry[]): BundleAnalysis {
  const totalSize = modules.reduce((sum, m) => sum + m.size, 0);
  const totalGzipSize = modules.reduce((sum, m) => sum + m.gzipSize, 0);

  const largestModules = [...modules]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Analyze total bundle size
  if (totalGzipSize > SIZE_THRESHOLDS.CHUNK_CRITICAL) {
    warnings.push(
      `Total gzipped bundle size (${formatBytes(totalGzipSize)}) exceeds critical threshold`
    );
    recommendations.push("Implement aggressive code splitting or lazy loading");
  } else if (totalGzipSize > SIZE_THRESHOLDS.CHUNK_WARNING) {
    warnings.push(
      `Total gzipped bundle size (${formatBytes(totalGzipSize)}) is above recommended threshold`
    );
    recommendations.push("Consider code splitting for non-critical routes");
  }

  // Analyze largest modules
  for (const module of largestModules) {
    if (module.risk === "critical") {
      warnings.push(
        `${module.name} (${formatBytes(module.size)}) is critically large`
      );

      if (module.type === "library") {
        recommendations.push(`Consider alternatives to ${module.name} or lazy load it`);
      } else if (module.type === "component") {
        recommendations.push(
          `Split ${module.name} into smaller components or lazy load`
        );
      }
    } else if (module.risk === "warning") {
      warnings.push(
        `${module.name} (${formatBytes(module.size)}) is larger than recommended`
      );
    }
  }

  // Check for duplicate modules
  const moduleNames = modules.map((m) => m.name);
  const duplicates = moduleNames.filter(
    (name, index) => moduleNames.indexOf(name) !== index
  );
  if (duplicates.length > 0) {
    warnings.push(`Found ${duplicates.length} duplicate modules`);
    recommendations.push("Remove duplicate modules to reduce bundle size");
  }

  // Compression ratio check
  const compressionRatio = getCompressionRatio(totalSize, totalGzipSize);
  if (compressionRatio < 50) {
    warnings.push(`Compression ratio (${compressionRatio.toFixed(1)}%) is low`);
    recommendations.push("Check for uncompressed assets or verify gzip is enabled");
  }

  return {
    totalSize,
    totalGzipSize,
    modules,
    largestModules,
    timestamp: Date.now(),
    warnings,
    recommendations,
  };
}

/**
 * Generate bundle report as markdown
 */
export function generateBundleReport(analysis: BundleAnalysis): string {
  const compressionRatio = getCompressionRatio(
    analysis.totalSize,
    analysis.totalGzipSize
  );

  let report = `# Bundle Analysis Report\n\n`;
  report += `**Generated:** ${new Date(analysis.timestamp).toLocaleString()}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Size | ${formatBytes(analysis.totalSize)} |\n`;
  report += `| Gzipped Size | ${formatBytes(analysis.totalGzipSize)} |\n`;
  report += `| Compression Ratio | ${compressionRatio.toFixed(1)}% |\n`;
  report += `| Module Count | ${analysis.modules.length} |\n\n`;

  report += `## Top 10 Largest Modules\n\n`;
  report += `| Rank | Name | Size | Gzipped | Type | Risk |\n`;
  report += `|------|------|------|---------|------|------|\n`;

  analysis.largestModules.forEach((module, index) => {
    report += `| ${index + 1} | ${module.name} | ${formatBytes(module.size)} | ${formatBytes(module.gzipSize)} | ${module.type} | ${module.risk} |\n`;
  });
  report += `\n`;

  if (analysis.warnings.length > 0) {
    report += `## Warnings\n\n`;
    analysis.warnings.forEach((warning) => {
      report += `- ⚠️ ${warning}\n`;
    });
    report += `\n`;
  }

  if (analysis.recommendations.length > 0) {
    report += `## Recommendations\n\n`;
    analysis.recommendations.forEach((rec) => {
      report += `- 💡 ${rec}\n`;
    });
    report += `\n`;
  }

  return report;
}

/**
 * Generate bundle report as JSON
 */
export function exportBundleAnalysisAsJSON(
  analysis: BundleAnalysis
): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Check if bundle has grown significantly
 */
export function checkBundleGrowth(
  current: BundleAnalysis,
  baseline: BundleAnalysis,
  threshold: number = 0.1 // 10% growth
): {
  hasGrown: boolean;
  growthPercentage: number;
  newSize: number;
  baselineSize: number;
} {
  const growthPercentage =
    (current.totalGzipSize - baseline.totalGzipSize) /
    baseline.totalGzipSize;
  const hasGrown = growthPercentage > threshold;

  return {
    hasGrown,
    growthPercentage: growthPercentage * 100,
    newSize: current.totalGzipSize,
    baselineSize: baseline.totalGzipSize,
  };
}

/**
 * Get bundle optimization tips
 */
export function getBundleOptimizationTips(): string[] {
  return [
    "✅ Enable gzip compression on your server",
    "✅ Use dynamic imports for route-based code splitting",
    "✅ Lazy load images with native `loading='lazy'`",
    "✅ Remove unused dependencies regularly",
    "✅ Use tree-shaking with ES modules",
    "✅ Consider using lighter alternatives (e.g., date-fns vs moment.js)",
    "✅ Minify and compress CSS and JavaScript",
    "✅ Inline critical CSS for above-the-fold content",
    "✅ Use service workers for caching",
    "✅ Monitor bundle size with continuous integration",
    "✅ Profile your app with DevTools to find bottlenecks",
    "✅ Use production builds for accurate measurements",
    "✅ Consider using Web Workers for heavy computation",
    "✅ Audit third-party scripts and their impact",
    "✅ Use Next.js Image Optimization",
  ];
}

/**
 * Common bundle optimization patterns
 */
export const OPTIMIZATION_PATTERNS = {
  CODE_SPLITTING: {
    name: "Code Splitting",
    description: "Split code into smaller chunks for lazy loading",
    impact: "20-40% reduction",
    implementation: `
// Use dynamic imports for route-based splitting
const Dashboard = dynamic(() => import('./dashboard'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});
    `,
  },
  TREE_SHAKING: {
    name: "Tree Shaking",
    description: "Remove unused code from dependencies",
    impact: "10-30% reduction",
    implementation: `
// Use ES modules and named imports
import { format } from 'date-fns'; // instead of import * from

// Configure tsconfig.json
"lib": ["es2020"],
"module": "es2020",
    `,
  },
  LAZY_LOADING: {
    name: "Lazy Loading",
    description: "Load components/images only when needed",
    impact: "15-35% reduction",
    implementation: `
// Use dynamic imports for components
import dynamic from 'next/dynamic';
const HeavyComponent = dynamic(() => import('./heavy'), {
  ssr: false
});

// Use native image lazy loading
<img loading="lazy" src="..." />
    `,
  },
  LIBRARY_REPLACEMENT: {
    name: "Library Replacement",
    description: "Replace heavy libraries with lighter alternatives",
    impact: "20-50% reduction for specific library",
    examples: [
      "moment.js (266 KB) → date-fns (13 KB)",
      "lodash (70 KB) → lodash-es with tree-shaking (20 KB)",
      "axios (14 KB) → fetch API (0 KB)",
      "dayjs (2 KB) → date-fns with tree-shaking (3 KB)",
    ],
  },
};
