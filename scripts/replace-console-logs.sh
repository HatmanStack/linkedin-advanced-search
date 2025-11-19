#!/bin/bash

# Script to replace console.log/error/warn with logger calls
# This is a helper script for refactoring console statements to use the centralized logger

echo "Replacing console statements with logger..."

# Files to process (excluding logger.ts itself)
files=(
  "src/config/appConfig.ts"
  "src/pages/Profile.tsx"
  "src/pages/Dashboard.tsx"
  "src/shared/utils/errorHandling.ts"
  "src/shared/hooks/useLocalStorage.ts"
  "src/shared/services/lambdaApiService.ts"
  "src/shared/services/puppeteerApiService.ts"
  "src/features/connections/components/NewConnectionCard.tsx"
  "src/shared/types/validators.ts"
  "src/features/posts/contexts/PostComposerContext.tsx"
  "src/features/messages/components/MessageModal.tsx"
  "src/features/connections/components/NewConnectionsTab.tsx"
  "src/features/messages/services/messageGenerationService.ts"
  "src/features/posts/components/NewPostTab.tsx"
  "src/features/posts/services/postsService.ts"
  "src/features/posts/components/PostAIAssistant.tsx"
  "src/features/posts/components/PostEditor.tsx"
  "src/features/workflow/contexts/HealAndRestoreContext.tsx"
  "src/features/auth/services/cognitoService.ts"
  "src/features/workflow/services/healAndRestoreService.ts"
  "src/features/workflow/services/workflowProgressService.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Check if logger import already exists
    if ! grep -q "from '@/shared/utils/logger'" "$file"; then
      echo "  Adding logger import..."
      # This is a placeholder - actual import addition needs manual review
      echo "  ⚠️  Manual import needed for $file"
    fi

    echo "  ✓ Marked for review: $file"
  else
    echo "  ⚠️  File not found: $file"
  fi
done

echo ""
echo "Next steps:"
echo "1. Manually add logger imports to files marked above"
echo "2. Replace console.log() with logger.info()"
echo "3. Replace console.error() with logger.error()"
echo "4. Replace console.warn() with logger.warn()"
echo "5. Replace console.debug() with logger.debug()"
echo ""
echo "Pattern examples:"
echo "  console.log('message') → logger.info('message')"
echo "  console.error('error:', err) → logger.error('error', { error: err })"
echo "  console.warn('warning') → logger.warn('warning')"
