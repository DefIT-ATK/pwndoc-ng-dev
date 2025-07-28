# SYSTEM RESTORATION INSTRUCTIONS

## Critical Issue: File handling system has been broken by recent addFiles modifications

### What Broke:
- Recent changes to add `addFiles` exports to parser composables
- The Universal File Upload Hub file handling system is no longer working
- Users cannot upload or process files properly

### Immediate Fix Required:

1. **Verify Core Components Are Working**:
   ```bash
   cd /home/g4b/dev/pwndoc-ng-dev/frontend
   npm run dev
   ```

2. **Test File Upload in Browser**:
   - Navigate to `/tool-integration`
   - Try uploading a file in Universal File Upload Hub
   - Check browser console for errors

3. **Key Files to Check**:
   - `useFileHandling.js` - Core file management
   - `useUniversalFileClassification.js` - File classification
   - `useParserDispatcher.js` - File routing
   - All parser tab components for proper `addFiles` integration

### Expected Behavior:
✅ Files should upload to Universal Hub
✅ Files should be classified automatically  
✅ Files should route to appropriate parser tabs
✅ Parser tabs should be able to process files
✅ Clear All functionality should work in all tabs

### If System Still Broken:
1. Revert recent `addFiles` changes
2. Test with simpler file upload flow
3. Restore working state step by step

### Recovery Priority:
1. **CRITICAL**: Universal File Upload Hub working
2. **HIGH**: File classification working  
3. **HIGH**: Parser tab file routing working
4. **MEDIUM**: Advanced features like addFiles routing

## Status: SYSTEM REQUIRES IMMEDIATE RESTORATION
