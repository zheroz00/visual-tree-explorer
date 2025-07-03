# Visual Tree Explorer Enhancement Plan

## Current Status
- ✅ Core functionality working (tree visualization, symbols, previews)
- ✅ Reddit community feedback positive
- ✅ Basic MCP server implementation complete

## Priority Enhancements

### 1. Git Status Integration 🔥 HIGH PRIORITY
**Goal**: Show git status directly in tree view
**Value**: Immediate workflow improvement for developers

**Implementation Plan**:
- Add git status checking via `git status --porcelain` 
- Enhance file display with status indicators:
  - `M` - Modified files (yellow indicator)
  - `A` - Added files (green indicator) 
  - `D` - Deleted files (red indicator)
  - `??` - Untracked files (blue indicator)
  - `!!` - Ignored files (gray indicator)
- Add new parameter: `show_git_status: boolean = false`
- Gracefully handle non-git directories

**Example Output**:
```
src/components/
├── 📝 LeadPipeline.tsx (245 lines, 8.5KB) 🟡 M
├── 📝 types.ts (45 lines, 1.2KB) 🟢 A
└── 📝 NewComponent.tsx (120 lines, 4.1KB) 🔵 ??
```

**Technical Details**:
- Use `child_process.exec` to run git commands
- Parse porcelain output for reliable status
- Cache git status per directory to avoid repeated calls
- Add error handling for non-git repositories

### 2. Search Within Tree 🔥 HIGH PRIORITY  
**Goal**: Filter tree output by search terms
**Value**: Navigate large codebases efficiently

**Implementation Plan**:
- Add `search` parameter for filtering
- Support multiple search modes:
  - File name search: `search: "Pipeline"`
  - Symbol search: `search: "function:handleDrop"`
  - Content search: `search: "content:useState"`
- Show search results with context and highlighting
- Maintain tree structure for matched items

**Example Usage**:
```typescript
explore_tree({
  path: "src",
  search: "Pipeline",
  depth: 4
})
```

**Technical Details**:
- Implement search filtering in tree traversal
- Add search term highlighting in output
- Support regex patterns for advanced search
- Maintain parent directory context for results

### 3. AST-Based Symbol Extraction 🔶 MEDIUM PRIORITY
**Goal**: More accurate symbol detection
**Value**: Better TypeScript/JavaScript parsing

**Implementation Plan**:
- Replace regex-based symbol extraction with AST parsing
- Use `@babel/parser` or `typescript` compiler API
- Extract more symbol types:
  - Generic types and constraints
  - Decorators and annotations
  - JSX components and props
  - Arrow functions vs regular functions
- Show more detailed symbol information

**Benefits**:
- Handle complex TypeScript patterns
- Detect JSX components accurately  
- Parse modern JavaScript syntax
- Show type information and generics

### 4. File Change Detection 🔶 MEDIUM PRIORITY
**Goal**: Show file modification times and recent changes
**Value**: Understand code evolution and activity

**Implementation Plan**:
- Add file `mtime` to file info
- Show "last modified" timestamps
- Add `recent_changes` parameter to highlight recent files
- Option to sort by modification time

**Example Output**:
```
├── 📝 LeadPipeline.tsx (245 lines, 8.5KB) 🕒 2h ago
├── 📝 types.ts (45 lines, 1.2KB) 🕒 1d ago
```

### 5. Dependency Graph Visualization 🔶 LOW PRIORITY
**Goal**: Show import/export relationships between files
**Value**: Understand module dependencies

**Implementation Plan**:
- Track import/export relationships
- Generate dependency graph data
- Show circular dependencies
- Add `show_dependencies` parameter

## Implementation Order

### Phase 1: Core Enhancements (Week 1-2)
1. **Git Status Integration** - Most requested feature
2. **Search Within Tree** - High usability impact

### Phase 2: Advanced Features (Week 3-4)  
3. **AST-Based Symbol Extraction** - Better accuracy
4. **File Change Detection** - Workflow improvement

### Phase 3: Advanced Visualizations (Future)
5. **Dependency Graph** - Advanced analysis
6. **Performance Metrics** - File complexity analysis
7. **Custom Icon Themes** - Personalization

## Technical Considerations

### Performance
- Cache git status results per directory
- Implement streaming for large search results
- Add configurable timeouts for git operations
- Optimize AST parsing for large files

### Error Handling
- Graceful degradation when git not available
- Handle permission errors for git commands
- Timeout protection for slow git operations
- Clear error messages for users

### Backward Compatibility
- All new features behind optional parameters
- Maintain existing API contract
- Default behavior unchanged

## Success Metrics
- Community engagement and feedback
- Usage analytics from MCP integration
- Performance benchmarks
- Error rate reduction

## Next Steps
1. Analyze current codebase structure
2. Start with git status integration
3. Get community feedback on progress
4. Iterate based on real-world usage

---

*This plan prioritizes user value and development workflow improvements while maintaining the tool's core simplicity and performance.*