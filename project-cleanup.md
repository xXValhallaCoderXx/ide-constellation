# Project Cleanup Plan

## Current State Analysis

The project currently has multiple overlapping components and confusing UX flows. Based on the analysis, here are the issues:

### 🔍 Current Components (Confusing State)

1. **Multiple Health Dashboards:**
   - `src/webview/panels/health/` - New enhanced dashboard (Image 1)
   - Legacy health analysis (Image 3) - Original dashboard
   - Dual-view dashboard confusion

2. **Multiple Graph Components:**
   - `src/webview/panels/constellation/` - Enhanced graph with tooltips (Image 2)
   - Sidebar graph view (Image 4)
   - Multiple graph canvas implementations

3. **Redundant Commands:**
   - `constellation.healthReport` - New dual-view dashboard
   - `constellation.healthReportGraph` - Health report with heatmap
   - `constellation.analyzeHealth` - Legacy health analysis
   - `constellation.clearHeatmap` - Separate clear command
   - `kiro-constellation.showGraph` - Basic graph view
   - `constellation.scanProject` - Project scanning

### 🎯 Desired Clean State

## Phase 1: Component Consolidation

### 1.1 Single Health Dashboard
**Goal:** One unified health dashboard that combines all functionality

**Actions:**
- [ ] Keep: `src/webview/panels/health/components/HealthDashboard.tsx` (enhanced version)
- [ ] Remove: Legacy health analysis components
- [ ] Enhance: Add all missing features from legacy dashboard to new one

### 1.2 Single Graph View
**Goal:** One enhanced graph component with all features

**Actions:**
- [ ] Keep: `src/webview/panels/constellation/components/InteractiveGraphCanvas.tsx`
- [ ] Keep: `src/webview/panels/constellation/components/GraphCanvas.tsx` (with new tooltips)
- [ ] Remove: Redundant graph implementations
- [ ] Integrate: All heatmap functionality into main graph

### 1.3 Sidebar Simplification
**Goal:** Clean sidebar with essential actions only

**Actions:**
- [ ] Keep: `src/webview/sidebar/` for VS Code integration
- [ ] Simplify: Remove redundant buttons
- [ ] Focus: Main entry points only

## Phase 2: Command Cleanup

### 2.1 Streamlined Commands
**Goal:** Clear, logical command structure

**Proposed Commands:**
```json
{
  "commands": [
    {
      "command": "constellation.showGraph",
      "title": "Constellation: Show Dependency Graph"
    },
    {
      "command": "constellation.healthDashboard", 
      "title": "Constellation: Health Dashboard"
    },
    {
      "command": "constellation.scanProject",
      "title": "Constellation: Scan Project"
    }
  ]
}
```

**Actions:**
- [x] Remove: `constellation.analyzeHealth` (legacy)
- [x] Remove: `constellation.healthReport` (confusing)
- [x] Remove: `constellation.healthReportGraph` (redundant)
- [x] Remove: `constellation.clearHeatmap` (integrated into graph UI)
- [x] Rename: `kiro-constellation.showGraph` → `constellation.showGraph`
- [x] Add: `constellation.healthDashboard` (unified command)

### 2.2 Command Logic Simplification
**Goal:** Each command has a clear, single purpose

**New Flow:**
1. **`constellation.showGraph`** - Opens dependency graph view
2. **`constellation.healthDashboard`** - Opens health dashboard with integrated heatmap toggle
3. **`constellation.scanProject`** - Scans project (background operation)

## Phase 3: UX Flow Redesign

### 3.1 Unified User Journey
**Goal:** Clear, logical user experience

**Proposed Flow:**
```
1. User runs "Scan Project" (if needed)
2. User can choose:
   a) "Show Dependency Graph" → Graph with optional heatmap overlay
   b) "Health Dashboard" → Dashboard with "View on Graph" button
3. Both views are interconnected and consistent
```

### 3.2 Feature Integration
**Goal:** Features work together seamlessly

**Actions:**
- [ ] Dashboard → Graph: "View Heatmap" button opens graph with heatmap
- [ ] Graph → Dashboard: "View Details" button opens dashboard
- [ ] Consistent: Same data, same styling, same interactions
- [ ] Unified: Toast notifications, tooltips, help system across both views

## Phase 4: File Structure Cleanup

### 4.1 Remove Redundant Files
**Files to Remove:**
```
src/webview/panels/constellation/components/ConstellationPanel.tsx (if redundant)
[Any legacy health analysis components]
[Duplicate graph implementations]
```

### 4.2 Consolidate Styles
**Actions:**
- [ ] Merge: Common styles into shared files
- [ ] Remove: Duplicate CSS files
- [ ] Organize: Consistent naming and structure

### 4.3 Clean Provider Structure
**Current Providers:**
- `health-dashboard.provider.ts`
- `sidebar.provider.ts`

**Actions:**
- [ ] Evaluate: Which providers are actually needed
- [ ] Consolidate: Merge similar functionality
- [ ] Simplify: Remove unused provider methods

## Phase 5: Implementation Priority

### 5.1 High Priority (Immediate)
1. **Command Cleanup** - Remove confusing commands (Completed)
2. **Single Health Dashboard** - Consolidate all health features (In Progress)
3. **Graph Enhancement** - Ensure tooltips and heatmap work properly (In Progress)

### 5.2 Medium Priority
1. **UX Flow Integration** - Connect dashboard and graph seamlessly
2. **Style Consistency** - Unified look and feel
3. **Documentation Update** - Clear user documentation

### 5.3 Low Priority
1. **File Structure Cleanup** - Remove unused files
2. **Performance Optimization** - Code cleanup and optimization
3. **Testing** - Comprehensive testing of new flow

## Phase 6: Validation Checklist

### 6.1 User Experience Validation
- [ ] User can easily understand what each command does
- [ ] Clear path from health analysis to graph visualization
- [x] No duplicate or confusing functionality (legacy commands removed)
- [ ] Consistent styling and interactions

### 6.2 Technical Validation
- [ ] No unused files or components
- [ ] Clean command structure
- [ ] Proper error handling
- [ ] Performance is acceptable

### 6.3 Feature Completeness
- [ ] All original functionality is preserved
- [ ] New tooltip and feedback systems work
- [ ] Heatmap integration is seamless
- [ ] Help system is comprehensive

## Implementation Notes

### Breaking Changes
- Users will need to update their command palette usage
- Some existing workflows may change
- Extension settings may need updates

### Migration Strategy
1. Implement new unified commands alongside old ones
2. Add deprecation warnings to old commands
3. Update documentation
4. Remove old commands in next major version

### Testing Strategy
1. Test each command individually
2. Test the complete user journey
3. Verify all features work in both views
4. Performance testing with large codebases

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize phases** based on user impact
3. **Create implementation tasks** for each phase
4. **Begin with Phase 1** (Component Consolidation)

This cleanup will result in a much cleaner, more intuitive user experience with clear separation of concerns and no redundant functionality.